import { Injectable } from "@nestjs/common";
import type { ProviderRequestOptionsDto } from "./dto/provider-runtime.dto";

export type ProviderRuntimeDiagnosticSeverity = "ERROR" | "WARNING";

export interface ProviderRuntimeDiagnostic {
  severity: ProviderRuntimeDiagnosticSeverity;
  code: string;
  path: string;
  message: string;
}

export interface ProviderCapabilityMetadata {
  maxInputTokens: number;
  maxOutputTokens: number;
  contextWindow: number;
  maxPromptBytes: number;
  temperature: { min: number; max: number };
  topP: { min: number; max: number };
  presencePenalty: { supported: boolean; min: number; max: number };
  frequencyPenalty: { supported: boolean; min: number; max: number };
  stopSequences: { supported: boolean; maxItems: number };
  vision: boolean;
  image: boolean;
  tools: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  reasoning: boolean;
}

export interface ProviderValidationInput {
  options: ProviderRequestOptionsDto;
  capabilities: ProviderCapabilityMetadata;
  promptSizeBytes: number;
  sourceDiagnostics?: ProviderRuntimeDiagnostic[];
}

export interface ProviderValidationResult {
  valid: boolean;
  diagnostics: ProviderRuntimeDiagnostic[];
  checkedAt: string;
}

@Injectable()
export class ProviderRuntimeValidator {
  validate(input: ProviderValidationInput): ProviderValidationResult {
    const diagnostics = [...(input.sourceDiagnostics ?? [])];
    const { options, capabilities } = input;
    const outputTokens = options.maxOutputTokens ?? capabilities.maxOutputTokens;

    this.maximum(diagnostics, input.promptSizeBytes, capabilities.maxPromptBytes,
      "PROMPT_SIZE_EXCEEDED", "compiledPrompt.sizeBytes", "Compiled prompt exceeds provider size metadata");
    this.maximum(diagnostics, options.estimatedInputTokens, capabilities.maxInputTokens,
      "INPUT_TOKEN_LIMIT_EXCEEDED", "options.estimatedInputTokens", "Estimated input exceeds the provider limit");
    this.maximum(diagnostics, outputTokens, capabilities.maxOutputTokens,
      "OUTPUT_TOKEN_LIMIT_EXCEEDED", "options.maxOutputTokens", "Requested output exceeds the model limit");
    this.maximum(diagnostics, options.estimatedInputTokens + outputTokens, capabilities.contextWindow,
      "CONTEXT_WINDOW_EXCEEDED", "options", "Estimated input and output exceed the model context window");
    this.range(diagnostics, options.temperature, capabilities.temperature,
      "TEMPERATURE_OUT_OF_RANGE", "options.temperature");
    this.range(diagnostics, options.topP, capabilities.topP,
      "TOP_P_OUT_OF_RANGE", "options.topP");
    this.optionalRange(diagnostics, options.presencePenalty, capabilities.presencePenalty,
      "PRESENCE_PENALTY", "options.presencePenalty");
    this.optionalRange(diagnostics, options.frequencyPenalty, capabilities.frequencyPenalty,
      "FREQUENCY_PENALTY", "options.frequencyPenalty");
    this.stopSequences(diagnostics, options.stopSequences, capabilities.stopSequences);
    this.capability(diagnostics, options.vision, capabilities.vision, "VISION_UNSUPPORTED", "options.vision");
    this.capability(diagnostics, options.image, capabilities.image, "IMAGE_UNSUPPORTED", "options.image");
    this.capability(diagnostics, options.tools, capabilities.tools, "TOOLS_UNSUPPORTED", "options.tools");
    this.capability(diagnostics, options.structuredOutput, capabilities.structuredOutput,
      "STRUCTURED_OUTPUT_UNSUPPORTED", "options.structuredOutput");
    this.capability(diagnostics, options.streaming, capabilities.streaming,
      "STREAMING_UNSUPPORTED", "options.streaming");
    this.capability(diagnostics, options.reasoning, capabilities.reasoning,
      "REASONING_UNSUPPORTED", "options.reasoning");

    return {
      valid: !diagnostics.some(({ severity }) => severity === "ERROR"),
      diagnostics,
      checkedAt: new Date().toISOString()
    };
  }

  private maximum(
    diagnostics: ProviderRuntimeDiagnostic[],
    value: number,
    maximum: number,
    code: string,
    path: string,
    message: string
  ) {
    if (value > maximum) diagnostics.push(this.error(code, path, `${message} (${value} > ${maximum})`));
  }

  private range(
    diagnostics: ProviderRuntimeDiagnostic[],
    value: number | undefined,
    range: { min: number; max: number },
    code: string,
    path: string
  ) {
    if (value !== undefined && (value < range.min || value > range.max)) {
      diagnostics.push(this.error(code, path, `Value must be between ${range.min} and ${range.max}`));
    }
  }

  private optionalRange(
    diagnostics: ProviderRuntimeDiagnostic[],
    value: number | undefined,
    range: { supported: boolean; min: number; max: number },
    prefix: string,
    path: string
  ) {
    if (value === undefined) return;
    if (!range.supported) {
      diagnostics.push(this.error(`${prefix}_UNSUPPORTED`, path, "Capability is not supported"));
      return;
    }
    this.range(diagnostics, value, range, `${prefix}_OUT_OF_RANGE`, path);
  }

  private stopSequences(
    diagnostics: ProviderRuntimeDiagnostic[],
    values: string[] | undefined,
    capability: { supported: boolean; maxItems: number }
  ) {
    if (!values?.length) return;
    if (!capability.supported) {
      diagnostics.push(this.error("STOP_SEQUENCES_UNSUPPORTED", "options.stopSequences",
        "Stop sequences are not supported"));
      return;
    }
    if (values.length > capability.maxItems) {
      diagnostics.push(this.error("STOP_SEQUENCE_LIMIT_EXCEEDED", "options.stopSequences",
        `At most ${capability.maxItems} stop sequences are supported`));
    }
    if (values.some((value) => value.length === 0)) {
      diagnostics.push(this.error("EMPTY_STOP_SEQUENCE", "options.stopSequences",
        "Stop sequences cannot be empty"));
    }
    if (new Set(values).size !== values.length) {
      diagnostics.push(this.error("DUPLICATE_STOP_SEQUENCE", "options.stopSequences",
        "Stop sequences must be unique"));
    }
  }

  private capability(
    diagnostics: ProviderRuntimeDiagnostic[],
    requested: boolean | undefined,
    supported: boolean,
    code: string,
    path: string
  ) {
    if (requested && !supported) diagnostics.push(this.error(code, path, "Requested capability is not supported"));
  }

  private error(code: string, path: string, message: string): ProviderRuntimeDiagnostic {
    return { severity: "ERROR", code, path, message };
  }
}
