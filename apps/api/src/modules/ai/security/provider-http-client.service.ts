import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import type { LookupFunction } from "node:net";
import {
  ProviderDestinationPolicy,
  ProviderDestinationRejectedError
} from "./provider-destination-policy.service";

export class ProviderResponseTooLargeError extends Error {
  constructor() {
    super("Provider response exceeded the maximum allowed size");
    this.name = "ProviderResponseTooLargeError";
  }
}

export class ProviderNetworkTimeoutError extends Error {
  constructor(stage: "connection" | "read" | "provider") {
    super(`Provider ${stage} timeout`);
    this.name = "ProviderNetworkTimeoutError";
  }
}

export interface ProviderHttpResponse {
  status: number;
  body: string;
  bytes: number;
}

@Injectable()
export class ProviderHttpClient {
  private readonly logger = new Logger(ProviderHttpClient.name);

  constructor(
    private readonly policy: ProviderDestinationPolicy,
    private readonly config: ConfigService
  ) {}

  async postJson(input: {
    provider: string;
    url: string;
    authorization?: string;
    headers?: Readonly<Record<string, string>>;
    body: string;
    signal: AbortSignal;
  }): Promise<ProviderHttpResponse> {
    const destination = await this.policy.authorize(input.url);
    const startedAt = Date.now();
    let status: number | string = "failed";
    let bytes = 0;
    try {
      const response = await this.execute({
        ...input,
        url: destination.url,
        hostname: destination.hostname,
        address: destination.address,
        family: destination.family
      });
      status = response.status;
      bytes = response.bytes;
      return response;
    } finally {
      this.logger.log({
        provider: input.provider,
        host: destination.hostname,
        duration: Date.now() - startedAt,
        status,
        bytes
      });
    }
  }

  async postSse(input: {
    provider: string;
    url: string;
    authorization?: string;
    headers?: Readonly<Record<string, string>>;
    body: string;
    signal: AbortSignal;
    onEvent: (event: { event?: string; data: string; id?: string }) => Promise<void>;
  }): Promise<{ status: number }> {
    const destination = await this.policy.authorize(input.url);
    const connectionTimeoutMs = this.config.getOrThrow<number>("ai.network.connectionTimeoutMs");
    const readTimeoutMs = this.config.getOrThrow<number>("ai.network.readTimeoutMs");
    const providerTimeoutMs = this.config.getOrThrow<number>("ai.requestTimeoutMs");
    const lookup: LookupFunction = (_hostname, _options, callback) => {
      callback(null, destination.address, destination.family);
    };
    return new Promise((resolve, reject) => {
      let settled = false;
      let connectionTimer: ReturnType<typeof setTimeout> | undefined;
      let readTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error, status?: number): void => {
        if (settled) return;
        settled = true;
        clearTimeout(providerTimer);
        if (connectionTimer) clearTimeout(connectionTimer);
        if (readTimer) clearTimeout(readTimer);
        input.signal.removeEventListener("abort", abort);
        if (error) reject(error); else resolve({ status: status ?? 502 });
      };
      const request = httpsRequest(destination.url, {
        method: "POST", agent: false, lookup, servername: destination.hostname,
        rejectUnauthorized: true,
        headers: {
          ...(input.authorization ? { authorization: input.authorization } : {}),
          ...input.headers, accept: "text/event-stream", "content-type": "application/json",
          "content-length": Buffer.byteLength(input.body)
        }
      }, (response) => {
        if (this.isRedirect(response)) {
          response.destroy(); request.destroy(new ProviderDestinationRejectedError("Provider redirects are disabled")); return;
        }
        const status = response.statusCode ?? 502;
        if (status < 200 || status >= 300) { response.resume(); finish(undefined, status); return; }
        let buffer = "";
        let chain = Promise.resolve();
        const reset = () => {
          if (readTimer) clearTimeout(readTimer);
          readTimer = setTimeout(() => request.destroy(new ProviderNetworkTimeoutError("read")), readTimeoutMs);
        };
        response.on("data", (chunk: Buffer | string) => {
          response.pause(); reset(); buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
          const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() ?? "";
          for (const block of blocks) chain = chain.then(async () => {
            const lines = block.split(/\r?\n/); const data = lines.filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart()).join("\n");
            if (!data) return;
            const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
            const id = lines.find((line) => line.startsWith("id:"))?.slice(3).trim();
            await input.onEvent({ ...(event ? { event } : {}), data, ...(id ? { id } : {}) });
          });
          chain.then(() => response.resume(), (error: unknown) => request.destroy(error instanceof Error ? error : new Error("SSE handler failed")));
        });
        response.once("error", (error) => finish(error));
        response.once("end", () => { chain.then(() => finish(undefined, status), (error: unknown) => finish(error instanceof Error ? error : new Error("SSE handler failed"))); });
        reset();
      });
      const providerTimer = setTimeout(() => request.destroy(new ProviderNetworkTimeoutError("provider")), providerTimeoutMs);
      const abort = () => request.destroy(input.signal.reason instanceof Error ? input.signal.reason : new Error("Aborted"));
      request.once("socket", (socket) => { connectionTimer = setTimeout(() => request.destroy(new ProviderNetworkTimeoutError("connection")), connectionTimeoutMs); socket.once("secureConnect", () => { if (connectionTimer) clearTimeout(connectionTimer); }); });
      request.once("error", (error) => finish(error));
      if (input.signal.aborted) abort(); else input.signal.addEventListener("abort", abort, { once: true });
      request.end(input.body);
    });
  }

  private execute(input: {
    url: URL;
    hostname: string;
    address: string;
    family: 4 | 6;
    authorization?: string;
    headers?: Readonly<Record<string, string>>;
    body: string;
    signal: AbortSignal;
  }): Promise<ProviderHttpResponse> {
    const connectionTimeoutMs = this.config.getOrThrow<number>("ai.network.connectionTimeoutMs");
    const readTimeoutMs = this.config.getOrThrow<number>("ai.network.readTimeoutMs");
    const providerTimeoutMs = this.config.getOrThrow<number>("ai.requestTimeoutMs");
    const maximumBytes = this.config.getOrThrow<number>("ai.network.maxResponseBytes");
    const lookup: LookupFunction = (_hostname, _options, callback) => {
      callback(null, input.address, input.family);
    };

    return new Promise<ProviderHttpResponse>((resolve, reject) => {
      let settled = false;
      let connectionTimer: ReturnType<typeof setTimeout> | undefined;
      let readTimer: ReturnType<typeof setTimeout> | undefined;
      const providerTimer = setTimeout(() => {
        if (!settled) request.destroy(new ProviderNetworkTimeoutError("provider"));
      }, providerTimeoutMs);

      const finish = (error?: Error, response?: ProviderHttpResponse): void => {
        if (settled) return;
        settled = true;
        clearTimeout(providerTimer);
        if (connectionTimer) clearTimeout(connectionTimer);
        if (readTimer) clearTimeout(readTimer);
        input.signal.removeEventListener("abort", abort);
        if (error) reject(error);
        else if (response) resolve(response);
      };
      const resetReadTimer = (): void => {
        if (readTimer) clearTimeout(readTimer);
        readTimer = setTimeout(() => {
          if (!settled) request.destroy(new ProviderNetworkTimeoutError("read"));
        }, readTimeoutMs);
      };
      const abort = (): void => {
        request.destroy(
          input.signal.reason instanceof Error ? input.signal.reason : new Error("Aborted")
        );
      };
      const request = httpsRequest(
        input.url,
        {
          method: "POST",
          agent: false,
          lookup,
          servername: input.hostname,
          rejectUnauthorized: true,
          headers: {
            ...(input.authorization ? { authorization: input.authorization } : {}),
            ...input.headers,
            "content-type": "application/json",
            "content-length": Buffer.byteLength(input.body)
          }
        },
        (response) => {
          if (this.isRedirect(response)) {
            response.destroy();
            request.destroy(
              new ProviderDestinationRejectedError("Provider redirects are disabled")
            );
            return;
          }
          const declaredLength = Number.parseInt(response.headers["content-length"] ?? "0", 10);
          if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
            response.destroy();
            request.destroy(new ProviderResponseTooLargeError());
            return;
          }
          this.readResponse(response, maximumBytes, resetReadTimer, finish);
        }
      );

      request.once("socket", (socket) => {
        connectionTimer = setTimeout(() => {
          if (!settled) request.destroy(new ProviderNetworkTimeoutError("connection"));
        }, connectionTimeoutMs);
        socket.once("secureConnect", () => {
          if (connectionTimer) clearTimeout(connectionTimer);
          resetReadTimer();
        });
      });
      request.on("error", (error) => finish(error));
      if (input.signal.aborted) abort();
      else input.signal.addEventListener("abort", abort, { once: true });
      request.end(input.body);
    });
  }

  private readResponse(
    response: IncomingMessage,
    maximumBytes: number,
    resetReadTimer: () => void,
    finish: (error?: Error, response?: ProviderHttpResponse) => void
  ): void {
    const chunks: Buffer[] = [];
    let bytes = 0;
    resetReadTimer();
    response.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > maximumBytes) {
        response.destroy(new ProviderResponseTooLargeError());
        return;
      }
      chunks.push(buffer);
      resetReadTimer();
    });
    response.once("error", (error) => finish(error));
    response.once("end", () => {
      finish(undefined, {
        status: response.statusCode ?? 502,
        body: Buffer.concat(chunks, bytes).toString("utf8"),
        bytes
      });
    });
  }

  private isRedirect(response: IncomingMessage): boolean {
    const status = response.statusCode ?? 0;
    return status >= 300 && status < 400;
  }
}
