# OIC Component Contracts

Contracts below are **DECIDED target semantics**. Existing X1-1 components are partial implementations; exact props may evolve without changing meaning.

| Component | Contract and required states |
|---|---|
| PageFrame | Title, breadcrumb, description, scope/status, primary action and content landmark; EN/AR direction; loading/error remain inside page context. |
| WorkspaceFrame | Local navigation, controls, working region, optional inspector and feedback; responsive reflow; preserve selected entity on narrow layouts. |
| Sidebar | Global domain destinations, current selection, accessible collapse; keyboard-operable; logical RTL ordering. |
| CommandBar / CommandPalette | Search destinations/entities/actions authorized for current operator; no unauthorized result; focus trap only if dialog; keyboard navigation and localized labels. |
| Slider | Bounded numeric setting, current value and unit/meaning, disabled/error; labeled slider keyboard semantics; numeric direction stable in RTL. |
| SegmentedControl | Small exclusive options with selected value; keyboard arrows; avoid overflow or present narrow alternative. |
| EntityPicker | Search real scoped API entities; type/name/status/scope; empty/loading/error; keyboard typeahead; expert ID fallback. |
| Drawer / Inspector | Labeled entity context, safe detail, close/focus return; full-screen narrow; technical ID LTR. |
| Wizard | Validated steps, draft vs persisted status, review and recoverable errors; keyboard step semantics; no hidden side effects. |
| CompareSurface | Declares compared objects and changed conditions; missing/non-comparable values explicit; stacks on narrow. |
| MetricInstrument / InstrumentGroup | Reads Metric Registry only; value, unit, state, source, freshness, accessible text alternative; unavailable/idle/degraded/fault; renderer cannot invent data. |
| TechnicalId | Copyable selectable identifier with type label and LTR isolation; safe truncation and accessible full value. |
| ActionFeedback | Server-confirmed success/failure, affected scope, request/trace link; live region; dismissible without hiding errors. |
| ContextualInsight | Source/method, observed time, uncertainty and known/predicted/unknown classification; no action execution without consent. |
| EmptyState / UnavailableState | Empty means successful query with zero rows; unavailable means source/request failure; retry only when valid; localized and announced. |
| LiveStateIndicator | `LIVE`, `PAUSED`, `OFFLINE`, `RECONNECTING` acquisition state with source/observation context; never infers freshness from render time. |
| FreshnessIndicator | `FRESH`, `AGING`, `STALE`, `UNAVAILABLE`, `FAULT`; shows source time and uses owner-defined thresholds only. |
| ConfigurationDiff | Current/proposed semantic field diff, scope, known/predicted/unknown impact; structured values remain understandable. |
| MutationStatus | Shared `IDLE` through `APPLIED`/`PARTIAL`/`FAILED` command outcome; separates mutation from follow-up read status. |
| PermissionGate / CapabilityAwareAction | Presentation hint only; distinct visible/read-only/actionable/not-authorized/not-applicable/unavailable states; API remains authoritative. |
| EventStream / EventRow | Optional scoped source subscription and safe event rendering with time, provenance, severity and gap/reconnect state; no distributed bus implied. |
| RecoveryPanel | Classified error, confirmed/unknown outcome, safe reconciliation and supported next steps; never invents undo. |
| FeatureAvailability | Distinct capability/config/data/auth/service availability taxonomy from the versioned compatibility contract. |
| TemporalRangeControl | Offers only source-supported retained windows and aggregation; unavailable history remains distinct from live snapshot. |

All components support semantic HTML, visible focus, reduced motion, contrast, error associations and four EN/AR × LTR/RTL contexts. Components do not bypass BFF/API permission checks.

## Component composition and implementation interface

**DECIDED:** components receive explicit `locale`, `dir`, accessible label(s), current state and controlled value/event callbacks where applicable. Fetching, authorization, domain decisions and optimistic persistence do not belong inside presentational primitives. Workspace owns data fetching, entity scope, action confirmation, and API read-back. Component events describe user intent (`onSelect`, `onOpen`, `onClose`, `onChange`, `onConfirm`, `onRetry`), not presumed success. A `pending`/`disabled` state is supplied by owner; controls do not fake completion.

| Component | Responsibility / inputs and states | Events / accessibility | RTL / responsive / composition | Anti-patterns |
|---|---|---|---|---|
| PageFrame | Page title, description, breadcrumb, scope/status, actions; normal/loading/error | Breadcrumb/action callbacks; main landmark, one H1, status announced | Logical slots; narrow heading stacks | PageFrame owns domain fetch or duplicates workspace heading |
| WorkspaceFrame | Local nav, control row, content, optional inspector; selected/local state | `onNavigateLocal`, inspector open/close; labeled nav/region | Grid pane order logical; narrow inspector full-screen | Nested global sidebar or hidden local selection |
| Sidebar | Domain links, active view, collapse | Navigation callback; `aria-current`, keyboard links/buttons | Direction-aware rail/collapsed menu | Long flat entity/action list |
| CommandBar | Global breadcrumb, connection/locale/session actions | Named action callbacks; landmarks and button names | Mirrors layout, not identifiers; condenses narrow | Mix mutating domain forms into global bar |
| CommandPalette | Search permitted destinations/entities/actions; open/query/results | Open, query, choose, close; dialog/listbox keyboard and focus restore | Full viewport narrow; localized, stable results | Bypass API permissions or make every action globally available |
| Slider / RangeSlider | Label, min/max/step/unit/value/unavailable/markers | Numeric `onChange`; native range name/value/description | RTL track policy explicit; stacked narrow | Slider without explanation; infer score from value |
| SegmentedControl | Small exclusive value/options/selected | `onChange`; radiogroup/tab semantics | Arrow handling mirrors reading; scroll/select narrow | Lifecycle values as decorative pills |
| EntityPicker | Authorized option set/query/loading/error/value | `onSelect`, `onQuery`; combobox/listbox pattern | Popover logical anchor; narrow sheet | Free UUID input as normal path |
| Drawer | Entity/action/task content, title, modal policy | `onClose`; focus trap/return if modal | Logical entry edge; full-screen narrow | Keep hidden drawer controls tabbable |
| Inspector | Read-only entity state, sections, source and actions | Link/action callbacks; heading hierarchy and region | Side pane desktop, page-like narrow | Unscoped lookup or secret/raw JSON dump |
| Wizard | Steps/draft/errors/review/submit | next/back/cancel/submit; focus step heading, progress | Single column narrow; direction-aware steps | Claim persisted before server result |
| CompareSurface | Two+ comparable records and changed-condition set | Select/expand/drilldown; semantic table | Stack groups narrow | Winner badge without evaluator/criterion |
| MetricInstrument | Definition+instance+state+size; no fetching | Drilldown callback only; text equivalent and label/unit | Renderer doesn't reverse numeric meaning | Compute values or omit freshness/state |
| InstrumentGroup | Domain/entity set of instrument descriptors | Expand/focus; heading/region | Grid density modes, list narrow | Hard-coded entity-specific metric JSX |
| MetricDeck | Grouped registry descriptors and curated order | Range/focus/compare only when supported | Responsive reorder preserves reading order | Save custom layouts before persistence contract |
| ModelDNA | Versioned evaluator dimensions, provenance, missing fields | Compare/drill evidence; table first | No radar-only interface; stack narrow | Use profile intensity or composite guessed score |
| TechnicalId | Type/value/source; copy affordance | Copy feedback and selection; accessible full ID | `dir=ltr`, wraps/clips with reveal | Direction-mixed or inaccessible truncation |
| ActionFeedback | Pending/result/error/request correlation | Retry/dismiss/link; polite live region | Wraps and stacks narrow | Toast-only for critical errors or optimistic success |
| ContextualInsight | Typed fact/insight/warning/recommendation/prediction/unknown with source | Open source/apply intent; semantic class announced | Local inspector context; narrow inline | Chat bubble or unidentified “AI insight” |
| EmptyState | Successful zero result, scope and next step | Optional create/filter action; heading | Compact in narrow | Reuse for failed API request |
| LoadingState | Request pending and destination frame | Optional cancel; `aria-busy`, stable skeleton | Content-shaped at both widths | Indefinite spinner without timeout/retry |
| UnavailableState | Source absence/transport failure and safe retry | Retry/copy correlation; status/alert semantics | Details disclosure narrow | Show zeros or call it empty |
| FaultState | Classified source/domain failure and safe diagnostic | Retry/escalation link; assertive only if critical | Keeps actionable controls visible | Expose stack/secret or alarm for harmless empty |

Composition rules: one modal layer owns focus; drawers can host inspectors but not competing dialogs; menus/popovers close before navigation; a wizard may include direct controls but must own draft state; `ActionFeedback` is rendered by the workspace shell so navigation does not erase a failure; metric components never wrap domain actions that the API does not allow. All contracts include EN/AR message keys, logical layout, LTR technical identifiers, zoom/reflow and reduced-motion behavior.

The added runtime components implement contracts in [21 live state](21_OIC_LIVE_STATE_AND_TEMPORAL_ARCHITECTURE.md), [22 command/event](22_OIC_ACTION_COMMAND_EVENT_ARCHITECTURE.md), [23 permissions](23_OIC_PERMISSION_AWARE_OPERATOR_UX.md), [24 recovery](24_OIC_FAILURE_RECOVERY_AND_ROLLBACK.md), and [26 availability/versioning](26_OIC_VERSIONING_CAPABILITY_AND_COMPATIBILITY.md); they are conceptual and are not implemented by X1.0C.

X1.3B component grouping/public exports/testing ownership and OIC-vs-neutral boundaries are contracted in [37](37_OIC_INTERFACE_EXTRACTION_STRATEGY.md), with detailed families in [29–34](29_OIC_CONTROL_LIBRARY_CONTRACT.md). Prefer typed props and discriminated semantic states; no giant index/component, per-page state machine, arbitrary CSS override or API behavior inside presentation primitives.
