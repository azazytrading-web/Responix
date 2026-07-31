import { BadRequestException, Injectable } from "@nestjs/common";
import type { ToolRuntimeSnapshot } from "./tool-runtime.types";

@Injectable()
export class ToolRuntimeValidator {
  validateSnapshot(snapshot: ToolRuntimeSnapshot) {
    if (!snapshot || !Array.isArray(snapshot.parameters) || !Array.isArray(snapshot.schemas) ||
      !Array.isArray(snapshot.permissions) || !Array.isArray(snapshot.capabilities)) {
      throw new BadRequestException("Tool snapshot structure is invalid");
    }
    const input = snapshot.schemas.find(({ kind }) => kind === "INPUT")?.schema;
    if (!input) throw new BadRequestException("Tool snapshot has no input schema");
    this.validateSchema(input, "inputSchema");
    const output = snapshot.schemas.find(({ kind }) => kind === "OUTPUT")?.schema;
    if (output) this.validateSchema(output, "outputSchema");
  }

  normalizeInput(snapshot: ToolRuntimeSnapshot, input: Record<string, unknown>) {
    const schema = snapshot.schemas.find(({ kind }) => kind === "INPUT")!.schema;
    return this.normalize(schema, structuredClone(input), "input") as Record<string, unknown>;
  }

  validateOutput(snapshot: ToolRuntimeSnapshot, output: unknown) {
    const schema = snapshot.schemas.find(({ kind }) => kind === "OUTPUT")?.schema;
    if (schema) this.normalize(schema, output, "output", false);
  }

  assertCompatibility(snapshot: ToolRuntimeSnapshot, requested = "1.0") {
    const supported = snapshot.compatibilityMetadata.runtimeVersion ?? "1.0";
    if (typeof supported !== "string" || supported.split(".")[0] !== requested.split(".")[0]) {
      throw new BadRequestException("Tool runtime compatibility version is unsupported");
    }
  }

  private normalize(schema: Record<string, unknown>, value: unknown, path: string, defaults = true): unknown {
    if (value === undefined && defaults && schema.default !== undefined) value = structuredClone(schema.default);
    if (value === undefined) return value;
    if (Array.isArray(schema.enum) && !schema.enum.some((item) => this.equal(item, value))) {
      throw new BadRequestException(`${path} is not an allowed enum value`);
    }
    const type = schema.type;
    if (type === "object") {
      if (!this.isRecord(value)) throw new BadRequestException(`${path} must be an object`);
      const properties = this.isRecord(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
      const result: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(properties)) {
        if (!this.isRecord(child)) throw new BadRequestException(`${path}.${key} schema is invalid`);
        const normalized = this.normalize(child, value[key], `${path}.${key}`, defaults);
        if (normalized !== undefined) result[key] = normalized;
      }
      for (const key of required) if (result[key] === undefined) throw new BadRequestException(`${path}.${key} is required`);
      const unknown = Object.keys(value).filter((key) => !(key in properties));
      if (unknown.length && schema.additionalProperties === false) {
        throw new BadRequestException(`${path}.${unknown[0]} is not allowed`);
      }
      for (const key of unknown) result[key] = value[key];
      return result;
    }
    if (type === "array") {
      if (!Array.isArray(value)) throw new BadRequestException(`${path} must be an array`);
      if (typeof schema.maxItems === "number" && value.length > schema.maxItems) throw new BadRequestException(`${path} exceeds maxItems`);
      const items = this.isRecord(schema.items) ? schema.items : {};
      return value.map((item, index) => this.normalize(items, item, `${path}[${index}]`, defaults));
    }
    const valid = type === undefined || type === "string" && typeof value === "string" ||
      type === "number" && typeof value === "number" && Number.isFinite(value) ||
      type === "integer" && Number.isInteger(value) || type === "boolean" && typeof value === "boolean" ||
      type === "null" && value === null;
    if (!valid) throw new BadRequestException(`${path} does not match schema type ${JSON.stringify(type)}`);
    if (typeof value === "string") {
      if (typeof schema.maxLength === "number" && value.length > schema.maxLength) throw new BadRequestException(`${path} exceeds maxLength`);
      if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) throw new BadRequestException(`${path} does not match pattern`);
    }
    return value;
  }

  private validateSchema(schema: Record<string, unknown>, path: string) {
    const allowed = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);
    if (schema.type !== undefined && (typeof schema.type !== "string" || !allowed.has(schema.type))) {
      throw new BadRequestException(`${path} has an unsupported schema type`);
    }
    if (this.isRecord(schema.properties)) for (const [key, child] of Object.entries(schema.properties)) {
      if (!this.isRecord(child)) throw new BadRequestException(`${path}.${key} is invalid`);
      this.validateSchema(child, `${path}.${key}`);
    }
    if (schema.items !== undefined) {
      if (!this.isRecord(schema.items)) throw new BadRequestException(`${path}.items is invalid`);
      this.validateSchema(schema.items, `${path}.items`);
    }
  }
  private equal(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }
  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
