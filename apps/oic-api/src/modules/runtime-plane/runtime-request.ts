import { z } from "zod";
import type { OicRuntimeRequest, OicTenantSelector } from "@oic/contracts";
import { OicRuntimeException } from "./runtime-errors";

const tenantSelectorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("id"), tenantId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal("external-reference"), sourceType: z.string().regex(/^[A-Za-z0-9._:-]{1,64}$/), externalId: z.string().min(1).max(256) }).strict()
]);

const requestSchema = z.object({
  model: z.string().regex(/^oi-[a-z0-9]+(?:[._-][a-z0-9]+)*$/i).max(64),
  input: z.array(z.object({
    speaker: z.enum(["instruction", "user", "assistant", "context"]),
    content: z.array(z.object({ type: z.literal("text"), text: z.string().max(1_000_000) }).strict()).min(1).max(100)
  }).strict()).min(1).max(1000),
  tenant: tenantSelectorSchema.optional(),
  maxOutputUnits: z.number().int().min(1).max(65_536).optional()
}).strict();

export function parseOicRuntimeRequest(value: unknown): OicRuntimeRequest {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new OicRuntimeException("INVALID_REQUEST");
  return parsed.data as OicRuntimeRequest;
}

export function parseTenantSelector(value: unknown): OicTenantSelector | undefined {
  const parsed = tenantSelectorSchema.safeParse(value);
  if (!parsed.success) throw new OicRuntimeException("INVALID_REQUEST");
  return parsed.data;
}

export function validateRuntimeHeaders(headers: Record<string, string | string[] | undefined>): void {
  for (const name of ["x-request-id", "x-caller-request-id", "x-trace-id", "x-correlation-id", "x-oic-tenant-id", "idempotency-key"]) {
    const value = headers[name];
    const text = Array.isArray(value) ? value[0] : value;
    if (text !== undefined && (text.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(text))) {
      throw new OicRuntimeException("INVALID_REQUEST");
    }
  }
}
