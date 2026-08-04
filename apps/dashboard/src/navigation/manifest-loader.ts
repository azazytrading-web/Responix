/**
 * Navigation Manifest Loader
 */

import type { PlatformNavigationSchemaDto } from "@responix/types";

export interface ManifestLoader {
  load(): Promise<PlatformNavigationSchemaDto>;
}

export class StaticManifestLoader implements ManifestLoader {
  constructor(private manifest: PlatformNavigationSchemaDto) {}

  async load(): Promise<PlatformNavigationSchemaDto> {
    await Promise.resolve();
    return this.manifest;
  }
}
