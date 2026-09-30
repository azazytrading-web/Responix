import type { OicModelResolver, OicRuntimeContext, OicResolvedModel, OicRuntimeRequest, OicVisibleModel } from "@oic/contracts";

export const OIC_MODEL_RESOLVER = Symbol("OIC_MODEL_RESOLVER");

/** Production remains unconfigured until OIC-3 publishes approved Oi Models/bindings. */
export class UnavailableOicModelResolver implements OicModelResolver {
  resolve(model: OicRuntimeRequest["model"], context: OicRuntimeContext): Promise<OicResolvedModel | null> {
    void model;
    void context;
    return Promise.resolve(null);
  }
  listVisible(context: OicRuntimeContext): Promise<OicVisibleModel[]> {
    void context;
    return Promise.resolve([]);
  }
}
