const safeDiagnostics = new Set([
  "CONNECTION_OK",
  "PROVIDER_ADAPTER_INCOMPATIBLE",
  "PROVIDER_AUTHENTICATION_FAILED",
  "PROVIDER_AUTHORIZATION_FAILED",
  "PROVIDER_DNS_FAILED",
  "PROVIDER_NETWORK_FAILED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_REJECTED",
  "PROVIDER_RESPONSE_INVALID",
  "PROVIDER_TIMEOUT",
  "PROVIDER_TLS_FAILED",
  "PROVIDER_UNAVAILABLE"
]);

/** @param {{ healthy?: unknown; diagnosticCode?: unknown }} result @param {{ healthy: string; unhealthy: string; unavailable: string }} copy */
function providerTestFeedback(result, copy) {
  if (result.healthy !== true && result.healthy !== false) return copy.unavailable;
  const label = result.healthy ? copy.healthy : copy.unhealthy;
  const diagnostic = typeof result.diagnosticCode === "string" && safeDiagnostics.has(result.diagnosticCode)
    ? result.diagnosticCode
    : "UNKNOWN";
  return `${label} · ${diagnostic}`;
}

module.exports = { providerTestFeedback };
