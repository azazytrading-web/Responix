# OIC Intelligence Model DNA Architecture

**Status: PLANNED; no Model DNA renderer or evaluator is asserted as CURRENT.** The existing OIC-5 runtime has configurable profile dimensions (context, memory, retrieval, reasoning, tools, verification, synthesis, efficiency intensities and bounded resource policies) and execution evidence such as strategy, task type, uncertainty, call/query/memory counts, context tokens, verification status and safe stage metadata. These configure/control behavior; they do not certify model quality.

## Measurement boundary

**DECIDED candidate dimensions:** capability coverage; evidence discipline; reasoning/task suitability; context handling; memory utility; retrieval utility; tool use; verification/repair; efficiency/resource use; stability under matched conditions. Each dimension requires a documented evaluator, task set, denominator, population, confidence/uncertainty, version and time window. A profile intensity is a control setting, not an observed ability score. A single trace is not a general model rating.

**OIC-7 ownership:** evaluation methodology, paired benchmark execution, quality/efficiency score definition and authoritative measured results are **PLANNED OIC-7**, outside X1.0 and unavailable until a reviewed contract exists. Keep scores `PLANNED`; do not estimate them from profile sliders, provider marketing, trace counts or UI heuristics. X1-4 may specify a visual shell and consume future versioned evidence only.

## Target renderer

**PLANNED X1-4:** a Model Passport panel can show measured dimensions with sample count/window/method/source and “not measured” state. Candidate SVG radar/trait matrix is subordinate to a labeled numeric/table alternative; avoid a single composite score unless OIC-7 explicitly defines one. Compare only same evaluator version, task cohort, profile and controlled execution conditions. Explain confidence and non-comparability. Never expose private prompts, response text, hidden chain-of-thought or internal reasoning as DNA.

## Dimension contract

The preferred direction below is a question for evaluator design, not a score polarity guarantee. Every dimension remains PLANNED until OIC-7 defines target, normalization, benchmark population, confidence method, minimum sample and comparability. CURRENT runtime traces may supply observations, never universal ability scores.

| Dimension | Meaning / preferred direction | Owner and status | Normalization, confidence, sample and comparison |
|---|---|---|---|
| Reasoning | Correct constraint handling on a defined task; higher objective pass may be favorable | OIC-7 PLANNED; traces have strategy/verification only | Matched tasks and rubric; confidence interval; minimum evaluated task count; compare same task cohort |
| Retrieval | Relevant authorized evidence selected and used; higher supported coverage may help | Runtime emits query/evidence artifacts; quality score OIC-7 PLANNED | Recall/precision denominator and authorization; confidence from labeled set; minimum query/task sample |
| Evidence Handling | Claims correctly linked to non-conflicted evidence; higher supported fraction may help | Trace verifier/evidence summary CURRENT per execution; dimension PLANNED | Claim/evidence unit and dependency policy; uncertainty interval; compare same evidence protocol |
| Memory Utility | Selected memory contributes verified support without harmful conflict | Runtime has trace-safe utility records; generalized metric PLANNED | Outcome-linked memory events and eligible denominator; minimum independent runs; same memory policy/cohort |
| Verification | Defined failures found without unacceptable false positives; both sensitivity and specificity matter | Verifier status CURRENT per trace; score PLANNED | Labeled errors and negatives; confidence on both rates; sample for each label |
| Tool Orchestration | Correctly selects/uses authorized tools for task constraints | Runtime records tool calls/outcomes where applicable; score PLANNED | Task-specific expected tool policy; confidence and abstention accounting; matched tasks |
| Search / Adaptation | Bounded search selects useful alternatives and stops appropriately | Trace stages/search/stop summaries CURRENT where emitted; score PLANNED | Outcome and resource-normalized objective; confidence; same search budget/task cohort |
| Self Repair | Repair resolves identified failure while preserving constraints | Trace may record revision/repair stages; score PLANNED | Pre/post assertion set and regression rate; confidence; enough failed and repaired cases |
| Reliability | Consistent completion across repeated equivalent scenarios | No population metric asserted; PLANNED | Failure definition, denominator and independence; interval over repeated runs; matched environment |
| Efficiency | Resource use for an equivalent accepted outcome | Per-run calls/tokens/duration CURRENT when recorded; efficient-quality score PLANNED | Normalize by task and outcome; uncertainty; compare same provider/model/task conditions |
| Latency Discipline | Meets declared latency budget without quality loss | Per-run duration may be recorded; target score PLANNED | Percentile/window and timeout policy; sample count/interval; same infrastructure and load |
| Cost Efficiency | Measured cost for equivalent successful outcome | No billing truth implied by pricing catalog; PLANNED | Actual billable usage/rates/time; confidence/accounting source; matched outcomes only |
| Stability | Metric/result variance over matched repeated runs | PLANNED OIC-7 | Evaluator variance and environment controls; enough independent repetitions; version-matched |

**Partial DNA:** show available dimensions without renormalizing them into a composite; missing entries say “not measured” with source/method absence. Never treat partial polygon area as comparable to a complete DNA shape. **Comparison:** require same evaluator version, dimension definition, task cohort, profile/policy or explicitly disclose the changed profile, provider/model revision, time range and data collection conditions. If incompatible, side-by-side inspection is allowed but score delta is not.

**Versioning:** evaluator version, metric definition version, rubric/fixture version and cohort key are immutable provenance. Re-evaluation creates a new result linked to same model revision; never overwrite previous DNA. Anti-fabrication: no profile intensity, provider marketing, raw trace count, one successful run, default, placeholder or UI formula becomes a score. OIC-7 owns semantic result and sample/confidence gates; Console owns honest rendering only.
