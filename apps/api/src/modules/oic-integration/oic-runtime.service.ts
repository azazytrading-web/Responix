import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { createOicClient, OicClientError } from "@oic/client";
import type { OicRuntimeRequest, OicRuntimeResponse } from "@oic/contracts";

export type OicContextMessage = { role: "system" | "user" | "assistant"; content: string };

const SAFE_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMITED: "The selected intelligence service is busy. Try again later.",
  MODEL_NOT_FOUND: "The selected intelligence model is unavailable.",
  MODEL_NOT_AVAILABLE: "The selected intelligence model is temporarily unavailable.",
  CAPABILITY_NOT_SUPPORTED: "This Agent requires a capability unavailable in OIC mode.",
  TENANT_NOT_ALLOWED: "The workspace is not authorized for OIC execution.",
  AUTHENTICATION_FAILED: "OIC service authentication is unavailable.",
  AUTHORIZATION_DENIED: "OIC service authorization is unavailable.",
  PROVIDER_AUTHENTICATION_FAILED: "The selected intelligence service is unavailable.",
  PROVIDER_AUTHORIZATION_FAILED: "The selected intelligence service is unavailable.",
  UPSTREAM_TIMEOUT: "The intelligence request timed out.",
  PROVIDER_UNAVAILABLE: "The intelligence service is temporarily unavailable.",
  RUNTIME_UNAVAILABLE: "The intelligence service is temporarily unavailable."
};
const MAX_CONTEXT_MESSAGES = 128;
const MAX_CONTEXT_CHARACTERS = 120_000;

@Injectable()
export class OicRuntimeService {
  private readonly baseUrl?: string;
  private readonly credential?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("oic.baseUrl");
    this.credential = config.get<string>("oic.serviceCredential");
    this.timeoutMs = config.get<number>("oic.timeoutMs") ?? 60_000;
  }

  async invoke(input: {
    workspaceId: string;
    conversationId?: string | null;
    requestId: string;
    traceId: string;
    oiModelKey: string;
    messages: OicContextMessage[];
    timeoutMs?: number;
  }): Promise<{ answer: string; response: OicRuntimeResponse }> {
    if (!this.baseUrl || !this.credential) {
      throw new ServiceUnavailableException({ code: "OIC_UNAVAILABLE", message: "OIC execution is not configured." });
    }
    if (!/^oi-[a-zA-Z0-9._:-]{1,120}$/.test(input.oiModelKey)) {
      throw new BadRequestException({ code: "OIC_MODEL_INVALID", message: "The selected Oi Model is invalid." });
    }
    if (input.messages.length > MAX_CONTEXT_MESSAGES ||
        input.messages.reduce((total, message) => total + message.content.length, 0) > MAX_CONTEXT_CHARACTERS) {
      throw new BadRequestException({ code: "OIC_CONTEXT_LIMIT_EXCEEDED", message: "The selected context exceeds the OIC execution limit." });
    }
    const request: OicRuntimeRequest = {
      model: input.oiModelKey as `oi-${string}`,
      tenant: { kind: "external-reference", sourceType: "RESPONIX_WORKSPACE", externalId: input.workspaceId },
      input: input.messages.map(({ role, content }) => ({
        speaker: role === "system" ? "instruction" : role,
        content: [{ type: "text", text: content }]
      }))
    };
    const idempotencyKey = createHash("sha256").update([
      "responix-oic-v1", input.workspaceId, input.conversationId ?? "no-conversation", input.requestId
    ].join("\0")).digest("hex");
    try {
      const response = await createOicClient({
        baseUrl: this.baseUrl,
        credential: () => this.credential!,
        timeoutMs: Math.min(input.timeoutMs ?? this.timeoutMs, this.timeoutMs)
      }).invoke(request, { requestId: input.requestId, traceId: input.traceId, idempotencyKey });
      const answer = response.output.flatMap((item) => item.content)
        .filter((part) => part.type === "text").map((part) => part.text).join("");
      return { answer, response };
    } catch (error) {
      if (error instanceof OicClientError) {
        const message = SAFE_ERROR_MESSAGES[error.code] ?? "The intelligence request could not be completed.";
        if (error.status === 429 || error.code === "RATE_LIMITED") {
          throw new HttpException({ code: "OIC_RATE_LIMITED", message }, HttpStatus.TOO_MANY_REQUESTS);
        }
        throw new ServiceUnavailableException({ code: `OIC_${error.code}`, message });
      }
      throw new ServiceUnavailableException({ code: "OIC_UNAVAILABLE", message: "The intelligence service is temporarily unavailable." });
    }
  }

  async listVisibleModels(): Promise<Array<{ id: string; object: "model"; owned_by: "oi" }>> {
    if (!this.baseUrl || !this.credential) {
      throw new ServiceUnavailableException({ code: "OIC_UNAVAILABLE", message: "OIC model catalog is not configured." });
    }
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/v1/models`, {
        headers: { authorization: `Bearer ${this.credential}`, accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) throw new OicClientError(response.status, `HTTP_${response.status}`, "OIC model catalog request failed");
      const result = await response.json() as { object: "list"; data: Array<{ id: string; object: "model"; owned_by: "oi" }> };
      return result.data.filter((model) => /^oi-[a-zA-Z0-9._:-]{1,120}$/.test(model.id));
    } catch {
      throw new ServiceUnavailableException({ code: "OIC_UNAVAILABLE", message: "OIC model catalog is temporarily unavailable." });
    }
  }
}
