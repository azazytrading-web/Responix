import type { OicRuntimeContext, OicRuntimePolicy, OicRuntimePolicyDecision, OicRuntimeRequest } from "@oic/contracts";
import { OicRuntimeException } from "./runtime-errors";

export const OIC_RUNTIME_POLICY = Symbol("OIC_RUNTIME_POLICY");

export class BoundedRuntimePolicy implements OicRuntimePolicy {
  evaluate(request: OicRuntimeRequest, context: OicRuntimeContext): Promise<OicRuntimePolicyDecision> {
    void context;
    const maxInputMessages = Number(process.env.OIC_RUNTIME_MAX_MESSAGES ?? 100);
    const maxInputCharacters = Number(process.env.OIC_RUNTIME_MAX_INPUT_CHARACTERS ?? 200_000);
    const maxOutputUnits = Number(process.env.OIC_RUNTIME_MAX_OUTPUT_UNITS ?? 16_384);
    const maxExecutionMs = Number(process.env.OIC_RUNTIME_MAX_EXECUTION_MS ?? 60_000);
    const characters = request.input.reduce((total, message) => total + message.content.reduce((sum, part) => sum + part.text.length, 0), 0);
    if (request.input.length > maxInputMessages || characters > maxInputCharacters ||
        (request.maxOutputUnits !== undefined && request.maxOutputUnits > maxOutputUnits)) {
      throw new OicRuntimeException("INVALID_REQUEST");
    }
    return Promise.resolve({
      allowed: true,
      maxInputMessages,
      maxInputCharacters,
      maxOutputUnits: request.maxOutputUnits ?? maxOutputUnits,
      maxExecutionMs,
      allowedCapabilities: ["text.generate", "text.stream"]
    });
  }
}
