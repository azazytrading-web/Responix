import { BadRequestException, Injectable } from "@nestjs/common";
import type { ToolRuntimeSnapshot } from "./tool-runtime.types";

export type ResolvedToolPolicy = { allowedMethods: string[]; allowedDestinations: string[];
  allowedHeaders: string[]; allowedMimeTypes: string[]; maximumResponseBytes: number;
  maximumExecutionMs: number; rateLimit: Record<string, unknown> };

@Injectable()
export class ToolPolicyValidator {
  resolve(snapshot: ToolRuntimeSnapshot): ResolvedToolPolicy {
    const policy = snapshot.executionPolicyMetadata;
    const methods = this.strings(policy.allowedMethods, ["GET", "POST"])
      .map((method) => method.toUpperCase());
    if (methods.some((method) => !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))) {
      throw new BadRequestException("Tool policy contains an unsupported HTTP method");
    }
    const endpoint = snapshot.providerMetadata.endpoint;
    const host = typeof endpoint === "string" ? this.host(endpoint) : undefined;
    const destinations = this.strings(policy.allowedDestinations, host ? [host] : []);
    const maximumResponseBytes = this.integer(policy.maximumResponseBytes, 1_048_576, 1, 10_485_760);
    const maximumExecutionMs = this.integer(policy.maximumExecutionMs,
      this.integer(snapshot.timeoutMetadata.milliseconds, 30_000, 1, 3_600_000), 1, 3_600_000);
    const headers = this.strings(policy.allowedHeaders, ["accept", "content-type"])
      .map((header) => header.toLowerCase());
    if (headers.some((header) => /^(authorization|cookie|proxy-authorization|host|connection)$/i.test(header))) {
      throw new BadRequestException("Tool policy permits a prohibited header");
    }
    return { allowedMethods: methods, allowedDestinations: destinations, allowedHeaders: headers,
      allowedMimeTypes: this.strings(policy.allowedMimeTypes, ["application/json", "text/plain"]),
      maximumResponseBytes, maximumExecutionMs, rateLimit: snapshot.rateLimitMetadata };
  }

  validateHttp(snapshot: ToolRuntimeSnapshot, method: string, endpoint: string,
    headers: Record<string, string>, contentType: string | undefined, policy: ResolvedToolPolicy) {
    if (!policy.allowedMethods.includes(method)) throw new BadRequestException(`HTTP method ${method} is not allowed`);
    if (!policy.allowedDestinations.includes(this.host(endpoint))) throw new BadRequestException("Tool destination is not allowed");
    const rejected = Object.keys(headers).find((header) => !policy.allowedHeaders.includes(header.toLowerCase()));
    if (rejected) throw new BadRequestException(`HTTP header ${rejected} is not allowed`);
    if (contentType && !policy.allowedMimeTypes.some((mime) => contentType.toLowerCase().startsWith(mime.toLowerCase()))) {
      throw new BadRequestException(`HTTP MIME type ${contentType} is not allowed`);
    }
    if (snapshot.authenticationType !== "NONE" && typeof snapshot.authenticationMetadata.secretReference !== "string") {
      throw new BadRequestException("Authenticated tools require a future secret reference");
    }
  }

  private host(raw: string) { try { return new URL(raw).hostname.toLowerCase(); }
    catch { throw new BadRequestException("Tool endpoint is invalid"); } }
  private strings(value: unknown, fallback: string[]): string[] {
    if (value === undefined) return fallback;
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new BadRequestException("Tool policy string list is invalid");
    return [...new Set(value.filter((item): item is string => typeof item === "string"))];
  }
  private integer(value: unknown, fallback: number, minimum: number, maximum: number) {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new BadRequestException("Tool policy integer is invalid");
    return Number(value);
  }
}
