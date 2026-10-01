import type { ManualModelInput } from "./model-fabric.service";

export const LOCAL_PROVIDER_FIXTURE_KEY = "oic-local-fixture";
export const LOCAL_PROVIDER_FIXTURE_ENDPOINT = "https://local-fixture.oic.invalid/v1";
export const LOCAL_PROVIDER_FIXTURE_CREDENTIAL = "oic-local-fixture-token";

export function localProviderFixtureEnabled(environment: Record<string, unknown> = process.env): boolean {
  return environment.NODE_ENV === "development" && environment.OIC_ENABLE_LOCAL_PROVIDER_FIXTURE === "true";
}
const effectiveAt = "2026-01-01T00:00:00.000Z";
export const LOCAL_PROVIDER_FIXTURE_CATALOG: ManualModelInput[] = [
  {
    upstreamModelId: "acceptance-oic45-chat-small",
    displayName: "OIC Acceptance Chat Small",
    family: "OIC local acceptance",
    contextLimit: 8192,
    outputLimit: 2048,
    capabilities: [
      { capability: "text.generate", status: "SUPPORTED", sourceRef: "oic-local-fixture-v1" },
      { capability: "text.stream", status: "SUPPORTED", sourceRef: "oic-local-fixture-v1" },
      { capability: "tool.use", status: "SUPPORTED", sourceRef: "oic-local-fixture-v1" },
      { capability: "vision.image", status: "UNSUPPORTED", sourceRef: "oic-local-fixture-v1" }
    ],
    pricing: { status: "KNOWN", inputRate: 0.25, outputRate: 1, currency: "USD", sourceRef: "oic-local-fixture-v1", effectiveAt }
  },
  {
    upstreamModelId: "acceptance-oic45-unknown",
    displayName: "OIC Acceptance Unknown Metadata",
    family: "OIC local acceptance",
    capabilities: [
      { capability: "text.generate", status: "SUPPORTED", sourceRef: "oic-local-fixture-v1" },
      { capability: "text.stream", status: "UNKNOWN", sourceRef: "oic-local-fixture-v1" },
      { capability: "tool.use", status: "UNKNOWN", sourceRef: "oic-local-fixture-v1" },
      { capability: "vision.image", status: "UNKNOWN", sourceRef: "oic-local-fixture-v1" }
    ],
    pricing: { status: "UNKNOWN", sourceRef: "oic-local-fixture-v1" }
  },
  {
    upstreamModelId: "acceptance-oic45-known-zero",
    displayName: "OIC Acceptance Known Zero",
    family: "OIC local acceptance",
    capabilities: [
      { capability: "text.generate", status: "SUPPORTED", sourceRef: "oic-local-fixture-v1" },
      { capability: "text.stream", status: "UNSUPPORTED", sourceRef: "oic-local-fixture-v1" }
    ],
    pricing: { status: "KNOWN", inputRate: 0, currency: "USD", sourceRef: "oic-local-fixture-v1", effectiveAt }
  }
];

export function isLocalFixtureConnection(input: { providerDefinition?: { key?: string } | null; endpointUrl?: string | null }): boolean {
  return input.providerDefinition?.key === LOCAL_PROVIDER_FIXTURE_KEY && input.endpointUrl === LOCAL_PROVIDER_FIXTURE_ENDPOINT;
}
