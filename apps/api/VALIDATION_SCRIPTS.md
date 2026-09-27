# API validation scripts

The standalone API acceptance scripts that authenticate require these environment variables:

- `RESPONIX_E2E_EMAIL`
- `RESPONIX_E2E_PASSWORD`

Set them in the current shell or a local secret manager before running `binding-e2e.cjs`, `full-flow-e2e.cjs`, `knowledge-e2e.cjs`, `live-acceptance.cjs`, `repro-knowledge.ps1`, or `verify-knowledge.cjs`. The scripts fail with the missing variable's name and never print its value. Their existing local API endpoint remains unchanged.

These scripts perform acceptance flows that create or modify workspace data. Run them only against an intended local/test environment; they were not executed as part of the credential remediation.
