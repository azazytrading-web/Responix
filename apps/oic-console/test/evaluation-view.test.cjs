/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = (relative) => fs.readFileSync(path.resolve(__dirname, "../", relative), "utf8");

test("evaluation BFF remains session and machine-credential protected and loads registries without caching", () => {
  const bff = source("app/api/console/route.ts");
  assert.match(bff, /if \(view === "evaluation"\)/);
  assert.match(bff, /hasConsoleSession\(\)/);
  assert.match(bff, /controlPlaneCredential\(\)/);
  assert.match(bff, /evaluations\/metrics/);
  assert.match(bff, /evaluations\/releases/);
  assert.match(bff, /evaluations\/judges/);
  assert.match(bff, /evaluations\/reports/);
  assert.match(bff, /evaluations\/comparisons/);
  assert.match(bff, /view === "evaluation-report"/);
  assert.match(bff, /view === "evaluation-run"/);
  assert.match(bff, /evaluations\/runs\/\$\{runId\}/);
  assert.match(bff, /Invalid evaluation report identity/);
  assert.match(bff, /evaluations\/work/);
  assert.match(bff, /evaluations\/outbox/);
  assert.match(bff, /view === "evaluation-pack"/);
  assert.match(bff, /evaluations\/packs\/\$\{packId\}/);
  assert.match(bff, /Invalid evaluation pack identity/);
  assert.match(bff, /Cache-Control": "no-store"/);
});

test("benchmark studio exposes bounded rights and slice coverage in English and Arabic", () => {
  const view = source("app/features/evaluation/evaluation-workspace.tsx");
  assert.match(view, /Coverage and rights review/);
  assert.match(view, /مراجعة التغطية والحقوق/);
  assert.match(view, /packDetails\.coverage/);
  assert.match(view, /missingRequiredSlices/);
  assert.match(view, /permittedUses/);
  assert.match(view, /sourceRef/);
  assert.match(view, /External import provenance/);
  assert.match(view, /transformMapDigest/);
  assert.match(view, /revocationRef/);
  assert.match(view, /Latest compiler validation/);
  assert.match(view, /artifactReferencesChecked/);
  assert.match(view, /COMPROMISED/);
  assert.match(view, /RETIRED/);
  assert.match(view, /dir=\{ar \? "rtl" : "ltr"\}/);
});

test("evaluation workspace surfaces versioned metrics and judges and keeps unsupported evidence explicitly dormant", () => {
  const view = source("app/features/evaluation/evaluation-workspace.tsx");
  assert.match(view, /id: "domain-coverage"/);
  assert.match(view, /domainCoverage\.map/);
  assert.match(view, /A published release does not imply human validation or measured model quality/);
  assert.match(view, /تغطية المجالات/);
  assert.match(view, /data\.metrics/);
  assert.match(view, /data\.judges/);
  assert.match(view, /Versioned metrics/);
  assert.match(view, /Versioned judges/);
  assert.match(view, /Run analysis reports/);
  assert.match(view, /data\.reports/);
  assert.match(view, /Comparisons retain compatibility reasons and paired uncertainty/);
  assert.match(view, /Protocol comparisons/);
  assert.match(view, /data\.comparisons/);
  assert.match(view, /Report evidence and missingness/);
  assert.match(view, /Provider & OIC-6 accounting/);
  assert.match(view, /Missing dispatch data stays unknown/);
  assert.match(view, /providerExecution/);
  assert.match(view, /OiuValue/);
  assert.match(view, /No preregistered metrics/);
  assert.match(view, /NOT MEASURED/);
  assert.match(view, /HUMAN GATE/);
  assert.doesNotMatch(view, /synthetic|fixture value|sample score/i);
});

test("execution monitor shows bounded work and delivery state in English and Arabic", () => {
  const view = source("app/features/evaluation/evaluation-workspace.tsx");
  assert.match(view, /Execution Monitor/);
  assert.match(view, /مراقبة التنفيذ/);
  assert.match(view, /data\.work/);
  assert.match(view, /data\.outbox/);
  assert.match(view, /LASTFAILURECLASS/);
  assert.match(view, /!\["inputArtifact", "oracle", "manifest", "caseManifest", "_count"\]\.includes\(key\)/);
});

test("reviewer sessions stay in HttpOnly BFF cookies and browser requests cannot mint assignments or calibration policy", () => {
  const auth = source("app/api/reviewer/auth/route.ts");
  const helper = source("lib/reviewer-auth.ts");
  assert.match(auth, /setReviewerToken\(result\.token/);
  assert.match(auth, /human: result\.human/);
  assert.doesNotMatch(auth, /token: result\.token/);
  assert.match(helper, /httpOnly: true/);
  assert.match(helper, /sameSite: "strict"/);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../app/api/reviewer/admin/assignments/route.ts")), false);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../app/api/reviewer/admin/assignments/[id]/reassign/route.ts")), false);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../app/api/reviewer/admin/calibration-policies/route.ts")), false);
});

test("reviewer workspace uses separate OIC onboarding and sign-in panels with unique labeled controls", () => {
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  const primitives = source("app/components/oic-primitives.tsx");
  assert.match(view, /Reviewer administration/);
  assert.match(view, /Reviewer sign in/);
  assert.match(view, /Existing reviewers/);
  assert.match(view, /reviewer-control-grid/);
  assert.match(view, /reviewer-form-grid/);
  assert.match(view, /import \{ Button, RadioGroup, TextArea, TextInput \} from "@\/app\/components\/oic-primitives"/);
  assert.match(primitives, /<label className="oic-field" htmlFor=\{inputId\}>/);
  assert.match(view, /id="reviewer-create-password" label=\{t\.password\} type="password"/);
  assert.match(view, /id="reviewer-login-password" label=\{t\.password\} type="password"/);
  const ids = [...view.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate fixed field IDs: ${ids.join(", ")}`);
});

test("reviewer UI clears distinct passwords and presents creation, authentication, and session feedback accessibly", () => {
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  assert.match(view, /finally \{ setCreatePassword\(""\); setBusy\(false\); \}/);
  assert.match(view, /finally \{ setLoginPassword\(""\); setBusy\(false\); \}/);
  assert.match(view, /role=\{value\.kind === "error" \? "alert" : "status"\}/);
  assert.match(view, /setReviewer\(record\(result\.human\)\)/);
  assert.match(view, /Session expiry is not exposed by the current safe session read model/);
  assert.match(view, /type="password" required/);
  assert.doesNotMatch(view, /<input[^>]+value=\{(?:createPassword|loginPassword)\}[^>]*type="text"/);
});

test("reviewer calibration feedback exposes only bounded eligibility, agreement, and anchor count in English and Arabic", () => {
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  assert.match(view, /const result = await request\("\/api\/reviewer\/calibrations"/);
  assert.match(view, /result\.eligibility === "ELIGIBLE" \|\| result\.eligibility === "INELIGIBLE"/);
  assert.match(view, /Number\.isFinite\(result\.agreement\)/);
  assert.match(view, /const anchorCount = String\(progress\.total\)/);
  assert.match(view, /setCalibrationResults/);
  assert.match(view, /result\.eligibility === "ELIGIBLE" \? t\.calibrationEligible/);
  assert.equal((view.match(/calibrationAgreement: "[^"]+"/g) ?? []).length, 2);
  assert.equal((view.match(/calibrationAnchors: "[^"]+"/g) ?? []).length, 2);
  assert.doesNotMatch(view, /expectedAnswers|referenceAnswers/);
});

test("reviewer registry BFF is uncached and UI remains localized and responsive for EN and RTL AR", () => {
  const route = source("app/api/reviewer/admin/identities/route.ts");
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  const css = source("app/styles.css");
  assert.match(route, /export async function GET/);
  assert.match(route, /hasConsoleSession\(\)/);
  assert.match(route, /controlPlaneCredential\(\)/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.match(view, /Individually authenticated review evidence/);
  assert.match(view, /arabicReviewerWorkflow/);
  assert.match(view, /dir=\{locale === "ar" \? "rtl" : "ltr"\}/);
  assert.match(view, /aria-labelledby="reviewer-registry-title"/);
  assert.match(css, /\.reviewer-control-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:1100px\)\{\.reviewer-control-grid/);
  assert.match(css, /@media\(max-width:760px\)\{\.reviewer-page-head/);
  assert.match(css, /\.reviewer-form-grid \.oic-input:focus-visible/);
});

test("reviewer administration BFF preserves safe status classes without returning API bodies", () => {
  const route = source("app/api/reviewer/admin/identities/route.ts");
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  for (const [status, code] of [[400, "REVIEWER_SETUP_INVALID"], [401, "OIC_CREDENTIAL_INVALID"], [403, "REVIEWER_ADMIN_FORBIDDEN"], [404, "REVIEWER_ADMIN_ROUTE_NOT_FOUND"], [409, "REVIEWER_LOGIN_HANDLE_EXISTS"], [429, "REVIEWER_ADMIN_RATE_LIMITED"]]) {
    assert.match(route, new RegExp(`status === ${status}\\) return "${code}"`));
    assert.match(view, new RegExp(`${code}: t\\.`));
  }
  assert.match(route, /status >= 500\) return "REVIEWER_API_FAILURE"/);
  assert.match(route, /REVIEWER_API_UNAVAILABLE/);
  assert.match(route, /errorCode: errorForStatus\(status\)/);
  assert.doesNotMatch(route, /response\.text\(\)|response\.clone\(\)|error\.stack|Authorization[^\n]*console\.(log|error)/);
  assert.match(view, /REVIEWER_API_FAILURE: t\.apiFailure/);
  assert.match(view, /REVIEWER_API_UNAVAILABLE: t\.apiUnavailable/);
  assert.match(view, /setRegistryError\(error instanceof Error \? error\.message : t\.registryDenied\)/);
  assert.match(view, /apiUnavailable: ".*OIC API/);
  assert.match(view, /adminForbidden: ".*not authorized/);
  assert.match(view, /duplicateHandle: ".*already in use/);
  assert.match(view, /ar: \{ \.\.\.en,/);
});

test("calibration BFF maps failures to bounded safe codes and handles transport failure", () => {
  const route = source("app/api/reviewer/calibrations/route.ts");
  for (const [status, code] of [[400, "CALIBRATION_SUBMISSION_INVALID"], [401, "REVIEWER_SESSION_EXPIRED"], [403, "CALIBRATION_NOT_AUTHORIZED"], [404, "CALIBRATION_POLICY_UNAVAILABLE"], [409, "CALIBRATION_ALREADY_SUBMITTED"], [429, "REVIEWER_RATE_LIMITED"]]) {
    assert.match(route, new RegExp(`status === ${status}\\) return "${code}"`));
  }
  assert.match(route, /status >= 500\) return "INTERNAL_REVIEW_ERROR"/);
  assert.match(route, /errorCode: "API_UNAVAILABLE"/);
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /reviewerApi\("\/api\/v1\/reviewer\/calibrations", token/);
  assert.match(route, /method: "POST", body: JSON\.stringify\(body\)/);
  assert.doesNotMatch(route, /response\.text\(\)|response\.clone\(\)|console\.(log|error)/);
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  for (const code of ["REVIEWER_SESSION_EXPIRED", "CALIBRATION_ALREADY_SUBMITTED", "CALIBRATION_SUBMISSION_INVALID", "CALIBRATION_POLICY_UNAVAILABLE", "CALIBRATION_NOT_AUTHORIZED", "CALIBRATION_REQUEST_FAILED", "REVIEWER_RATE_LIMITED", "INTERNAL_REVIEW_ERROR", "API_UNAVAILABLE"]) assert.match(view, new RegExp(`${code}: t\\.${code}`));
  assert.match(view, /durableCalibration\.completedAt/);
});

test("expired reviewer sessions remain visible after logout and block calibration dispatch", () => {
  const view = source("app/features/evaluation/reviewer-workspace.tsx");
  assert.match(view, /if \(!loggedIn\) \{\s*setReviewFeedback\(\{ kind: "error", message: t\.REVIEWER_SESSION_EXPIRED \}\);\s*return;/);
  assert.match(view, /if \(text\(result\.errorCode\) === "REVIEWER_SESSION_EXPIRED"\) \{\s*setLoggedIn\(false\);/);
  assert.match(view, /<FeedbackMessage value=\{reviewFeedback\}\/>(?=\s*<section className="x14-data-surface reviewer-registry")/);
  assert.match(view, /calibrationIncomplete: ".+"/);
  assert.match(view, /!completeContent && anchors\.length === rawAnchors\.length/);
  assert.match(view, /if \(!progress\.complete\) \{\s*setReviewFeedback\(\{ kind: "error", message: t\.calibrationIncomplete \}\);\s*return;/);
  assert.equal((view.match(/calibrationIncomplete: "[^"]+"/g) ?? []).length, 2);
});
