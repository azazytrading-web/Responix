import type { PlatformManifestDto } from "./manifest.js";
import type { PlatformFieldKind } from "./forms.js";
import type { PlatformWidgetKind } from "./dashboard.js";

export const PLATFORM_SCHEMA_VERSION = "1.0" as const;

const BUILT_IN_WIDGET_KINDS = new Set<string>([
  "card", "metric", "table", "chart", "list", "tabs", "timeline", "activity",
  "markdown", "json-viewer", "code-viewer", "button-group", "quick-actions"
]);
const BUILT_IN_FIELD_KINDS = new Set<string>([
  "text", "textarea", "number", "boolean", "date", "datetime", "select", "autocomplete",
  "secret", "password", "json", "file", "hidden", "readonly"
]);

export type PlatformExtensionKind = "widget" | "field";

export interface PlatformExtensionDefinitionDto {
  kind: PlatformExtensionKind;
  id: string;
  supportedSchemaVersions: readonly string[];
}

export interface PlatformContractValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Runtime registry for independently shipped metadata extensions. It has no
 * rendering or execution responsibility and is safe to use in any consumer.
 */
export class PlatformExtensionRegistry {
  private readonly extensions = new Map<string, PlatformExtensionDefinitionDto>();

  register(extension: PlatformExtensionDefinitionDto): void {
    const key = this.key(extension.kind, extension.id);
    if (this.extensions.has(key)) {
      throw new Error(`Duplicate platform ${extension.kind} extension: ${extension.id}`);
    }
    if (!extension.supportedSchemaVersions.includes(PLATFORM_SCHEMA_VERSION)) {
      throw new Error(`Platform extension ${extension.id} does not support schema ${PLATFORM_SCHEMA_VERSION}`);
    }
    this.extensions.set(key, { ...extension, supportedSchemaVersions: [...extension.supportedSchemaVersions] });
  }

  has(kind: PlatformExtensionKind, id: string): boolean {
    return this.extensions.has(this.key(kind, id));
  }

  validate(manifest: PlatformManifestDto): PlatformContractValidationResult {
    const errors: string[] = [];
    if (manifest.schemaVersion !== PLATFORM_SCHEMA_VERSION) {
      errors.push("Unsupported platform schema version.");
    }
    this.validateUnique(manifest.dashboard.pages.map((page) => page.id), "page", errors);
    this.validateUnique(manifest.navigation.items.map((item) => item.id), "navigation item", errors);

    for (const page of manifest.dashboard.pages) {
      this.validateUnique(page.sections.map((section) => section.id), `section in page ${page.id}`, errors);
      for (const section of page.sections) {
        this.validateUnique(section.widgets.map((widget) => widget.id), `widget in section ${section.id}`, errors);
        for (const widget of section.widgets) {
          if (!this.isKnownWidget(widget.kind)) {
            errors.push(`Unregistered widget kind: ${widget.kind}`);
          }
          if (widget.form) {
            this.validateUnique(widget.form.fields.map((field) => field.id), `field in form ${widget.form.id}`, errors);
            for (const field of widget.form.fields) {
              if (!this.isKnownField(field.kind)) {
                errors.push(`Unregistered field kind: ${field.kind}`);
              }
            }
          }
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  private isKnownWidget(kind: PlatformWidgetKind): boolean {
    return BUILT_IN_WIDGET_KINDS.has(kind) || this.has("widget", kind);
  }

  private isKnownField(kind: PlatformFieldKind): boolean {
    return BUILT_IN_FIELD_KINDS.has(kind) || this.has("field", kind);
  }

  private validateUnique(values: string[], label: string, errors: string[]): void {
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    for (const duplicate of new Set(duplicates)) {
      errors.push(`Duplicate ${label} id: ${duplicate}`);
    }
  }

  private key(kind: PlatformExtensionKind, id: string): string {
    return `${kind}:${id}`;
  }
}

/** Produces a detached JSON-compatible DTO for transport or later OpenAPI use. */
export function serializePlatformManifest(manifest: PlatformManifestDto): PlatformManifestDto {
  return JSON.parse(JSON.stringify(manifest)) as PlatformManifestDto;
}
