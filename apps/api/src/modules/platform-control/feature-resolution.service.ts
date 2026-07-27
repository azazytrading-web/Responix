import { Injectable } from "@nestjs/common";
import { PlatformControlRepository } from "./platform-control.repository";
import type { FeatureSnapshot } from "./platform-control.types";

@Injectable()
export class FeatureResolutionService {
  constructor(private readonly repository: PlatformControlRepository) {}

  async resolve(workspaceId: string, includeExperimental = false): Promise<string[]> {
    const [features, license] = await Promise.all([
      this.repository.featureSnapshots(workspaceId),
      this.repository.licenseSnapshot(workspaceId)
    ]);
    const selected = new Map<string, FeatureSnapshot>();
    for (const feature of features) {
      if (feature.workspaceId === null || feature.workspaceId === workspaceId) selected.set(feature.key, feature);
    }
    const enabled = new Set(license.features);
    for (const feature of selected.values()) {
      if (feature.state === "ENABLED" && (!feature.experimental || includeExperimental)) enabled.add(feature.key);
      if (feature.state === "DISABLED" || feature.state === "HIDDEN") enabled.delete(feature.key);
    }
    for (const feature of [...enabled]) {
      if (!this.dependenciesEnabled(feature, selected, enabled, new Set())) enabled.delete(feature);
    }
    return [...enabled].sort();
  }

  private dependenciesEnabled(
    key: string,
    features: Map<string, FeatureSnapshot>,
    enabled: Set<string>,
    visiting: Set<string>
  ): boolean {
    if (visiting.has(key)) return false;
    visiting.add(key);
    const result = (features.get(key)?.dependencies ?? []).every(
      (dependency) => enabled.has(dependency) && this.dependenciesEnabled(dependency, features, enabled, visiting)
    );
    visiting.delete(key);
    return result;
  }
}
