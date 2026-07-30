import { Injectable } from "@nestjs/common";

export interface AgentExecutionAssetSet {
  agent: Record<string, unknown>;
  prompt: Record<string, unknown>;
  provider: Record<string, unknown>;
  conversation?: Record<string, unknown>;
  pipeline: Record<string, unknown>;
}
export interface AgentExecutionDiagnostic {
  severity: "ERROR" | "WARNING";
  code: string;
  path: string;
  message: string;
}

@Injectable()
export class AgentExecutionValidator {
  validate(assets: AgentExecutionAssetSet): AgentExecutionDiagnostic[] {
    const diagnostics: AgentExecutionDiagnostic[] = [];
    const runtimeAssets: Array<[string, Record<string, unknown> | undefined]> = [
      ["agent", assets.agent], ["prompt", assets.prompt],
      ["provider", assets.provider], ["conversation", assets.conversation],
      ["pipeline", assets.pipeline]
    ];
    for (const [assetName, asset] of runtimeAssets) {
      if (!asset) continue;
      for (const value of this.sourceDiagnostics(asset)) {
        diagnostics.push({
          severity: value.severity === "WARNING" ? "WARNING" : "ERROR",
          code: typeof value.code === "string" ? value.code : "RUNTIME_DIAGNOSTIC",
          path: typeof value.path === "string" ? value.path : assetName,
          message: typeof value.message === "string"
            ? value.message : `${assetName} reported an invalid runtime diagnostic`
        });
      }
    }
    const same = (actual: unknown, expected: unknown, path: string, code: string) => {
      if (actual !== undefined && actual !== null && actual !== expected) {
        diagnostics.push({
          severity: "ERROR", code, path,
          message: `${path} is incompatible with the selected immutable runtime assets`
        });
      }
    };
    const agentId = assets.agent.id;
    const compiledPromptId = assets.prompt.compiledPromptId;
    same(assets.prompt.agentRuntimeSnapshotId, agentId,
      "promptExecutionPayload.agentRuntimeSnapshotId", "AGENT_RUNTIME_MISMATCH");
    same(assets.provider.agentRuntimeSnapshotId, agentId,
      "providerRuntimeSnapshot.agentRuntimeSnapshotId", "PROVIDER_RUNTIME_MISMATCH");
    same(assets.provider.compiledPromptId, compiledPromptId,
      "providerRuntimeSnapshot.compiledPromptId", "PROMPT_PROVIDER_MISMATCH");
    if (assets.conversation) {
      same(assets.prompt.conversationRuntimeSnapshotId, assets.conversation.id,
        "promptExecutionPayload.conversationRuntimeSnapshotId", "CONVERSATION_MISMATCH");
    }
    same(assets.prompt.executionPipelineSnapshotId, assets.pipeline.id,
      "promptExecutionPayload.executionPipelineSnapshotId", "PIPELINE_MISMATCH");
    return diagnostics;
  }

  private sourceDiagnostics(asset: Record<string, unknown>): Record<string, unknown>[] {
    const values: unknown[] = [];
    const append = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value as unknown[]) values.push(item);
      }
    };
    append(asset.runtimeDiagnostics);
    append(asset.diagnostics);
    const validation = asset.validationResult;
    if (validation && typeof validation === "object" &&
        Array.isArray((validation as Record<string, unknown>).diagnostics)) {
      append((validation as Record<string, unknown>).diagnostics);
    }
    return values.filter((value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" &&
      (value as Record<string, unknown>).severity === "ERROR");
  }
}
