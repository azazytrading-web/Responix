import "reflect-metadata";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import type { IncomingMessage } from "node:http";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { encryptProviderCredential } from "./provider-credential.crypto";
import { ProviderControlService } from "./provider-control.service";
import { LocalProviderHttpFixture } from "../runtime-plane/provider-http.fixture";

void test("Provider Connection Test uses a bounded fixture request without activating or disclosing secrets", async (t) => {
  const fixture = new LocalProviderHttpFixture();
  const previousKey = process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
  process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const endpointUrl = await fixture.start();
  const connectionId = "connection-fixture";
  const secret = "connection-fixture-secret";
  const encrypted = encryptProviderCredential(secret, connectionId, 1);
  const connection = {
    id: connectionId, scope: "APPLICATION", applicationId: "app-fixture", tenantId: null,
    providerDefinitionId: "provider-def", displayName: "Loopback test only", endpointUrl,
    transportProfile: "openai-chat-completions-v1", status: "SUSPENDED", healthStatus: "UNKNOWN", lastValidatedAt: null,
    providerDefinition: { authStrategy: "BEARER" }
  };
  const credential = { connectionId, version: 1, status: "ACTIVE", ...encrypted };
  const audit: Array<Record<string, unknown>> = [];
  const healthChecks: Array<Record<string, unknown>> = [];
  const actor: AuthenticatedPrincipal = { id: "internal-admin", applicationId: connection.applicationId, scopes: ["oic:connections:manage"], tenantIds: [] };
  const db = {
    oicProviderConnection: { findUnique: () => Promise.resolve(connection), update: ({ data }: { data: Record<string, unknown> }) => { Object.assign(connection, data); return Promise.resolve(connection); } },
    oicProviderCredential: { findFirst: () => Promise.resolve(credential) },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) => operation({
      oicProviderHealthCheck: { create: ({ data }: { data: Record<string, unknown> }) => { healthChecks.push(data); return Promise.resolve(data); } },
      oicProviderConnection: { update: ({ data }: { data: Record<string, unknown> }) => { Object.assign(connection, data); return Promise.resolve(connection); } },
      oicAuditEvent: { create: ({ data }: { data: Record<string, unknown> }) => { audit.push(data); return Promise.resolve(data); } }
    })
  };
  const service = ProviderControlService.forTest(db as never, {
    timeoutMs: 75,
    resolveEndpoint(input) {
      const url = new URL(input);
      if (url.hostname !== "provider-fixture.test" || url.protocol !== "http:") throw new Error("fixture endpoint rejected");
      return Promise.resolve({ url, hostname: url.hostname, addresses: [{ address: "127.0.0.1", family: 4 }] });
    },
    request(url, headers, timeoutMs) {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let incoming: IncomingMessage | undefined;
        const req = httpRequest(url, {
          method: "GET", headers, timeout: timeoutMs,
          lookup: (_hostname, options, callback) => options.all
            ? callback(null, [{ address: "127.0.0.1", family: 4 }])
            : callback(null, "127.0.0.1", 4)
        }, (response) => {
          incoming = response;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 64 * 1024) response.destroy(new Error("provider test response bound exceeded"));
            else chunks.push(chunk);
          });
          response.on("error", reject);
          response.on("end", () => resolve({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks), contentType: response.headers["content-type"] ?? "" }));
        });
        req.on("timeout", () => {
          const error = new Error("provider test timeout");
          if (incoming) incoming.destroy(error);
          else req.destroy(error);
        });
        req.on("error", reject);
        req.end();
      });
    }
  });

  try {
    await t.test("valid fixture probe records safe evidence, keeps connection suspended and redacts credential", async () => {
      fixture.mode = "success";
      const result = await service.testConnection(actor, connectionId, "req-id", "trace-id");
      assert.equal(result.healthy, true);
      assert.equal(result.diagnosticCode, "CONNECTION_OK");
      assert.equal(connection.status, "SUSPENDED");
      assert.equal(fixture.captured.at(-1)?.authorization, `Bearer ${secret}`);
      assert.equal(JSON.stringify(result).includes(secret), false);
      assert.equal(JSON.stringify(audit).includes(secret), false);
      assert.equal(JSON.stringify(healthChecks).includes(secret), false);
      assert.equal(healthChecks.length, 1);
    });

    await t.test("auth, rate limit, server, malformed body and timeout diagnostics normalize", async () => {
      const cases = [
        ["401", "PROVIDER_AUTHENTICATION_FAILED"], ["403", "PROVIDER_AUTHORIZATION_FAILED"],
        ["408", "PROVIDER_TIMEOUT"], ["429", "PROVIDER_RATE_LIMITED"], ["500", "PROVIDER_REJECTED"],
        ["malformed", "PROVIDER_RESPONSE_INVALID"], ["unexpected-content-type", "PROVIDER_RESPONSE_INVALID"], ["delay", "PROVIDER_TIMEOUT"]
      ] as const;
      for (const [mode, code] of cases) {
        fixture.mode = mode;
        const result = await service.testConnection(actor, connectionId);
        assert.equal(result.healthy, false);
        assert.equal(result.diagnosticCode, code);
        assert.equal(connection.status, "SUSPENDED");
      }
    });

    await t.test("cross-Application access is concealed before any fixture request", async () => {
      const before = fixture.captured.length;
      await assert.rejects(service.testConnection({ ...actor, applicationId: "other-app" }, connectionId));
      assert.equal(fixture.captured.length, before);
    });
  } finally {
    await fixture.stop();
    if (previousKey === undefined) delete process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY;
    else process.env.OIC_PROVIDER_CREDENTIAL_ENCRYPTION_KEY = previousKey;
  }
});
