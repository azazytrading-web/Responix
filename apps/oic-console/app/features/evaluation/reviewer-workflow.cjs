const ownRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const safeText = (value) => typeof value === "string" ? value : "";

function parseCalibrationAnchor(value) {
  const anchor = ownRecord(value);
  const prompt = safeText(anchor.prompt);
  const match = /^(?:Task|المهمة):\s*([\s\S]*?)\s*A:\s*([\s\S]*?)\s*B:\s*([\s\S]*)$/i.exec(prompt);
  if (!match || typeof anchor.id !== "string") return null;
  return { id: anchor.id, language: safeText(anchor.language), task: match[1].trim(), responseA: match[2].trim(), responseB: match[3].trim(), rubric: safeText(anchor.rubric) };
}

function calibrationProgress(anchors, selections) {
  const valid = Array.isArray(anchors) ? anchors.filter((anchor) => anchor && typeof anchor.id === "string") : [];
  const values = ownRecord(selections);
  let answered = 0;
  let abstentions = 0;
  for (const anchor of valid) {
    if (values[anchor.id] === "ABSTAIN") abstentions += 1;
    else if (values[anchor.id] === "A" || values[anchor.id] === "B") answered += 1;
  }
  return { total: valid.length, answered, abstentions, completed: answered + abstentions, complete: valid.length > 0 && answered + abstentions === valid.length };
}

function buildCalibrationPayload(policyId, anchors, selections) {
  const valid = Array.isArray(anchors) ? anchors.filter((anchor) => anchor && typeof anchor.id === "string") : [];
  const values = ownRecord(selections);
  const progress = calibrationProgress(valid, values);
  if (!progress.complete || new Set(valid.map((anchor) => anchor.id)).size !== valid.length) throw new Error("Complete every calibration item before submitting.");
  const answers = {};
  const abstentions = [];
  for (const anchor of valid) {
    if (values[anchor.id] === "ABSTAIN") abstentions.push(anchor.id);
    else if (values[anchor.id] === "A" || values[anchor.id] === "B") answers[anchor.id] = values[anchor.id];
    else throw new Error("Calibration selection is invalid.");
  }
  return { policyId, answers, abstentions };
}

function safeBlindProjection(value) {
  const row = ownRecord(value);
  const allowed = new Set(["prompt", "instructions", "rubric", "candidates", "itemLabel", "language", "taskType"]);
  const projection = {};
  for (const key of allowed) if (typeof row[key] === "string") projection[key] = row[key];
  if (Array.isArray(row.candidates)) projection.candidates = row.candidates.filter((candidate) => {
    const item = ownRecord(candidate);
    return (["A", "B", "CANDIDATE"].includes(item.label)) && typeof item.content === "string";
  }).map((candidate) => ({ label: candidate.label, content: candidate.content }));
  return projection;
}

function safeReviewProjection(value, mode) {
  const projection = safeBlindProjection(value);
  if (mode === "PAIRWISE") return projection.candidates.length === 2 && new Set(projection.candidates.map((item) => item.label)).size === 2 ? projection : null;
  if (mode === "SINGLE_BOOLEAN") return projection.candidates.length === 1 && projection.candidates[0].label === "CANDIDATE" ? projection : null;
  return null;
}

function metricControl(definition) {
  const row = ownRecord(definition);
  const bounds = ownRecord(row.rangeOrCategories);
  if (row.type === "PAIRWISE" || row.type === "CATEGORY") {
    const categories = Array.isArray(bounds.categories) ? bounds.categories.filter((item) => typeof item === "string") : [];
    return categories.length ? { kind: "choices", values: categories } : null;
  }
  if (row.type === "BOOLEAN") return { kind: "boolean", values: [true, false] };
  if ((row.type === "COUNT" || row.type === "DECIMAL") && Number.isFinite(bounds.minimum) && Number.isFinite(bounds.maximum) && bounds.minimum <= bounds.maximum) {
    return { kind: "number", minimum: bounds.minimum, maximum: bounds.maximum, step: row.type === "COUNT" ? 1 : "any" };
  }
  return null;
}

function assignmentState(assignments, calibrationEligible) {
  if (!calibrationEligible || !Array.isArray(assignments) || assignments.length === 0) return "NOT_READY";
  if (assignments.some((row) => row && row.status === "OPENED")) return "IN_PROGRESS";
  if (assignments.some((row) => row && (row.status === "SUBMITTED" || row.status === "ABSTAINED"))) return "SUBMITTED";
  return "READY";
}

module.exports = { parseCalibrationAnchor, calibrationProgress, buildCalibrationPayload, safeBlindProjection, safeReviewProjection, metricControl, assignmentState };
