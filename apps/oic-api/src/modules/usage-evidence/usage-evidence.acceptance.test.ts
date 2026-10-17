import assert from "node:assert/strict";
import test from "node:test";
import type { OicRuntimeContext } from "@oic/contracts";
import { UsageEvidenceService } from "./usage-evidence.service";

void test("OIC-6.1 usage evidence stores allowlisted provider facts with immutable replay semantics", async () => {
  const attempts = new Map<string, Record<string, unknown>>();
  const receipts = new Map<string, Record<string, unknown>>();
  let receiptId = 0;
  const db = {
    oicProviderAttempt: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        const id = typeof data.id === "string" ? data.id : "attempt-1";
        attempts.set(id, data);
        return Promise.resolve({ id: "attempt-1" });
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        attempts.set(where.id, { ...attempts.get(where.id), ...data });
        return Promise.resolve(attempts.get(where.id));
      },
      findFirst: () => Promise.resolve(null)
    },
    $transaction: <T>(operation: (tx: unknown) => Promise<T>) => operation({
      oicProviderAttempt: {
        create: ({ data }: { data: Record<string, unknown> }) => {
          attempts.set("attempt-1", data);
          return Promise.resolve({ id: "attempt-1" });
        },
        findFirst: ({ where }: { where: { id: string; applicationId: string; tenantId: string | null } }) =>
          Promise.resolve(where.id === "attempt-1" && where.applicationId === "app-a" && where.tenantId === "tenant-a" ? { id: where.id } : null),
        update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          attempts.set(where.id, { ...attempts.get(where.id), ...data });
          return Promise.resolve();
        }
      },
      oicUsageEvent: {
        findUnique: ({ where }: { where: { providerAttemptId_receiptSequence: { providerAttemptId: string; receiptSequence: number } } }) =>
          Promise.resolve(receipts.get(`${where.providerAttemptId_receiptSequence.providerAttemptId}:${where.providerAttemptId_receiptSequence.receiptSequence}`) ?? null),
        create: ({ data }: { data: Record<string, unknown> }) => {
          const id = `event-${++receiptId}`;
          receipts.set(`${String(data.providerAttemptId)}:${String(data.receiptSequence)}`, { ...data, id });
          return Promise.resolve({ id });
        }
      }
    })
  } as never;
  const service = new UsageEvidenceService(db);
  const context: OicRuntimeContext = { requestId: "request-a", traceId: "trace-a", applicationId: "app-a", principalId: "principal-a", tenantId: "tenant-a" };
  const attemptId = await service.beginAttempt(context, { connectionId: "connection-a", bindingId: "binding-a", providerKey: "openai", upstreamModelId: "provider-model", transportProfile: "openai-chat-completions-v1" });
  assert.equal(attemptId, "attempt-1");
  assert.equal(attempts.get(attemptId)?.tenantId, "tenant-a");

  const receipt = {
    applicationId: "app-a", tenantId: "tenant-a", providerKey: "openai", transportProfile: "openai-chat-completions-v1",
    rawDimensions: { prompt_tokens: 11, completion_tokens: 4, authorization: "never-store-this" },
    normalizedDimensions: { inputTokens: 11, outputTokens: 4 }
  };
  await service.recordReceipt(attemptId, 0, receipt);
  await service.recordReceipt(attemptId, 0, receipt);
  assert.equal(receipts.size, 1);
  const stored = receipts.get(`${attemptId}:0`)!;
  assert.deepEqual(stored.rawDimensions, { prompt_tokens: 11, completion_tokens: 4 });
});

void test("OIC-6.1 unknown usage stays absent and scope or digest conflicts are rejected", async () => {
  let inserted = false;
  const db = {
    oicProviderAttempt: { create: () => Promise.resolve({ id: "attempt-1" }), update: () => Promise.resolve(), findFirst: () => Promise.resolve(null) },
    $transaction: <T>(operation: (tx: unknown) => Promise<T>) => operation({
      oicProviderAttempt: {
        create: () => Promise.resolve({ id: "attempt-1" }),
        findFirst: ({ where }: { where: { applicationId: string; tenantId: string | null } }) => Promise.resolve(where.applicationId === "app-a" && where.tenantId === null ? { id: "attempt-1" } : null),
        update: () => Promise.resolve()
      },
      oicUsageEvent: {
        findUnique: () => Promise.resolve(inserted ? { sourceDigest: "different-digest" } : null),
        create: () => { inserted = true; return Promise.resolve({ id: "event-1" }); }
      }
    })
  } as never;
  const service = new UsageEvidenceService(db);
  const context: OicRuntimeContext = { requestId: "request-a", traceId: "trace-a", applicationId: "app-a", principalId: "principal-a", tenantId: null };
  const attemptId = await service.beginAttempt(context, { connectionId: "connection-a", bindingId: "binding-a", providerKey: "openai", upstreamModelId: "provider-model", transportProfile: "openai-chat-completions-v1" });
  await service.recordReceipt(attemptId, 0, { applicationId: "app-a", tenantId: null, providerKey: "openai", transportProfile: "openai-chat-completions-v1", rawDimensions: {}, normalizedDimensions: {} });
  assert.equal(inserted, false);
  await assert.rejects(service.recordReceipt(attemptId, 0, { applicationId: "app-a", tenantId: "tenant-other", providerKey: "openai", transportProfile: "openai-chat-completions-v1", rawDimensions: { prompt_tokens: 2 }, normalizedDimensions: { inputTokens: 2 } }), /scope/);
  await service.recordReceipt(attemptId, 0, { applicationId: "app-a", tenantId: null, providerKey: "openai", transportProfile: "openai-chat-completions-v1", rawDimensions: { prompt_tokens: 2 }, normalizedDimensions: { inputTokens: 2 } });
  await assert.rejects(service.recordReceipt(attemptId, 0, { applicationId: "app-a", tenantId: null, providerKey: "openai", transportProfile: "openai-chat-completions-v1", rawDimensions: { prompt_tokens: 3 }, normalizedDimensions: { inputTokens: 3 } }), /digest conflict/);
});

void test("OIC evaluation provider dispatch accepts only a durable physical-attempt admission link", async () => {
  const attemptId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a4";
  const admissionId = "c8b49b66-a9a9-4edf-b955-ef5084ea46a5";
  let created = 0;
  let transitioned = 0;
  const db = {
    $transaction: <T>(operation: (tx: unknown) => Promise<T>) => operation({
      oicAdmission: {
        findFirst: () => Promise.resolve(null),
        updateMany: ({ where }: { where: { id: string; status: string } }) => {
          assert.equal(where.id, admissionId);
          assert.equal(where.status, "DISPATCHED");
          transitioned += 1;
          return Promise.resolve({ count: 1 });
        }
      },
      oicEvaluationAttempt: {
        findFirst: ({ where }: { where: { id: string; admissionId: string; status: string } }) => {
          assert.deepEqual(where, { id: attemptId, admissionId, status: "DISPATCHED" });
          return Promise.resolve({ caseExecution: { run: { applicationId: "app-a", tenantId: null, targetIdentity: { runtimePrincipalId: "principal-a" } } } });
        }
      },
      oicProviderAttempt: { create: ({ data }: { data: Record<string, unknown> }) => { created += 1; assert.equal(data.admissionId, admissionId); return Promise.resolve({ id: "provider-attempt-a" }); } },
      oicReservationLeg: { updateMany: () => Promise.resolve({ count: 0 }) }
    })
  } as never;
  const service = new UsageEvidenceService(db);
  const context: OicRuntimeContext = { requestId: `evaluation-${attemptId}`, traceId: "trace-a", applicationId: "app-a", principalId: "principal-a", tenantId: null, admissionId };
  assert.equal(await service.beginAttempt(context, { connectionId: "connection-a", bindingId: "binding-a", providerKey: "deepseek", upstreamModelId: "deepseek-flash", transportProfile: "openai-chat-completions-v1" }), "provider-attempt-a");
  assert.equal(created, 1);
  assert.equal(transitioned, 1);

  const unlinkedDb = {
    $transaction: <T>(operation: (tx: unknown) => Promise<T>) => operation({
      oicAdmission: { findFirst: () => Promise.resolve(null) },
      oicEvaluationAttempt: { findFirst: () => Promise.resolve(null) },
      oicProviderAttempt: { create: () => { created += 1; return Promise.resolve({ id: "must-not-create" }); } }
    })
  } as never;
  await assert.rejects(new UsageEvidenceService(unlinkedDb).beginAttempt(context, { connectionId: "connection-a", bindingId: "binding-a", providerKey: "deepseek", upstreamModelId: "deepseek-flash", transportProfile: "openai-chat-completions-v1" }), /durable evaluation linkage/);
  assert.equal(created, 1);
});
