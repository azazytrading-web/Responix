export const OIC_CONTRACT_VERSION = "1" as const;

export type OicHealthResponse = {
  status: "ok";
  service: "oic-api";
  contractVersion?: typeof OIC_CONTRACT_VERSION;
};

export * from "./runtime";
