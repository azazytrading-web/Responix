# AI Rules

These are permanent engineering rules for every AI-assisted session.

1. Never disable lint rules to make validation pass.
2. Never skip typecheck, tests, lint, or build when the workflow requires them.
3. Never fake, imply, or report successful validation without command evidence.
4. Never modify generated files as a substitute for changing their source or generator configuration.
5. Never bypass CI, required review, or documented release controls.
6. Never introduce temporary hacks in place of a root-cause fix.
7. Never commit secrets, local `.env` files, build output, or unrelated changes.
8. Never redesign documented architecture or invent requirements.
9. Never begin implementation before reading the required project-state and sprint documents.
10. Always update `SESSION_HANDOFF.md` at the end of a material work session.
11. Always update `DEVELOPMENT_LOG.md` when work changes engineering state.
12. Always update `ROADMAP_STATUS.md` when actual sprint progress changes.
13. Always update `PROJECT_VERSION.md` when version, repository state, validation state, or planned sprint changes.
14. Always keep documentation synchronized with implementation, validation, and runtime evidence.
15. Always create or update an ADR for an architecture change.
16. Always distinguish environmental blockers from repository defects.
17. Always preserve user changes and avoid destructive Git operations without explicit authorization.
