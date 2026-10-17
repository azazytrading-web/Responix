import test from "node:test";
import assert from "node:assert/strict";
import { ConflictException, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { OicExceptionFilter } from "./oic-exception.filter";

function filter(exception: unknown, path = "/api/v1/reviewer/domain-content-assignments/item/submission") {
  const result: { status?: number; body?: unknown } = {};
  const response = { status(code: number) { result.status = code; return this; }, json(body: unknown) { result.body = body; } };
  const request = { path, requestId: "req-safe-1", headers: {} };
  const host = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) };
  new OicExceptionFilter().catch(exception, host as never);
  return result;
}

void test("review submit failures return bounded canonical codes without exception detail", () => {
  const expired = filter(new UnauthorizedException("private reviewer session"));
  assert.equal(expired.status, 401);
  assert.deepEqual(expired.body, { statusCode: 401, error: { code: "REVIEWER_SESSION_EXPIRED", message: "Reviewer session expired" }, requestId: "req-safe-1" });
  const changed = filter(new ConflictException("ASSIGNMENT_STATE_CHANGED"));
  assert.equal(changed.status, 409);
  assert.deepEqual(changed.body, { statusCode: 409, error: { code: "ASSIGNMENT_STATE_CHANGED", message: "Assignment state changed; refresh before continuing" }, requestId: "req-safe-1" });
  const internal = filter(new InternalServerErrorException("secret key private-value"));
  assert.equal(JSON.stringify(internal.body).includes("private-value"), false);
  assert.equal(JSON.stringify(internal.body).includes("INTERNAL_REVIEW_ERROR"), true);
});

void test("admin evaluation failures log only safe exception metadata", () => {
  const chunks: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: string | Uint8Array) => { chunks.push(String(chunk)); return true; };
  try {
    const result = filter(new Error("private database URL and secret-value"), "/api/v1/admin/evaluations/runs/id/cases/id/contingency");
    assert.equal(result.status, 500);
    assert.equal(chunks.length, 1);
    assert.match(chunks[0]!, /"event":"evaluation.admin.request_failed"/);
    assert.match(chunks[0]!, /"exceptionClass":"Error"/);
    assert.equal(chunks.join("").includes("secret-value"), false);
    assert.equal(chunks.join("").includes("private database URL"), false);
  } finally {
    process.stderr.write = write;
  }
});

void test("candidate run-start conflicts log only an allowlisted reason code", () => {
  const chunks: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: string | Uint8Array) => { chunks.push(String(chunk)); return true; };
  try {
    const result = filter(new ConflictException("CANDIDATE_PREDISPATCH_PARENT_COHORT_INCOMPLETE"), "/api/v1/admin/evaluations/runs");
    assert.equal(result.status, 409);
    assert.deepEqual(JSON.parse(chunks[0]!), {
      event: "evaluation.run.start_blocked",
      requestId: "req-safe-1",
      reasonCode: "CANDIDATE_PREDISPATCH_PARENT_COHORT_INCOMPLETE"
    });
    chunks.length = 0;
    filter(new ConflictException("private token=do-not-log"), "/api/v1/admin/evaluations/runs");
    assert.deepEqual(JSON.parse(chunks[0]!), {
      event: "evaluation.run.start_blocked",
      requestId: "req-safe-1",
      reasonCode: "RUN_START_CONFLICT"
    });
    assert.equal(chunks.join("").includes("do-not-log"), false);
  } finally {
    process.stderr.write = write;
  }
});
