import assert from "node:assert/strict";
import test from "node:test";
import { validateOicEnvironment } from "./oic-config.schema";

const validEnvironment = {
  NODE_ENV: "development",
  OIC_DATABASE_URL: "postgresql://oic_test:local@127.0.0.1:5432/oic_test"
};
const runnerCredential = `oic_v1.${"r".repeat(22)}.${"s".repeat(43)}`;
const publisherCredential = `oic_v1.${"p".repeat(22)}.${"t".repeat(43)}`;

void test("OIC-7 local runner and publisher credentials are paired development-only config", () => {
  assert.equal(validateOicEnvironment(validEnvironment).OIC7_EVALUATION_RUNNER_CREDENTIAL, undefined);
  const result = validateOicEnvironment({
    ...validEnvironment,
    OIC7_EVALUATION_RUNNER_CREDENTIAL: runnerCredential,
    OIC7_EVALUATION_PUBLISHER_CREDENTIAL: publisherCredential
  });
  assert.equal(result.OIC7_EVALUATION_RUNNER_CREDENTIAL, runnerCredential);
  assert.equal(result.OIC7_EVALUATION_PUBLISHER_CREDENTIAL, publisherCredential);
});

void test("OIC-7 local config rejects a missing counterpart without echoing a credential", () => {
  assert.throws(
    () => validateOicEnvironment({ ...validEnvironment, OIC7_EVALUATION_RUNNER_CREDENTIAL: runnerCredential }),
    (error: unknown) => error instanceof Error && error.message.includes("OIC7_EVALUATION_PUBLISHER_CREDENTIAL") && !error.message.includes(runnerCredential)
  );
});

void test("OIC-7 local config rejects malformed credentials without echoing their values", () => {
  const malformed = "do-not-print-this-value";
  assert.throws(
    () => validateOicEnvironment({ ...validEnvironment, OIC7_EVALUATION_RUNNER_CREDENTIAL: malformed, OIC7_EVALUATION_PUBLISHER_CREDENTIAL: publisherCredential }),
    (error: unknown) => error instanceof Error && error.message.includes("OIC7_EVALUATION_RUNNER_CREDENTIAL") && !error.message.includes(malformed)
  );
});

void test("OIC-7 local credentials cannot be loaded in production", () => {
  assert.throws(
    () => validateOicEnvironment({ ...validEnvironment, NODE_ENV: "production", OIC7_EVALUATION_RUNNER_CREDENTIAL: runnerCredential, OIC7_EVALUATION_PUBLISHER_CREDENTIAL: publisherCredential }),
    /OIC7_EVALUATION_RUNNER_CREDENTIAL/
  );
});

void test("evaluation artifact writer requires version 2 and distinct read-only legacy key", () => {
  const legacy = "11".repeat(32);
  const active = "22".repeat(32);
  const parsed = validateOicEnvironment({ ...validEnvironment, OIC_EVALUATOR_ENABLED: "true", OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY: legacy, OIC_EVALUATION_ARTIFACT_KEY_V2: active, OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION: "2" });
  assert.equal(parsed.OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION, "2");
  assert.throws(() => validateOicEnvironment({ ...validEnvironment, OIC_EVALUATOR_ENABLED: "true", OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY: legacy }), /OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION/);
  assert.throws(() => validateOicEnvironment({ ...validEnvironment, OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY: legacy, OIC_EVALUATION_ARTIFACT_KEY_V2: legacy, OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION: "2" }), /OIC_EVALUATION_ARTIFACT_KEY_V2/);
  assert.throws(() => validateOicEnvironment({ ...validEnvironment, OIC_EVALUATION_ARTIFACT_KEY_V1_LEGACY: legacy, OIC_EVALUATION_ARTIFACT_KEY_V2: active, OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION: "1" }), /OIC_EVALUATION_ARTIFACT_WRITE_KEY_VERSION/);
});
