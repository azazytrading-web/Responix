/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.resolve(__dirname, "../app");
const studio = fs.readFileSync(path.join(appRoot, "features/intelligence/memory-knowledge-studio.tsx"), "utf8");
const center = fs.readFileSync(path.join(appRoot, "features/intelligence/intelligence-center.tsx"), "utf8");
const action = fs.readFileSync(path.join(appRoot, "api/action/route.ts"), "utf8");
const consoleRoute = fs.readFileSync(path.join(appRoot, "api/console/route.ts"), "utf8");

test("Memory and Knowledge render as distinct canonical workspaces", () => {
  assert.match(center, /view === "memory" \|\| view === "knowledge"/);
  assert.match(center, /<MemoryKnowledgeStudio/);
  for (const component of ["ScopePicker", "LifecyclePicker", "DependencyPicker", "DiscreteStepSelector", "Toggle", "WizardFrame", "WorkspaceTabs", "Inspector", "ActionButton", "RelationshipPanel"]) {
    assert.match(studio, new RegExp(`\\b${component}\\b`));
  }
  for (const component of ["NumericInstrument", "NodeTrack", "StateBeacon", "EmptyState"]) assert.match(studio, new RegExp(`\\b${component}\\b`));
  assert.match(studio, /Memory Engineering Studio/);
  assert.match(studio, /Knowledge Engineering Studio/);
  assert.match(studio, /بحث في بيانات المصدر/);
  assert.doesNotMatch(studio, /components\/gallery|dev\/instruments|dev\/interface-system/);
  assert.doesNotMatch(studio, /<select\b|type=["']checkbox["']/i);
  assert.match(studio, /Memory state/);
  assert.match(studio, /Source record/);
  assert.match(studio, /NO MEMORY RECORDS IN CURRENT AUTHORIZED VIEW/);
  assert.match(studio, /NO KNOWLEDGE RECORDS IN CURRENT VIEW/);
  assert.match(studio, /Context eligibility/);
  assert.match(studio, /Retrieval evidence/);
  assert.match(studio, /RECORDS IN SAMPLE/);
});

test("Memory list hides archived records by default and separates stored state from runtime selection", () => {
  assert.match(studio, /includeArchived \|\| filters\.lifecycle === "ARCHIVED" \|\| item\.lifecycle !== "ARCHIVED"/);
  assert.match(studio, /memoryUtility/);
  assert.match(studio, /USED_IN_CONTEXT/);
  assert.match(studio, /Stored does not mean included in context/);
  assert.doesNotMatch(studio, /entry\.score|entry\.reason|selected\.score/);
  assert.match(studio, /passes|expiry|sensitivity/i);
  assert.match(studio, /No record-scoped history or audit read endpoint is available/);
});

test("Knowledge evidence links use bounded graph metadata without presenting content or ranking scores", () => {
  assert.match(studio, /evidenceGraph/);
  assert.match(studio, /Evidence reference returned by execution graph/);
  assert.match(studio, /A reference does not prove content entered provider context/);
  assert.doesNotMatch(studio, /node\.(?:retrievalScore|rerankScore|lexicalScore|semanticScore|authority|freshness)/);
  assert.match(studio, /No per-record retrieval test endpoint is available/);
  assert.match(studio, /does not import documents, create chunks or start a sync job/);
});

test("Memory mutation BFF maps only existing fields and preserves session, origin and server credential boundaries", () => {
  assert.match(action, /action === "intelligence\.memory\.create"[\s\S]*?validUntil[\s\S]*?sensitivity/);
  assert.match(action, /action === "intelligence\.memory\.update"[\s\S]*?path = `\/api\/v1\/admin\/intelligence\/memory\/\$\{body\.id\}`; method = "PATCH"/);
  assert.match(action, /body\.validUntil !== undefined \? \{ validUntil: body\.validUntil \}/);
  assert.match(action, /if \(!sameOrigin\(request\)\)/);
  assert.match(action, /if \(!\(await hasConsoleSession\(\)\)\)/);
  assert.match(action, /controlPlaneCredential\(\)/);
  assert.doesNotMatch(action, /Authorization:\s*`Bearer \$\{body\./);
});

test("Memory and Knowledge server search remains bounded to supported metadata and API scope", () => {
  assert.match(studio, /Searches title and source type\/reference only; content is not searched/);
  assert.match(studio, /Searches title and source key\/reference only; content is not searched/);
  assert.match(consoleRoute, /tenantId = safeQuery/);
  assert.match(consoleRoute, /q = safeQuery/);
  assert.match(consoleRoute, /lifecycle = safeQuery/);
  assert.match(consoleRoute, /kind = safeQuery/);
  assert.match(consoleRoute, /hasConsoleSession\(\)/);
  assert.match(consoleRoute, /controlPlaneCredential\(\)/);
});

test("Record states distinguish first load, retryable failure, an empty result, and confirmed terminal archive", () => {
  assert.match(center, /recordStates: Record<"memory" \| "knowledge", "loading" \| "available" \| "failed">/);
  assert.match(studio, /<LoadingState/);
  assert.match(studio, /<ErrorState[\s\S]*?Retry/);
  assert.match(studio, /<EmptyState/);
  assert.match(studio, /<ArmThenExecute/);
  assert.match(studio, /Archive is terminal/);
  assert.match(studio, /Archived and verified by detail readback/);
});

test("The studio contains no prompt viewer, chain-of-thought surface or local fake-data path", () => {
  assert.doesNotMatch(studio, /prompt|chain.of.thought|workingMemory|candidateNotes/i);
  assert.doesNotMatch(studio, /fixture|demoData|synthetic/i);
  assert.doesNotMatch(studio, /localStorage|sessionStorage|console\.(?:log|info|debug)\s*\(/);
});
