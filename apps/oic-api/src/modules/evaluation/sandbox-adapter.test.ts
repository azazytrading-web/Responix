import assert from "node:assert/strict";
import test from "node:test";
import type { ConfigService } from "@nestjs/config";
import { buildDockerRunArgs, createSandboxArchive, EvaluationSandboxAdapter, SandboxUnavailableError, type SandboxPolicy } from "./sandbox-adapter";

const image = "alpine@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6";
const policy: SandboxPolicy = { enabled: true, images: [image], disposableRoot: "R:\\OIC-Infrastructure\\Evaluator", minFreeBytes: 1024 * 1024 * 1024, workspaceBytes: 8 * 1024 * 1024, tmpBytes: 16 * 1024 * 1024, shmBytes: 16 * 1024 * 1024, memoryBytes: 96 * 1024 * 1024, cpuCores: 0.5, pidLimit: 12, timeoutMs: 20_000, outputBytes: 4_096 };

function adapter(overrides: Partial<SandboxPolicy> = {}): EvaluationSandboxAdapter {
  const selected = { ...policy, ...overrides };
  const values: Record<string, string | number> = {
    OIC_EVALUATOR_ENABLED: selected.enabled ? "true" : "false",
    OIC_EVALUATOR_IMAGE_ALLOWLIST: selected.images.join(","),
    OIC_EVALUATOR_DISPOSABLE_ROOT: selected.disposableRoot,
    OIC_EVALUATOR_MIN_FREE_BYTES: selected.minFreeBytes,
    OIC_EVALUATOR_WORKSPACE_BYTES: selected.workspaceBytes,
    OIC_EVALUATOR_TMP_BYTES: selected.tmpBytes,
    OIC_EVALUATOR_SHM_BYTES: selected.shmBytes,
    OIC_EVALUATOR_MEMORY_BYTES: selected.memoryBytes,
    OIC_EVALUATOR_CPU_CORES: selected.cpuCores,
    OIC_EVALUATOR_PID_LIMIT: selected.pidLimit,
    OIC_EVALUATOR_TIMEOUT_MS: selected.timeoutMs,
    OIC_EVALUATOR_OUTPUT_BYTES: selected.outputBytes
  };
  return new EvaluationSandboxAdapter({ get: (key: string) => values[key] } as unknown as ConfigService);
}

void test("sandbox Docker invocation uses an immutable allowlist, argument vector and locked isolation flags", () => {
  const args = buildDockerRunArgs({
    containerName: "oic-eval-123e4567-e89b-42d3-a456-426614174000",
    image,
    command: ["/bin/sh", "-c", "echo '; arbitrary host syntax'"],
    policy,
    labels: { "io.oic.evaluator.owner": "oic-evaluator-v1", "io.oic.evaluator.run": "123e4567-e89b-42d3-a456-426614174000" }
  });
  assert.equal(args.includes("--pull=never"), true);
  assert.equal(args.includes("--network"), true);
  assert.equal(args[args.indexOf("--network") + 1], "none");
  assert.equal(args[args.indexOf("--cap-drop") + 1], "ALL");
  assert.equal(args.includes("--read-only"), true);
  assert.equal(args.includes("--user"), true);
  assert.equal(args[args.indexOf("--user") + 1], "65532:65532");
  assert.equal(args.includes("--volume"), false);
  assert.equal(args.includes("--mount"), false);
  assert.equal(args.at(-1), "echo '; arbitrary host syntax'");
  assert.throws(() => buildDockerRunArgs({ containerName: "oic-eval-123e4567-e89b-42d3-a456-426614174000", image: "alpine:latest", command: ["true"], policy, labels: {} }), SandboxUnavailableError);
});

void test("ephemeral archive accepts only bounded regular files with safe leaf names", () => {
  const archive = createSandboxArchive({ "input.txt": Buffer.from("fixture") }, 1024);
  assert.equal(archive.subarray(0, 100).toString("ascii").replace(/\0.*$/s, ""), "input.txt");
  assert.throws(() => createSandboxArchive({ "../secret": Buffer.from("x") }, 1024), SandboxUnavailableError);
  assert.throws(() => createSandboxArchive({ "C:\\secret": Buffer.from("x") }, 1024), SandboxUnavailableError);
  assert.throws(() => createSandboxArchive({ "input.txt": Buffer.alloc(1025) }, 1024), SandboxUnavailableError);
  assert.throws(() => createSandboxArchive(Object.fromEntries(Array.from({ length: 1025 }, (_, index) => [`f${index}`, Buffer.alloc(0)])), 1024 * 1024), SandboxUnavailableError);
});

void test("disabled backend fails closed without any host execution fallback", async () => {
  await assert.rejects(adapter({ enabled: false }).run({ image, command: ["/bin/sh", "-c", "echo must-not-run"] }), (error: unknown) => error instanceof SandboxUnavailableError && error.reasonCode === "SANDBOX_UNAVAILABLE");
  await assert.rejects(adapter().run({ image: "alpine:latest", command: ["/bin/sh", "-c", "echo must-not-run"] }), SandboxUnavailableError);
  await assert.rejects(adapter({ disposableRoot: "R:\\OIC-Infrastructure\\missing" }).run({ image, command: ["/bin/sh", "-c", "echo must-not-run"] }), (error: unknown) => error instanceof SandboxUnavailableError && error.reasonCode === "POLICY_UNAVAILABLE");
  await assert.rejects(adapter({ minFreeBytes: 300 * 1024 * 1024 * 1024 }).run({ image, command: ["/bin/sh", "-c", "echo must-not-run"] }), (error: unknown) => error instanceof SandboxUnavailableError && error.reasonCode === "SANDBOX_UNAVAILABLE");
});

void test("missing Docker executable fails closed as infrastructure failure", async () => {
  const originalPath = process.env.PATH;
  process.env.PATH = "";
  try {
    await assert.rejects(adapter().preflight(image), (error: unknown) => error instanceof SandboxUnavailableError && error.reasonCode === "SANDBOX_UNAVAILABLE");
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  }
});

const securityAcceptance = process.env.OIC_EVALUATOR_SECURITY_ACCEPTANCE === "true";
const selectedImage = process.env.OIC_EVALUATOR_TEST_IMAGE ?? image;
const environmentImage = selectedImage === image ? image : selectedImage;

void test("Docker security acceptance: non-root, readonly root, no socket or inherited secrets, bounded inputs, and network denial", { skip: !securityAcceptance }, async () => {
  const syntheticSecret = "OIC_SYNTHETIC_WORKER_SECRET_NEVER_IN_CONTAINER_83f0";
  process.env.OIC_EVALUATOR_TEST_SECRET = syntheticSecret;
  try {
    const result = await adapter({ images: [environmentImage] }).run({
      image: environmentImage,
      runId: "123e4567-e89b-42d3-a456-426614174000",
      caseExecutionId: "223e4567-e89b-42d3-a456-426614174000",
      attemptId: "323e4567-e89b-42d3-a456-426614174000",
      files: { "public.txt": Buffer.from("public-fixture") },
      command: ["/bin/sh", "-c", "printf 'uid='; id -u; test ! -w /etc || exit 24; echo ROOTFS_READONLY; test ! -S /var/run/docker.sock || exit 25; echo DOCKER_SOCKET_ABSENT; grep '^CapEff:' /proc/self/status | grep -q '0000000000000000' || exit 26; echo CAPABILITIES_DROPPED; grep '^NoNewPrivs:' /proc/self/status | grep -q '1' || exit 27; echo NO_NEW_PRIVS; grep '^Seccomp:' /proc/self/status | grep -q '2' || exit 30; echo SECCOMP_FILTERED; ! grep -Eq '/mnt/host/|/run/desktop/mnt/host/|/mnt/g/trading/oic|/mnt/c/users' /proc/self/mountinfo || exit 28; echo HOST_MOUNTS_ABSENT; for path in /mnt/g/Trading/OIC /run/desktop/mnt/host/g/Trading/OIC /mnt/c/Users /run/desktop/mnt/host/c/Users /run/oic/protected.txt; do test ! -e \"$path\" || exit 29; done; echo HOST_AND_ORACLE_PATHS_ABSENT; env; test \"$(cat public.txt)\" = public-fixture; echo INPUT_STAGED; if wget -T 1 -q -O- http://1.1.1.1 >/dev/null 2>&1; then exit 21; else echo NETWORK_DENIED; fi"]
    });
    assert.equal(result.status, "SUCCEEDED", result.stderr);
    assert.match(result.stdout, /uid=65532/);
    assert.match(result.stdout, /ROOTFS_READONLY/);
    assert.match(result.stdout, /DOCKER_SOCKET_ABSENT/);
    assert.match(result.stdout, /CAPABILITIES_DROPPED/);
    assert.match(result.stdout, /NO_NEW_PRIVS/);
    assert.match(result.stdout, /SECCOMP_FILTERED/);
    assert.match(result.stdout, /HOST_MOUNTS_ABSENT/);
    assert.match(result.stdout, /HOST_AND_ORACLE_PATHS_ABSENT/);
    assert.match(result.stdout, /INPUT_STAGED/);
    assert.match(result.stdout, /NETWORK_DENIED/);
    assert.equal(result.stdout.includes(syntheticSecret), false);
    assert.equal(result.stderr.includes(syntheticSecret), false);
    assert.equal(JSON.stringify(result).includes(syntheticSecret), false);
    assert.equal(result.backend, "DOCKER_LINUX");
    assert.equal(result.networkPolicy, "DENY");
    assert.match(result.environmentDigest, /^[a-f0-9]{64}$/);
    assert.ok(result.dockerEngineVersion.length > 0);
    assert.match(result.architecture, /^(?:amd64|arm64)$/);
  } finally {
    delete process.env.OIC_EVALUATOR_TEST_SECRET;
  }
});

void test("Docker security acceptance: writable workspace has a fixed tmpfs quota", { skip: !securityAcceptance }, async () => {
  const result = await adapter({ images: [environmentImage], workspaceBytes: 8 * 1024 * 1024 }).run({ image: environmentImage, command: ["/bin/sh", "-c", "if dd if=/dev/zero of=/workspace/full bs=1048576 count=12 2>/dev/null; then exit 31; else echo STORAGE_LIMIT; fi"] });
  assert.equal(result.status, "SUCCEEDED", result.stderr);
  assert.match(result.stdout, /STORAGE_LIMIT/);
});

void test("Docker security acceptance: external timeout stops a long-running container and removes it", { skip: !securityAcceptance }, async () => {
  const result = await adapter({ images: [environmentImage], timeoutMs: 700 }).run({ image: environmentImage, command: ["/bin/sh", "-c", "sleep 30"] });
  assert.equal(result.status, "TIMEOUT");
  assert.ok(result.durationMs < 5_000);
});

void test("Docker security acceptance: lost lease abort stops an active container", { skip: !securityAcceptance }, async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("synthetic lease loss")), 3_000);
  try {
    const outcome = await adapter({ images: [environmentImage], timeoutMs: 20_000 }).run({ image: environmentImage, command: ["/bin/sh", "-c", "sleep 30"], signal: controller.signal }).then((result) => result.status, (error: unknown) => error instanceof SandboxUnavailableError ? error.reasonCode : "UNEXPECTED_ERROR");
    assert.equal(outcome, "SANDBOX_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
});

void test("Docker security acceptance: stdout and stderr are bounded and truncation is explicit", { skip: !securityAcceptance }, async () => {
  const result = await adapter({ images: [environmentImage], outputBytes: 2048 }).run({ image: environmentImage, command: ["/bin/sh", "-c", "i=0; while [ $i -lt 1000 ]; do echo 012345678901234567890123456789; echo 987654321098765432109876543210 >&2; i=$((i+1)); done"] });
  assert.equal(result.status, "RESOURCE_LIMIT");
  assert.equal(result.resourceLimit, "OUTPUT");
  assert.equal(result.outputTruncated, true);
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 2048);
});

void test("Docker security acceptance: process and memory limits stop bounded hostile fixtures", { skip: !securityAcceptance }, async () => {
  const processes = await adapter({ images: [environmentImage], pidLimit: 8, timeoutMs: 4_000 }).run({ image: environmentImage, command: ["/bin/sh", "-c", "i=0; while [ $i -lt 100 ]; do (sleep 0.2) 2>&1 & i=$((i+1)); done; wait"] });
  assert.equal(processes.resourceLimit, "PROCESS", processes.stderr);

  const memory = await adapter({ images: [environmentImage], memoryBytes: 64 * 1024 * 1024, timeoutMs: 8_000 }).run({ image: environmentImage, command: ["/bin/sh", "-c", "awk 'BEGIN { s=\"x\"; for (i=0;i<28;i++) s=s s; print length(s) }'"] });
  assert.equal(memory.status, "RESOURCE_LIMIT", memory.stderr);
  assert.equal(memory.resourceLimit, "MEMORY");
});

void test("Docker security acceptance: evaluator-owned containers are cleaned after each outcome", { skip: !securityAcceptance }, async () => {
  const result = await adapter({ images: [environmentImage] }).run({ image: environmentImage, command: ["/bin/sh", "-c", "echo cleanup-check"] });
  assert.equal(result.status, "SUCCEEDED");
  const { spawnSync } = await import("node:child_process");
  const check = spawnSync("docker", ["ps", "-aq", "--filter", "label=io.oic.evaluator.owner=oic-evaluator-v1"], { shell: false, encoding: "utf8", windowsHide: true });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(check.stdout.trim(), "");
});

void test("Docker security acceptance: orphan reconciliation removes only stale OIC-owned containers", { skip: !securityAcceptance }, async () => {
  const { spawnSync } = await import("node:child_process");
  const staleId = "423e4567-e89b-42d3-a456-426614174000";
  const activeId = "523e4567-e89b-42d3-a456-426614174000";
  const create = (name: string, attemptId?: string, owned = true) => {
    const args = ["create", "--name", name, "--network", "none", "--read-only", "--user", "65532:65532"];
    if (owned) args.push("--label", "io.oic.evaluator.owner=oic-evaluator-v1", "--label", "io.oic.evaluator.managed=true");
    if (attemptId) args.push("--label", `io.oic.evaluator.attempt=${attemptId}`);
    args.push(environmentImage, "/bin/sh", "-c", "true");
    const result = spawnSync("docker", args, { shell: false, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
  };
  create("oic-test-orphan-stale", staleId);
  create("oic-test-orphan-active", activeId);
  create("oic-test-unrelated", undefined, false);
  try {
    const result = await adapter({ images: [environmentImage] }).reconcileOrphans((attemptId) => Promise.resolve(attemptId === activeId));
    assert.deepEqual(result, { inspected: 2, removed: 1, retained: 1 });
    const inspectStale = spawnSync("docker", ["inspect", "oic-test-orphan-stale"], { shell: false, encoding: "utf8", windowsHide: true });
    const inspectActive = spawnSync("docker", ["inspect", "oic-test-orphan-active"], { shell: false, encoding: "utf8", windowsHide: true });
    const inspectUnrelated = spawnSync("docker", ["inspect", "oic-test-unrelated"], { shell: false, encoding: "utf8", windowsHide: true });
    assert.notEqual(inspectStale.status, 0);
    assert.equal(inspectActive.status, 0);
    assert.equal(inspectUnrelated.status, 0);
  } finally {
    spawnSync("docker", ["rm", "--force", "oic-test-orphan-active", "oic-test-unrelated"], { shell: false, encoding: "utf8", windowsHide: true });
  }
});
