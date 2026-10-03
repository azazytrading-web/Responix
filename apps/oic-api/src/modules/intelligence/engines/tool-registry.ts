import { z } from "zod";

export type OicToolResult = { toolKey: string; output: string; inputFingerprint: string; cacheable: boolean };
export interface OicIntelligenceTool<TArgs = unknown> {
  key: string;
  version: string;
  description: string;
  argumentSchema: z.ZodType<TArgs>;
  invoke(args: TArgs): OicToolResult;
}

function evaluateArithmetic(source: string): number {
  const tokens = source.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== source.replace(/\s+/g, "") || tokens.length > 120) throw new Error("calculator_invalid_expression");
  const values: number[] = []; const operators: string[] = [];
  const precedence: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const apply = () => {
    const op = operators.pop(); const right = values.pop(); const left = values.pop();
    if (!op || left === undefined || right === undefined) throw new Error("calculator_invalid_expression");
    if (op === "+") values.push(left + right); else if (op === "-") values.push(left - right); else if (op === "*") values.push(left * right); else { if (right === 0) throw new Error("calculator_division_by_zero"); values.push(left / right); }
  };
  let previous = "";
  for (const token of tokens) {
    if (/^\d/.test(token)) values.push(Number(token));
    else if (token === "(") operators.push(token);
    else if (token === ")") { while (operators.at(-1) && operators.at(-1) !== "(") apply(); if (operators.pop() !== "(") throw new Error("calculator_invalid_expression"); }
    else if (token === "-" && (!previous || "(+*/-".includes(previous))) values.push(0);
    else { while (operators.at(-1) && operators.at(-1) !== "(" && precedence[operators.at(-1)!]! >= precedence[token]!) apply(); operators.push(token); }
    previous = token;
  }
  while (operators.length) { if (operators.at(-1) === "(") throw new Error("calculator_invalid_expression"); apply(); }
  const value = values[0]; if (values.length !== 1 || value === undefined || !Number.isFinite(value)) throw new Error("calculator_invalid_expression");
  return value;
}

export const OIC_CALCULATOR: OicIntelligenceTool<{ expression: string }> = {
  key: "oic.calculator", version: "1.0.0", description: "Evaluate a bounded arithmetic expression without dynamic code execution.",
  argumentSchema: z.object({ expression: z.string().min(1).max(240).regex(/^[\d\s()+*/.-]+$/) }).strict(),
  invoke(args) { const expression = args.expression.replace(/\s+/g, ""); const value = evaluateArithmetic(expression); return { toolKey: this.key, output: `${expression} = ${Number(value.toPrecision(12))}`, inputFingerprint: expression, cacheable: true }; }
};

const unitMeters = { mm: 0.001, cm: 0.01, m: 1, km: 1000, ft: 0.3048, mi: 1609.344 } as const;
const unitSchema = z.enum(["mm", "cm", "m", "km", "ft", "mi"]);
export type UnitConversionArguments = { value: number; from: keyof typeof unitMeters; to: keyof typeof unitMeters };
export const OIC_UNIT_CONVERTER: OicIntelligenceTool<UnitConversionArguments> = {
  key: "oic.unit-converter", version: "1.0.0", description: "Convert a bounded scalar between supported metric and imperial length units.",
  argumentSchema: z.object({ value: z.number().finite().min(-1_000_000_000).max(1_000_000_000), from: unitSchema, to: unitSchema }).strict(),
  invoke(args) {
    const converted = args.value * unitMeters[args.from] / unitMeters[args.to];
    if (!Number.isFinite(converted)) throw new Error("unit_conversion_out_of_range");
    const output = `${args.value} ${args.from} = ${Number(converted.toPrecision(12))} ${args.to}`;
    return { toolKey: this.key, output, inputFingerprint: `${args.value}:${args.from}:${args.to}`, cacheable: true };
  }
};

export class OicToolRegistry {
  private readonly tools = new Map<string, OicIntelligenceTool>([[OIC_CALCULATOR.key, OIC_CALCULATOR], [OIC_UNIT_CONVERTER.key, OIC_UNIT_CONVERTER]]);
  describe() { return [...this.tools.values()].map(({ key, version, description }) => ({ key, version, description })); }
  invoke(key: string, input: unknown, allowed: boolean): OicToolResult {
    if (!allowed) throw new Error("tool_permission_denied");
    const tool = this.tools.get(key); if (!tool) throw new Error("tool_not_registered");
    const parsed = tool.argumentSchema.safeParse(input); if (!parsed.success) throw new Error("tool_arguments_invalid");
    return tool.invoke(parsed.data);
  }
}

export function calculatorExpression(request: string): string | null {
  const match = request.match(/\b(?:calculate|compute|what is|solve)\s+([\d\s()+*/.-]{1,240})[?.!]?/i);
  return match?.[1]?.trim().replace(/[?.!]+$/, "") || null;
}

export function unitConversionArguments(request: string): UnitConversionArguments | null {
  const match = /\bconvert\s+(-?\d+(?:\.\d+)?)\s*(mm|cm|km|m|ft|mi)\s+to\s+(mm|cm|km|m|ft|mi)\b/i.exec(request);
  if (!match) return null;
  return { value: Number(match[1]), from: match[2]!.toLocaleLowerCase() as keyof typeof unitMeters, to: match[3]!.toLocaleLowerCase() as keyof typeof unitMeters };
}
