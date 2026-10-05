# OIC Selection and Picker System

**Status:** DECIDED X1.3B contract. Parent: [28](28_OIC_INTERFACE_SYSTEM_ARCHITECTURE.md); shared state/security: [34](34_OIC_INTERFACE_STATE_PERMISSION_MACHINE.md).

## Selection families

Searchable Select and Combobox handle known option sets. Entity Picker is a labeled, scoped entity selector. Specialized Model, Provider, Application, Tenant, Service Principal, Profile and Revision pickers use domain adapters over that contract. Hierarchical Picker preserves family→edition→revision→variant or application→tenant relationships. Multi-select, Tag/Chip, Scope, Capability, Lifecycle, Relationship and Dependency selectors use only API-backed choices and explicit selection cardinality. Command Palette Picker shares search semantics. Recent/Favorite picker is deferred until a safe persistence/retention contract justifies it; never fabricate recents.

If OIC already knows an entity, ordinary workflows must not ask the operator to type its UUID. Show a human-readable name and relevant type, scope and status; canonical ID is secondary copyable technical detail in inspector. Raw text is acceptable for external references, opaque provider IDs or content where backend contract requires it, not as a replacement for a known entity relationship.

## Search/result lifecycle

`IDLE → SEARCHING → RESULTS | EXACT_MATCH | NO_RESULTS | ERROR`; optional `RECENT` is a separate source state, and `INACTIVE/ARCHIVED` matches remain explicitly labeled when the domain allows selection. Debounce/network paging is owned by the workspace adapter. Retain the current selected value on search failure. Empty, loading, failed and no-results messages differ. Search options are scope-filtered by authoritative API response; do not broaden a query or expose unauthorized entities after 403.

Each option has stable key, accessible name, secondary identity, type, scope, lifecycle/capability badges, and disabled reason when known. Selection reports intent only. For dependent choices, clear or mark descendants stale only after explaining the change; preserve operator context and draft values for conflict review. More than one relationship axis uses hierarchical selection rather than an unstructured huge select.

## Scale and keyboard

Use client filtering only for a bounded complete option set. Prefer server-side query/page contracts for large or scoped entity populations. The API currently supports `q` on memory and knowledge lists and bounded execution retrieval; it does not expose a universal searchable entity endpoint or generic pagination contract. Do not claim scalable remote search where it is absent. Virtualize only when measured list size/render cost requires it; retain accessible result count and predictable focus while rows update.

Follow combobox/listbox/select semantics: label, expanded/controls/active-descendant as appropriate; Arrow keys move through results, Enter selects, Escape closes without losing prior selection, Tab follows normal page focus, Home/End only where the adopted pattern specifies. Multi-select uses explicit selected state and removal controls. In narrow layouts, use a full-screen selection sheet or reflowed panel, never a clipped popover.

## Localization and URLs

Search labels/results are native EN and AR. Technical IDs and canonical keys use LTR bidi-isolated code islands. RTL may mirror panel arrangement, but must not reverse ID strings, numerical ordering or domain hierarchy. Selected entity and appropriate tab/filter/inspector target may be URL state only when safe and authorization is rechecked on load. Never put credential, secret, prompt, sensitive draft, transient permission proof or private query content in URLs. Deep links are locations, not access grants.

## API truth and tests

Use current snapshot relationships, dedicated list/detail reads, memory/knowledge `q`, and runtime context as they exist. Profiles support list/detail but not general server search. Provider/model pickers derive only from scoped source data. Any future broad search, inactive inclusion, relationship preview or capability query requires an explicit API contract. Test exact match, no results, archived/inactive, scope denial, large-list query behavior, async failure with retained selection, keyboard, dependent-selection conflict, EN/AR+RTL, narrow sheet, URL reauthorization and safe IDs.
