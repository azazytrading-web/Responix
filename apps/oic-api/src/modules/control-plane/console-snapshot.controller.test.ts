import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { OicDatabaseService } from "@oic/database";
import type { AuthenticatedPrincipal } from "../identity/auth.guard";
import { ConsoleSnapshotController } from "./console-snapshot.controller";

void test("console snapshot keeps credential secrets and audit metadata outside the response", async () => {
  const calls: Record<string, unknown> = {};
  const db = {
    oicApplication: {
      findMany: (query: unknown) => {
        calls.applications = query;
        return Promise.resolve([]);
      }
    },
    oicTenant: {
      findMany: (query: unknown) => {
        calls.tenants = query;
        return Promise.resolve([
          {
            id: "tenant-id",
            references: [
              { id: "reference-id", sourceType: "external", externalId: "tenant-42", createdAt: new Date(0), revokedAt: new Date(1) }
            ]
          }
        ]);
      }
    },
    oicServicePrincipal: {
      findMany: (query: unknown) => {
        calls.principals = query;
        return Promise.resolve([]);
      }
    },
    oicProviderDefinition: { findMany: () => Promise.resolve([]) },
    oicProviderConnection: {
      findMany: () =>
        Promise.resolve([
          {
            id: "connection-id",
            credentials: [
              {
                id: "credential-id",
                status: "ACTIVE",
                verifier: "must-not-appear",
                ciphertext: "must-not-appear"
              }
            ]
          }
        ])
    },
    oicUpstreamModel: { findMany: () => Promise.resolve([]) },
    oicModelFamily: { findMany: () => Promise.resolve([]) },
    oicAuditEvent: {
      findMany: (query: unknown) => {
        calls.audit = query;
        return Promise.resolve([]);
      }
    }
  } as unknown as OicDatabaseService;

  const reader: AuthenticatedPrincipal = { id: "console-reader", applicationId: "platform", scopes: ["oic:console:read"], tenantIds: [] };
  const result = await new ConsoleSnapshotController(db).snapshot(reader);
  assert.equal(result.tenants[0]?.references[0]?.revokedAt?.getTime(), 1);
  assert.equal(result.connections[0]?.credential?.id, "credential-id");
  assert.equal("credentials" in (result.connections[0] ?? {}), false);
  assert.equal("verifier" in (result.connections[0]?.credential ?? {}), false);
  assert.equal("ciphertext" in (result.connections[0]?.credential ?? {}), false);
  const auditQuery = calls.audit as { select: Record<string, unknown> };
  assert.equal("metadata" in auditQuery.select, false);
  const principalQuery = calls.principals as {
    include: { credentials: { select: Record<string, unknown> } };
  };
  assert.equal("verifier" in principalQuery.include.credentials.select, false);
  assert.equal("secret" in principalQuery.include.credentials.select, false);
  const tenantQuery = calls.tenants as {
    include: { references: { select: Record<string, unknown> } };
  };
  assert.equal(tenantQuery.include.references.select.revokedAt, true);
});

void test("console snapshot denies identities without global console read scope", async () => {
  const reader: AuthenticatedPrincipal = { id: "reader", applicationId: "app", scopes: ["oic:applications:read"], tenantIds: [] };
  await assert.rejects(new ConsoleSnapshotController({} as OicDatabaseService).snapshot(reader), ForbiddenException);
});
