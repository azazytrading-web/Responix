# OIC Interaction System

All patterns are **DECIDED contracts**; current availability is partial. Every action must state its target, scope and lifecycle consequence before commit when consequential. Feedback shows accepted/rejected result and source refresh; it must not imply success on optimistic failure.

**CURRENT owners:** shared UI controls are in `apps/oic-console/app/components/oic-controls.tsx`; X1-1's `oic-primitives.tsx` and `oic-frames.tsx` are dirty implementation work under review. Current pages compose these through `console-app.tsx` and `app/features/**`. This document defines target semantics independent of today's prop surface.

| Pattern | Use / do not use | Keyboard, narrow, RTL |
|---|---|---|
| Button / icon button | Primary commit or clear secondary action; icon-only only when universally recognizable and labeled. | Tab/Enter/Space; adequate target; logical alignment. |
| Toggle / checkbox | Immediate reversible boolean vs explicit selection; do not use toggle for multi-state lifecycle. | Space; announce checked state; mirror layout only. |
| Segmented control | Small mutually exclusive mode set; not long lists. | Arrow navigation; narrow may scroll or become select. |
| Slider / range slider | Bounded numeric policy with current value/unit; never UUID/text substitute. | Arrows, Home/End, page increments, label/value; numerical direction remains stable in RTL. |
| Searchable selector / entity picker | Choose from scoped known entities; show name, type, scope and status. | Typeahead, arrows, Enter, clear; narrow full-screen sheet; preserve stable reading order. |
| Popover / menu | Brief actions or contextual options; not long forms. | Escape closes, focus returns, menu key behavior; logical anchor. |
| Dialog / drawer / inspector | Confirm destructive/credential action; entity details; technical diagnostics. | Focus containment/restoration, Escape rules, labeled heading; drawer becomes full-screen narrow. |
| Tabs / stepper / wizard | Related workspace modes; staged validated task with review. | Arrow/tab semantics; preserve progress; mirror directional step affordance. |
| Compare workspace | Side-by-side same-scope revisions/results; do not imply causal comparison without controlled inputs. | Readable stacked narrow presentation; preserve aligned fields. |
| Technical inspector | Safe IDs, versions, source, timestamps and structured metadata. Never secrets/prompts/hidden reasoning. | Copy/select semantics, LTR code islands, wrap long values. |
| Lifecycle controls | Explicit activate/suspend/archive/revoke with scope and consequence. | Confirmation for irreversible actions; require permission; never color alone. |
| Empty/loading/error/unavailable | Distinguish no records, pending, failed, and source unavailable. | Announce state; retain retry/context; narrow content order stable. |
| Action feedback / contextual insight | Report server-confirmed result; insight must cite source/freshness and known vs inferred. | Live region for result; dismissible, focus-safe, EN/AR. |

**DECIDED permanent rule:** MANUAL TEXT / UUID ENTRY IS FALLBACK OR EXPERT MODE, NOT THE DEFAULT OPERATOR EXPERIENCE. Use scoped pickers backed by real API results; keep expert copy/paste for diagnostics and integrations.

## Primitive contracts

All components receive already-authorized options/data from a workspace. They emit intent; the workspace calls BFF; server confirmation owns persisted state. The table defines required behavior; local implementation may differ if it preserves the contract.

| Primitive | Purpose / default use | Not for; states / error | Keyboard / accessibility | RTL / narrow |
|---|---|---|---|---|
| Button | Named action; primary action once per frame | Not multiple competing primaries; default/hover/focus/disabled/busy/error | Native button, Enter/Space, busy announced and duplicate submit blocked | Logical alignment; stack secondary actions narrow |
| IconButton | Compact secondary action with visible/accessible name | Not unlabeled icon or destructive action without confirmation | Native button, tooltip supplements accessible name | Mirror directional glyph only; preserve target |
| Toggle | Immediate reversible boolean setting | Not lifecycle, save, or multi-step mutation; checked/unchecked/disabled/pending | Native switch state, Space, label | Track direction may mirror; value semantics do not |
| Checkbox | Independent or multi-select choice | Not exclusive choice; checked/mixed/unchecked/disabled | Space; group legend and associated descriptions | Logical label side; narrow wraps |
| SegmentedControl | Small exclusive mode set | Not >5 options, long labels or arbitrary entity picker; selected/disabled | Radiogroup or tab semantics; arrows, one tab stop | Arrow direction follows RTL; scroll or select fallback narrow |
| Slider / RangeSlider | Bounded numeric value/range with meaning and unit | Not hidden policy or unknown value; min/max/value/unavailable/disabled | Native range; arrows, Home/End, page steps; current value text | Mirror track only if direction is spatial; numbers remain monotonic |
| EntityPicker | Select a known scoped entity | Not free-form identity; loading/empty/error/selected/disabled | Combobox/listbox pattern; typeahead, arrows, Enter, Escape, focus return | Full-screen sheet narrow; metadata wraps |
| SearchPicker | Query large known collection with bounded results | Not raw server query passthrough; query/loading/no-result/error | Search name, clear button, result count announcement | Full width narrow; preserve typed query on close |
| Popover / ContextMenu | Short contextual controls/actions | Not long form or important hidden navigation; open/closed/disabled | Escape closes, focus restoration; context menu arrow semantics only when implemented | Align to logical anchor; become bottom sheet if constrained |
| Dialog | Confirm consequential/destructive action or focused task | Not routine read-only details; open/submitting/error/success | Modal name, focus trap, Escape policy, return focus | Fit viewport/scroll body, actions always reachable |
| Drawer / Inspector | Entity details or related workspace context | Not a second global route; closed/loading/error/content | Labeled region/dialog, close button, predictable focus | Desktop side pane; narrow full-screen drawer, back closes first |
| Tabs | Switch related views with shared context | Not unrelated global destinations; active/loading/error per tab | Tablist arrow and Home/End; selected panel label | Horizontally scroll or select, never wrap ambiguously |
| Stepper / Wizard | Validated multi-step high-impact operation | Not trivial one-field action; current/completed/blocked/error/review | Headed steps, back/next, focus new heading, retain draft | Single-column steps; show step count and summary |
| CompareSurface | Compare same-kind revisions/runs with conditions disclosed | Not assign winner without objective criterion; missing/noncomparable values explicit | Table row/column headers and keyboard scroll | Stack groups with aligned labels, not squashed columns |
| TechnicalInspector | Safe raw identifiers/source/version and allowlisted metadata | Never secrets, private prompt/response, hidden CoT; loading/not-found/denied | Copy controls named; selectable text; expandable sections | LTR IDs, wraps long values, hide no critical data |
| LifecycleControls | Supported activate/disable/archive/revoke transition | Not arbitrary free-form status assignment; valid transitions only | Named action, confirm terminal effects, server error visible | Menu/sheet narrow; destructive separated |
| ActionFeedback | Server-confirmed result and correlation link | Not optimistic “saved” on network start; pending/success/rejected/unknown | Polite live region; focus retained unless dialog transition | Wraps scope/reason; dismiss does not erase error |
| ContextualInsight | Fact/rule/recommendation anchored to current context | Not generic chatbot or ungrounded suggestion; status class + source + confidence | Semantic heading, source link, action explicit | In inspector inline or collapsible; same reading order |
| EmptyState | Successful query yielded no rows | Not API failure; includes scope explanation and valid next action | Announced heading; focus unchanged | No oversized hero on narrow |
| LoadingState | Pending request with stable context | Not indefinite spinner; include timeout/retry threshold | `aria-busy`; avoid live announcements every frame | Skeleton matches final reading order |
| UnavailableState | Source cannot answer / no connection | Not zero or empty; endpoint/source and retry where safe | Alert/status semantics, retry button | Concise error + details disclosure |
| FaultState | Explicit source/domain fault | Not transient loading; safe code and correlation ID, no secret detail | Assertive announcement only for actionable critical fault | Preserve incident detail and action access |

### Interaction precedence

1. **Direct control** for a small, reversible, well-scoped setting in the current view.
2. **Contextual drawer** for inspect/select/change an entity without losing workspace context.
3. **Wizard** when multiple validated steps, external credential entry, dependency review or consequential scope confirmation are required.
4. **Expert inspector** for raw IDs, versions, safe metadata and diagnostics; secondary to the normal operator picker.

Choose the least interruptive pattern that still communicates scope and consequence. A lifecycle action, credential rotation, binding change or cross-scope reassignment is never reduced to an unlabeled toggle. Network failure leaves the last confirmed state visible with stale marker, not a new value.
