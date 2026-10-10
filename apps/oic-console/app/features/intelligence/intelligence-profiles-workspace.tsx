"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale, View } from "../../i18n";
import type { Row, Snapshot } from "../../types";
import {
  ActionMenu,
  BudgetSlider,
  CommandBar,
  CompareSurface,
  ConfigurationDiff,
  Inspector,
  IntensitySlider,
  NumericStepper,
  ProfilePicker,
  PresetSelector,
  RevisionPicker,
  SegmentedControl,
  StickyActionBar,
  Timeline,
  ToggleControl,
  WorkspaceTabs,
  useConfigurationDraft
} from "../../components/interface";
import { DNARadar, StateBeacon } from "../../components/instruments";
import { metricDefinitions } from "../overview/metric-registry";
import type { DnaDimension } from "../../components/instruments";

type ProfileAction = (action: string, values?: Row) => Promise<Row | null>;
export type DnaDimensionDefinition = { id: string; labelKey: string; description: string; direction: "EVALUATOR_DEFINED"; unit: string; domain: string; sourceType: "EVALUATION_RESULT"; availability: "UNMEASURED"; evidenceType: "VERSIONED_EVALUATION"; dependency: "OIC-7" };
export const dnaDimensionRegistry: readonly DnaDimensionDefinition[] = metricDefinitions.filter((definition) => definition.key.startsWith("dna.")).map((definition) => ({ id: definition.key, labelKey: definition.labelKey, description: definition.valueSemantics, direction: "EVALUATOR_DEFINED", unit: definition.unit, domain: definition.domain, sourceType: "EVALUATION_RESULT", availability: "UNMEASURED", evidenceType: "VERSIONED_EVALUATION", dependency: "OIC-7" }));
type Policy = Record<string, number | boolean>;
const intensityFields = ["contextIntensity", "memoryIntensity", "retrievalIntensity", "reasoningIntensity", "toolsIntensity", "verificationIntensity", "synthesisIntensity", "efficiencyIntensity"] as const;
const budgetFields = ["maxStages", "maxProviderCalls", "maxToolCalls", "maxRetrievalQueries", "maxMemoryItems", "maxCandidates", "maxVerificationRounds", "maxContextTokens", "maxExecutionMs"] as const;
const booleanFields = ["allowMemoryWrites", "allowRevision", "requireEvidence"] as const;
const policyFields = [...intensityFields, ...budgetFields, ...booleanFields] as const;
const limits: Record<(typeof budgetFields)[number], { min: number; max: number; step?: number; unit?: string }> = {
  maxStages: { min: 1, max: 32 }, maxProviderCalls: { min: 1, max: 16 }, maxToolCalls: { min: 0, max: 16 }, maxRetrievalQueries: { min: 0, max: 16 }, maxMemoryItems: { min: 0, max: 64 }, maxCandidates: { min: 1, max: 4 }, maxVerificationRounds: { min: 0, max: 3 }, maxContextTokens: { min: 256, max: 200000, step: 256, unit: "tokens" }, maxExecutionMs: { min: 1000, max: 120000, step: 1000, unit: "ms" }
};
const english: Record<string, string> = {
  title: "Cognitive Profile Engineering", description: "Versioned runtime policy ceilings. Settings describe permitted behavior, not consumption or model quality.", profiles: "Profiles", active: "Active", builtIn: "Built-in", custom: "Custom", archived: "Archived", showArchived: "Show archived", search: "Search profiles", empty: "No profiles match this view.", current: "Current revision", immutable: "IMMUTABLE REVISION", immutableHelp: "Persisted revisions cannot be edited. Create a new revision to change this profile.", preset: "Policy baseline", modified: "Modified", customPreset: "Custom", presetMatch: "Configuration", simple: "Simple", advanced: "Advanced", configuration: "Configuration", comparison: "Compare configuration", dna: "Model DNA / evaluation", relationships: "Relationships and activity", reasoning: "Reasoning ceiling", context: "Context ceiling", memory: "Memory ceiling", retrieval: "Retrieval ceiling", tools: "Tools ceiling", verification: "Verification ceiling", synthesis: "Synthesis ceiling", efficiency: "Efficiency policy", budgets: "Resource ceilings", maxStages: "Maximum stages", maxProviderCalls: "Provider call ceiling", maxToolCalls: "Tool call ceiling", maxRetrievalQueries: "Retrieval query ceiling", maxMemoryItems: "Memory item ceiling", maxCandidates: "Maximum candidates", maxVerificationRounds: "Verification round ceiling", maxContextTokens: "Context token ceiling", maxExecutionMs: "Execution time ceiling", measuredDimensions: "Measured DNA dimensions", configuredDimensions: "Configured / declared DNA", unmeasuredDimensions: "Unmeasured DNA dimensions", switches: "Policy controls", allowMemoryWrites: "Allow memory writes", allowRevision: "Allow response revision", requireEvidence: "Require evidence", saveRevision: "Create new revision", startDraft: "Draft a new revision", cancelDraft: "Discard draft", dirty: "DRAFT MODIFIED", unchanged: "CURRENT", create: "Create custom profile", clone: "Clone selected revision", profileKey: "Profile key", displayName: "Display name", createFrom: "Configuration source", confirmCreate: "Create profile", noSource: "No baseline revision is available.", sourceTruth: "Values are persisted policy limits returned by OIC.", noHistory: "No linked model revision, execution, or profile-scoped audit record is available in this bounded source.", revisionHistory: "Revision history", previous: "Previous revision", cloneAction: "Clone", moreActions: "More actions", inspect: "Technical inspector", lifecycle: "Lifecycle", dnaNote: "Evaluation is not configured. Profile configuration does not produce model measurements.", awaiting: "UNMEASURED · AWAITING OIC-7", dimension: "Dimension", availability: "Availability", provenance: "Provenance", method: "Method / evidence", measured: "Measured", notComparable: "NOT COMPARABLE", measurement: "Measurement", compareProfile: "Compare with", same: "SAME", different: "DIFFERENT", higher: "HIGHER CONFIGURATION", lower: "LOWER CONFIGURATION", added: "ADDED", removed: "REMOVED", effectsUnknown: "Effect unknown", createHelp: "The current API creates a custom policy from the selected configuration; it does not persist a source-profile lineage.", confirmLifecycle: "Confirm lifecycle change", activate: "Activate", disable: "Disable", archive: "Archive", noRestore: "Archived profiles cannot be restored.", cloneHelp: "Cloning copies the selected immutable revision into a new custom profile at revision 1.", pending: "Pending changes", apply: "Create revision", noRevision: "No revision is returned.", verified: "VERIFIED FROM PROFILE READBACK", unknown: "APPLIED · READBACK NOT VERIFIED", failure: "Change was not applied.", openTrace: "View matching execution traces", noTrace: "No matching execution in the current bounded sample.", scopes: "Authorization is enforced by the OIC API for every action.", compareConfig: "Configuration only · higher is not better", builtInLock: "Built-in baseline · read-only", selected: "Selected profile", inspectDNA: "Dimension inspector", close: "Close", simpleHelp: "Common intensities and configured baseline.", advancedHelp: "All schema-backed ceilings and policy switches.", lastChanged: "Created", modelRevisionUses: "Model revisions linked", currentVs: "Current / proposed policy", noChanges: "No configuration differences.", showComparison: "Comparison", baseline: "Baseline", disabled: "Disabled", status: "State", key: "Key", revision: "Revision", source: "Type", policyPreset: "BASELINE", configState: "CONFIGURATION", measuredState: "DNA STATE", compareLabel: "Profile comparison", execution: "Execution", trace: "Trace", audit: "Audit", copiedFrom: "Copy policy from", actionFailure: "The server rejected this operation. Existing data is unchanged.", lifecycleWarn: "This changes profile availability for future model revisions. Existing immutable revisions remain preserved.", selectedRevision: "Selected source revision"
};
const arabic: Record<string, string> = {
  title: "هندسة ملفات القدرات المعرفية", description: "حدود سياسات التشغيل ذات الإصدارات. الإعدادات تحدد السلوك المسموح، ولا تمثل الاستهلاك أو جودة النموذج.", profiles: "الملفات", active: "نشط", builtIn: "مدمج", custom: "مخصص", archived: "مؤرشف", showArchived: "عرض المؤرشف", search: "بحث في الملفات", empty: "لا توجد ملفات مطابقة.", current: "الإصدار الحالي", immutable: "إصدار ثابت", immutableHelp: "لا يمكن تعديل الإصدارات المحفوظة. أنشئ إصداراً جديداً لتغيير الملف.", preset: "خط أساس السياسة", modified: "معدل", customPreset: "مخصص", presetMatch: "الإعداد", simple: "مبسط", advanced: "متقدم", configuration: "الإعدادات", comparison: "مقارنة الإعدادات", dna: "الحمض النووي للنموذج / التقييم", relationships: "العلاقات والنشاط", reasoning: "حد الاستدلال", context: "حد السياق", memory: "حد الذاكرة", retrieval: "حد الاسترجاع", tools: "حد الأدوات", verification: "حد التحقق", synthesis: "حد التوليف", efficiency: "سياسة الكفاءة", budgets: "حدود الموارد", maxStages: "\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u0631\u0627\u062d\u0644", maxProviderCalls: "\u0633\u0642\u0641 \u0627\u0633\u062a\u062f\u0639\u0627\u0621\u0627\u062a \u0645\u0632\u0648\u062f \u0627\u0644\u062e\u062f\u0645\u0629", maxToolCalls: "\u0633\u0642\u0641 \u0627\u0633\u062a\u062f\u0639\u0627\u0621\u0627\u062a \u0627\u0644\u0623\u062f\u0648\u0627\u062a", maxRetrievalQueries: "\u0633\u0642\u0641 \u0627\u0633\u062a\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639", maxMemoryItems: "\u0633\u0642\u0641 \u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0630\u0627\u0643\u0631\u0629", maxCandidates: "\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u0631\u0634\u062d\u064a\u0646", maxVerificationRounds: "\u0633\u0642\u0641 \u062c\u0648\u0644\u0627\u062a \u0627\u0644\u062a\u062d\u0642\u0642", maxContextTokens: "\u0633\u0642\u0641 \u0631\u0645\u0648\u0632 \u0627\u0644\u0633\u064a\u0627\u0642", maxExecutionMs: "\u0633\u0642\u0641 \u0648\u0642\u062a \u0627\u0644\u062a\u0646\u0641\u064a\u0630", measuredDimensions: "\u0623\u0628\u0639\u0627\u062f DNA \u0627\u0644\u0645\u0642\u0627\u0633\u0629", configuredDimensions: "DNA \u0645\u0647\u064a\u0623 / \u0645\u0639\u0644\u0646", unmeasuredDimensions: "\u0623\u0628\u0639\u0627\u062f DNA \u063a\u064a\u0631 \u0645\u0642\u0627\u0633\u0629", switches: "ضوابط السياسة", allowMemoryWrites: "السماح بكتابة الذاكرة", allowRevision: "السماح بمراجعة الإجابة", requireEvidence: "اشتراط الأدلة", saveRevision: "إنشاء إصدار جديد", startDraft: "تحرير إصدار جديد", cancelDraft: "إلغاء المسودة", dirty: "مسودة معدلة", unchanged: "الحالي", create: "إنشاء ملف مخصص", clone: "نسخ الإصدار المحدد", profileKey: "مفتاح الملف", displayName: "الاسم المعروض", createFrom: "مصدر الإعدادات", confirmCreate: "إنشاء الملف", noSource: "لا يتوفر إصدار أساس.", sourceTruth: "القيم حدود سياسة محفوظة كما أعادها OIC.", noHistory: "\u0644\u0627 \u062a\u062a\u0648\u0641\u0631 \u0645\u0631\u0627\u062c\u0639\u0627\u062a \u0646\u0645\u0627\u0630\u062c \u0645\u0631\u062a\u0628\u0637\u0629 \u0623\u0648 \u0633\u062c\u0644\u0627\u062a \u062a\u0646\u0641\u064a\u0630 \u0623\u0648 \u062a\u062f\u0642\u064a\u0642 \u062e\u0627\u0635 \u0628\u0627\u0644\u0645\u0644\u0641 \u0641\u064a \u0627\u0644\u0645\u0635\u062f\u0631 \u0627\u0644\u0645\u062d\u062f\u0648\u062f.", revisionHistory: "سجل الإصدارات", previous: "الإصدار السابق", cloneAction: "نسخ", moreActions: "\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629", inspect: "الفاحص التقني", lifecycle: "دورة الحياة", dnaNote: "التقييم غير مهيأ. إعدادات الملف لا تنتج قياسات للنموذج.", awaiting: "غير مقاس · بانتظار OIC-7", dimension: "البعد", availability: "التوفر", provenance: "المصدر", method: "الطريقة / الدليل", measured: "مقاس", notComparable: "غير قابل للمقارنة", measurement: "القياس", compareProfile: "قارن مع", same: "مطابق", different: "مختلف", higher: "إعداد أعلى", lower: "إعداد أقل", added: "مضاف", removed: "محذوف", effectsUnknown: "الأثر غير معروف", createHelp: "تنشئ الواجهة الحالية سياسة مخصصة من الإعداد المحدد، ولا تحفظ علاقة مصدر بالملف الأصلي.", confirmLifecycle: "تأكيد تغيير دورة الحياة", activate: "تفعيل", disable: "تعطيل", archive: "أرشفة", noRestore: "لا يمكن استعادة الملفات المؤرشفة.", cloneHelp: "ينسخ الإجراء الإصدار الثابت المحدد إلى ملف مخصص جديد بإصدار 1.", pending: "تغييرات معلقة", apply: "إنشاء الإصدار", noRevision: "لم يُعد إصدار.", verified: "تم التحقق من قراءة الملف", unknown: "تم التطبيق · لم يُتحقق من القراءة", failure: "لم يتم تطبيق التغيير.", openTrace: "عرض آثار التنفيذ المطابقة", noTrace: "لا يوجد تنفيذ مطابق في العينة المحدودة الحالية.", scopes: "تُفرض الصلاحيات من واجهة OIC API لكل إجراء.", compareConfig: "الإعدادات فقط · الأعلى ليس أفضل", builtInLock: "خط أساس مدمج · للقراءة فقط", selected: "الملف المحدد", inspectDNA: "فاحص البعد", close: "إغلاق", simpleHelp: "القيم الشائعة وخط الأساس المحدد.", advancedHelp: "كل الحدود ومفاتيح السياسة المعتمدة في المخطط.", lastChanged: "أُنشئ", modelRevisionUses: "مراجعات نماذج مرتبطة", currentVs: "السياسة الحالية / المقترحة", noChanges: "لا توجد فروق في الإعدادات.", showComparison: "\u0645\u0642\u0627\u0631\u0646\u0629", actionFailure: "\u0631\u0641\u0636 \u0627\u0644\u062e\u0627\u062f\u0645 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064a\u0629. \u0644\u0645 \u062a\u062a\u063a\u064a\u0631 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629.", lifecycleWarn: "\u064a\u063a\u064a\u0631 \u0647\u0630\u0627 \u062a\u0648\u0641\u0631 \u0627\u0644\u0645\u0644\u0641 \u0644\u0644\u0625\u0635\u062f\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0642\u0628\u0644\u064a\u0629 \u0644\u0644\u0646\u0645\u0627\u0630\u062c. \u0648\u062a\u0638\u0644 \u0627\u0644\u0625\u0635\u062f\u0627\u0631\u0627\u062a \u0627\u0644\u062b\u0627\u0628\u062a\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0645\u062d\u0641\u0648\u0638\u0629.", baseline: "خط الأساس", disabled: "معطل", status: "الحالة", key: "المفتاح", revision: "الإصدار", source: "النوع", policyPreset: "خط الأساس", configState: "الإعدادات", measuredState: "حالة DNA", compareLabel: "مقارنة الملفات", execution: "التنفيذ", trace: "الأثر", audit: "التدقيق", copiedFrom: "نسخ السياسة من", selectedRevision: "الإصدار المصدر المحدد"
};

function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function rows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((item): item is Row => !!item && typeof item === "object" && !Array.isArray(item)) : []; }
function text(value: unknown, fallback = "—"): string { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
function revisionRows(profile: Row | null): Row[] { return rows(profile?.revisions).sort((a, b) => Number(b.revision ?? 0) - Number(a.revision ?? 0)); }
function policyOf(revision: Row | undefined): Policy | null {
  if (!revision) return null;
  return Object.fromEntries(policyFields.flatMap((key) => {
    const value = revision[key];
    return typeof value === "number" || typeof value === "boolean" ? [[key, value]] : [];
  }));
}
function comparable(policy: Policy): Record<string, number> {
  return Object.fromEntries(policyFields.map((key) => [key, typeof policy[key] === "boolean" ? Number(policy[key]) : Number(policy[key] ?? 0)]));
}
function samePolicy(a: Row | Policy, b: Row | Policy): boolean { return policyFields.every((key) => a[key] === b[key]); }

function linkedModelRevisions(snapshot: Snapshot | null, profileRevisionId: string): Row[] {
  if (!snapshot || !profileRevisionId) return [];
  return rows(snapshot.modelFamilies).flatMap((family) => rows(family.editions).flatMap((edition) => rows(edition.revisions)
    .filter((revision) => text(revision.intelligenceProfileRevisionId, "") === profileRevisionId)
    .map((revision) => ({ ...revision, familyName: text(family.displayName, text(family.familyKey, "Oi model")), familyKey: text(family.familyKey), editionName: text(edition.displayName, text(edition.editionKey, "Edition")), editionId: text(edition.id), modelRevision: text(revision.revision, "—") }))));
}

export function IntelligenceProfilesWorkspace({ profiles, locale, perform, reloadProfiles, executions, snapshot, navigate }: { profiles: Row[]; locale: Locale; perform: ProfileAction; reloadProfiles: () => Promise<Row[]>; executions: Row[]; snapshot: Snapshot | null; navigate: (view: View) => void }) {
  const ar = locale === "ar";
  const t = useCallback((key: string) => (ar ? arabic[key] : english[key]) ?? key, [ar]);
  const dir = ar ? "rtl" : "ltr";
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Row | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState("simple");
  const [activePresetId, setActivePresetId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("policy");
  const [compareId, setCompareId] = useState("");
  const [inspectOpen, setInspectOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileKey, setProfileKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sourceRevisionId, setSourceRevisionId] = useState("");
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dnaSelected, setDnaSelected] = useState<string | undefined>();
  const [confirmLifecycle, setConfirmLifecycle] = useState<"ACTIVE" | "DISABLED" | "ARCHIVED" | null>(null);
  const visibleProfiles = useMemo(() => profiles.filter((profile) => {
    if (!showArchived && profile.lifecycle === "ARCHIVED") return false;
    const needle = query.trim().toLocaleLowerCase();
    return !needle || `${text(profile.displayName)} ${text(profile.profileKey)} ${text(profile.id)}`.toLocaleLowerCase().includes(needle);
  }), [profiles, query, showArchived]);
  const selectedSummary = visibleProfiles.find((profile) => String(profile.id) === selectedId) ?? visibleProfiles[0] ?? null;
  const selectedDetail = detail && String(detail.id) === String(selectedSummary?.id) ? detail : selectedSummary;
  const revisions = revisionRows(selectedDetail);
  const currentRevision = revisions[0];
  const modelRevisionLinks = useMemo(() => revisions.flatMap((profileRevision) => linkedModelRevisions(snapshot, text(profileRevision.id, "")).map((modelRevision): Row => ({ ...modelRevision, editionName: `${text(modelRevision.editionName)} · profile r${text(profileRevision.revision)}` }))), [snapshot, revisions]);
  const currentPolicy = policyOf(currentRevision);
  const policyDraft = useConfigurationDraft<Policy>(currentPolicy ?? {}, currentRevision ? String(currentRevision.id) : undefined);
  const draftRefresh = useRef(policyDraft.refresh);
  draftRefresh.current = policyDraft.refresh;
  const sourceRevision = revisions.find((revision) => String(revision.id) === sourceRevisionId) ?? currentRevision;
  const sourcePolicy = policyOf(sourceRevision);
  const builtinProfiles = profiles.filter((profile) => profile.source === "BUILTIN" && profile.lifecycle !== "ARCHIVED");
  const isCustom = selectedDetail?.source === "CUSTOM";
  const canRevise = isCustom && selectedDetail?.lifecycle === "ACTIVE" && !!currentRevision;
  const editable = canRevise && editing;
  const usePolicy = policyDraft.state.proposed;
  const isDirty = policyDraft.isDirty;
  const presetRows = builtinProfiles.flatMap((profile) => {
    const latest = revisionRows(profile)[0]; const policy = policyOf(latest);
    return policy && latest ? [{ id: String(profile.profileKey), label: String(profile.displayName), values: comparable(policy), policy, revisionId: String(latest.id) }] : [];
  });
  const presetValues = usePolicy ? comparable(usePolicy) : {};
  const matchedPreset = presetRows.find((preset) => Object.keys(preset.values).length === Object.keys(presetValues).length && Object.entries(preset.values).every(([key, value]) => presetValues[key] === value));
  const selectedDNA = useMemo<DnaDimension[]>(() => dnaDimensionRegistry.map((definition) => ({ id: definition.id, label: ar ? arabicDna[definition.id] ?? definition.labelKey : englishDna[definition.id] ?? definition.labelKey, state: definition.availability, stateLabel: t("awaiting") })), [ar, t]);
  const dnaCounts = { measured: selectedDNA.filter((dimension) => dimension.state === "MEASURED").length, configured: 0, unmeasured: selectedDNA.filter((dimension) => dimension.state !== "MEASURED").length };
  const selectedDimension = selectedDNA.find((item) => item.id === dnaSelected) ?? selectedDNA[0];
  const compareOptions = profiles.filter((profile) => String(profile.id) !== String(selectedDetail?.id) && profile.lifecycle !== "ARCHIVED").map((profile) => ({ id: String(profile.id), label: text(profile.displayName), secondary: `${text(profile.profileKey)} · r${text(revisionRows(profile)[0]?.revision, "0")}`, type: profile.source === "BUILTIN" ? t("builtIn") : t("custom"), lifecycle: String(profile.lifecycle) }));
  const sourceRevisionOptions = revisions.map((revision) => ({ id: String(revision.id), label: `${text(selectedDetail?.displayName)} / r${text(revision.revision)}`, secondary: String(revision.id), type: t("revision") }));
  const filteredExecs = executions.filter((item) => item.profileRevisionId && revisions.some((revision) => String(revision.id) === String(item.profileRevisionId)));

  useEffect(() => { if (!selectedId && visibleProfiles[0]) setSelectedId(String(visibleProfiles[0].id)); }, [selectedId, visibleProfiles]);
  useEffect(() => {
    if (!selectedSummary) { setDetail(null); return; }
    let alive = true;
    setLoadingDetail(true); setDetailError("");
    fetch(`/api/console?view=profile-detail&profileId=${encodeURIComponent(String(selectedSummary.id))}`, { cache: "no-store" })
      .then(async (response) => { const value: unknown = await response.json().catch(() => null); if (!response.ok) throw new Error(t("failure")); return record(value); })
      .then((value) => { if (alive) { setDetail(value); setEditing(false); } })
      .catch(() => { if (alive) { setDetailError(t("failure")); setDetail(null); setEditing(false); } })
      .finally(() => { if (alive) setLoadingDetail(false); });
    return () => { alive = false; };
  }, [selectedSummary?.id, t]);
  useEffect(() => { if (currentPolicy && !policyDraft.isDirty) draftRefresh.current(currentPolicy, currentRevision ? String(currentRevision.id) : undefined); }, [selectedSummary?.id, currentRevision?.id, policyDraft.isDirty]);

  const patchDraft = (key: string, value: number | boolean) => { policyDraft.edit({ ...usePolicy, [key]: value }); };
  const refetchDetail = async (id: string) => {
    const response = await fetch(`/api/console?view=profile-detail&profileId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)) return null;
    const found = value as Row;
    setDetail(found);
    return found;
  };
  const apply = async (action: string, values: Row, verify: (result: Row, readback: Row | null) => boolean) => {
    setFeedback("");
    const result = await perform(action, values);
    if (!result) { setFeedback(t("actionFailure")); return false; }
    const readProfiles = await reloadProfiles();
    const candidate = record(result.value ?? result);
    const profileId = text(candidate.profileId ?? candidate.id ?? values.profileId, "");
    const readback = profileId ? await refetchDetail(profileId) : null;
    const verified = verify(candidate, readback);
    setFeedback(verified ? t("verified") : t("unknown"));
    if (verified) { setEditing(false); const nextPolicy = policyOf(revisionRows(readback)[0]); if (nextPolicy) policyDraft.verify(nextPolicy, text(revisionRows(readback)[0]?.id, ""), t("verified")); }
    if (!readback && readProfiles.length) setDetail(readProfiles.find((row) => String(row.id) === profileId) ?? null);
    return verified;
  };
  const create = async (kind: "create" | "clone", sourceRevisionId: string, policy: Policy) => {
    if (!profileKey || !displayName.trim()) return;
    setCreating(true);
    const payload = kind === "clone" ? { sourceRevisionId, profileKey, displayName: displayName.trim() } : { profileKey, displayName: displayName.trim(), policy };
    const result = await perform(kind === "clone" ? "intelligence.profile.clone" : "intelligence.profile.create", payload);
    if (!result) { setFeedback(t("actionFailure")); setCreating(false); return; }
    const foundProfiles = await reloadProfiles();
    const returned = record(result?.value ?? result);
    const found = foundProfiles.find((item) => String(item.id) === String(returned.id) || item.profileKey === profileKey);
    const readback = found ? await refetchDetail(String(found.id)) : null;
    const createdPolicy = policyOf(revisionRows(readback)[0]);
    const verified = !!readback && readback.profileKey === profileKey && readback.displayName === displayName.trim() && !!createdPolicy && samePolicy(createdPolicy, policy);
    setFeedback(verified ? t("verified") : t("unknown"));
    if (verified && readback) { setSelectedId(String(readback.id)); setDetail(readback); const nextPolicy = policyOf(revisionRows(readback)[0]); if (nextPolicy) policyDraft.verify(nextPolicy, text(revisionRows(readback)[0]?.id, ""), t("verified")); setCreateOpen(false); setProfileKey(""); setDisplayName(""); }
    setCreating(false);
  };
  const changeLifecycle = async () => {
    if (!selectedDetail || !confirmLifecycle) return;
    const next = confirmLifecycle;
    setConfirmLifecycle(null);
    await apply("intelligence.profile.lifecycle", { profileId: String(selectedDetail.id), lifecycle: next }, (_result, readback) => !!readback && readback.lifecycle === next);
  };
  const detailRows = revisions.map((revision) => ({ id: String(revision.id), title: `r${text(revision.revision)}`, detail: `${t("modelRevisionUses")}: ${text(record(revision._count).modelRevisions, "0")}`, time: typeof revision.createdAt === "string" ? new Date(revision.createdAt).toLocaleString(locale) : undefined, tone: "neutral" as const }));
  const compared = profiles.find((profile) => String(profile.id) === compareId) ?? null;
  const comparedRevision = compared ? revisionRows(compared)[0] : undefined;
  const comparedPolicy = policyOf(comparedRevision);
  const labels = Object.fromEntries(policyFields.map((field) => [field, t(policyLabel[field])])) as Partial<Record<keyof Policy, string>>;

  return <section className="x16-profiles" dir={dir}>
    <header className="x16-page-head"><div><small>OIC / INTELLIGENCE SYSTEMS · X1.6</small><h2>{t("title")}</h2><p>{t("description")}</p></div><div className="x16-head-count"><b>{profiles.length}</b><small>{t("profiles")}</small><button type="button" className="oi-action is-primary" onClick={() => { setCreateOpen(true); setProfileKey(""); setDisplayName(""); setSourceRevisionId(text(currentRevision?.id, "")); }} disabled={!currentRevision}>{t("create")}</button></div></header>
    <div className="x16-summary-strip"><Summary count={profiles.filter((p) => p.source === "BUILTIN").length} label={t("builtIn")} /><Summary count={profiles.filter((p) => p.source === "CUSTOM").length} label={t("custom")} /><Summary count={profiles.filter((p) => p.lifecycle === "ACTIVE").length} label={t("active")} /><Summary count={profiles.filter((p) => p.lifecycle === "ARCHIVED").length} label={t("archived")} /></div>
    <CommandBar title={t("profiles")}><label className="x16-search"><span>{t("search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={t("search")} /></label><div className="x16-check"><ToggleControl label={t("showArchived")} value={showArchived} onChange={setShowArchived} dir={dir} /></div></CommandBar>
    {feedback && <p className={`x16-feedback ${feedback.includes(t("unknown")) || feedback.includes(t("failure")) ? "is-warning" : "is-good"}`} role="status">{feedback}</p>}
    <div className="x16-layout">
      <aside className="x16-index"><header><b>{t("profiles")}</b><span>{visibleProfiles.length.toString().padStart(2, "0")}</span></header><div className="x16-index-list">{visibleProfiles.length === 0 && <p className="x16-empty">{t("empty")}</p>}{visibleProfiles.map((profile) => {
        const latest = revisionRows(profile)[0];
        return <button type="button" key={String(profile.id)} className={`x16-index-item ${String(profile.id) === String(selectedDetail?.id) ? "is-selected" : ""}`} onClick={() => { policyDraft.reset(); setSelectedId(String(profile.id)); setActiveTab("policy"); setActivePresetId(undefined); setFeedback(""); }} aria-pressed={String(profile.id) === String(selectedDetail?.id)}><StateBeacon state={profile.lifecycle === "ACTIVE" ? "READY" : profile.lifecycle === "ARCHIVED" ? "IDLE" : "DEGRADED"} size="XS"/><span><b>{text(profile.displayName)}</b><small>{text(profile.profileKey)} · {profile.source === "BUILTIN" ? t("builtIn") : t("custom")}</small></span><em className={`x16-status is-${String(profile.lifecycle).toLowerCase()}`}>{text(profile.lifecycle)}</em><small className="x16-rev-count">r{text(latest?.revision, "0")} · {text(record(profile._count).revisions, "0")} rev</small></button>;
      })}</div></aside>
      {selectedDetail ? <main className="x16-main">
        <header className="x16-profile-head"><div><small>{text(selectedDetail.profileKey)} / {selectedDetail.source === "BUILTIN" ? t("builtInLock") : t("custom")}</small><h3>{text(selectedDetail.displayName)}</h3><p>{text(selectedDetail.description, "")}</p></div><div className="x16-profile-meta"><span>{t("current")}<b>r{text(currentRevision?.revision, "0")}</b></span><span>{t("lifecycle")}<b className={`x16-status is-${String(selectedDetail.lifecycle).toLowerCase()}`}>{text(selectedDetail.lifecycle)}</b></span><span>{t("configState")}<b>{matchedPreset?.label ?? t("customPreset")}{isDirty ? ` \u00b7 ${t("modified")}` : ""}</b></span><span>{t("measuredState")}<b className="is-muted">{t("awaiting")}</b></span></div><div className="x16-profile-actions"><button type="button" className="oi-action is-secondary" onClick={() => setInspectOpen(true)}>{t("inspect")}</button><button type="button" className="oi-action is-primary" disabled={!currentRevision || selectedDetail.lifecycle === "ARCHIVED"} onClick={() => { setCreateOpen(true); setProfileKey(""); setDisplayName(""); setSourceRevisionId(text(currentRevision?.id, "")); }}>{t("clone")}</button>{selectedDetail.source === "CUSTOM" && <ActionMenu label={t("moreActions")} items={[...(selectedDetail.lifecycle === "DISABLED" ? [{ id: "ACTIVE", label: t("activate") }] : []), ...(selectedDetail.lifecycle === "ACTIVE" ? [{ id: "DISABLED", label: t("disable") }, { id: "ARCHIVED", label: t("archive"), tone: "critical" as const }] : [])]} onAction={(action) => setConfirmLifecycle(action as "ACTIVE" | "DISABLED" | "ARCHIVED")} />}</div></header>
        {loadingDetail && <p className="x16-muted" role="status">{t("current")}…</p>}{detailError && <p className="x16-feedback is-warning" role="alert">{detailError}</p>}
        <WorkspaceTabs label={t("selected")} selected={activeTab} onSelectionChange={setActiveTab} dir={dir} items={[
          { id: "policy", label: t("configuration"), content: <div className="x16-tab-stack"><div className="x16-workspace-title"><div><h4>{t("configuration")}</h4><p>{t("sourceTruth")}</p></div><span className="oi-state-tag is-amber">{t("immutable")}</span></div><div className="x16-governance"><b>{t("immutable")}</b><span>{t("immutableHelp")}</span>{isCustom && <button type="button" className="oi-action is-secondary" disabled={!canRevise} onClick={() => { policyDraft.reset(); setActivePresetId(matchedPreset?.id); setEditing(true); }}>{t("startDraft")}</button>}</div>
            <SegmentedControl label={t("configuration")} value={mode} onChange={setMode} options={[{ id: "simple", label: t("simple"), description: t("simpleHelp") }, { id: "advanced", label: t("advanced"), description: t("advancedHelp") }]} dir={dir} />
            {mode === "simple" && (editable ? <PresetSelector label={t("preset")} presets={presetRows.map(({ id, label, values }) => ({ id, label, values }))} value={presetValues} onChange={(preset) => { const selected = presetRows.find((item) => item.id === preset.id); if (selected) { policyDraft.edit(selected.policy); setActivePresetId(preset.id); } }} activePresetId={activePresetId ?? matchedPreset?.id} customLabel={t("customPreset")} modifiedLabel={t("modified")} matchLabel={t("presetMatch")} locale={locale} dir={dir} /> : <div className="x16-preset-readonly"><small>{t("preset")}</small><b>{matchedPreset?.label ?? t("customPreset")}{isDirty ? ` · ${t("modified")}` : ""}</b></div>)}
            {mode === "simple" && <><div className="x16-control-grid">{intensityFields.map((field) => <IntensitySlider key={field} label={t(policyLabel[field])} value={Number(usePolicy?.[field] ?? 0)} onChange={(value) => patchDraft(field, value)} min={0} max={100} step={1} unit="%" locale={locale} dir={dir} density="compact" disabled={!editable} stateLabel={t("sourceTruth")} />)}</div><div className="x16-control-grid">{(["maxStages", "maxProviderCalls", "maxToolCalls", "maxRetrievalQueries"] as const).map((field) => <BudgetSlider key={field} label={t(policyLabel[field])} value={Number(usePolicy?.[field] ?? limits[field].min)} onChange={(value) => patchDraft(field, value)} min={limits[field].min} max={limits[field].max} step={limits[field].step ?? 1} unit={limits[field].unit} locale={locale} dir={dir} density="compact" disabled={!editable} stateLabel={t("sourceTruth")} />)}</div></>}
            {mode === "advanced" && <div className="x16-advanced-grid"><section><h5>{t("budgets")}</h5>{budgetFields.map((field) => <BudgetSlider key={field} label={t(policyLabel[field])} value={Number(usePolicy?.[field] ?? limits[field].min)} onChange={(value) => patchDraft(field, value)} min={limits[field].min} max={limits[field].max} step={limits[field].step ?? 1} unit={limits[field].unit} locale={locale} dir={dir} density="compact" disabled={!editable} stateLabel={t("sourceTruth")} />)}</section><section><h5>{t("switches")}</h5>{intensityFields.map((field) => <NumericStepper key={field} label={t(policyLabel[field])} value={Number(usePolicy?.[field] ?? 0)} onChange={(value) => patchDraft(field, value)} min={0} max={100} step={1} unit="%" locale={locale} dir={dir} density="compact" disabled={!editable} />)}{booleanFields.map((field) => <ToggleControl key={field} label={t(field)} value={Boolean(usePolicy?.[field])} onChange={(value) => patchDraft(field, value)} dir={dir} permission={editable ? { kind: "allowed" } : { kind: "read-only", reason: t("immutableHelp") }} />)}</section></div>}
            {editing && currentPolicy && usePolicy && <div className="x16-review"><h5>{t("currentVs")}</h5><ConfigurationDiff current={currentPolicy} proposed={usePolicy} labels={labels} locale={locale} columnLabels={{ parameter: t("configuration"), current: t("current"), proposed: t("dirty"), change: t("comparison") }} /></div>}
            {editing && <StickyActionBar label={t("pending")}><span>{isDirty ? t("dirty") : t("unchanged")} · {t("effectsUnknown")}</span><button type="button" className="oi-action is-quiet" onClick={() => { policyDraft.reset(); setEditing(false); setActivePresetId(matchedPreset?.id); }}>{t("cancelDraft")}</button><button type="button" className="oi-action is-primary" disabled={!isDirty || !usePolicy} onClick={() => { if (!selectedDetail || !usePolicy) return; void apply("intelligence.profile.revision", { profileId: String(selectedDetail.id), policy: usePolicy }, (result, readback) => revisionRows(readback).some((revision) => String(revision.id) === String(result.id) && samePolicy(policyOf(revision) ?? {}, usePolicy))); }}>{t("saveRevision")}</button></StickyActionBar>}
            <div className="x16-config-footer"><b>{t("effectsUnknown")}</b><span>{t("dnaNote")}</span></div>
          </div> },
          { id: "comparison", label: t("comparison"), content: <div className="x16-tab-stack"><header className="x16-workspace-title"><div><h4>{t("compareLabel")}</h4><p>{t("compareConfig")}</p></div><ProfilePicker label={t("compareProfile")} value={compareId} onChange={setCompareId} options={compareOptions} placeholder={t("compareProfile")} searchLabel={t("search")} emptyLabel={t("empty")} dir={dir} locale={locale} /></header>{compared && comparedPolicy && currentPolicy ? <><CompareSurface title={t("comparison")} leftLabel={`${text(selectedDetail.displayName)} · r${text(currentRevision?.revision)}`} rightLabel={`${text(compared.displayName)} · r${text(comparedRevision?.revision)}`} left={<PolicyList policy={currentPolicy} against={comparedPolicy} labels={labels} locale={locale} />} right={<PolicyList policy={comparedPolicy} against={currentPolicy} labels={labels} locale={locale} />} /><ConfigurationDiff current={currentPolicy} proposed={comparedPolicy} labels={labels} locale={locale} columnLabels={{ parameter: t("configuration"), current: t("selected"), proposed: t("compareProfile"), change: t("different") }} /></> : <p className="x16-empty">{t("empty")}</p>}<p className="x16-config-footer"><b>{t("measurement")}: {t("awaiting")}</b><span>{t("dnaNote")}</span></p></div> },
          { id: "dna", label: t("dna"), content: <div className="x16-dna-layout"><section className="x16-dna-surface"><header><div><h4>{t("dna")}</h4><p>{t("dnaNote")}</p></div><StateBeacon state="UNMEASURED" stateLabel={t("awaiting")} /></header><div className="x16-dna-counts"><Summary count={dnaCounts.measured} label={t("measuredDimensions")} /><Summary count={dnaCounts.configured} label={t("configuredDimensions")} /><Summary count={dnaCounts.unmeasured} label={t("unmeasuredDimensions")} /></div><DNARadar dimensions={selectedDNA} onSelect={setDnaSelected} label={t("dna")} dimensionsLabel={t("dimension")} measuredLabel={t("measured")} /><p className="x16-dna-note">{t("awaiting")} · OIC-7 evaluator output has not been returned.</p></section><section className="x16-dna-surface"><h4>{t("dimension")}</h4><div className="x16-dna-table" role="table"><div role="row"><b role="columnheader">{t("dimension")}</b><b role="columnheader">{t("availability")}</b><b role="columnheader">{t("provenance")}</b></div>{selectedDNA.map((dimension) => <button type="button" role="row" key={dimension.id} className={dnaSelected === dimension.id ? "is-selected" : ""} onClick={() => setDnaSelected(dimension.id)}><span role="cell">{dimension.label}</span><span role="cell">{t("awaiting")}</span><span role="cell">{dnaDimensionRegistry.find((entry) => entry.id === dimension.id)?.sourceType} / {dnaDimensionRegistry.find((entry) => entry.id === dimension.id)?.dependency}</span></button>)}</div>{selectedDimension && <div className="x16-detail-box"><b>{selectedDimension.label}</b><span>{t("availability")}: {t("awaiting")}</span><span>{t("provenance")}: {dnaDimensionRegistry.find((entry) => entry.id === selectedDimension.id)?.sourceType} / {dnaDimensionRegistry.find((entry) => entry.id === selectedDimension.id)?.dependency}</span><span>{t("method")}: {dnaDimensionRegistry.find((entry) => entry.id === selectedDimension.id)?.description}</span><span>{t("availability")}: {dnaDimensionRegistry.find((entry) => entry.id === selectedDimension.id)?.domain} / {dnaDimensionRegistry.find((entry) => entry.id === selectedDimension.id)?.unit} / {dnaDimensionRegistry.find((entry) => entry.id === selectedDimension.id)?.direction}</span></div>}</section></div> },
          { id: "relationships", label: t("relationships"), content: <div className="x16-tab-stack"><h4>{t("relationships")}</h4><Timeline label={t("revisionHistory")} events={detailRows} /><section className="x16-relation-card"><h5>{t("modelRevisionUses")}</h5>{modelRevisionLinks.length ? modelRevisionLinks.map((revision) => <div key={String(revision.id)}><span>{text(revision.familyName)} · {text(revision.editionName)} / r{text(revision.modelRevision)}</span><bdi>{text(revision.id)}</bdi></div>) : <p className="x16-empty">{t("noHistory")}</p>}<small>{t("scopes")}</small></section><p className="x16-empty">{filteredExecs.length ? `${filteredExecs.length} ${t("execution")}` : t("noHistory")}</p>{filteredExecs.length > 0 && <button type="button" className="oi-action is-secondary" onClick={() => navigate("traces")}>{t("openTrace")}</button>}<small>{t("scopes")}</small></div> }
        ]} />
      </main> : <div className="x16-empty">{t("empty")}</div>}
    </div>
    <Inspector open={createOpen} onClose={() => setCreateOpen(false)} title={t("create")} description={t("createHelp")} closeLabel={t("close")} dir={dir} footer={<><button type="button" className="oi-action is-quiet" onClick={() => setCreateOpen(false)}>{t("cancelDraft")}</button><button type="button" className="oi-action is-secondary" disabled={creating || !profileKey || !/^[a-z][a-z0-9._-]{1,63}$/.test(profileKey) || !displayName.trim() || !sourceRevision} onClick={() => { if (sourceRevision) void create("clone", text(sourceRevision.id), sourcePolicy ?? {}); }}>{t("clone")}</button><button type="button" className="oi-action is-primary" disabled={creating || !profileKey || !/^[a-z][a-z0-9._-]{1,63}$/.test(profileKey) || !displayName.trim() || !sourcePolicy} onClick={() => { if (sourcePolicy) void create("create", text(sourceRevision?.id, ""), sourcePolicy); }}>{t("confirmCreate")}</button></>}>
      <div className="x16-create-dialog" dir={dir}><header><div><small>OIC / PROFILE</small></div></header><label>{t("displayName")}<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={160} required /></label><label>{t("profileKey")}<input value={profileKey} onChange={(event) => setProfileKey(event.target.value)} pattern="[a-z][a-z0-9._-]{1,63}" maxLength={64} required /></label><RevisionPicker label={t("selectedRevision")} value={text(sourceRevision?.id, "")} onChange={setSourceRevisionId} options={sourceRevisionOptions} placeholder={t("selectedRevision")} searchLabel={t("search")} emptyLabel={t("noSource")} dir={dir} locale={locale} /><div className="x16-form-source"><b>{text(selectedDetail?.displayName)}</b><span>{t("revision")} r{text(sourceRevision?.revision)} / {t("sourceTruth")}</span></div></div>
    </Inspector>
    {confirmLifecycle && selectedDetail && <Inspector open={!!confirmLifecycle} onClose={() => setConfirmLifecycle(null)} title={`${t("confirmLifecycle")}: ${confirmLifecycle}`} description={t("lifecycleWarn")} closeLabel={t("close")} dir={dir} footer={<><button type="button" className="oi-action is-quiet" onClick={() => setConfirmLifecycle(null)}>{t("cancelDraft")}</button><button type="button" className="oi-action is-danger" onClick={() => void changeLifecycle()}>{t("confirmLifecycle")}</button></>}><div className="x16-create-dialog">{confirmLifecycle === "ARCHIVED" && <p>{t("noRestore")}</p>}</div></Inspector>}
    <Inspector open={inspectOpen} onClose={() => setInspectOpen(false)} title={t("inspect")} description={t("dnaNote")} closeLabel={t("close")} dir={dir}><div className="x16-inspector-content"><h4>{text(selectedDetail?.displayName)}</h4><p>{t("key")}: <bdi>{text(selectedDetail?.profileKey)}</bdi></p><p>{t("source")}: {text(selectedDetail?.source)} · {t("lifecycle")}: {text(selectedDetail?.lifecycle)}</p><p>{t("current")}: r{text(currentRevision?.revision)}</p><p className="x16-technical">ID: <bdi>{text(selectedDetail?.id)}</bdi></p><h4>{t("revisionHistory")}</h4><Timeline label={t("revisionHistory")} events={detailRows} />{currentRevision && <p className="x16-technical">Revision ID: <bdi>{text(currentRevision.id)}</bdi></p>}<h4>{t("relationships")}</h4>{modelRevisionLinks.length ? modelRevisionLinks.map((revision) => <p key={String(revision.id)}>{text(revision.familyName)} · {text(revision.editionName)} / r{text(revision.modelRevision)} <bdi>{text(revision.id)}</bdi></p>) : <p>{t("noHistory")}</p>}<p>{t("audit")}: {t("noHistory")}</p><h4>{t("measuredState")}</h4><p>{t("awaiting")}</p></div></Inspector>
  </section>;
}

const policyLabel: Record<string, string> = { contextIntensity: "context", memoryIntensity: "memory", retrievalIntensity: "retrieval", reasoningIntensity: "reasoning", toolsIntensity: "tools", verificationIntensity: "verification", synthesisIntensity: "synthesis", efficiencyIntensity: "efficiency", maxStages: "maxStages", maxProviderCalls: "maxProviderCalls", maxToolCalls: "maxToolCalls", maxRetrievalQueries: "maxRetrievalQueries", maxMemoryItems: "maxMemoryItems", maxCandidates: "maxCandidates", maxVerificationRounds: "maxVerificationRounds", maxContextTokens: "maxContextTokens", maxExecutionMs: "maxExecutionMs", allowMemoryWrites: "allowMemoryWrites", allowRevision: "allowRevision", requireEvidence: "requireEvidence" };
const englishDna: Record<string, string> = { "dna.reasoning": "Reasoning", "dna.retrieval": "Retrieval", "dna.evidence": "Evidence handling", "dna.memory": "Memory utility", "dna.verification": "Verification", "dna.tools": "Tool orchestration", "dna.search": "Search / adaptation", "dna.repair": "Self repair", "dna.reliability": "Reliability", "dna.efficiency": "Efficiency", "dna.latency": "Latency discipline", "dna.cost": "Cost efficiency", "dna.stability": "Stability" };
const arabicDna: Record<string, string> = { "dna.reasoning": "الاستدلال", "dna.retrieval": "الاسترجاع", "dna.evidence": "معالجة الأدلة", "dna.memory": "منفعة الذاكرة", "dna.verification": "التحقق", "dna.tools": "تنسيق الأدوات", "dna.search": "البحث والتكيف", "dna.repair": "الإصلاح الذاتي", "dna.reliability": "الموثوقية", "dna.efficiency": "الكفاءة", "dna.latency": "انضباط زمن الاستجابة", "dna.cost": "كفاءة التكلفة", "dna.stability": "الاستقرار" };
function Summary({ count, label }: { count: number; label: string }) { return <div className="x16-summary-item"><b>{count.toString().padStart(2, "0")}</b><small>{label}</small></div>; }
function PolicyList({ policy, against, labels, locale }: { policy: Policy; against: Policy; labels: Partial<Record<keyof Policy, string>>; locale: Locale }) { return <dl className="x16-policy-list">{policyFields.map((field) => { const value = policy[field]; const other = against[field]; const marker = value === other ? (locale === "ar" ? "مطابق" : "SAME") : typeof value === "number" && typeof other === "number" ? value > other ? (locale === "ar" ? "إعداد أعلى" : "HIGHER CONFIGURATION") : (locale === "ar" ? "إعداد أقل" : "LOWER CONFIGURATION") : (locale === "ar" ? "مختلف" : "DIFFERENT"); return <div key={field}><dt>{labels[field]}</dt><dd>{typeof value === "boolean" ? String(value) : value}<small>{marker}</small></dd></div>; })}</dl>; }
