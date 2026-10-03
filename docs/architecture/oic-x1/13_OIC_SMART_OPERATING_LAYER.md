# OIC Smart Operating Layer

**Status: PLANNED.** Smart Operating Layer (SOL) is contextual assistance attached to an operator's current entity, action and scope. It is not an autonomous agent and not a generic chat panel. Recommendations must be attributable to an OIC source, policy rule, observed state or versioned evaluator. Show uncertainty and permission requirements; do not run an action without explicit operator confirmation.

## Advisory workflow

`OBSERVE → EXPLAIN → SUGGEST → PREDICTED IMPACT → OPTIONAL SIMULATION → APPLY → SYSTEM REACTION → OBSERVE`.

Classify impact as **KNOWN** (API/domain contract establishes it), **PREDICTED** (versioned model/rule with evidence and uncertainty), or **UNKNOWN** (not enough evidence). No simulation is presented as execution; no projection without a source/method. Apply follows existing authenticated action and scope path. Reaction is read back from API and linked to request/trace/audit record.

Future contexts include profiles, model bindings, provider routing, memory policy, knowledge/retrieval, search budget, verification and context budget. Changes to memory policy, route, provider credential or lifecycle are consequential: explicit diff, scope, permission and confirmation required. **DEFERRED:** generic chat, autonomous remediation, cross-product actions and unreviewed “AI recommendation” copy.

## Insight taxonomy and lifecycle

| Class | Meaning | Required visual treatment / evidence |
|---|---|---|
| SYSTEM FACT | Direct source value or persisted state | Neutral factual presentation, exact source/time/scope; no inference wording. |
| INSIGHT | Deterministic derivation from cited facts | Amber contextual accent, formula/inputs visible, “derived” label. |
| WARNING | Policy or source reports a risk condition | Orange semantic state, exact triggering rule/source and affected entity. |
| RECOMMENDATION | Optional operator choice with rationale | Amber outline, evidence and expected known/predicted impact; never preselected/auto-applied. |
| PREDICTION | Versioned probabilistic/estimated future state | Visually distinct forecast label, horizon, model/method and uncertainty; never merged into fact. |
| UNKNOWN | Evidence or method insufficient | Neutral; say what is missing and what check could resolve it. |

Insight lifecycle: `OBSERVE (source event/state) → DERIVE (versioned deterministic rule or evaluator) → PRESENT (class, scope, confidence, source, timestamp, limits) → OPERATOR ACTION (optional, existing permission-checked action) → RESULT (server response/audit/request/trace)`. A recommendation with no valid action remains informational. A failed apply becomes a fact about the failure, not proof the original insight was correct.

Context scopes: **page** (current workspace, no cross-entity assumption), **entity** (single authorized entity and linked persisted records), **operation** (draft action and exact changed fields), **system** (aggregate only when API defines population/scope). Context scope appears in the insight header and deep link; the API reauthorizes destination. No unseen cross-tenant context retrieval.

Future advisor grounding: every claim maps to source record/rule/version and freshness; generation (if any) receives only permitted context, is constrained to cited claims, records uncertainty and allows inspection of basis. Human operator approval is mandatory for mutations. **PLANNED:** any model-assisted advisor, confidence calibration, evidence ranking or automatic incident correlation. **DEFERRED:** chatbot-first interaction, autonomous remediation, generalized causal claim and “AI says” without provenance.
