export type Row = Record<string, unknown>;

export type Snapshot = {
  generatedAt: string;
  applications: Row[];
  tenants: Row[];
  principals: Row[];
  providers: Row[];
  connections: Row[];
  upstreamModels: Row[];
  modelFamilies: Row[];
  audit: Row[];
  runtimeContext?: {
    application: { id?: string; key?: string; displayName?: string };
    tenants: Row[];
  } | null;
};
