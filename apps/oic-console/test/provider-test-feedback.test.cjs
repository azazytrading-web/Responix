/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { providerTestFeedback } = require("../app/features/model-fabric/provider-test-feedback.cjs");

const app = fs.readFileSync(path.resolve(__dirname, "../app/console-app.tsx"), "utf8");
const messages = fs.readFileSync(path.resolve(__dirname, "../app/i18n.ts"), "utf8");
const en = {
  healthy: "Connection healthy",
  unhealthy: "Connection unhealthy",
  unavailable: "Connection test result unavailable"
};
const ar = {
  healthy: "الاتصال سليم",
  unhealthy: "الاتصال غير سليم",
  unavailable: "نتيجة اختبار الاتصال غير متاحة"
};

test("healthy and unhealthy outcomes show only allowlisted diagnostics", () => {
  assert.equal(providerTestFeedback({ healthy: true, diagnosticCode: "CONNECTION_OK" }, en), "Connection healthy · CONNECTION_OK");
  assert.equal(providerTestFeedback({ healthy: false, diagnosticCode: "PROVIDER_TLS_FAILED" }, en), "Connection unhealthy · PROVIDER_TLS_FAILED");
  assert.equal(providerTestFeedback({ healthy: false, diagnosticCode: "PROVIDER_NETWORK_FAILED" }, en), "Connection unhealthy · PROVIDER_NETWORK_FAILED");
  assert.equal(providerTestFeedback({ healthy: false, diagnosticCode: "PROVIDER_ADAPTER_INCOMPATIBLE" }, en), "Connection unhealthy · PROVIDER_ADAPTER_INCOMPATIBLE");
});

test("untrusted diagnostic content, including secret-like values, is never rendered", () => {
  const result = providerTestFeedback({ healthy: false, diagnosticCode: "Bearer private-api-key" }, en);
  assert.equal(result, "Connection unhealthy · UNKNOWN");
  assert.doesNotMatch(result, /Bearer|private-api-key/i);
  assert.equal(providerTestFeedback({ healthy: null, diagnosticCode: "CONNECTION_OK" }, en), en.unavailable);
});

test("English and Arabic connection feedback is wired into the Console action", () => {
  assert.match(messages, /connectionTestHealthy: "Connection healthy"/);
  assert.match(messages, /connectionTestUnhealthy: "Connection unhealthy"/);
  assert.match(messages, /connectionTestUnavailable: "Connection test result unavailable"/);
  assert.match(messages, /connectionTestHealthy: "الاتصال سليم"/);
  assert.match(messages, /connectionTestUnhealthy: "الاتصال غير سليم"/);
  assert.match(messages, /connectionTestUnavailable: "نتيجة اختبار الاتصال غير متاحة"/);
  assert.match(app, /setToast\(providerTestFeedback\(data,/);
  assert.equal(providerTestFeedback({ healthy: true, diagnosticCode: "CONNECTION_OK" }, ar), "الاتصال سليم · CONNECTION_OK");
  assert.equal(providerTestFeedback({ healthy: false, diagnosticCode: "PROVIDER_TLS_FAILED" }, ar), "الاتصال غير سليم · PROVIDER_TLS_FAILED");
});
