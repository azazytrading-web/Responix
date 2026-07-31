import { BadRequestException } from "@nestjs/common";
import { ToolPolicyValidator } from "./tool-policy.validator";
import type { ToolRuntimeSnapshot } from "./tool-runtime.types";

describe("ToolPolicyValidator", () => {
  const validator = new ToolPolicyValidator();
  const snapshot = { type: "HTTP", authenticationType: "NONE",
    providerMetadata: { endpoint: "https://api.example.com/items" },
    executionPolicyMetadata: { allowedMethods: ["GET"], allowedDestinations: ["api.example.com"],
      allowedHeaders: ["accept"], allowedMimeTypes: ["application/json"], maximumResponseBytes: 1000,
      maximumExecutionMs: 5000 }, timeoutMetadata: {}, rateLimitMetadata: {}
  } as unknown as ToolRuntimeSnapshot;

  it("resolves and enforces destination, method, header, MIME, size, and timeout policy", () => {
    const policy = validator.resolve(snapshot);
    expect(policy).toMatchObject({ allowedMethods: ["GET"], maximumResponseBytes: 1000,
      maximumExecutionMs: 5000 });
    expect(() => validator.validateHttp(snapshot, "GET", "https://api.example.com/items",
      { accept: "application/json" }, "application/json", policy)).not.toThrow();
    expect(() => validator.validateHttp(snapshot, "POST", "https://api.example.com/items",
      {}, "application/json", policy)).toThrow(BadRequestException);
    expect(() => validator.validateHttp(snapshot, "GET", "https://evil.example/items",
      {}, "application/json", policy)).toThrow(BadRequestException);
  });

  it("rejects unsafe headers and unresolved authentication secrets", () => {
    expect(() => validator.resolve({ ...snapshot, executionPolicyMetadata: {
      ...snapshot.executionPolicyMetadata, allowedHeaders: ["authorization"] } })).toThrow(BadRequestException);
    const authenticated = { ...snapshot, authenticationType: "API_KEY",
      authenticationMetadata: {} } as ToolRuntimeSnapshot;
    expect(() => validator.validateHttp(authenticated, "GET", "https://api.example.com", {},
      "application/json", validator.resolve(authenticated))).toThrow(BadRequestException);
  });
});
