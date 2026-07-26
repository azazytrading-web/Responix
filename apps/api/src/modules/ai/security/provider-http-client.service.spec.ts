import { EventEmitter } from "node:events";
import { request as httpsRequest } from "node:https";
import { ProviderDestinationRejectedError } from "./provider-destination-policy.service";
import {
  ProviderHttpClient,
  ProviderNetworkTimeoutError,
  ProviderResponseTooLargeError
} from "./provider-http-client.service";

jest.mock("node:https", () => ({
  request: jest.fn()
}));

type ResponsePlan = {
  status?: number;
  headers?: Record<string, string>;
  chunks?: Buffer[];
  emitEnd?: boolean;
  secureConnect?: boolean;
  emitResponse?: boolean;
};

class FakeResponse extends EventEmitter {
  statusCode: number;
  headers: Record<string, string>;

  constructor(plan: ResponsePlan) {
    super();
    this.statusCode = plan.status ?? 200;
    this.headers = plan.headers ?? {};
  }

  destroy(error?: Error): void {
    if (error) this.emit("error", error);
  }
}

class FakeRequest extends EventEmitter {
  constructor(private readonly run: () => void) {
    super();
  }

  end(): void {
    this.run();
  }

  destroy(error?: Error): void {
    this.emit("error", error ?? new Error("Request destroyed"));
  }
}

function createClient(plan: ResponsePlan) {
  const policy = {
    authorize: jest.fn().mockResolvedValue({
      url: new URL("https://api.openai.com/v1/chat/completions"),
      hostname: "api.openai.com",
      address: "104.18.26.120",
      family: 4,
      port: 443
    })
  };
  const values: Record<string, number> = {
    "ai.network.connectionTimeoutMs": 20,
    "ai.network.readTimeoutMs": 20,
    "ai.requestTimeoutMs": 100,
    "ai.network.maxResponseBytes": 100
  };
  const config = { getOrThrow: (key: string) => values[key] };
  let request: FakeRequest;
  let response: FakeResponse;
  let socket: EventEmitter;
  let requestOptions: Record<string, unknown> | undefined;
  const requestMock = httpsRequest as unknown as jest.Mock;
  requestMock.mockImplementation(
    (_url: URL, options: Record<string, unknown>, callback: (incoming: FakeResponse) => void) => {
      requestOptions = options;
      response = new FakeResponse(plan);
      socket = new EventEmitter();
      request = new FakeRequest(() => {
        request.emit("socket", socket);
        if (plan.secureConnect !== false) socket.emit("secureConnect");
        if (plan.emitResponse !== false) {
          callback(response);
          for (const chunk of plan.chunks ?? []) response.emit("data", chunk);
          if (plan.emitEnd !== false) response.emit("end");
        }
      });
      return request;
    }
  );
  return {
    client: new ProviderHttpClient(policy as never, config as never),
    policy,
    request: () => request!,
    requestOptions: () => requestOptions!
  };
}

const requestInput = {
  provider: "OpenAI",
  url: "https://api.openai.com/v1/chat/completions",
  authorization: "Bearer provider-secret",
  body: JSON.stringify({ model: "gpt", messages: [] }),
  signal: new AbortController().signal
};

describe("ProviderHttpClient", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("pins the request lookup to the policy-approved address", async () => {
    const fixture = createClient({ chunks: [Buffer.from("{}")] });
    await expect(fixture.client.postJson(requestInput)).resolves.toMatchObject({
      status: 200,
      body: "{}",
      bytes: 2
    });
    const lookup = fixture.requestOptions().lookup as (
      hostname: string,
      options: unknown,
      callback: (error: Error | null, address: string, family: number) => void
    ) => void;
    const callback = jest.fn();
    lookup("api.openai.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "104.18.26.120", 4);
    expect(fixture.requestOptions()).toMatchObject({
      agent: false,
      servername: "api.openai.com",
      rejectUnauthorized: true
    });
  });

  it("rejects redirects without following them", async () => {
    const fixture = createClient({ status: 302, headers: { location: "https://attacker.test" } });
    await expect(fixture.client.postJson(requestInput)).rejects.toBeInstanceOf(
      ProviderDestinationRejectedError
    );
  });

  it("rejects an oversized declared response before buffering", async () => {
    const fixture = createClient({ headers: { "content-length": "101" } });
    await expect(fixture.client.postJson(requestInput)).rejects.toBeInstanceOf(
      ProviderResponseTooLargeError
    );
  });

  it("aborts immediately when streamed response bytes exceed the limit", async () => {
    const fixture = createClient({
      chunks: [Buffer.alloc(60), Buffer.alloc(41)]
    });
    await expect(fixture.client.postJson(requestInput)).rejects.toBeInstanceOf(
      ProviderResponseTooLargeError
    );
  });

  it("propagates caller abort and discards late completion", async () => {
    const controller = new AbortController();
    const fixture = createClient({ emitResponse: false });
    const invocation = fixture.client.postJson({ ...requestInput, signal: controller.signal });
    controller.abort(new Error("caller aborted"));
    await expect(invocation).rejects.toThrow("caller aborted");
  });

  it("enforces connection timeout", async () => {
    jest.useFakeTimers();
    const fixture = createClient({ secureConnect: false, emitResponse: false });
    const invocation = fixture.client.postJson(requestInput);
    await Promise.resolve();
    jest.advanceTimersByTime(21);
    await expect(invocation).rejects.toBeInstanceOf(ProviderNetworkTimeoutError);
  });

  it("enforces read timeout", async () => {
    jest.useFakeTimers();
    const fixture = createClient({ emitEnd: false });
    const invocation = fixture.client.postJson(requestInput);
    await Promise.resolve();
    jest.advanceTimersByTime(21);
    await expect(invocation).rejects.toBeInstanceOf(ProviderNetworkTimeoutError);
  });
});
