import type { PlatformVisibilityDto } from "./access.js";
import type { PlatformIconDto, PlatformOrderingDto } from "./common.js";

export type PlatformNavigationPlacement = "sidebar" | "topbar" | "breadcrumb";

export interface PlatformNavigationItemDto extends PlatformOrderingDto {
  id: string;
  label: string;
  route?: string;
  icon?: PlatformIconDto;
  badge?: string;
  children?: PlatformNavigationItemDto[];
  visibility?: PlatformVisibilityDto;
}

export interface PlatformNavigationSchemaDto {
  items: Array<PlatformNavigationItemDto & { placement: PlatformNavigationPlacement }>;
}
