import type { OicRuntimeRequest } from "@oic/contracts";
import type { TaskAnalysis, TaskType } from "./types";

const words = (value: string) => value.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_'-]*/gu) ?? [];
const userText = (request: OicRuntimeRequest) => request.input.filter((message) => message.speaker === "user").flatMap((message) => message.content.map((part) => part.text)).join("\n");

/** Deterministic multi-signal analysis. It only chooses execution shape; it does not rewrite user intent. */
export function analyzeTask(request: OicRuntimeRequest): TaskAnalysis {
  const text = userText(request);
  const tokens = words(text);
  const clauses = text.split(/(?:\n+|[.!?;]+|\b(?:and then|also|compare|versus|while|because|then)\b)/i).map((part) => part.trim()).filter((part) => words(part).length >= 3);
  const subtaskCount = Math.min(8, Math.max(1, clauses.length));
  const reasons: string[] = [];
  const structuredOutput = /\b(json|schema|table|csv|xml|yaml|exactly \d+|required fields?)\b/i.test(text) || request.input.some((message) => message.speaker === "instruction");
  const evidenceRequired = /\b(source|evidence|according to|based on|cite|reference|prove|verify|research|retriev|document|provided material)\b/i.test(text);
  const uncertaintySignal = /\b(uncertain|unclear|conflict|contradict|might|maybe|estimate|risk|ambiguous|not sure)\b/i.test(text);
  let taskType: TaskType = "SIMPLE_FACTUAL";
  if (/\b(code|debug|implement|function|compile|typescript|sql|algorithm)\b/i.test(text)) taskType = "CODING";
  else if (/\b(plan|steps|roadmap|sequence|schedule)\b/i.test(text)) taskType = "PLANNING";
  else if (evidenceRequired) taskType = "RETRIEVAL";
  else if (/\b(extract|fields|entities|classify|categorize)\b/i.test(text)) taskType = "EXTRACTION";
  else if (/\b(summarize|summary|tl;dr|key points)\b/i.test(text)) taskType = "SUMMARY";
  else if (/\b(rewrite|translate|format|convert|paraphrase|sort|transform)\b/i.test(text)) taskType = "TRANSFORMATION";
  else if (structuredOutput) taskType = "STRUCTURED";
  else if (subtaskCount > 1 || tokens.length > 100 || uncertaintySignal || /\b(why|how|trade-?off|evaluate|reason|compare|analy[sz]e)\b/i.test(text)) taskType = "REASONING";
  else if (tokens.length < 12 && request.input.length <= 2) taskType = "CONVERSATION";

  const complexity = Math.min(100, Math.round(Math.min(tokens.length / 2, 30) + Math.max(0, subtaskCount - 1) * 14 + (evidenceRequired ? 18 : 0) + (structuredOutput ? 8 : 0) + (uncertaintySignal ? 18 : 0) + (request.input.filter((message) => message.speaker === "assistant").length ? 5 : 0)));
  const uncertainty = uncertaintySignal || (evidenceRequired && taskType === "RETRIEVAL") ? "MEDIUM_UNCERTAINTY" : "LOW_UNCERTAINTY";
  if (subtaskCount > 1) reasons.push(`${subtaskCount} separable request clauses detected`);
  if (evidenceRequired) reasons.push("evidence requirement detected");
  if (structuredOutput) reasons.push("structured output constraint detected");
  if (uncertaintySignal) reasons.push("uncertainty or conflict signal detected");
  if (tokens.length < 20 && subtaskCount === 1 && !evidenceRequired) reasons.push("short single-part request favors direct execution");
  return { taskType, complexity, uncertainty, evidenceRequired, structuredOutput, subtaskCount, reasons };
}

export function taskTypeIs(value: TaskAnalysis, ...types: TaskType[]): boolean { return types.includes(value.taskType); }
