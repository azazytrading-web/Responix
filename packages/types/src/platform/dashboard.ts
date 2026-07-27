import type { PlatformVisibilityDto } from "./access.js";
import type {
  PlatformDataSourceDto,
  PlatformIconDto,
  PlatformJsonValue,
  PlatformOrderingDto
} from "./common.js";
import type { PlatformFormDto } from "./forms.js";

export type BuiltInPlatformWidgetKind =
  | "card"
  | "metric"
  | "table"
  | "chart"
  | "list"
  | "tabs"
  | "timeline"
  | "activity"
  | "markdown"
  | "json-viewer"
  | "code-viewer"
  | "button-group"
  | "quick-actions";

/** Allows registered widget kinds without coupling contracts to a renderer. */
export type PlatformWidgetKind = BuiltInPlatformWidgetKind | (string & {});

export interface PlatformActionDto extends PlatformOrderingDto {
  id: string;
  label: string;
  icon?: PlatformIconDto;
  action: string;
  parameters?: Record<string, PlatformJsonValue>;
  confirmation?: { title: string; message: string };
  visibility?: PlatformVisibilityDto;
}

export interface PlatformFilterDto extends PlatformOrderingDto {
  id: string;
  label: string;
  field: string;
  kind: string;
  defaultValue?: PlatformJsonValue;
  dataSource?: PlatformDataSourceDto;
  visibility?: PlatformVisibilityDto;
}

export interface PlatformTableColumnDto extends PlatformOrderingDto {
  id: string;
  field: string;
  label: string;
  formatter?: string;
  sortable?: boolean;
  visibility?: PlatformVisibilityDto;
}

export interface PlatformTableDto {
  columns: PlatformTableColumnDto[];
  rowActions?: PlatformActionDto[];
  pagination?: boolean;
}

export interface PlatformWidgetDto extends PlatformOrderingDto {
  id: string;
  kind: PlatformWidgetKind;
  title?: string;
  description?: string;
  icon?: PlatformIconDto;
  dataSource?: PlatformDataSourceDto;
  table?: PlatformTableDto;
  form?: PlatformFormDto;
  actions?: PlatformActionDto[];
  filters?: PlatformFilterDto[];
  visibility?: PlatformVisibilityDto;
  configuration?: Record<string, PlatformJsonValue>;
}

export interface PlatformSectionDto extends PlatformOrderingDto {
  id: string;
  title?: string;
  description?: string;
  layout: string;
  widgets: PlatformWidgetDto[];
  visibility?: PlatformVisibilityDto;
}

export interface PlatformPageDto extends PlatformOrderingDto {
  id: string;
  title: string;
  route: string;
  layout: string;
  sections: PlatformSectionDto[];
  actions?: PlatformActionDto[];
  filters?: PlatformFilterDto[];
  visibility?: PlatformVisibilityDto;
}

export interface PlatformDashboardSchemaDto {
  pages: PlatformPageDto[];
}
