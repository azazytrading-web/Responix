import type { ShowcaseSignal, ShowcaseSignalKind } from "./flight-deck-composition";

export type CoreVitalPolarity = "HIGH_IS_BAD" | "HIGH_IS_GOOD" | "TARGET_RANGE" | "NONE";
export type CoreVitalSourceState = "LIVE" | "SNAPSHOT" | "PLANNED" | "UNMEASURED" | "UNAVAILABLE" | "STALE";
export type CoreVitalMaturity = "CURRENT_SOURCE" | "FUTURE_CAPABILITY" | "OIC7_CANDIDATE";
export type CoreVitalCategory = "PRIMARY_PRESSURE" | "SUBSYSTEM_PRESSURE" | "THROUGHPUT" | "CAPACITY";

export type CoreVitalDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  labelAr: string;
  shortLabelAr: string;
  description: string;
  descriptionAr: string;
  category: CoreVitalCategory;
  instrument: ShowcaseSignalKind;
  unit: string;
  bounds: readonly [number, number] | null;
  polarity: CoreVitalPolarity;
  thresholdContract: string;
  sourceAdapter: string;
  sourceState: CoreVitalSourceState;
  freshness: "UNKNOWN" | "SOURCE_CONTROLLED";
  maturity: CoreVitalMaturity;
  futureCapability: string;
  phase: "PRIMARY" | "SECONDARY" | "THROUGHPUT";
};

const pressureThreshold = "0–34 normal; 35–59 elevated; 60–79 warning; 80–100 critical. HIGH_IS_BAD.";
const planned = (sourceAdapter: string, futureCapability: string, sourceState: "PLANNED" | "UNMEASURED" = "UNMEASURED"): Pick<CoreVitalDefinition, "sourceState" | "freshness" | "maturity" | "sourceAdapter" | "futureCapability"> => ({ sourceState, freshness: "UNKNOWN", maturity: "FUTURE_CAPABILITY", sourceAdapter, futureCapability });

export const coreVitalRegistry: readonly CoreVitalDefinition[] = [
  { id: "vital.inbound-pressure", label: "Inbound data pressure", shortLabel: "Inbound", labelAr: "ضغط البيانات الواردة", shortLabelAr: "الوارد", description: "Volume and pressure entering the OIC core.", descriptionAr: "حجم وضغط البيانات الداخلة إلى نواة OIC.", category: "PRIMARY_PRESSURE", instrument: "pressure", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC ingress pressure adapter", "Measured ingress volume and bounded queue pressure"), phase: "PRIMARY" },
  { id: "vital.compute-pressure", label: "Compute pressure", shortLabel: "Compute", labelAr: "ضغط الحوسبة", shortLabelAr: "الحوسبة", description: "Current computational resource pressure.", descriptionAr: "ضغط موارد الحوسبة الحالي.", category: "PRIMARY_PRESSURE", instrument: "radial", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC runtime resource adapter", "CPU, accelerator and memory pressure from runtime sources"), phase: "PRIMARY" },
  { id: "vital.reasoning-pressure", label: "Reasoning pressure", shortLabel: "Reasoning", labelAr: "ضغط الاستدلال", shortLabelAr: "الاستدلال", description: "Current reasoning and cognitive workload.", descriptionAr: "عبء الاستدلال والمعالجة المعرفية الحالي.", category: "PRIMARY_PRESSURE", instrument: "arc", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC execution-stage adapter", "Reasoning-stage workload from persisted runtime telemetry"), phase: "PRIMARY" },
  { id: "vital.context-saturation", label: "Context saturation", shortLabel: "Context", labelAr: "تشبع السياق", shortLabelAr: "السياق", description: "Context-window resource saturation.", descriptionAr: "مستوى استهلاك موارد نافذة السياق.", category: "CAPACITY", instrument: "rail", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC context-window adapter", "Context capacity utilization from the selected runtime"), phase: "SECONDARY" },
  { id: "vital.retrieval-load", label: "Retrieval load", shortLabel: "Retrieval", labelAr: "حمل الاسترجاع", shortLabelAr: "الاسترجاع", description: "Current retrieval subsystem activity and load.", descriptionAr: "نشاط وحمل نظام الاسترجاع الحالي.", category: "SUBSYSTEM_PRESSURE", instrument: "rail", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC retrieval adapter", "Live retrieval queue and execution pressure"), phase: "SECONDARY" },
  { id: "vital.memory-pressure", label: "Memory pressure", shortLabel: "Memory", labelAr: "ضغط الذاكرة", shortLabelAr: "الذاكرة", description: "Memory read, write and relevance activity pressure.", descriptionAr: "ضغط نشاط قراءة الذاكرة وكتابتها ومدى ملاءمتها.", category: "SUBSYSTEM_PRESSURE", instrument: "pressure", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC memory adapter", "Memory subsystem utilization and operation pressure"), phase: "SECONDARY" },
  { id: "vital.verification-load", label: "Verification load", shortLabel: "Verify", labelAr: "حمل التحقق", shortLabelAr: "التحقق", description: "Verifier and critique workload.", descriptionAr: "عبء التحقق والنقد.", category: "SUBSYSTEM_PRESSURE", instrument: "arc", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC verification adapter", "Verifier workload from authoritative runtime events"), phase: "SECONDARY" },
  { id: "vital.tool-execution-load", label: "Tool / execution load", shortLabel: "Tools", labelAr: "حمل الأدوات والتنفيذ", shortLabelAr: "الأدوات", description: "Current tools and runtime action activity.", descriptionAr: "نشاط الأدوات وإجراءات بيئة التشغيل الحالية.", category: "SUBSYSTEM_PRESSURE", instrument: "rail", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC tool-runner adapter", "Tool execution pressure from runtime telemetry"), phase: "SECONDARY" },
  { id: "vital.provider-pressure", label: "Provider pressure", shortLabel: "Provider", labelAr: "ضغط المورّد", shortLabelAr: "المورّد", description: "Upstream provider execution pressure.", descriptionAr: "ضغط تنفيذ المورّدين الخارجيين.", category: "SUBSYSTEM_PRESSURE", instrument: "pressure", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC provider telemetry adapter", "Provider capacity and execution pressure from authoritative health signals"), phase: "SECONDARY" },
  { id: "vital.queue-pressure", label: "Queue pressure", shortLabel: "Queue", labelAr: "ضغط قائمة الانتظار", shortLabelAr: "الانتظار", description: "Pending runtime workload pressure.", descriptionAr: "ضغط أعباء التشغيل المعلّقة.", category: "SUBSYSTEM_PRESSURE", instrument: "rail", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC runtime queue adapter", "Queue depth against an authoritative capacity bound"), phase: "SECONDARY" },
  { id: "vital.fault-pressure", label: "Fault / error pressure", shortLabel: "Faults", labelAr: "ضغط الأعطال والأخطاء", shortLabelAr: "الأعطال", description: "Bounded fault pressure when an authoritative source is present.", descriptionAr: "ضغط الأعطال ضمن حد معلوم عند توفر مصدر موثوق.", category: "SUBSYSTEM_PRESSURE", instrument: "arc", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_BAD", thresholdContract: pressureThreshold, ...planned("OIC fault telemetry adapter", "Bounded error pressure using authoritative fault rate and threshold"), phase: "SECONDARY" },
  { id: "vital.cache-reuse", label: "Cache / reuse activity", shortLabel: "Cache", labelAr: "نشاط الذاكرة المؤقتة وإعادة الاستخدام", shortLabelAr: "التخزين المؤقت", description: "Cache hit and safe reuse activity, when measured.", descriptionAr: "نشاط إصابات الذاكرة المؤقتة وإعادة الاستخدام الآمن عند قياسه.", category: "THROUGHPUT", instrument: "rail", unit: "%", bounds: [0, 100], polarity: "HIGH_IS_GOOD", thresholdContract: "No threshold until an authoritative cache/reuse contract is defined.", ...planned("OIC cache telemetry adapter", "Cache hit and reuse activity from an authoritative source", "PLANNED"), phase: "THROUGHPUT" },
  { id: "vital.request-throughput", label: "Request throughput", shortLabel: "Requests", labelAr: "معدل الطلبات", shortLabelAr: "الطلبات", description: "Measured request rate from OIC ingress.", descriptionAr: "معدل الطلبات المقاس عند بوابة OIC.", category: "THROUGHPUT", instrument: "numeric", unit: "req/min", bounds: null, polarity: "NONE", thresholdContract: "Rate requires a time-windowed authoritative counter.", ...planned("OIC ingress counter adapter", "Requests per minute with declared measurement window", "PLANNED"), phase: "THROUGHPUT" },
  { id: "vital.token-throughput", label: "Token / unit throughput", shortLabel: "Units", labelAr: "معدل الرموز والوحدات", shortLabelAr: "الوحدات", description: "Measured token or execution-unit throughput.", descriptionAr: "معدل الرموز أو وحدات التنفيذ المقاس.", category: "THROUGHPUT", instrument: "numeric", unit: "units/min", bounds: null, polarity: "NONE", thresholdContract: "Rate requires a source-defined execution unit and time window.", ...planned("OIC execution counter adapter", "Measured token or execution-unit rate from runtime events", "PLANNED"), phase: "THROUGHPUT" },
  { id: "vital.active-runs", label: "Active runs", shortLabel: "Runs", labelAr: "عمليات التشغيل النشطة", shortLabelAr: "التشغيل", description: "Concurrent OIC executions currently in progress.", descriptionAr: "عمليات OIC المتزامنة الجاري تنفيذها.", category: "THROUGHPUT", instrument: "numeric", unit: "runs", bounds: null, polarity: "NONE", thresholdContract: "Current concurrent run count; not a bounded sample total.", ...planned("OIC execution lifecycle adapter", "Concurrent executions derived from current lifecycle state", "PLANNED"), phase: "THROUGHPUT" }
];

export const coreVitalById = new Map(coreVitalRegistry.map((definition) => [definition.id, definition]));

export function productionCoreVitalSignals(): ShowcaseSignal[] {
  return coreVitalRegistry.map((definition) => ({
    id: definition.id,
    label: definition.label,
    labelAr: definition.labelAr,
    kind: definition.instrument,
    value: null,
    ...(definition.bounds ? { min: definition.bounds[0], max: definition.bounds[1] } : {}),
    unit: definition.unit,
    state: definition.sourceState === "PLANNED" || definition.sourceState === "UNMEASURED" ? "UNMEASURED" : definition.sourceState === "SNAPSHOT" ? "LIVE" : definition.sourceState === "STALE" ? "DEGRADED" : definition.sourceState,
    stateLabel: definition.sourceState,
    stateLabelAr: definition.sourceState === "PLANNED" ? "مخطط" : definition.sourceState,
    ...(definition.polarity !== "NONE" ? { scale: { polarity: definition.polarity, zones: definition.polarity === "HIGH_IS_GOOD" ? [{ from: 0, to: 30, state: "CRITICAL" as const }, { from: 30, to: 55, state: "WARNING" as const }, { from: 55, to: 75, state: "ELEVATED" as const }, { from: 75, to: 100, state: "NORMAL" as const }] : [{ from: 0, to: 35, state: "NORMAL" as const }, { from: 35, to: 60, state: "ELEVATED" as const }, { from: 60, to: 80, state: "WARNING" as const }, { from: 80, to: 100, state: "CRITICAL" as const }] } } : {})
  }));
}
