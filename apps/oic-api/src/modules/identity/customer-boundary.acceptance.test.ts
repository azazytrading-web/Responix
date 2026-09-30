import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { OicAuthenticationGuard, OicScopeGuard } from "./auth.guard";
import type { AuthenticatedPrincipal } from "./auth.guard";
import { parseOicRuntimeRequest } from "../runtime-plane/runtime-request";
import { OicRuntimeException } from "../runtime-plane/runtime-errors";

void test("customer-side identities and caller-supplied ownership metadata do not authenticate to OIC", async () => {
  const db = { oicMachineCredential: { findUnique: () => Promise.resolve(null) } };
  const guard = new OicAuthenticationGuard(db as never);
  const context = (headers: Record<string, string | string[] | undefined>) => ({ switchToHttp: () => ({ getRequest: () => ({ headers, ip: "198.51.100.42" }) }) }) as unknown as ExecutionContext;
  for (const headers of [
    { "x-workspace-id": "workspace-customer-a" },
    { "x-workspace-id": "workspace-customer-a", authorization: "Bearer customer_api_abcdefghijklmnop" },
    { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0b21lciJ9.signature" },
    { authorization: "Bearer oic_v1.AAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "x-oic-application-id": "app-spoof", "x-tenant-id": "tenant-spoof" }
  ]) await assert.rejects(guard.canActivate(context(headers)), UnauthorizedException);
  assert.throws(() => parseOicRuntimeRequest({ model: "oi-core", input: [{ speaker: "user", content: [{ type: "text", text: "hello" }] }], applicationId: "caller-selected-app", tenantId: "caller-selected-tenant" }), OicRuntimeException);
});

void test("customer application principal cannot access OIC provider or model administration scopes", () => {
  const customer: AuthenticatedPrincipal = { id: "customer", applicationId: "app", scopes: ["product:api:invoke"], tenantIds: [] };
  const reflector = { getAllAndOverride: (_key: string, handlers: unknown[]) => handlers.includes("provider-controller") ? ["oic:providers:read"] : ["oic:models:manage"] } as unknown as Reflector;
  const guard = new OicScopeGuard(reflector);
  const context = (handler: string) => ({ switchToHttp: () => ({ getRequest: () => ({ principal: customer }) }), getHandler: () => handler, getClass: () => "controller" }) as unknown as ExecutionContext;
  assert.throws(() => guard.canActivate(context("provider-controller")), ForbiddenException);
  assert.throws(() => guard.canActivate(context("model-controller")), ForbiddenException);
});
