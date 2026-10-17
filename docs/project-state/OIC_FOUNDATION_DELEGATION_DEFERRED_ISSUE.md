# Foundation delegation authority — deferred architecture hardening

Status: **DEFERRED ARCHITECTURE HARDENING** (OIC-7, 2026-10-14)

The current Foundation scope grant rule couples authority to grant a domain scope with possession of that executable domain scope. A normal Foundation administrator may therefore need to accumulate domain permissions just to provision other service principals. That expands the blast radius of a compromised Foundation credential and weakens separation of duties.

For the immediate OIC-7 development canary, the existing normal `oic-console-operator` has `oic:console:manage`. The canonical Admission Controller explicitly accepts that scope for plan and budget mutations. The normal `oic-foundation-operator` can rotate the Console operator credential through the audited Foundation credential lifecycle without receiving admission authority. No recovery actor or new delegation rule is needed for this canary.

Proposed future direction: define explicit, application-scoped delegation authority for scope grants, separate from executable business-domain scopes. Review protected targets, grant audit records, credential rotation, revocation, and self-grant constraints as part of that amendment. Do not infer executable admission or evaluation authority from the delegation role.

The `oic:console:manage` admission exception also needs an explicit **keep / narrow / retire** architecture decision. It currently grants broad OIC-6 mutation authority and should not be silently removed during OIC-7. The Console session and its server-held credential must remain protected while this exception exists.

This issue does not change the locked OIC-7 release protocol or authorize additional paid requests.
