import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

export type ProviderFixtureMode = "success" | "stream" | "400" | "401" | "403" | "404" | "408" | "429" | "500" | "502" | "503" | "malformed" | "truncated" | "oversized" | "close-mid-stream" | "slow-stream" | "stream-provider-error" | "malformed-stream" | "oversized-stream" | "delay" | "redirect" | "unsafe-redirect" | "unexpected-content-type";
export type CapturedProviderRequest = { authorization?: string; contentType?: string; body: string };

export class LocalProviderHttpFixture {
  private server?: Server;
  mode: ProviderFixtureMode = "success";
  delayMs = 100;
  captured: CapturedProviderRequest[] = [];
  cancellationCount = 0;

  async start(): Promise<string> {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("close", () => { if (!response.writableEnded) this.cancellationCount += 1; });
      request.on("end", () => {
        this.captured.push({ authorization: request.headers.authorization, contentType: request.headers["content-type"], body: Buffer.concat(chunks).toString("utf8") });
        const mode = this.mode;
        const errors: Partial<Record<ProviderFixtureMode, number>> = { "400": 400, "401": 401, "403": 403, "404": 404, "408": 408, "429": 429, "500": 500, "502": 502, "503": 503 };
        const errorStatus = errors[mode];
        if (errorStatus !== undefined) { response.writeHead(errorStatus, { "content-type": "application/json" }); response.end('{"error":"fixture-only"}'); return; }
        if (mode === "redirect" || mode === "unsafe-redirect") { response.writeHead(302, { location: mode === "unsafe-redirect" ? "http://127.0.0.1/private" : "/redirected" }); response.end(); return; }
        if (mode === "delay") { setTimeout(() => { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content: "late" } }] })); }, this.delayMs); return; }
        if (mode === "malformed") { response.writeHead(200, { "content-type": "application/json" }); response.end("{"); return; }
        if (mode === "truncated") { response.writeHead(200, { "content-type": "application/json", "content-length": "100" }); response.write('{"choices":'); response.destroy(); return; }
        if (mode === "oversized") { response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content: "x".repeat(2 * 1024 * 1024 + 1) } }] })); return; }
        if (mode === "unexpected-content-type") { response.writeHead(200, { "content-type": "text/html" }); response.end("<html>no</html>"); return; }
        if (mode === "stream" || mode === "slow-stream" || mode === "close-mid-stream" || mode === "stream-provider-error" || mode === "malformed-stream" || mode === "oversized-stream") {
          response.writeHead(200, { "content-type": "text/event-stream" });
          const responses = request.url?.includes("/responses") ?? false;
          const first = responses ? 'data: {"type":"response.output_text.delta","delta":"part-1"}\n\n' : 'data: {"choices":[{"delta":{"content":"part-1"}}]}\n\n';
          const second = responses ? 'data: {"type":"response.output_text.delta","delta":"part-2"}\n\n' : 'data: {"choices":[{"delta":{"content":"part-2"}}]}\n\n';
          response.write(first);
          const sendSecond = () => {
            if (response.destroyed) return;
            if (mode === "stream-provider-error") { response.end('data: {"error":{"message":"secret fixture detail"}}\n\n'); return; }
            if (mode === "malformed-stream") { response.end("data: {malformed-json}\n\ndata: [DONE]\n\n"); return; }
            if (mode === "oversized-stream") { response.end(`data: ${JSON.stringify({ choices: [{ delta: { content: "x".repeat(300 * 1024) } }] })}\n\ndata: [DONE]\n\n`); return; }
            response.write(second);
            if (mode === "close-mid-stream") { setTimeout(() => response.destroy(), 10); return; }
            if (responses) response.end('data: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":3,"input_tokens_details":{"cached_tokens":2}}}}\n\n');
            else { response.write('data: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":3,"prompt_tokens_details":{"cached_tokens":2}}}\n\n'); response.end("data: [DONE]\n\n"); }
          };
          if (mode === "slow-stream") setTimeout(sendSecond, this.delayMs); else sendSecond();
          return;
        }
        response.writeHead(200, { "content-type": "application/json" });
        if (request.method === "GET") { response.end(JSON.stringify({ data: [{ id: "fixture-model" }] })); return; }
        if (request.url?.includes("/responses")) response.end(JSON.stringify({ status: "completed", output_text: "fixture answer", usage: { input_tokens: 11, output_tokens: 4, input_tokens_details: { cached_tokens: 2 }, output_tokens_details: { reasoning_tokens: 1 } } }));
        else response.end(JSON.stringify({ choices: [{ message: { content: "fixture answer" }, finish_reason: "stop" }], usage: { prompt_tokens: 11, completion_tokens: 4, prompt_tokens_details: { cached_tokens: 2 }, completion_tokens_details: { reasoning_tokens: 1 } } }));
      });
    });
    await new Promise<void>((resolve, reject) => { this.server!.once("error", reject); this.server!.listen(0, "127.0.0.1", () => resolve()); });
    const address = this.server.address() as AddressInfo;
    return `http://provider-fixture.test:${address.port}/v1`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = undefined;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
