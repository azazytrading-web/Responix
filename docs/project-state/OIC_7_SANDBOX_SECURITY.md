# OIC-7 Sandbox Adapter hardening record

**Status:** local Docker and integrated worker security acceptance passed; packet 7.2 remains open.<br>
**Scope:** trusted host-side execution adapter and disabled-by-default worker path.

## Enforced adapter policy

- Docker CLI is launched with `spawn(..., { shell: false })` and a structured argument array. Caller command arguments are interpreted only inside the container. Images must be in `OIC_EVALUATOR_IMAGE_ALLOWLIST` as immutable `name@sha256:...` references; preflight checks the Linux engine and requires the pinned image already present.
- Each call gets a fresh container and in-memory regular-file-only ustar input stream. No repository, profile, database, vault, Docker socket, or R: directory is mounted. The only candidate writable paths are size-capped `/workspace`, `/tmp`, and `/dev/shm` tmpfs mounts. Caller filenames are restricted to safe leaf names.
- The container runs as UID/GID 65532 with a read-only root, private IPC, `--network none`, all capabilities dropped, `no-new-privileges`, Docker's daemon default seccomp profile, bounded PIDs, memory and swap, CPU quota, wall-clock timeout, and combined stdout/stderr limit. No host or image environment variables are passed with `--env`.
- Preflight checks `R:\OIC-Infrastructure\Evaluator` exists as a real directory and has the configured free-space reserve. The host never stages target files there; Docker Desktop's disposable data root is expected on R: per the infrastructure handoff.
- Every result carries a digest over the pinned image plus Docker Engine version and architecture, the separate resource-policy revision digest, network policy, elapsed time, exit/signal, truncation and resource-limit classification. The policy digest includes resource caps and single-process local concurrency. `--pull=never` prevents a preflight/run race from silently downloading a missing image. Cleanup failure is infrastructure failure, not a successful measurement.
- Orphan reconciliation filters by evaluator ownership labels, validates each attempt UUID, asks the caller for durable lease truth, removes only stale owned containers, and keeps leased work. It rejects oversized orphan lists and ambiguous state.

## Local acceptance evidence

Command: `pnpm --filter @oic/api test:evaluation:sandbox` with the explicit security-acceptance switch and local image digest set for that invocation.

Result: **17 passed, 0 failed, 0 skipped** against `alpine@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6` on Docker Linux, Docker Engine 29.6.2, 2 CPUs and about 1.9 GiB engine memory. The suite includes an integrated worker-to-sandbox invocation and lost-lease abort.

The acceptance cases exercised:

- non-root identity, read-only root, zero effective capabilities, `NoNewPrivs=1`, seccomp filter active, no Docker socket, no host bind mounts or host/oracle paths;
- denied outbound network and explicit public-input staging;
- synthetic worker secret absent from target environment, output and result envelope;
- bounded workspace/tmpfs writes, combined output truncation, PID/fork limit, memory OOM classification and external timeout termination;
- missing Docker executable, missing image policy, insufficient R: reserve and disabled-backend fail-closed behavior;
- automatic cleanup and stale-orphan removal while preserving leased and unrelated containers;
- structured host argument construction and path-traversal rejection.

## Remaining security and activation gates

- These controls and bounded fixtures do not prove resistance to kernel/container escapes or every hostile workload. No invasive exploit testing was performed.
- The adapter and worker are disabled by default. The PostgreSQL queue, worker, outbox and independent reconciliation loop now exist. Physical attempts link OIC-6 admission before dispatch; admitted expired work stops for reconciliation. Executable candidates run only in the pinned sandbox, and a sealed-output verifier returns a bounded oracle verdict after settled admission. A rollback-only database fixture covers the queue, encrypted protected artifacts, verifier and outbox; the live Docker fixture covers worker-to-sandbox execution.
- PostgreSQL serializes executable capacity across replicas at one live lease. The adapter also permits one concurrent execution per API process. A real provider/runtime canary, aggregate campaign budget and complete retry/failure policy remain required before packet 7.2 acceptance.
- Network-enabled benchmarks, arbitrary images, device access, privileged jobs, external output artifacts, and benchmark-specific larger resource classes are unsupported and must fail closed.
