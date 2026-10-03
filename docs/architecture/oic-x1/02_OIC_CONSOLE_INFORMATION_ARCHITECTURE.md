# OIC Console Information Architecture

**DECIDED target global domains:** COMMAND, FOUNDATION, FACTORY, INTELLIGENCE, LAB, OPERATIONS. Global navigation holds domain destinations and global command search. Local workspace navigation holds filters, tabs, saved scope, sibling views, and entity context. Do not flatten every entity/action into a permanently visible sidebar.

## Route mapping

**CURRENT:** the Console is one Next page (`app/page.tsx`) with client `View` state and conditional feature views; these are not independent URL routes. A future route adapter should preserve bookmarkable destinations and scoped entity identifiers without breaking the existing BFF. The following mapping is the DECIDED target:

| Current view | Target domain / workspace |
|---|---|
| Overview | COMMAND / Flight Deck (X1-2) |
| Applications | FOUNDATION / Applications |
| Tenants | FOUNDATION / Tenants |
| Service Principals | FOUNDATION / Access |
| Provider Fabric | FACTORY / Provider Factory |
| Upstream Catalog | FACTORY / Provider Catalog |
| Oi Model Fabric | FACTORY / Model Factory |
| Intelligence Profiles | INTELLIGENCE / Profiles |
| Memory | INTELLIGENCE / Memory Studio |
| Knowledge | INTELLIGENCE / Knowledge Studio |
| Workbench | LAB / Intelligence Lab |
| Execution Traces | LAB / Trace Explorer |
| Runtime Lab | LAB / Runtime Lab |
| Health & readiness | OPERATIONS / Health |
| Audit | OPERATIONS / Audit |

## Frames and behavior

**DECIDED Page Frame:** page title, breadcrumb, scope/status, primary action, and content region. **DECIDED Workspace Frame:** local navigation, filter/scope row, main working surface, optional inspector, and action feedback. Breadcrumbs represent actual domain → workspace → entity hierarchy; do not imply URL routing until it exists.

On narrow layouts, collapse global nav behind an accessible menu; retain current domain and breadcrumb; move local tabs to scrollable/selectable controls; put inspector in a full-height drawer; keep primary actions reachable; tables may become labeled records or horizontally scroll within their own region. Do not shrink dense dashboards until text is unreadable.

RTL mirrors navigation order, drawer entry edge, directional icons and alignment through logical CSS. IDs, endpoints, UUIDs and code remain LTR-isolated. Keep keyboard order aligned with visual order in both directions.

**PLANNED expansion:** command palette and workspace-local navigation let the IA grow by domain and entity context; use search, filters, and scoped subnavigation instead of adding another flat sidebar. Current sidebar grouping is transitional, not the final route contract.

## Page-to-surface implementation map

| Current `View` | Global domain | Target workspace / local surface | Initial inspector / drilldown | Milestone |
|---|---|---|---|---|
| `overview` | COMMAND | Flight Deck: System Core, Fleet, Provider Network, Factory, Lab, Activity, Operations | Metric source → entity workspace; current summary links only | X1-2 |
| `applications` | FOUNDATION | Applications / Inventory, Access, Visibility | Application → tenant, principal, model visibility | X1-1 then X1-3/4 |
| `tenants` | FOUNDATION | Tenants / Inventory, External References | Tenant → application, references, grants | X1-1 |
| `principals` | FOUNDATION | Access / Principals, Scopes, Tenant Grants, Credentials | Principal → grants, safe credential metadata, audit | X1-1 |
| `providers` | FACTORY | Provider Factory / Overview, Connections, Credentials, Capabilities | Connection → check, sync, models, bindings | X1-3 |
| `catalog` | FACTORY | Provider Catalog / Upstream Models, Evidence, Sync Runs | Upstream model → provider/connection, Oi variants | X1-3 |
| `models` | FACTORY | Model Factory / Fleet, Families, Editions, Revisions, Variants, Bindings, Visibility | Model Passport / Assembly Pipeline | X1-4 |
| `profiles` | INTELLIGENCE | Profiles / Fleet, Revision, Policy | Profile revision → model revision and execution trace | X1-4 |
| `memory` | INTELLIGENCE | Memory Studio / Inventory, Composer, Usage | Memory record → provenance, safe observed use | X1-5 |
| `knowledge` | INTELLIGENCE | Knowledge Studio / Inventory, Source & Evidence, Dependencies | Knowledge record → source and dependency references | X1-5 |
| `workbench` | LAB | Intelligence Lab / Setup, Scenario, Baseline, Candidate, Result, Evidence, Resources, Trace | Run → paired executions and trace IDs | X1-6 |
| `traces` | LAB | Trace Explorer / Search, Timeline, Safe Artifacts | Execution → stage/evidence/resource summaries | X1-6 |
| `runtime` | LAB | Runtime Lab / Invoke, Result, Correlation | Invocation → request and execution trace | X1-6 |
| `health` | OPERATIONS | Health / API, Database, Dependencies | Check → endpoint/time/response details | X1-1 then X1-7 |
| `audit` | OPERATIONS | Audit / Events, Filters, Event Inspector | Event → actor, scope, request/trace, target | X1-1 then X1-7 |

## Navigation state contract

**CURRENT:** `app/i18n.ts` defines the `View` union and `nav` groups; `console-app.tsx` stores selected view in client state. Selection does not yet encode a URL. **DECIDED:** selected navigation means the active workspace, with `aria-current="page"`; pending selection never masquerades as active. The selected workspace remains selected while opening/closing its inspector. Back closes the topmost transient surface first, then returns to the prior entity/workspace state; a later route layer must synchronize browser history and restore filters/entity selection on back/forward.

Breadcrumb contract is `global domain → workspace → selected entity → optional subview`. Every segment except the current leaf is navigable and focusable. Do not derive hierarchy from display labels. Entity drilldown carries stable IDs and scope; API reauthorizes every read. Cross-workspace links use entity references and preserve originating return context. Deep links are **PLANNED**: route IDs must be validated and must produce an unavailable/not-found state without leaking existence across scopes.

**PLANNED route shape:** `/foundation/applications/{applicationId}?tab=visibility`, `/factory/models/{editionId}?tab=revisions`, `/intelligence/memory/{memoryId}`, `/lab/traces/{traceId}`, `/operations/health?check=database`. Domain/workspace names are stable slugs; `tab` is an allowlisted local surface; IDs are opaque identifiers, never authorization. Filters use bounded query values and must not encode secrets or raw memory/knowledge content. Opening a deep link runs current API authorization; denied and unknown IDs share a privacy-safe outcome. Back/forward restores the prior scoped selection/filter, but never caches sensitive entity payload beyond existing session boundaries.

The Workspace Frame owns local tabs/filters and one selected entity. Inspector is contextual, read-only by default; editing opens a focused action/dialog/wizard that confirms scope. On desktop it occupies a side column without changing global selection. On narrow view it becomes a full-screen drawer with entity title, close/back and primary action visible. RTL mirrors pane order and entry edge; ID/code values retain LTR isolation.

## Scaling past 20 additions

**DECIDED structure:** keep six global domains, then expose new capabilities as local surfaces or entity inspectors. For example, Factory can add provider auth profiles, endpoint policies, sync history, capability evidence, price evidence, connection tests, catalog diffs, upstream model details, transport compatibility, Oi families, editions, revisions, variants, binding resolution, visibility, release history, retirement plans, dependency checks, passport and comparisons without creating 20 global links. Use within-workspace search, grouped tabs, filtered inventory and contextual links. Promote an item globally only when it is an independently operated domain with distinct ownership and frequent cross-workspace access; record that decision first.
