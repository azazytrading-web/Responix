import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "./auth.guard";
import type { FoundationAuditWriter } from "./foundation-audit-writer";
import { FoundationService, OIC_SCOPES } from "./foundation.service";

const serviceFor = () => {
  let applicationLookups = 0;
  const db = {
    oicApplication: {
      findFirst: () => {
        applicationLookups += 1;
        return Promise.resolve(null);
      }
    }
  } as unknown as OicDatabaseService;
  const writer = { write: () => Promise.resolve() } satisfies FoundationAuditWriter;
  return {
    service: new FoundationService(db, writer),
    applicationLookups: () => applicationLookups
  };
};

void test("Console cross-application management remains bound to domain scopes", async () => {
  const { service, applicationLookups } = serviceFor();
  const readOnly: AuthenticatedPrincipal = {
    id: "console-reader",
    applicationId: "oic-platform",
    scopes: ["oic:console:read", "oic:tenants:manage"],
    tenantIds: []
  };

  await assert.rejects(
    service.createTenant(readOnly, "responix", { displayName: "Blocked" }, "blocked", {}),
    (error: unknown) => error instanceof NotFoundException
  );
  assert.equal(applicationLookups(), 0);

  const manager: AuthenticatedPrincipal = {
    ...readOnly,
    scopes: ["oic:console:manage", "oic:tenants:manage"]
  };
  await assert.rejects(
    service.createTenant(manager, "responix", { displayName: "Target check" }, "key", {}),
    (error: unknown) => error instanceof NotFoundException
  );
  assert.equal(applicationLookups(), 1);
});

void test("Console global scopes cannot be self-granted by Console operators", async () => {
  const { service } = serviceFor();
  const operator: AuthenticatedPrincipal = {
    id: "console-operator",
    applicationId: "oic-platform",
    scopes: ["oic:console:manage", "oic:principals:manage"],
    tenantIds: []
  };
  assert.ok(OIC_SCOPES.includes("oic:console:read"));
  assert.ok(OIC_SCOPES.includes("oic:console:manage"));

  await assert.rejects(
    service.grantScope(operator, "oic-platform", "another-principal", "oic:console:read", "grant", {}),
    (error: unknown) => error instanceof ForbiddenException
  );
});
