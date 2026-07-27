import type {
  PlatformConditionDto,
  PlatformDataSourceDto,
  PlatformJsonValue,
  PlatformOrderingDto
} from "./common.js";
import type { PlatformVisibilityDto } from "./access.js";

export type BuiltInPlatformFieldKind =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "autocomplete"
  | "secret"
  | "password"
  | "json"
  | "file"
  | "hidden"
  | "readonly";

/** Allows registered field kinds without requiring a package release. */
export type PlatformFieldKind = BuiltInPlatformFieldKind | (string & {});

export interface PlatformFieldValidationDto {
  rule: "required" | "min" | "max" | "minLength" | "maxLength" | "pattern" | "custom";
  value?: PlatformJsonValue;
  message?: string;
}

export interface PlatformFieldOptionDto {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
}

export interface PlatformFormFieldDto extends PlatformOrderingDto {
  id: string;
  name: string;
  kind: PlatformFieldKind;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: PlatformJsonValue;
  options?: PlatformFieldOptionDto[];
  dataSource?: PlatformDataSourceDto;
  validation?: PlatformFieldValidationDto[];
  visibleWhen?: PlatformConditionDto;
  visibility?: PlatformVisibilityDto;
  readonly?: boolean;
  hidden?: boolean;
  sensitive?: boolean;
  configuration?: Record<string, PlatformJsonValue>;
}

export interface PlatformFormGroupDto extends PlatformOrderingDto {
  id: string;
  label?: string;
  description?: string;
  fields: string[];
  visibility?: PlatformVisibilityDto;
}

export interface PlatformFormSectionDto extends PlatformOrderingDto {
  id: string;
  title?: string;
  description?: string;
  groups: PlatformFormGroupDto[];
  visibility?: PlatformVisibilityDto;
}

export interface PlatformFormDto {
  id: string;
  title?: string;
  description?: string;
  dataSource?: PlatformDataSourceDto;
  fields: PlatformFormFieldDto[];
  sections?: PlatformFormSectionDto[];
  visibility?: PlatformVisibilityDto;
  configuration?: Record<string, PlatformJsonValue>;
}
