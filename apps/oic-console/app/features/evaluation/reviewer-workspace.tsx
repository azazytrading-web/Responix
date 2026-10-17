"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, RadioGroup, TextArea, TextInput } from "@/app/components/oic-primitives";
import type { Locale } from "@/app/i18n";
import workflow from "./reviewer-workflow.cjs";

type Row = Record<string, unknown>;
type Feedback = { kind: "success" | "error" | "info"; message: string } | null;
const text = (value: unknown) => typeof value === "string" ? value : "";
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(record) : [];
const application = "7f25c69e-bdbb-4949-ad7b-ef6412119850";

const en: Record<string, string> = {
    title: "Human review",
    intro: "Individually authenticated review evidence, separated from machine identities and the shared Console operator.",
    admin: "Reviewer administration",
    adminIntro: "Create a human reviewer identity for this application. Set the password privately; it is cleared after submission.",
    app: "Application",
    appLocked: "OIC_PLATFORM � application scope is fixed for this workspace",
    label: "Display label",
    labelHelp: "Use a recognizable review label. This is not the immutable reviewer ID.",
    handle: "Private login handle",
    handleHelp: "Unique login name; share it only with the intended reviewer.",
    password: "Private reviewer password",
    create: "Create reviewer",
    creating: "Creating reviewer�",
    created: "Reviewer created. Internal ID:",
    signIn: "Reviewer sign in",
    signInIntro: "Use your individual reviewer account. Console operator access alone cannot submit human review.",
    login: "Login handle",
    continue: "Sign in",
    signingIn: "Signing in�",
    signOut: "End reviewer session",
    session: "Reviewer session",
    active: "Authenticated reviewer",
    sessionActive: "Session active",
    sessionExpiry: "Session expiry",
    expiryUnavailable: "Session expiry is not exposed by the current safe session read model.",
    registry: "Existing reviewers",
    registryIntro: "Application-scoped identity and authorization status. Credential verifiers and session secrets are never included.",
    refreshRegistry: "Refresh registry",
    refresh: "Refresh assignments",
    open: "Open blind review",
    score: "Your decision",
    rationale: "Optional bounded rationale",
    submit: "Submit rating",
    abstain: "Abstain � insufficient evidence",
    done: "Review submitted.",
    empty: "No open assignments.",
    denied: "This operation requires the appropriate authenticated reviewer or identity administrator.",
    credentials: "Human reviewer credentials are separate from OIC machine credentials.",
    calibration: "Calibration status",
    calibrationIntro: "Only published, application-scoped calibration policies are shown.",
    calibrationChoice: "Your decision",
    chooseA: "Response A is better",
    chooseB: "Response B is better",
    abstainCalibration: "Abstain � insufficient evidence",
    calibrationReady: "Calibration ready",
    completed: "completed",
    abstentions: "Abstentions",
    progress: "answered",
    task: "Task",
    responseA: "Response A",
    responseB: "Response B",
    guidance: "Evaluation guidance",
    language: "Language",
    calibrationItem: "Calibration",
    calibrationRequired: "REQUIRED",
    calibrationEligible: "ELIGIBLE",
    calibrationIneligible: "NOT ELIGIBLE",
    calibrationExpired: "EXPIRED",
    calibrationAgreement: "Agreement",
    calibrationAnchors: "Anchors",
    calibrationResult: "Calibration recorded",
    calibrationUnavailable: "Calibration content is unavailable. Contact the review coordinator.",
    calibrationIncomplete: "Answer every calibration item before submitting.",
    noCalibration: "No published calibration set is available.",
    notDecisionEligible: "Evidence retained. Current calibration or conflict status does not make it decision-eligible.",
    status: "Status",
    reviewerId: "Immutable reviewer ID",
    loginStatus: "Login credential",
    authorization: "Reviewer authorization",
    calibrationEligibility: "Calibration eligibility",
    createdAt: "Created",
    noReviewers: "No reviewer identities are registered for this application yet.",
    registryDenied: "Reviewer registry is unavailable for this application or caller.",
    noLogin: "No active local login",
    notCalibrated: "Not calibrated",
    workspace: "Assigned review work",
    reviewAction: "Review action",
    assignmentId: "Blind item",
    loading: "Loading�",
    consoleSessionRequired: "Your shared Console session has expired. Sign in again.",
    originInvalid: "The request origin could not be verified. Refresh the Console and try again.",
    applicationInvalid: "The OIC_PLATFORM application scope is invalid.",
    apiCredentialInvalid: "The configured Console API credential was rejected. Contact the OIC administrator.",
    adminForbidden: "This Console operator is not authorized to administer reviewers for this application.",
    routeNotFound: "The reviewer administration API route was not found.",
    duplicateHandle: "That reviewer login handle is already in use. Choose another handle.",
    setupInvalid: "Reviewer setup was rejected. Check the required fields and password policy.",
    rateLimited: "Reviewer administration is rate limited. Wait before trying again.",
    apiFailure: "The OIC API failed while processing reviewer administration. Check the registry before retrying.",
    apiUnavailable: "The OIC API did not return a response. Check service health and the registry before retrying.",
    adminRequestFailed: "Reviewer administration request failed.",
    REVIEWER_SESSION_EXPIRED: "Reviewer session expired. Sign in again before submitting.",
    CALIBRATION_ALREADY_SUBMITTED: "A calibration attempt already exists. Refresh and verify its result before submitting again.",
    CALIBRATION_SUBMISSION_INVALID: "Calibration choices were rejected. Review the selections and required anchors.",
    CALIBRATION_POLICY_UNAVAILABLE: "The published calibration policy is unavailable.",
    CALIBRATION_NOT_AUTHORIZED: "This reviewer is not authorized for the calibration policy.",
    CALIBRATION_REQUEST_FAILED: "Calibration could not be submitted. Check the recorded result before retrying.",
    REVIEWER_RATE_LIMITED: "Reviewer requests are temporarily rate limited.",
    INTERNAL_REVIEW_ERROR: "The review service failed. Check the recorded result before retrying.",
    API_UNAVAILABLE: "The OIC API did not respond. Check the calibration result before retrying.",
    assignmentInProgress: "Assignment in progress",
    assignmentNotReady: "Assignment not ready",
    assignmentReady: "Assignment ready",
    assignmentState: "Assignment state",
    assignmentSubmitted: "Assignment submitted",
    blindContext: "Blind context",
    candidateResponse: "Candidate response",
    meetsCriterion: "Meets the criterion",
    doesNotMeetCriterion: "Does not meet the criterion",
    item: "Item",
    no: "No",
    ratingUnavailable: "Rating unavailable",
    reviewerActive: "Reviewer active",
    reviewerStatus: "Reviewer status",
    signedInAs: "Signed in as",
    submitCalibration: "Submit calibration",
    technicalDetails: "Technical details",
    tie: "Tie",
    yes: "Yes",
    auditVerified: "Audit verified",
    calibrationReadback: "Durable calibration evidence",
    conflictDeclaration: "Conflict declaration",
    didNotAuthor: "I did not author the fixture or evaluated material.",
    didNotPublish: "I did not publish the protected release.",
    didNotOperate: "I did not operate the evaluated candidate or process.",
    didNotOwn: "I did not own the candidate or review item.",
    didNotAccessOracle: "I have not accessed protected oracle or reference answers.",
    noOtherProtocolConflict: "I have no other conflict defined by this protocol.",
    recordDeclaration: "Record declaration",
    conflictRecorded: "Declaration recorded",
    conflictRecordedWithAssignments: "Conflict clearance recorded. Your blinded review items are ready.",
    conflictClear: "CLEARED",
    conflicted: "CONFLICTED",
    requiresAttestation: "REQUIRES ATTESTATION",
    reviseDeclaration: "Revise declaration",
};
const translations: Record<Locale, Record<string, string>> = {
  en,
  ar: { ...en,
    auditVerified: "تم التحقق من سجل التدقيق",
    calibrationReadback: "دليل المعايرة المحفوظ",
    conflictDeclaration: "إقرار تضارب المصالح",
    didNotAuthor: "لم أؤلف العينة أو المادة الخاضعة للتقييم.",
    didNotPublish: "لم أنشر الإصدار المحمي.",
    didNotOperate: "لم أشغّل المرشح أو العملية الخاضعة للتقييم.",
    didNotOwn: "لا أملك المرشح أو عنصر المراجعة.",
    didNotAccessOracle: "لم أطلع على مرجع الإجابات أو مادة المرجع المحمية.",
    noOtherProtocolConflict: "ليس لدي أي تعارض آخر يحدده هذا البروتوكول.",
    recordDeclaration: "تسجيل الإقرار",
    conflictRecorded: "تم تسجيل الإقرار",
    conflictRecordedWithAssignments: "تم تسجيل إقرار تضارب المصالح. عناصر المراجعة المعمّاة جاهزة الآن.",
    conflictClear: "تمت الموافقة",
    conflicted: "يوجد تعارض",
    requiresAttestation: "يلزم تقديم الإقرار",
    reviseDeclaration: "تعديل الإقرار",
    calibrationIncomplete: "\u0623\u062C\u0628 \u0639\u0646 \u0643\u0644 \u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u0642\u0628\u0644 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
    calibrationAgreement: "\u0646\u0633\u0628\u0629 \u0627\u0644\u0627\u062A\u0641\u0627\u0642",
    calibrationAnchors: "\u0627\u0644\u0645\u0631\u0627\u0633\u064A",
    REVIEWER_SESSION_EXPIRED: "\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0631\u0627\u062C\u0639. \u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B \u0642\u0628\u0644 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
    CALIBRATION_ALREADY_SUBMITTED: "\u062A\u0648\u062C\u062F \u0645\u0639\u0627\u064A\u0631\u0629 \u0645\u0633\u062C\u0644\u0629. \u062D\u062F\u062B \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
    CALIBRATION_SUBMISSION_INVALID: "\u062A\u0645 \u0631\u0641\u0636 \u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629. \u0631\u0627\u062C\u0639 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.",
    CALIBRATION_POLICY_UNAVAILABLE: "\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629.",
    CALIBRATION_NOT_AUTHORIZED: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u063A\u064A\u0631 \u0645\u062E\u0648\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629.",
    CALIBRATION_REQUEST_FAILED: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
    REVIEWER_RATE_LIMITED: "\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u062D\u062F\u0648\u062F\u0629 \u0645\u0624\u0642\u062A\u0627\u064B.",
    INTERNAL_REVIEW_ERROR: "\u062A\u0639\u0630\u0631\u062A \u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
    API_UNAVAILABLE: "\u0644\u0645 \u062A\u0633\u062A\u062C\u0628 \u0648\u0627\u062C\u0647\u0629 OIC. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
  }
};

const arabicReviewerWorkflow = {
  REVIEWER_SESSION_EXPIRED: "\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0631\u0627\u062C\u0639. \u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B \u0642\u0628\u0644 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
  CALIBRATION_ALREADY_SUBMITTED: "\u062A\u0648\u062C\u062F \u0645\u0639\u0627\u064A\u0631\u0629 \u0645\u0633\u062C\u0644\u0629. \u062D\u062F\u0651\u062B \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
  CALIBRATION_SUBMISSION_INVALID: "\u062A\u0645 \u0631\u0641\u0636 \u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629. \u0631\u0627\u062C\u0639 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.",
  CALIBRATION_POLICY_UNAVAILABLE: "\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629.",
  CALIBRATION_NOT_AUTHORIZED: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u063A\u064A\u0631 \u0645\u062E\u0648\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629.",
  CALIBRATION_REQUEST_FAILED: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
  REVIEWER_RATE_LIMITED: "\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u062D\u062F\u0648\u062F\u0629 \u0645\u0624\u0642\u062A\u0627\u064B.",
  INTERNAL_REVIEW_ERROR: "\u062A\u0639\u0630\u0631\u062A \u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.",
  API_UNAVAILABLE: "\u0644\u0645 \u062A\u0633\u062A\u062C\u0628 \u0648\u0627\u062C\u0647\u0629 OIC. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0625\u0631\u0633\u0627\u0644.",
  score: "\u0642\u0631\u0627\u0631\u0643",
  abstain: "\u0627\u0645\u062A\u0646\u0627\u0639 · \u0623\u062F\u0644\u0629 \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629",
  calibrationChoice: "\u0642\u0631\u0627\u0631\u0643",
  chooseA: "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 A \u0623\u0641\u0636\u0644",
  chooseB: "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 B \u0623\u0641\u0636\u0644",
  abstainCalibration: "\u0627\u0645\u062A\u0646\u0627\u0639 · \u0623\u062F\u0644\u0629 \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629",
  calibrationReady: "\u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u062C\u0627\u0647\u0632\u0629",
  completed: "\u0645\u0631\u0627\u0633\u064D \u0645\u0643\u062A\u0645\u0644\u0629",
  abstentions: "\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0627\u0645\u062A\u0646\u0627\u0639",
  progress: "\u062A\u0645\u062A \u0627\u0644\u0625\u062C\u0627\u0628\u0629",
  task: "\u0627\u0644\u0645\u0647\u0645\u0629",
  responseA: "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 A",
  responseB: "\u0627\u0644\u0625\u062C\u0627\u0628\u0629 B",
  guidance: "\u0625\u0631\u0634\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u0642\u064A\u064A\u0645",
  language: "\u0627\u0644\u0644\u063A\u0629",
  calibrationItem: "\u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629",
  calibrationRequired: "\u0645\u0637\u0644\u0648\u0628\u0629",
  assignmentState: "\u0627\u0644\u0645\u0647\u0645\u0629 \u0627\u0644\u0645\u0639\u0645\u0627\u0629",
  assignmentNotReady: "\u063A\u064A\u0631 \u062C\u0627\u0647\u0632",
  assignmentReady: "\u062C\u0627\u0647\u0632",
  assignmentInProgress: "\u0642\u064A\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630",
  assignmentSubmitted: "\u0645\u0631\u0633\u0644",
  signedInAs: "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0627\u0633\u0645",
    reviewerStatus: "\u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0631\u0627\u062C\u0639",
  reviewerActive: "\u0646\u0634\u0637",
  technicalDetails: "\u062A\u0641\u0627\u0635\u064A\u0644 \u062A\u0642\u0646\u064A\u0629",
  ratingUnavailable: "\u0623\u062F\u0648\u0627\u062A \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0627\u0645\u062A\u0646\u0627\u0639 \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0627\u0644\u0623\u062F\u0644\u0629 \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629.",
  blindContext: "\u0633\u064A\u0627\u0642 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
  candidateResponse: "\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0645\u0631\u0634\u062D",
  meetsCriterion: "\u062A\u0633\u062A\u0648\u0641\u064A \u0627\u0644\u0645\u0639\u064A\u0627\u0631",
  doesNotMeetCriterion: "\u0644\u0627 \u062A\u0633\u062A\u0648\u0641\u064A \u0627\u0644\u0645\u0639\u064A\u0627\u0631",
  item: "\u0639\u0646\u0635\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
  calibrationUnavailable: "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0645\u0646\u0633\u0642 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629.",
  calibrationResult: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0639\u0627\u064A\u0631\u0629",
  tie: "\u0627\u0644\u0625\u062C\u0627\u0628\u062A\u0627\u0646 \u0645\u062A\u0643\u0627\u0641\u0626\u062A\u0627\u0646",
  yes: "\u0646\u0639\u0645",
  no: "\u0644\u0627",
} as const;

function FeedbackMessage({ value }: { value: Feedback }) {
  if (!value) return null;
  return <p className={`reviewer-feedback is-${value.kind}`} role={value.kind === "error" ? "alert" : "status"} aria-live={value.kind === "error" ? "assertive" : "polite"}>{value.message}</p>;
}

export function ReviewerWorkspace({ locale }: { locale: Locale }) {
  const t: Record<string, string> = { ...translations[locale], ...(locale === "ar" ? arabicReviewerWorkflow : {}) };
  const adminErrors: Record<string, string> = {
    CONSOLE_SESSION_REQUIRED: t.consoleSessionRequired,
    REQUEST_ORIGIN_INVALID: t.originInvalid,
    REVIEWER_APPLICATION_INVALID: t.applicationInvalid,
    OIC_CREDENTIAL_INVALID: t.apiCredentialInvalid,
    REVIEWER_ADMIN_FORBIDDEN: t.adminForbidden,
    REVIEWER_ADMIN_ROUTE_NOT_FOUND: t.routeNotFound,
    REVIEWER_LOGIN_HANDLE_EXISTS: t.duplicateHandle,
    REVIEWER_SETUP_INVALID: t.setupInvalid,
    REVIEWER_ADMIN_RATE_LIMITED: t.rateLimited,
    REVIEWER_API_FAILURE: t.apiFailure,
    REVIEWER_API_UNAVAILABLE: t.apiUnavailable,
    REVIEWER_ADMIN_REQUEST_FAILED: t.adminRequestFailed,
    REVIEWER_SESSION_EXPIRED: t.REVIEWER_SESSION_EXPIRED,
    CALIBRATION_ALREADY_SUBMITTED: t.CALIBRATION_ALREADY_SUBMITTED,
    CALIBRATION_SUBMISSION_INVALID: t.CALIBRATION_SUBMISSION_INVALID,
    CALIBRATION_POLICY_UNAVAILABLE: t.CALIBRATION_POLICY_UNAVAILABLE,
    CALIBRATION_NOT_AUTHORIZED: t.CALIBRATION_NOT_AUTHORIZED,
    CALIBRATION_REQUEST_FAILED: t.CALIBRATION_REQUEST_FAILED,
    REVIEWER_RATE_LIMITED: t.REVIEWER_RATE_LIMITED,
    INTERNAL_REVIEW_ERROR: t.INTERNAL_REVIEW_ERROR,
    API_UNAVAILABLE: t.API_UNAVAILABLE,
  };
  const [applicationId, setApplicationId] = useState(application);
  const [displayLabel, setDisplayLabel] = useState("");
  const [handle, setHandle] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [loginHandle, setLoginHandle] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [reviewer, setReviewer] = useState<Row | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState("");
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [calibrations, setCalibrations] = useState<Row[]>([]);
  const [registry, setRegistry] = useState<Row[]>([]);
  const [calibrationReadback, setCalibrationReadback] = useState<Row[]>([]);
  const [conflictScopes, setConflictScopes] = useState<Row[]>([]);
  const [conflictDeclarations, setConflictDeclarations] = useState<Record<string, Record<string, boolean>>>({});
  const [conflictEditing, setConflictEditing] = useState<Record<string, boolean>>({});
  const [registryState, setRegistryState] = useState<"loading" | "ready" | "error">("loading");
  const [registryError, setRegistryError] = useState("");
  const [calibrationSelections, setCalibrationSelections] = useState<Record<string, Record<string, string>>>({});
  const [calibrationResults, setCalibrationResults] = useState<Record<string, { eligibility: string; agreement: string; anchors: string; abstentions: number }>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const [blindRating, setBlindRating] = useState("");
  const [rationale, setRationale] = useState("");
  const [adminFeedback, setAdminFeedback] = useState<Feedback>(null);
  const [authFeedback, setAuthFeedback] = useState<Feedback>(null);
  const [reviewFeedback, setReviewFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  async function request(path: string, init?: RequestInit): Promise<Row> {
    const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const result = await response.json().catch(() => ({})) as Row;
    if (!response.ok) {
      if (text(result.errorCode) === "REVIEWER_SESSION_EXPIRED") {
        setLoggedIn(false);
        setReviewer(null);
        setSessionExpiry("");
        setAssignments([]);
        setCalibrations([]);
      }
      throw new Error(adminErrors[text(result.errorCode)] || text(result.error) || t.denied);
    }
    return result;
  }

  const loadRegistry = useCallback(async () => {
    setRegistryState("loading");
    setRegistryError("");
    try {
      const result = await request(`/api/reviewer/admin/identities?applicationId=${encodeURIComponent(applicationId)}`);
      setRegistry(list(result));
      try { setCalibrationReadback(list(await request(`/api/reviewer/admin/calibrations?applicationId=${encodeURIComponent(applicationId)}`))); } catch { setCalibrationReadback([]); }
      setRegistryState("ready");
    } catch (error) {
      setRegistry([]);
      setRegistryError(error instanceof Error ? error.message : t.registryDenied);
      setRegistryState("error");
    }
  }, [applicationId]);

  const loadAssignments = useCallback(async () => {
    try { setAssignments(list(await request("/api/reviewer/assignments"))); }
    catch { setAssignments([]); }
  }, []);

  const loadCalibrations = useCallback(async () => {
    try { setCalibrations(list(await request("/api/reviewer/calibrations"))); }
    catch { setCalibrations([]); }
  }, []);

  const loadConflictScopes = useCallback(async () => {
    try { setConflictScopes(list(await request("/api/reviewer/conflict-scopes"))); }
    catch { setConflictScopes([]); }
  }, []);

  useEffect(() => {
    let active = true;
    void loadRegistry();
    void fetch("/api/reviewer/auth", { cache: "no-store" }).then(async (response) => response.json() as Promise<Row>).then((result) => {
      if (!active || result.authenticated !== true) return;
      const human = record(result.human);
      setLoggedIn(true);
      setCalibrationReadback([]);
      setReviewer(human);
      setSessionExpiry(text(result.expiresAt));
      setApplicationId(text(result.applicationId) || application);
      void loadAssignments();
      void loadCalibrations();
      void loadConflictScopes();
    }).catch(() => undefined);
    return () => { active = false; };
  }, [loadAssignments, loadCalibrations, loadConflictScopes, loadRegistry]);

  async function createReviewer(event: FormEvent) {
    event.preventDefault(); setBusy(true); setAdminFeedback(null);
    try {
      const result = await request("/api/reviewer/admin/identities", { method: "POST", body: JSON.stringify({ applicationId, displayLabel, loginHandle: handle, password: createPassword, capabilities: ["oic:evaluation:review:read", "oic:evaluation:review:submit", "oic:evaluation:review:calibrate", "oic:evaluation:review:adjudicate"] }) });
      setDisplayLabel(""); setHandle(""); setAdminFeedback({ kind: "success", message: `${t.created} ${text(result.id)}` });
      await loadRegistry();
    } catch (error) {
      setAdminFeedback({ kind: "error", message: error instanceof Error ? error.message : t.denied });
    } finally { setCreatePassword(""); setBusy(false); }
  }

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setAuthFeedback(null);
    try {
      const result = await request("/api/reviewer/auth", { method: "POST", body: JSON.stringify({ applicationId, loginHandle, password: loginPassword }) });
      setCalibrationReadback([]); setReviewer(record(result.human)); setSessionExpiry(text(result.expiresAt)); setLoggedIn(true); setAuthFeedback({ kind: "success", message: t.sessionActive });
      await loadAssignments(); await loadCalibrations();
      await loadConflictScopes();
    } catch (error) {
      setAuthFeedback({ kind: "error", message: error instanceof Error ? error.message : t.denied });
    } finally { setLoginPassword(""); setBusy(false); }
  }

  async function open(id: string) {
    setBusy(true); setReviewFeedback(null);
    try { setSelected(await request(`/api/reviewer/assignments/${encodeURIComponent(id)}`)); }
    catch (error) { setReviewFeedback({ kind: "error", message: error instanceof Error ? error.message : t.denied }); }
    finally { setBusy(false); }
  }

  async function submit(abstained: boolean) {
    if (!selected) return;
    setBusy(true); setReviewFeedback(null);
    try {
      const control = workflow.metricControl(selected.ratingDefinition);
      let value: unknown;
      if (!abstained) {
        if (!control) throw new Error(t.ratingUnavailable);
        if (control.kind === "choices") {
          if (!control.values.includes(blindRating)) throw new Error(t.denied);
          value = blindRating;
        } else if (control.kind === "boolean") {
          if (blindRating !== "true" && blindRating !== "false") throw new Error(t.denied);
          value = blindRating === "true";
        } else {
          const numeric = Number(blindRating);
          if (!blindRating || !Number.isFinite(numeric) || numeric < control.minimum || numeric > control.maximum || (control.step === 1 && !Number.isInteger(numeric))) throw new Error(t.denied);
          value = numeric;
        }
      }
      const result = await request(`/api/reviewer/assignments/${encodeURIComponent(text(selected.id))}`, { method: "POST", body: JSON.stringify({ value, abstained, rationale }) });
      setSelected(null); setBlindRating(""); setRationale("");
      setReviewFeedback({ kind: "success", message: result.decisionEligible === true ? t.done : `${t.done} ${t.notDecisionEligible}` });
      await loadAssignments();
    } catch (error) { setReviewFeedback({ kind: "error", message: error instanceof Error ? error.message : t.denied }); }
    finally { setBusy(false); }
  }

  function chooseCalibration(policyId: string, anchorId: string, value: string) {
    setCalibrationSelections((current) => ({ ...current, [policyId]: { ...(current[policyId] ?? {}), [anchorId]: value } }));
  }

  async function submitCalibration(policyId: string) {
    if (!loggedIn) {
      setReviewFeedback({ kind: "error", message: t.REVIEWER_SESSION_EXPIRED });
      return;
    }
    const policy = calibrations.find((candidate) => text(candidate.id) === policyId);
    const rawAnchors = Array.isArray(policy?.anchors) ? policy.anchors : [];
    const anchors = rawAnchors.map((anchor) => workflow.parseCalibrationAnchor(anchor)).filter((anchor): anchor is NonNullable<typeof anchor> => anchor !== null);
    const selections = calibrationSelections[policyId] ?? {};
    const progress = workflow.calibrationProgress(anchors, selections);
    if (anchors.length !== rawAnchors.length) {
      setReviewFeedback({ kind: "error", message: t.calibrationUnavailable });
      return;
    }
    if (!progress.complete) {
      setReviewFeedback({ kind: "error", message: t.calibrationIncomplete });
      return;
    }
    setBusy(true); setReviewFeedback(null);
    try {
      const payload = workflow.buildCalibrationPayload(policyId, anchors, selections);
      const result = await request("/api/reviewer/calibrations", { method: "POST", body: JSON.stringify(payload) });
      const eligibility = result.eligibility === "ELIGIBLE" || result.eligibility === "INELIGIBLE" ? text(result.eligibility) : "UNKNOWN";
      const agreement = typeof result.agreement === "number" && Number.isFinite(result.agreement) && result.agreement >= 0 && result.agreement <= 1 ? `${Math.round(result.agreement * 100)}%` : "UNKNOWN";
      const anchorCount = String(progress.total);
      setCalibrationResults((current) => ({ ...current, [policyId]: { eligibility, agreement, anchors: anchorCount, abstentions: progress.abstentions } }));
      setReviewFeedback({ kind: "success", message: t.calibrationResult }); await loadCalibrations();
    } catch (error) { setReviewFeedback({ kind: "error", message: error instanceof Error ? error.message : t.denied }); }
    finally { setBusy(false); }
  }

  async function submitConflictDeclaration(scope: Row) {
    const key = `${text(scope.policyId)}:${text(scope.protocolRevisionId)}`;
    const declarations = conflictDeclarations[key] ?? {};
    const declarationKeys = ["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"];
    if (declarationKeys.some((name) => typeof declarations[name] !== "boolean")) return;
    setBusy(true); setReviewFeedback(null);
    try {
      const result = await request("/api/reviewer/conflict-attestations", { method: "POST", body: JSON.stringify({ policyId: scope.policyId, protocolRevisionId: scope.protocolRevisionId, declarations }) });
      setConflictScopes((current) => current.map((item) => item.policyId === scope.policyId && item.protocolRevisionId === scope.protocolRevisionId ? { ...item, state: result.state, recordedAt: result.recordedAt } : item));
      if (result.state === "CLEARED") await loadAssignments();
      setConflictEditing((current) => ({ ...current, [key]: false }));
      setReviewFeedback({ kind: result.state === "CLEARED" ? "success" : "info", message: result.state === "CLEARED" && result.assignmentsPrepared === true ? t.conflictRecordedWithAssignments : result.state === "CLEARED" ? t.conflictRecorded : text(result.state) });
    } catch (error) { setReviewFeedback({ kind: "error", message: error instanceof Error ? error.message : t.denied }); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/reviewer/auth", { method: "DELETE" });
    setLoggedIn(false); setReviewer(null); setSessionExpiry(""); setSelected(null); setAssignments([]); setCalibrations([]); setCalibrationReadback([]); setAuthFeedback(null);
  }

  function applicationField(id: string) {
    return <TextInput id={id} label={t.app} value={applicationId} readOnly aria-readonly="true" aria-describedby={`${id}-hint`} onChange={() => undefined} />;
  }
  const calibrationEligible = calibrations.some((policy) => text(record(policy.reviewerCalibration).eligibility) === "ELIGIBLE");
  const calibrationExpired = calibrations.some((policy) => text(record(policy.reviewerCalibration).eligibility) === "EXPIRED");
  const currentCalibrationLabel = calibrationEligible ? t.calibrationEligible : calibrationExpired ? t.calibrationExpired : t.calibrationRequired;
  const assignmentState = workflow.assignmentState(assignments, calibrationEligible);
  const assignmentStateLabel = assignmentState === "READY" ? t.assignmentReady : assignmentState === "IN_PROGRESS" ? t.assignmentInProgress : assignmentState === "SUBMITTED" ? t.assignmentSubmitted : t.assignmentNotReady;

  return <section className="x14-identity reviewer-page" dir={locale === "ar" ? "rtl" : "ltr"} aria-labelledby="reviewer-title">
    <header className="x14-page-head reviewer-page-head">
      <div><p className="section-index">OIC / 7.4 Â· HUMAN REVIEW</p><h2 id="reviewer-title">{t.title}</h2><p>{t.intro}</p></div>
      <div className="reviewer-heading-state"><span className={`status-light ${loggedIn ? "online" : ""}`} aria-hidden="true"/><span>{loggedIn ? t.sessionActive : t.signIn}</span></div>
    </header>

    <div className="reviewer-control-grid">
      <section className="x14-primary-workspace reviewer-panel" aria-labelledby="reviewer-admin-title">
        <header className="x14-entity-head"><div><p className="section-index">IDENTITY CONTROL</p><h3 id="reviewer-admin-title">{t.admin}</h3><p>{t.adminIntro}</p></div></header>
        <form className="reviewer-form-grid" onSubmit={(event) => { void createReviewer(event); }} aria-label={t.admin}>
          {applicationField("reviewer-admin-application")}
          <p className="reviewer-form-hint" id="reviewer-admin-application-hint">{t.appLocked}</p>
          <TextInput id="reviewer-display-label" label={t.label} required maxLength={120} value={displayLabel} onChange={(event) => setDisplayLabel(event.currentTarget.value)} hint={t.labelHelp} />
          <TextInput id="reviewer-private-handle" label={t.handle} required minLength={3} maxLength={96} autoComplete="off" value={handle} onChange={(event) => setHandle(event.currentTarget.value)} hint={t.handleHelp} />
          <TextInput id="reviewer-create-password" label={t.password} type="password" required minLength={14} maxLength={1024} autoComplete="new-password" value={createPassword} onChange={(event) => setCreatePassword(event.currentTarget.value)} />
          <div className="reviewer-form-actions"><Button type="submit" variant="primary" loading={busy}>{busy ? t.creating : t.create}</Button></div>
        </form>
        <FeedbackMessage value={adminFeedback}/>
      </section>

      <section className="x14-primary-workspace reviewer-panel" aria-labelledby="reviewer-session-title">
        <header className="x14-entity-head"><div><p className="section-index">INDIVIDUAL AUTHENTICATION</p><h3 id="reviewer-session-title">{loggedIn ? t.session : t.signIn}</h3><p>{loggedIn ? t.active : t.signInIntro}</p></div></header>
        {!loggedIn ? <form className="reviewer-form-grid reviewer-signin-form" onSubmit={(event) => { void signIn(event); }} aria-label={t.signIn}>
          {applicationField("reviewer-signin-application")}
          <p className="reviewer-form-hint" id="reviewer-signin-application-hint">{t.appLocked}</p>
          <TextInput id="reviewer-login-handle" label={t.login} required autoComplete="username" value={loginHandle} onChange={(event) => setLoginHandle(event.currentTarget.value)} />
          <TextInput id="reviewer-login-password" label={t.password} type="password" required autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.currentTarget.value)} />
          <div className="reviewer-form-actions"><Button type="submit" variant="primary" loading={busy}>{busy ? t.signingIn : t.continue}</Button></div>
        </form> : <div className="reviewer-session-readout">
          <div className="reviewer-session-status"><span className="status-light online" aria-hidden="true"/><strong>{t.sessionActive}</strong></div>
          <dl className="reviewer-session-details"><div><dt>{t.signedInAs}</dt><dd>{text(reviewer?.displayLabel)}</dd></div><div><dt>{t.reviewerStatus}</dt><dd>{t.reviewerActive}</dd></div><div><dt>{t.calibration}</dt><dd>{currentCalibrationLabel}</dd></div><div><dt>{t.assignmentState}</dt><dd>{assignmentStateLabel}</dd></div></dl>
          <details className="reviewer-technical-details"><summary>{t.technicalDetails}</summary><dl className="reviewer-session-details"><div><dt>{t.reviewerId}</dt><dd><bdi dir="ltr">{text(reviewer?.id)}</bdi></dd></div><div><dt>{t.app}</dt><dd><bdi dir="ltr">{applicationId}</bdi></dd></div>{sessionExpiry && <div><dt>{t.sessionExpiry}</dt><dd><time dateTime={sessionExpiry}>{new Date(sessionExpiry).toLocaleString(locale === "ar" ? "ar" : "en")}</time></dd></div>}</dl></details>
          {!sessionExpiry && <p className="reviewer-form-hint">{t.expiryUnavailable}</p>}
          <Button type="button" variant="secondary" onClick={() => void signOut()}>{t.signOut}</Button>
        </div>}
        <FeedbackMessage value={authFeedback}/>
      </section>
    </div>
    <FeedbackMessage value={reviewFeedback}/>

    <section className="x14-data-surface reviewer-registry" aria-labelledby="reviewer-registry-title">
      <header className="reviewer-section-heading"><div><p className="section-index">APPLICATION REGISTRY</p><h3 id="reviewer-registry-title">{t.registry}</h3><p>{t.registryIntro}</p></div><Button type="button" variant="secondary" size="compact" loading={registryState === "loading"} onClick={() => void loadRegistry()}>{t.refreshRegistry}</Button></header>
      {registryState === "loading" ? <p className="x14-empty" role="status">{t.loading}</p> : registryState === "error" ? <p className="reviewer-feedback is-error" role="alert">{registryError || t.registryDenied}</p> : registry.length === 0 ? <p className="x14-empty" role="status">{t.noReviewers}</p> : <div className="reviewer-registry-list">{registry.map((row) => {
        const authorizations = list(row.authorizations).filter((authorization) => authorization.status === "ACTIVE").map((authorization) => text(authorization.capability));
        const handles = list(row.loginHandles).filter((login) => login.status === "ACTIVE").map((login) => text(login.handle)).filter(Boolean);
        const calibration = record(row.calibration);
        return <article className="reviewer-registry-row" key={text(row.id)}>
          <div className="reviewer-registry-primary"><strong>{text(row.displayLabel)}</strong><code><bdi dir="ltr">{text(row.id)}</bdi></code></div>
          <dl className="reviewer-registry-facts"><div><dt>{t.status}</dt><dd><span className={`reviewer-status-tag is-${text(row.status).toLowerCase()}`}>{text(row.status)}</span></dd></div><div><dt>{t.loginStatus}</dt><dd>{handles.length ? handles.join(", ") : t.noLogin}</dd></div><div><dt>{t.authorization}</dt><dd>{authorizations.length ? authorizations.join(", ") : "â€”"}</dd></div><div><dt>{t.calibrationEligibility}</dt><dd>{text(calibration.eligibility) || t.notCalibrated}</dd></div><div><dt>{t.createdAt}</dt><dd><time dateTime={text(row.createdAt)}>{text(row.createdAt) ? new Date(text(row.createdAt)).toLocaleDateString(locale === "ar" ? "ar" : "en") : "â€”"}</time></dd></div></dl>
        </article>;
      })}</div>}
      {!loggedIn && calibrationReadback.length > 0 && <section className="reviewer-admin-readback" aria-label={t.calibrationReadback}><h4>{t.calibrationReadback}</h4>{calibrationReadback.map((row) => <article key={text(row.humanIdentityId)}><strong><bdi dir="ltr">{text(row.humanIdentityId)}</bdi></strong><dl className="reviewer-registry-facts"><div><dt>{t.calibrationEligibility}</dt><dd>{text(row.eligibility) || text(row.status)}</dd></div><div><dt>{t.calibrationAgreement}</dt><dd>{typeof row.agreement === "number" ? `${Math.round(row.agreement * 100)}%` : "—"}</dd></div><div><dt>{t.calibrationAnchors}</dt><dd>{typeof row.anchorCount === "number" ? row.anchorCount : "—"}</dd></div><div><dt>{t.abstentions}</dt><dd>{typeof row.abstentionCount === "number" ? row.abstentionCount : "—"}</dd></div><div><dt>{t.status}</dt><dd>{text(record(row.audit).status) === "VERIFIED" ? t.auditVerified : text(record(row.audit).status)}</dd></div></dl></article>)}</section>}
    </section>

    {loggedIn && <section className="x14-data-surface reviewer-work-area" aria-labelledby="reviewer-work-title">
      <header className="reviewer-section-heading"><div><p className="section-index">REVIEWER WORKSPACE</p><h3 id="reviewer-work-title">{t.workspace}</h3><p>{t.credentials}</p></div><Button type="button" variant="secondary" size="compact" onClick={() => void loadAssignments()}>{t.refresh}</Button></header>
      <div className="reviewer-review-grid">
        <section className="reviewer-subpanel" aria-labelledby="reviewer-calibration-title"><div className="reviewer-subpanel-heading"><div><p className="section-index">ELIGIBILITY</p><h4 id="reviewer-calibration-title">{t.calibration}</h4><p>{t.calibrationIntro}</p></div></div>
          {calibrations.length ? calibrations.map((policy) => {
            const policyId = text(policy.id);
            const rawAnchors = Array.isArray(policy.anchors) ? policy.anchors : [];
            const anchors = rawAnchors.map((anchor) => workflow.parseCalibrationAnchor(anchor)).filter((anchor): anchor is NonNullable<typeof anchor> => anchor !== null);
            const selections = calibrationSelections[policyId] ?? {};
            const progress = workflow.calibrationProgress(anchors, selections);
            const completeContent = anchors.length === rawAnchors.length && progress.complete;
            const policyEligibility = text(record(policy.reviewerCalibration).eligibility);
            const durableCalibration = record(policy.reviewerCalibration);
            const returnedAgreement = typeof durableCalibration.agreement === "number" && Number.isFinite(durableCalibration.agreement) && durableCalibration.agreement >= 0 && durableCalibration.agreement <= 1 ? `${Math.round(durableCalibration.agreement * 100)}%` : "UNKNOWN";
            const durableAnchorCount = typeof durableCalibration.anchorCount === "number" && Number.isInteger(durableCalibration.anchorCount) && durableCalibration.anchorCount >= 0 ? String(durableCalibration.anchorCount) : "UNKNOWN";
            const result = calibrationResults[policyId] ?? (typeof durableCalibration.completedAt === "string" ? { eligibility: policyEligibility, agreement: returnedAgreement, anchors: durableAnchorCount, abstentions: typeof durableCalibration.abstentionCount === "number" ? durableCalibration.abstentionCount : 0 } : undefined);
            const policyState = policyEligibility === "ELIGIBLE" ? t.calibrationEligible : policyEligibility === "EXPIRED" ? t.calibrationExpired : policyEligibility === "INELIGIBLE" ? t.calibrationIneligible : t.calibrationRequired;
            return <article className="reviewer-calibration-card" key={policyId}>
              <header className="reviewer-calibration-heading"><h5>{t.calibrationItem}<span aria-hidden="true"> · </span>{Math.max(1, calibrations.indexOf(policy) + 1)} / {calibrations.length}</h5><span className="reviewer-status-tag">{policyState}</span></header>
              {anchors.map((anchor, index) => {
                const anchorDir = /^ar(?:-|$)/i.test(anchor.language) ? "rtl" : "ltr";
                const choices = [{ value: "A", label: t.chooseA }, { value: "B", label: t.chooseB }, { value: "ABSTAIN", label: t.abstainCalibration }];
                return <section className="reviewer-calibration-item" key={`${policyId}-${index}`} dir={anchorDir} aria-labelledby={`reviewer-calibration-task-${policyId}-${index}`}>
                  <p className="reviewer-calibration-language">{t.language}: <bdi dir="auto">{anchor.language || "—"}</bdi></p>
                  <div className="reviewer-readable-block"><h6 id={`reviewer-calibration-task-${policyId}-${index}`}>{t.task}</h6><p>{anchor.task}</p></div>
                  <div className="reviewer-candidate-grid"><article><h6><bdi dir="ltr">{t.responseA}</bdi></h6><p>{anchor.responseA}</p></article><article><h6><bdi dir="ltr">{t.responseB}</bdi></h6><p>{anchor.responseB}</p></article></div>
                  <div className="reviewer-rubric"><h6>{t.guidance}</h6><p>{anchor.rubric}</p></div>
                  <RadioGroup label={t.calibrationChoice} name={`calibration-${policyId}-${anchor.id}`} value={selections[anchor.id] ?? ""} onChange={(value) => chooseCalibration(policyId, anchor.id, value)} disabled={busy} options={choices} />
                </section>;
              })}
              {anchors.length !== rawAnchors.length && <p className="reviewer-feedback is-error" role="alert">{t.calibrationUnavailable}</p>}
              <p className="reviewer-progress" role="status" aria-live="polite">{progress.answered} / {progress.total} {progress.answered === progress.total ? t.completed : t.progress}{progress.abstentions ? ` · ${t.abstentions}: ${progress.abstentions}` : ""}</p>
              {!completeContent && anchors.length === rawAnchors.length && <p className="reviewer-form-hint" role="status" aria-live="polite">{t.calibrationIncomplete}</p>}
              {completeContent && <div className="reviewer-calibration-ready" role="status" aria-live="polite"><strong>{t.calibrationReady}</strong><span>{progress.completed} {t.completed}</span><span>{t.abstentions}: {progress.abstentions}</span></div>}
              {result && <div className={`reviewer-calibration-result is-${result.eligibility.toLowerCase()}`} role="status" aria-live="polite"><strong>{t.calibrationResult}</strong><dl><div><dt>{t.calibrationEligibility}</dt><dd>{result.eligibility === "ELIGIBLE" ? t.calibrationEligible : result.eligibility === "INELIGIBLE" ? t.calibrationIneligible : result.eligibility}</dd></div><div><dt>{t.calibrationAgreement}</dt><dd>{result.agreement}</dd></div><div><dt>{t.calibrationAnchors}</dt><dd>{result.anchors}</dd></div><div><dt>{t.abstentions}</dt><dd>{result.abstentions}</dd></div><div><dt>{t.status}</dt><dd>{typeof durableCalibration.completedAt === "string" ? new Date(durableCalibration.completedAt).toLocaleString(locale === "ar" ? "ar" : "en") : t.completed}</dd></div></dl></div>}
              <Button type="button" variant="primary" disabled={busy || !completeContent} onClick={() => void submitCalibration(policyId)}>{t.submitCalibration}</Button>
            </article>;
          }) : <p className="x14-empty">{t.noCalibration}</p>}
        </section>
        <section className="reviewer-subpanel" aria-labelledby="reviewer-conflict-title"><div className="reviewer-subpanel-heading"><div><p className="section-index">INDEPENDENCE</p><h4 id="reviewer-conflict-title">{t.conflictDeclaration}</h4></div></div>
          {conflictScopes.map((scope) => { const key = `${text(scope.policyId)}:${text(scope.protocolRevisionId)}`; const values = conflictDeclarations[key] ?? {}; const names = ["didNotAuthor", "didNotPublish", "didNotOperate", "didNotOwn", "didNotAccessOracle", "noOtherProtocolConflict"]; const editable = text(scope.state) !== "CLEARED" || conflictEditing[key] === true; return <article className="reviewer-calibration-card" key={key}><p>{text(scope.state) === "CLEARED" ? t.conflictClear : text(scope.state) === "CONFLICTED" ? t.conflicted : t.requiresAttestation}</p>{names.map((name) => <fieldset className="reviewer-conflict-choice" key={name} disabled={busy || !editable}><legend>{t[name]}</legend><label><input type="radio" name={`conflict-${key}-${name}`} checked={values[name] === true} onChange={() => setConflictDeclarations((current) => ({ ...current, [key]: { ...(current[key] ?? {}), [name]: true } }))}/><span>{t.yes}</span></label><label><input type="radio" name={`conflict-${key}-${name}`} checked={values[name] === false} onChange={() => setConflictDeclarations((current) => ({ ...current, [key]: { ...(current[key] ?? {}), [name]: false } }))}/><span>{t.no}</span></label></fieldset>)}{text(scope.state) === "CLEARED" && !editable ? <Button type="button" variant="secondary" disabled={busy} onClick={() => setConflictEditing((current) => ({ ...current, [key]: true }))}>{t.reviseDeclaration}</Button> : <Button type="button" variant="primary" disabled={busy || names.some((name) => typeof values[name] !== "boolean")} onClick={() => void submitConflictDeclaration(scope)}>{t.recordDeclaration}</Button>}</article>; })}
          {!conflictScopes.length && <p className="x14-empty">{t.requiresAttestation}</p>}
        </section>
        <section className="reviewer-subpanel" aria-labelledby="reviewer-assignments-title"><div className="reviewer-subpanel-heading"><div><p className="section-index">BLIND ASSIGNMENTS</p><h4 id="reviewer-assignments-title">{t.workspace}</h4></div></div>
          {selected ? (() => {
            const projection = workflow.safeReviewProjection(selected.projection, selected.reviewMode === "SINGLE_BOOLEAN" ? "SINGLE_BOOLEAN" : "PAIRWISE") ?? {};
            const control = workflow.metricControl(selected.ratingDefinition);
            const candidates = Array.isArray(projection.candidates) ? projection.candidates : [];
            const prompt = text(projection.prompt) || text(projection.instructions) || text(projection.itemLabel);
            const options = control?.kind === "choices" ? control.values.map((value) => ({ value, label: value === "A" ? t.chooseA : value === "B" ? t.chooseB : value === "TIE" ? t.tie : value })) : control?.kind === "boolean" ? [{ value: "true", label: selected.reviewMode === "SINGLE_BOOLEAN" ? t.meetsCriterion : t.yes }, { value: "false", label: selected.reviewMode === "SINGLE_BOOLEAN" ? t.doesNotMeetCriterion : t.no }] : [];
            const ratingReady = control?.kind === "number" ? Boolean(blindRating) && Number.isFinite(Number(blindRating)) && Number(blindRating) >= control.minimum && Number(blindRating) <= control.maximum && (control.step !== 1 || Number.isInteger(Number(blindRating))) : options.some((option) => option.value === blindRating);
            const contentDir = /^ar(?:-|$)/i.test(text(projection.language)) ? "rtl" : /^en(?:-|$)/i.test(text(projection.language)) ? "ltr" : "auto";
            return <article className="reviewer-selected-assignment" dir={contentDir}>
              <h5>{t.reviewAction}</h5>
              {prompt && <div className="reviewer-readable-block"><h6>{t.blindContext}</h6><p>{prompt}</p></div>}
              {selected.reviewMode === "SINGLE_BOOLEAN" && candidates.length === 1 && <div className="reviewer-readable-block"><h6>{t.candidateResponse}</h6><p>{candidates[0].content}</p></div>}
              {selected.reviewMode === "PAIRWISE" && candidates.length === 2 && <div className="reviewer-candidate-grid">{candidates.map((candidate) => <article key={candidate.label}><h6><bdi dir="ltr">{candidate.label === "A" ? t.responseA : t.responseB}</bdi></h6><p>{candidate.content}</p></article>)}</div>}
              {text(projection.rubric) && <div className="reviewer-rubric"><h6>{t.guidance}</h6><p>{text(projection.rubric)}</p></div>}
              {control?.kind === "number" ? <TextInput id="reviewer-rating-value" label={t.score} type="number" min={control.minimum} max={control.maximum} step={control.step} value={blindRating} onChange={(event) => setBlindRating(event.currentTarget.value)} disabled={busy} /> : options.length > 0 ? <RadioGroup label={t.score} name={`reviewer-rating-${text(selected.id)}`} value={blindRating} onChange={setBlindRating} disabled={busy} options={options} /> : <p className="reviewer-feedback is-error" role="status">{t.ratingUnavailable}</p>}
              {selected.reviewMode !== "SINGLE_BOOLEAN" && <TextArea id="reviewer-rating-rationale" label={t.rationale} maxLength={1000} value={rationale} onChange={(event) => setRationale(event.currentTarget.value)} />}
              <div className="reviewer-inline-actions"><Button type="button" variant="primary" disabled={busy || !ratingReady} onClick={() => void submit(false)}>{t.submit}</Button>{selected.abstentionAllowed === true && <Button type="button" variant="secondary" disabled={busy} onClick={() => void submit(true)}>{t.abstain}</Button>}</div>
            </article>;
          })() : assignments.length ? <ul className="reviewer-assignment-list">{assignments.map((row, index) => <li key={text(row.id)}><span><strong>{t.item} {index + 1}</strong><small>{text(row.status) === "OPENED" ? t.assignmentInProgress : t.assignmentReady}</small></span><Button type="button" variant="secondary" size="compact" disabled={busy} onClick={() => void open(text(row.id))}>{t.open}</Button></li>)}</ul> : <p className="x14-empty">{t.empty}</p>}
        </section>
      </div>
    </section>}
  </section>;
}
