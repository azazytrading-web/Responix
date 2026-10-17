/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const workflow = require("../app/features/evaluation/reviewer-workflow.cjs");

const source = (relative) => fs.readFileSync(path.resolve(__dirname, "../", relative), "utf8");
const rawAnchors = [
  { id: "secret-anchor-1", language: "en", prompt: "Task: State the capital of Egypt. A: Cairo. B: Alexandria.", rubric: "Compare factual correctness and relevance. Do not reward verbosity or position." },
  { id: "secret-anchor-2", language: "ar", prompt: "المهمة: ما عاصمة مصر؟ A: الإسكندرية. B: القاهرة.", rubric: "اتبع اللغة المطلوبة؛ امتنع إذا كانت الأدلة غير كافية." },
  { id: "secret-anchor-3", language: "en", prompt: "Task: Pick the better short answer. A: Answer one. B: Answer two.", rubric: "Use the published criteria faithfully." }
];

test("calibration anchors become readable EN and AR presentation blocks without exposing IDs", () => {
  const anchors = rawAnchors.map(workflow.parseCalibrationAnchor);
  assert.equal(anchors.length, 3);
  assert.equal(anchors[0].task, "State the capital of Egypt.");
  assert.equal(anchors[0].responseA, "Cairo.");
  assert.equal(anchors[0].responseB, "Alexandria.");
  assert.equal(anchors[0].rubric, rawAnchors[0].rubric);
  assert.equal(anchors[1].task, "ما عاصمة مصر؟");
  assert.equal(anchors[1].language, "ar");
  assert.equal(JSON.stringify(anchors).includes("expectedAnswers"), false);
});

test("Packet 7.5 domain reviewer UI requires its own scoped conflict declaration before opening items", () => {
  const ui = source("app/features/evaluation/domain-content-review-workspace.tsx");
  assert.match(ui, /Packet 7\.5 conflict declaration/);
  assert.match(ui, /إقرار تضارب المصالح/);
  assert.match(ui, /domain-review\/conflict/);
  assert.match(ui, /assignment\.actionable !== true/);
  assert.match(ui, /didNotAccessOracle/);
  assert.match(ui, /noOtherProtocolConflict/);
  assert.match(ui, /Sales and support dialogue/);
  assert.match(ui, /الحوار في المبيعات والدعم/);
});

test("Packet 7.5 conflict BFF uses the HttpOnly human reviewer session and no-store responses", () => {
  const route = source("app/api/reviewer/domain-review/conflict/route.ts");
  assert.match(route, /hasConsoleSession\(\)/);
  assert.match(route, /reviewerToken\(\)/);
  assert.match(route, /api\/v1\/reviewer\/domain-review\/conflict/);
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /Cache-Control.*no-store/);
});

test("calibration progress counts ratings and abstentions and blocks incomplete payloads", () => {
  const anchors = rawAnchors.map(workflow.parseCalibrationAnchor);
  assert.deepEqual(workflow.calibrationProgress(anchors, {}), { total: 3, answered: 0, abstentions: 0, completed: 0, complete: false });
  assert.deepEqual(workflow.calibrationProgress(anchors, { "secret-anchor-1": "A", "secret-anchor-2": "ABSTAIN" }), { total: 3, answered: 1, abstentions: 1, completed: 2, complete: false });
  assert.throws(() => workflow.buildCalibrationPayload("policy", anchors, { "secret-anchor-1": "A" }), /Complete every calibration item/);
  const payload = workflow.buildCalibrationPayload("policy", anchors, { "secret-anchor-1": "A", "secret-anchor-2": "ABSTAIN", "secret-anchor-3": "B" });
  assert.deepEqual(payload, { policyId: "policy", answers: { "secret-anchor-1": "A", "secret-anchor-3": "B" }, abstentions: ["secret-anchor-2"] });
  assert.equal(Object.hasOwn(payload, "expectedAnswers"), false);
});

test("blind rating controls exactly follow the published metric schema", () => {
  assert.deepEqual(workflow.metricControl({ type: "PAIRWISE", rangeOrCategories: { categories: ["A", "B", "TIE"] } }), { kind: "choices", values: ["A", "B", "TIE"] });
  assert.deepEqual(workflow.metricControl({ type: "BOOLEAN", rangeOrCategories: {} }), { kind: "boolean", values: [true, false] });
  assert.deepEqual(workflow.metricControl({ type: "COUNT", rangeOrCategories: { minimum: 0, maximum: 4 } }), { kind: "number", minimum: 0, maximum: 4, step: 1 });
  assert.equal(workflow.metricControl({ type: "PAIRWISE", rangeOrCategories: { categories: [] } }), null);
});

test("single Boolean reviews render one candidate and preserve pairwise presentation rules", () => {
  const single = workflow.safeReviewProjection({ prompt: "Follow the visible instruction.", rubric: "The response must address the requested format.", language: "en", candidates: [{ label: "CANDIDATE", content: "One visible response." }], oracle: "hidden", provider: "private", model: "private" }, "SINGLE_BOOLEAN");
  assert.deepEqual(single, { prompt: "Follow the visible instruction.", rubric: "The response must address the requested format.", language: "en", candidates: [{ label: "CANDIDATE", content: "One visible response." }] });
  assert.equal(workflow.safeReviewProjection({ candidates: [{ label: "A", content: "One" }, { label: "B", content: "Two" }] }, "SINGLE_BOOLEAN"), null);
  assert.equal(workflow.safeReviewProjection({ candidates: [{ label: "A", content: "One" }, { label: "B", content: "Two" }] }, "PAIRWISE").candidates.length, 2);
  assert.equal(workflow.safeReviewProjection({ candidates: [{ label: "CANDIDATE", content: "One" }] }, "PAIRWISE"), null);
  assert.match(source("app/features/evaluation/reviewer-workspace.tsx"), /selected\.reviewMode === "SINGLE_BOOLEAN" && candidates\.length === 1/);
  assert.match(source("app/features/evaluation/reviewer-workspace.tsx"), /Meets the criterion/);
  assert.match(source("app/features/evaluation/reviewer-workspace.tsx"), /meetsCriterion: "\\u062A/);
});

test("blind renderer allowlists only the server-authorized projection fields", () => {
  const projection = workflow.safeBlindProjection({ prompt: "Compare", rubric: "Correctness", language: "en", candidates: [{ label: "A", content: "first" }, { label: "B", content: "second" }], provider: "hidden-provider", model: "hidden-model", oracle: "hidden-answer", priorScores: [1] });
  assert.deepEqual(projection, { prompt: "Compare", rubric: "Correctness", language: "en", candidates: [{ label: "A", content: "first" }, { label: "B", content: "second" }] });
  assert.equal(JSON.stringify(projection).includes("hidden"), false);
});

test("assignment readiness labels distinguish required calibration, available, active, and submitted work", () => {
  assert.equal(workflow.assignmentState([], false), "NOT_READY");
  assert.equal(workflow.assignmentState([{ status: "ASSIGNED" }], false), "NOT_READY");
  assert.equal(workflow.assignmentState([{ status: "ASSIGNED" }], true), "READY");
  assert.equal(workflow.assignmentState([{ status: "OPENED" }], true), "IN_PROGRESS");
  assert.equal(workflow.assignmentState([{ status: "SUBMITTED" }], true), "SUBMITTED");
});

test("normal reviewer UI contains no raw JSON inputs, IDs, tokens, or protected answers", () => {
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  assert.doesNotMatch(view, /JSON\.stringify\(policy\.anchors|JSON\.stringify\(selected\.projection|<pre>|JSON\.parse\(blindRating|JSON\.parse\(calibration/);
  assert.doesNotMatch(view, /calibrationAnswers|calibrationAbstentions|rating \(JSON\)|JSON object keyed by anchor ID/);
  assert.doesNotMatch(view, /expectedAnswers|referenceAnswers|result\.token/);
  assert.match(view, /<RadioGroup label=\{t\.calibrationChoice\}/);
  assert.match(view, /value: "ABSTAIN"/);
  assert.match(view, /role="status" aria-live="polite"/);
  assert.match(view, /reviewerId/);
  assert.match(view, /<details className="reviewer-technical-details"/);
  assert.match(view, /signedInAs/);
  assert.match(view, /reviewerActive/);
  assert.match(view, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);
  assert.match(view, /dir=\{anchorDir\}/);
  const css = source("app/styles.css");
  assert.match(css, /@media\(max-width:760px\)\{\.reviewer-candidate-grid/);
  assert.match(css, /reviewer-calibration-item \.oic-radio-group input:focus-visible/);
  assert.match(css, /white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext/);
});

test("reviewer session continues to use HttpOnly cookies and neither secrets nor session tokens render", () => {
  const auth = source("app/api/reviewer/auth/route.ts");
  const helper = source("lib/reviewer-auth.ts");
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  assert.match(auth, /setReviewerToken\(result\.token/);
  assert.doesNotMatch(auth, /token: result\.token/);
  assert.match(helper, /httpOnly: true/);
  assert.doesNotMatch(view, /reviewerToken|sessionToken|passwordHash|type="text"[^>]*password/i);
});

test("safe calibration readback is Console-admin-only and reviewer conflict statements submit through the human session", () => {
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  const readback = source("app/api/reviewer/admin/calibrations/route.ts");
  const scopes = source("app/api/reviewer/conflict-scopes/route.ts");
  const declaration = source("app/api/reviewer/conflict-attestations/route.ts");
  assert.match(view, /!loggedIn && calibrationReadback.length/);
  assert.match(view, /auditVerified/);
  assert.match(view, /didNotAuthor/);
  assert.match(view, /didNotPublish/);
  assert.match(view, /didNotOperate/);
  assert.match(view, /didNotOwn/);
  assert.match(view, /didNotAccessOracle/);
  assert.match(view, /noOtherProtocolConflict/);
  assert.match(view, /conflictScopes.map/);
  assert.match(view, /auditVerified: "تم التحقق/);
  assert.match(view, /didNotAuthor: "لم أؤلف/);
  assert.match(readback, /reviewerToken()/);
  assert.match(readback, /REVIEWER_SESSION_ACTIVE/);
  assert.match(readback, /controlPlaneCredential()/);
  assert.match(scopes, /reviewerToken()/);
  assert.match(declaration, /sameOrigin\(request\)/);
  assert.match(declaration, /reviewerToken()/);
  assert.match(declaration, /oic7-human-review-local-demo-v1/);
  assert.match(declaration, /oic7-human-review-local-demo-b2-v1/);
  assert.match(declaration, /OIC7_EVALUATION_RUNNER_CREDENTIAL/);
  assert.match(declaration, /reviewerIds: \[humanId\]/);
  assert.match(view, /if \(result\.state === "CLEARED"\) await loadAssignments\(\)/);
  assert.match(view, /conflictRecordedWithAssignments/);
  assert.doesNotMatch(view, /OIC7_EVALUATION_RUNNER_CREDENTIAL|authorization:\s*`Bearer/);
  assert.doesNotMatch(readback, /DATABASE_URL|answers|expectedAnswers|referenceAnswers/);
});

test("domain review submission exposes bounded EN/AR state feedback and reconciles durable status", () => {
  const view = source("app/features/evaluation/domain-content-review-workspace.tsx");
  const bff = source("app/api/reviewer/domain-content-assignments/[id]/route.ts");
  assert.match(view, /REVIEWER_SESSION_EXPIRED/);
  assert.match(view, /ASSIGNMENT_STATE_CHANGED/);
  assert.match(view, /ASSIGNMENT_ALREADY_SUBMITTED/);
  assert.match(view, /API_UNAVAILABLE/);
  assert.match(view, /INTERNAL_REVIEW_ERROR/);
  assert.match(view, /This review was already recorded/);
  assert.match(view, /تم تسجيل هذه المراجعة مسبقاً/);
  assert.match(view, /status === "SUBMITTED" \? t\.submitted/);
  assert.match(view, /result\.status === "ALREADY_RECORDED"/);
  assert.doesNotMatch(view, /The review could not be saved\. Check the assignment state before retrying/);
  assert.match(bff, /API_UNAVAILABLE/);
  assert.match(bff, /response\.status/);
  assert.doesNotMatch(bff, /console\.log|console\.error|Authorization/);
});
