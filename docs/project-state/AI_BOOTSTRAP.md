# AI Bootstrap

## Mission

Continue Responix safely and accurately without losing architecture, sprint, validation, or runtime context.

## Repository Purpose

Responix is an enterprise multi-tenant AI customer-engagement platform. It is a TypeScript pnpm/Turbo monorepo with a Next.js Dashboard, NestJS API, Prisma/PostgreSQL foundation, Redis, Docker Compose, and shared packages.

## Required Reading Order

1. [AI_CONTEXT.md](AI_CONTEXT.md)
2. [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
3. [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
4. [ENGINEERING_WORKFLOW.md](ENGINEERING_WORKFLOW.md)
5. [AI_RULES.md](AI_RULES.md)
6. [PROJECT_VERSION.md](PROJECT_VERSION.md)
7. [VALIDATION_HISTORY.md](VALIDATION_HISTORY.md)
8. [ROADMAP_STATUS.md](ROADMAP_STATUS.md)
9. The official documents explicitly named by the active sprint.

Do not implement anything until this reading is complete and the active sprint scope is understood.

## Repository and Engineering Rules

- The official technical documentation and approved sprint request are authoritative.
- Do not redesign architecture, invent requirements, or begin a later sprint early.
- Keep TypeScript strict; preserve package boundaries and tenant-aware architecture.
- Fix root causes. Do not hide failures by disabling rules, checks, tests, or runtime behavior.
- Architecture changes require an ADR in `ARCHITECTURE_DECISIONS.md`.

## Validation Rules

Before handoff, review, or commit, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`. Validation may never be skipped or represented as successful without evidence.

## Coding and Documentation Rules

- Implement only approved scope using production-quality, typed, modular code.
- Do not commit secrets, `.env` files, generated output, or fake implementations.
- Update `DEVELOPMENT_LOG.md`, `SESSION_HANDOFF.md`, `ROADMAP_STATUS.md`, and `PROJECT_VERSION.md` when the change affects them.

## Definition of Done

Approved scope, validation, relevant runtime verification, documentation, and handoff are complete; known environmental blockers are documented separately from repository defects.

## Session End Checklist

- [ ] Validation evidence recorded.
- [ ] Runtime results or blockers recorded.
- [ ] Architecture decisions recorded when applicable.
- [ ] Development log, handoff, roadmap, version, and issues documents updated as needed.
- [ ] No secrets, generated files, or unrelated changes are included.
