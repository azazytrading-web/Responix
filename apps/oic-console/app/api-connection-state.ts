export type ApiConnectionState = "connected" | "checking" | "unavailable" | "unknown";
export type HealthRequestState = "loading" | "available" | "failed";

type HealthObservation = {
  sourceState?: unknown;
  httpStatus?: unknown;
  body?: unknown;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function getApiConnectionState(
  health: Record<string, unknown> | null,
  requestState: HealthRequestState
): ApiConnectionState {
  if (requestState === "loading") return "checking";
  if (requestState === "failed") return "unavailable";

  const live = record(health?.live) as HealthObservation;
  if (live.sourceState === "UNAVAILABLE") return "unavailable";
  if (live.sourceState !== "AVAILABLE") return "unknown";

  const body = record(live.body);
  return live.httpStatus === 200 && body.status === "ok" ? "connected" : "unavailable";
}
