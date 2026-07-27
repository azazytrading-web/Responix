/**
 * JSON-safe metadata shared by every platform contract. Contracts describe
 * presentation intent only; they do not prescribe a rendering technology.
 */
export type PlatformPrimitive = boolean | number | string | null;

export type PlatformJsonValue =
  | PlatformPrimitive
  | PlatformJsonValue[]
  | { [key: string]: PlatformJsonValue };

export interface PlatformReferenceDto {
  id: string;
  label?: string;
}

export interface PlatformDataSourceDto {
  sourceId: string;
  parameters?: Record<string, PlatformJsonValue>;
}

export interface PlatformConditionDto {
  field: string;
  operator:
    | "equals"
    | "notEquals"
    | "in"
    | "notIn"
    | "exists"
    | "notExists";
  value?: PlatformJsonValue;
}

export interface PlatformOrderingDto {
  order: number;
  group?: string;
}

export interface PlatformIconDto {
  name: string;
  source?: string;
}
