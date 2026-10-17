const isRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
const rows = (value) => Array.isArray(value) ? value.filter(isRecord) : [];
const decimalPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

function addDecimals(values) {
  if (!values.length || values.some((value) => typeof value !== "string" || !decimalPattern.test(value))) return null;
  const scale = Math.max(...values.map((value) => (value.split(".")[1] || "").length));
  const factor = 10n ** BigInt(scale);
  const total = values.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole) * factor + BigInt((fraction + "0".repeat(scale)).slice(0, scale) || "0");
  }, 0n);
  if (!scale) return total.toString();
  const whole = total / factor;
  const fraction = (total % factor).toString().padStart(scale, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function knownSum(values) {
  return values.length && values.every((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
}

function canonicalProviderLabel(provider, model) {
  if (typeof provider === "string" && /openai-compatible/i.test(provider) && typeof model === "string" && /^deepseek-/i.test(model)) return "DeepSeek";
  return provider;
}

function aggregatePacket76Accounting(campaignRows, runRows, detailRows) {
  const campaigns = rows(campaignRows).filter((row) => typeof row.campaignKey === "string" && /^oic7-packet76-(?:paired|candidate)-cohort-/.test(row.campaignKey));
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id).filter((id) => typeof id === "string"));
  const runs = rows(runRows).filter((run) => campaignIds.has(run.campaignId));
  const details = rows(detailRows);
  const detailsById = new Map(details.map((detail) => [detail.id, detail]));
  const complete = runs.length > 0 && runs.every((run) => detailsById.has(run.id));
  const accounting = runs.map((run) => isRecord(detailsById.get(run.id)?.accounting) ? detailsById.get(run.id).accounting : null);
  const fullyRead = complete && accounting.every(isRecord);
  const currencyKeys = [...new Set(accounting.flatMap((item) => Object.keys(isRecord(item?.providerCosts) ? item.providerCosts : {})))];
  const costTotals = {};
  for (const currency of currencyKeys) {
    const costs = accounting.map((item) => isRecord(item?.providerCosts?.[currency]) ? item.providerCosts[currency] : null);
    const known = fullyRead && costs.every((cost) => cost?.state === "ASSESSED" && typeof cost.amount === "string");
    costTotals[currency] = { amount: known ? addDecimals(costs.map((cost) => cost.amount)) : null, state: known ? "ASSESSED" : "PARTIAL" };
  }
  const totalDecimal = (key) => {
    const values = accounting.map((item) => isRecord(item?.oiu) ? item.oiu[key] : null);
    return fullyRead && values.every((value) => typeof value === "string" && decimalPattern.test(value)) ? addDecimals(values) : null;
  };
  const authorizedOiu = campaigns.length > 0 ? addDecimals(campaigns.map((campaign) => typeof campaign.budgetLimitOiu === "string" ? campaign.budgetLimitOiu : String(campaign.budgetLimitOiu ?? ""))) : null;
  const providerAttempts = accounting.flatMap((item) => rows(item?.attempts).flatMap((attempt) => rows(attempt.providerAttempts)));
  const providerNames = providerAttempts.map((attempt) => {
    // The API's provider definition names this OpenAI-compatible transport;
    // the canonical upstream model identity supplies the actual provider brand.
    return canonicalProviderLabel(attempt.provider, attempt.model);
  }).filter((value) => typeof value === "string");
  const distinct = (key) => [...new Set(providerAttempts.map((attempt) => attempt[key]).filter((value) => typeof value === "string"))];
  const allCounts = (key) => fullyRead ? knownSum(accounting.map((item) => item[key])) : null;
  return {
    scope: "Packet 7.6 paired and candidate cohorts",
    state: fullyRead && accounting.every((item) => item.state === "LIVE") ? "LIVE" : fullyRead ? "PARTIAL" : runs.length ? "UNAVAILABLE" : campaigns.length ? "NO_DATA_YET" : "UNAVAILABLE",
    campaignCount: campaigns.length,
    runCount: runs.length,
    dispatchCount: allCounts("dispatchCount"),
    inputTokens: allCounts("inputTokens"),
    outputTokens: allCounts("outputTokens"),
    provider: [...new Set(providerNames)],
    model: distinct("model"),
    adapter: distinct("providerKey"),
    providerCosts: costTotals,
    oiu: {
      authorized: authorizedOiu,
      reserved: totalDecimal("reserved"),
      consumed: totalDecimal("consumed"),
      released: totalDecimal("released"),
      remaining: null,
      state: fullyRead && accounting.every((item) => item.oiu?.state === "SETTLED") ? "SETTLED" : fullyRead ? "PARTIAL" : "UNKNOWN"
    },
    runs: runs.map((run) => ({ id: run.id, targetClass: run.targetClass, status: run.status, accountingState: detailsById.get(run.id)?.accounting?.state ?? "UNKNOWN", completedAt: run.completedAt ?? null }))
  };
}

module.exports = { aggregatePacket76Accounting, canonicalProviderLabel };
