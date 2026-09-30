# OIC Development Boundary

**Status:** APPROVED / LOCKED
**Authority:** Owner's OIC Master Architecture Human Decision Lock, 2026-09-30
**Repository:** shared Responix Git repository/history; no second repository
**OIC branch/worktree:** `oic` at `G:\Trading\OIC`
**Initial OIC baseline:** `79f7230ca51da60f950d21f3bc26a0b673658c93`
**Responix worktree:** `frontend` at `G:\Trading\Responix_Git`

## 1. Ownership boundary

OIC and Responix are peer products owned by Oi Smart Solutions. OIC owns OIC runtime/control code, OIC persistence and migrations, OIC contracts, provider infrastructure and reusable intelligence. Responix owns its product behavior and data, including workspaces, Agents, conversations/history, product memory/knowledge/RAG/tools, CRM, channels, workflows, human handoff and Channel Protection Guard.

OIC must not directly access Responix tables. Responix must not directly access OIC tables. Use versioned API, SDK and explicit connector contracts. Generic code may be extracted only after the boundary and independent consumers are understood; do not silently move data or erase Responix capabilities.

## 2. Branch and worktree policy

- Continue using the same Git repository and history; do not create a second repository under this policy.
- Use `frontend` / `G:\Trading\Responix_Git` for Responix work and `oic` / `G:\Trading\OIC` for OIC work.
- The OIC branch was created from accepted baseline `79f7230ca51da60f950d21f3bc26a0b673658c93`. OIC commits publish to `origin/oic`; Responix commits publish to `origin/frontend`.
- Keep each worktree focused on its product. Do not stage or commit dirty work from the other product. No `git add .` / `git add -A` for cross-product changes.
- Shared history does not mean permanently disconnected branches. Keep branches synchronized through reviewed integration gates; no casual cross-product cherry-picks and no force pushes.
- OIC architecture records are the first OIC program changes and belong on `oic`, not `frontend`.

## 3. Integration gates

**Gate 0 — Architecture:** this charter and boundary are committed on `oic`; Responix baseline and dirty work remain untouched.

**Gate 1 — Foundation contract:** before OIC persistence/runtime implementation, approve identity, authentication/service-principal, data ownership, API/versioning, threat/privacy, migration and acceptance contracts. Establish that Responix and OIC cannot access each other's tables.

**Gate 2 — Native runtime and compatibility:** review the canonical native request/result and OpenAI compatibility behavior against actual consuming applications. Specify unsupported features, model visibility, streaming, limits, errors, idempotency and usage semantics before code.

**Gate 3 — Minimum provider-backed Oi Model path:** integrate one bounded path with explicit provider connection, Oi Model release/variant binding, security, usage/trace, failure and rollback evidence.

**Gate 4 — Responix integration:** change Responix through its OIC client/API boundary. Verify tenant/resource isolation, product ownership, observable cutover and rollback. Do not use direct OIC tables or silently transfer Responix memory, knowledge, history or customer data.

**Gate 5 — Stable contract:** human acceptance confirms the OIC interface and migration path are stable enough for additional OIC development and independent Responix work. Responix Channel Protection Guard can then proceed independently within Responix.

At each gate, synchronize required shared baseline changes on a reviewed branch/path, validate the receiving product, and document compatibility. Do not automatically merge or cherry-pick during a gate.

## 4. Change policy

A phase charter authorizes only its stated bounded work. No OIC product/runtime features, OIC database schema, Responix data migration, Provider Fabric implementation or Responix behavior change is authorized by this boundary document alone. Keep source/product changes on the OIC worktree for OIC work and the Responix worktree for Responix work. The architecture charter controls product boundaries; each implementation contract supplies technical detail and acceptance evidence.

## 5. Initial worktree state

The `oic` worktree was created only after verifying that `G:\Trading\OIC` did not exist and that no existing `oic` branch/worktree was registered. It shares repository history and Git metadata with the Responix checkout. The `frontend` worktree remains at the same accepted baseline; its pre-existing dirty project-state files were preserved.
