import { createHash, randomUUID } from "node:crypto";
import { realpath, stat, statfs } from "node:fs/promises";
import { win32 as path } from "node:path";
import { spawn } from "node:child_process";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

export type SandboxStatus = "SUCCEEDED" | "TARGET_FAILED" | "TIMEOUT" | "RESOURCE_LIMIT" | "SANDBOX_UNAVAILABLE" | "POLICY_UNAVAILABLE";
export type SandboxResult = {
  status: SandboxStatus;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
  resourceLimit: "MEMORY" | "PROCESS" | "OUTPUT" | null;
  durationMs: number;
  environmentDigest: string;
  dockerEngineVersion: string;
  architecture: string;
  resourcePolicyRevision: string;
  backend: "DOCKER_LINUX";
  networkPolicy: "DENY";
};

export type SandboxRequest = {
  image: string;
  command: string[];
  files?: Record<string, Buffer>;
  signal?: AbortSignal;
  runId?: string;
  caseExecutionId?: string;
  attemptId?: string;
};

export type SandboxPolicy = {
  enabled: boolean;
  images: string[];
  disposableRoot: string;
  minFreeBytes: number;
  workspaceBytes: number;
  tmpBytes: number;
  shmBytes: number;
  memoryBytes: number;
  cpuCores: number;
  pidLimit: number;
  timeoutMs: number;
  outputBytes: number;
};

export class SandboxUnavailableError extends Error {
  constructor(readonly reasonCode: "SANDBOX_UNAVAILABLE" | "POLICY_UNAVAILABLE") {
    super(reasonCode);
    this.name = "SandboxUnavailableError";
  }
}

const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;
const SAFE_ID = /^[a-f0-9-]{36}$/i;
const SAFE_LABEL_VALUE = /^(?:oic-evaluator-v1|true|[a-f0-9-]{36})$/i;
const IMAGE_DIGEST = /^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/i;
const POLICY_REVISION = "oic-docker-default-v1";

function policyRevision(policy: SandboxPolicy): string {
  const payload = [policy.disposableRoot, policy.minFreeBytes, policy.workspaceBytes, policy.tmpBytes, policy.shmBytes, policy.memoryBytes, policy.cpuCores, policy.pidLimit, policy.timeoutMs, policy.outputBytes, 1].join(":");
  return `${POLICY_REVISION}:${createHash("sha256").update(payload).digest("hex")}`;
}

function asPolicy(config: ConfigService): SandboxPolicy {
  return {
    enabled: config.get<string>("OIC_EVALUATOR_ENABLED") === "true",
    images: (config.get<string>("OIC_EVALUATOR_IMAGE_ALLOWLIST") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
    disposableRoot: config.get<string>("OIC_EVALUATOR_DISPOSABLE_ROOT") ?? "",
    minFreeBytes: config.get<number>("OIC_EVALUATOR_MIN_FREE_BYTES") ?? 1024 * 1024 * 1024,
    workspaceBytes: config.get<number>("OIC_EVALUATOR_WORKSPACE_BYTES") ?? 64 * 1024 * 1024,
    tmpBytes: config.get<number>("OIC_EVALUATOR_TMP_BYTES") ?? 16 * 1024 * 1024,
    shmBytes: config.get<number>("OIC_EVALUATOR_SHM_BYTES") ?? 16 * 1024 * 1024,
    memoryBytes: config.get<number>("OIC_EVALUATOR_MEMORY_BYTES") ?? 256 * 1024 * 1024,
    cpuCores: config.get<number>("OIC_EVALUATOR_CPU_CORES") ?? 0.5,
    pidLimit: config.get<number>("OIC_EVALUATOR_PID_LIMIT") ?? 32,
    timeoutMs: config.get<number>("OIC_EVALUATOR_TIMEOUT_MS") ?? 30_000,
    outputBytes: config.get<number>("OIC_EVALUATOR_OUTPUT_BYTES") ?? 65_536
  };
}

function octal(value: number, length: number): Buffer {
  const encoded = Buffer.from(`${value.toString(8).padStart(length - 1, "0")}\0`, "ascii");
  if (encoded.length !== length) throw new Error("TAR_FIELD_TOO_LARGE");
  return encoded;
}

/** Create a small, regular-file-only ustar stream. No caller-supplied paths or link types enter the archive. */
export function createSandboxArchive(files: Record<string, Buffer> = {}, maxBytes = 64 * 1024 * 1024): Buffer {
  const entries = Object.entries(files);
  if (entries.length > 1024) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
  let total = 0;
  let archiveBytes = 1024;
  const blocks: Buffer[] = [];
  for (const [name, content] of entries) {
    if (!SAFE_FILE_NAME.test(name) || name === "." || name === ".." || !Buffer.isBuffer(content)) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
    total += content.length;
    archiveBytes += 512 + Math.ceil(content.length / 512) * 512;
    if (total > maxBytes || archiveBytes > maxBytes + 1024 * Math.max(1, entries.length)) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, "ascii");
    octal(0o600, 8).copy(header, 100);
    octal(65532, 8).copy(header, 108);
    octal(65532, 8).copy(header, 116);
    octal(content.length, 12).copy(header, 124);
    octal(0, 12).copy(header, 136);
    header.fill(0x20, 148, 156);
    header[156] = 0x30;
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    octal(checksum, 8).copy(header, 148);
    blocks.push(header, content);
    const remainder = content.length % 512;
    if (remainder) blocks.push(Buffer.alloc(512 - remainder));
  }
  blocks.push(Buffer.alloc(1024));
  const archive = Buffer.concat(blocks);
  if (archive.length !== archiveBytes) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
  return archive;
}

export function buildDockerRunArgs(input: {
  containerName: string;
  image: string;
  command: string[];
  policy: SandboxPolicy;
  labels: Record<string, string>;
}): string[] {
  const { policy, image, command, containerName } = input;
  if (!IMAGE_DIGEST.test(image) || !policy.images.includes(image)) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
  if (!/^oic-eval-[a-f0-9-]{36}$/i.test(containerName) || !command.length || command.length > 64 || command.some((part) => typeof part !== "string" || part.includes("\0")) || command.reduce((total, part) => total + part.length, 0) > 32_000) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
  if (Object.values(input.labels).some((value) => !SAFE_LABEL_VALUE.test(value))) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
  const labels = Object.entries(input.labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
  return [
    "run", "--pull=never", "--name", containerName,
    ...labels,
    "--network", "none", "--ipc", "private", "--read-only", "--init",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
    "--pids-limit", String(policy.pidLimit),
    "--memory", String(policy.memoryBytes), "--memory-swap", String(policy.memoryBytes),
    "--cpus", String(policy.cpuCores), "--shm-size", `${policy.shmBytes}b`, "--user", "65532:65532",
    "--workdir", "/workspace",
    "--tmpfs", `/workspace:rw,nosuid,nodev,size=${policy.workspaceBytes},uid=65532,gid=65532`,
    "--tmpfs", `/tmp:rw,nosuid,nodev,size=${policy.tmpBytes},uid=65532,gid=65532`,
    "--ulimit", "core=0", "--interactive",
    image,
    "/bin/sh", "-c", "tar -xf - -C /workspace && cd /workspace && exec \"$@\"", "oic-run", ...command
  ];
}

type ProcessResult = { code: number | null; signal: string | null; stdout: Buffer; stderr: Buffer; overflow: boolean; error?: Error };

function runProcess(executable: string, args: string[], timeoutMs: number, outputBytes: number, input?: Buffer, onOutputLimit?: () => void): Promise<ProcessResult> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: process.env });
    } catch (error) {
      resolve({ code: null, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), overflow: false, error: error as Error });
      return;
    }
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let received = 0;
    let overflow = false;
    let overflowReported = false;
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => { if (!settled) child.kill("SIGKILL"); }, 500).unref();
    }, timeoutMs);
    const finish = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const capture = (target: Buffer[]) => (chunk: Buffer) => {
      const remaining = Math.max(0, outputBytes - received);
      if (remaining) target.push(chunk.subarray(0, remaining));
      received += chunk.length;
      if (received > outputBytes) {
        overflow = true;
        if (!overflowReported) {
          overflowReported = true;
          if (onOutputLimit) onOutputLimit();
          else child.kill("SIGTERM");
        }
      }
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    child.on("error", (error) => finish({ code: null, signal: null, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), overflow, error }));
    child.on("close", (code, signal) => finish({ code, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), overflow }));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
  });
}

@Injectable()
export class EvaluationSandboxAdapter {
  private readonly policy: SandboxPolicy;
  private active = false;

  constructor(config: ConfigService) {
    this.policy = asPolicy(config);
  }

  async preflight(image: string): Promise<{ backend: "DOCKER_LINUX"; image: string; environmentDigest: string; dockerEngineVersion: string; architecture: string; resourcePolicyRevision: string; networkPolicy: "DENY" }> {
    if (!this.policy.enabled) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    if (!IMAGE_DIGEST.test(image) || !this.policy.images.includes(image)) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
    const expectedRoot = "R:\\OIC-Infrastructure\\Evaluator";
    if (!this.policy.disposableRoot || path.resolve(this.policy.disposableRoot).toLowerCase() !== expectedRoot.toLowerCase()) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
    try {
      const [canonicalRoot, rootInfo, disk] = await Promise.all([realpath(expectedRoot), stat(expectedRoot), statfs(expectedRoot)]);
      if (!rootInfo.isDirectory() || path.resolve(canonicalRoot).toLowerCase() !== path.resolve(expectedRoot).toLowerCase() || disk.bavail * disk.bsize < this.policy.minFreeBytes) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    } catch (error) {
      if (error instanceof SandboxUnavailableError) throw error;
      throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    }
    const engine = await runProcess("docker", ["info", "--format", "{{.OSType}}|{{.Architecture}}|{{.ServerVersion}}"], 5_000, 1024);
    if (engine.error || engine.code !== 0) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    const [osType, engineArchitectureRaw, dockerEngineVersion] = engine.stdout.toString("utf8").trim().split("|");
    const normalizeArchitecture = (value: string | undefined) => ({ x86_64: "amd64", aarch64: "arm64" }[value ?? ""] ?? value);
    const architecture = normalizeArchitecture(engineArchitectureRaw);
    if (osType !== "linux" || !architecture || !dockerEngineVersion) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    const inspected = await runProcess("docker", ["image", "inspect", image, "--format", "{{json .RepoDigests}}|{{.Architecture}}"], 5_000, 4096);
    if (inspected.error || inspected.code !== 0) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    const [digestJson, imageArchitectureRaw] = inspected.stdout.toString("utf8").trim().split("|");
    let digests: unknown;
    try { digests = JSON.parse(digestJson ?? ""); } catch { throw new SandboxUnavailableError("POLICY_UNAVAILABLE"); }
    if (!Array.isArray(digests) || !digests.includes(image) || normalizeArchitecture(imageArchitectureRaw) !== architecture) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
    const identity = `${image}:${dockerEngineVersion}:${architecture}`;
    const environmentDigest = createHash("sha256").update(identity).digest("hex");
    return { backend: "DOCKER_LINUX", image, environmentDigest, dockerEngineVersion, architecture, resourcePolicyRevision: policyRevision(this.policy), networkPolicy: "DENY" };
  }

  /** Reconcile only containers carrying this adapter's ownership labels. The caller supplies lease truth from durable work state. */
  async reconcileOrphans(isAttemptLeaseValid: (attemptId: string) => Promise<boolean>): Promise<{ inspected: number; removed: number; retained: number }> {
    if (this.active) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    this.active = true;
    try {
      const listed = await runProcess("docker", ["ps", "--all", "--quiet", "--filter", "label=io.oic.evaluator.owner=oic-evaluator-v1"], 5_000, 16_384);
      if (listed.error || listed.code !== 0) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
      const ids = listed.stdout.toString("utf8").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
      if (ids.length > 100) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
      let removed = 0;
      let retained = 0;
      for (const id of ids) {
        if (!/^[a-f0-9]{12,64}$/i.test(id)) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
        const inspected = await runProcess("docker", ["inspect", "--format", "{{json .Config.Labels}}", id], 2_000, 4096);
        if (inspected.error || inspected.code !== 0) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
        let labels: unknown;
        try { labels = JSON.parse(inspected.stdout.toString("utf8")); } catch { throw new SandboxUnavailableError("POLICY_UNAVAILABLE"); }
        if (!labels || typeof labels !== "object" || (labels as Record<string, unknown>)["io.oic.evaluator.owner"] !== "oic-evaluator-v1" || (labels as Record<string, unknown>)["io.oic.evaluator.managed"] !== "true") continue;
        const attemptId = (labels as Record<string, unknown>)["io.oic.evaluator.attempt"];
        if (typeof attemptId !== "string" || !SAFE_ID.test(attemptId)) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
        if (await isAttemptLeaseValid(attemptId)) {
          retained += 1;
          continue;
        }
        const deletion = await runProcess("docker", ["rm", "--force", id], 5_000, 1024);
        if (deletion.error || deletion.code !== 0) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
        removed += 1;
      }
      return { inspected: ids.length, removed, retained };
    } finally {
      this.active = false;
    }
  }

  async run(request: SandboxRequest): Promise<SandboxResult> {
    if (!this.policy.enabled) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    if (this.active) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    const runId = request.runId ?? randomUUID();
    const caseExecutionId = request.caseExecutionId ?? randomUUID();
    const attemptId = request.attemptId ?? randomUUID();
    if (![runId, caseExecutionId, attemptId].every((value) => SAFE_ID.test(value))) throw new SandboxUnavailableError("POLICY_UNAVAILABLE");
    const archive = createSandboxArchive(request.files, this.policy.workspaceBytes);
    const containerName = `oic-eval-${randomUUID()}`;
    const args = buildDockerRunArgs({
      containerName,
      image: request.image,
      command: request.command,
      policy: this.policy,
      labels: { "io.oic.evaluator.owner": "oic-evaluator-v1", "io.oic.evaluator.managed": "true", "io.oic.evaluator.run": runId, "io.oic.evaluator.case": caseExecutionId, "io.oic.evaluator.attempt": attemptId }
    });
    this.active = true;
    let runtimeIdentity: Awaited<ReturnType<EvaluationSandboxAdapter["preflight"]>>;
    try {
      runtimeIdentity = await this.preflight(request.image);
    } catch (error) {
      this.active = false;
      throw error;
    }
    if (request.signal?.aborted) {
      this.active = false;
      throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    }
    const started = performance.now();
    let execution: ProcessResult;
    let timeoutTriggered = false;
    let abortTriggered = false;
    let outputLimitTriggered = false;
    let infrastructureLost = false;
    let sandboxResult: SandboxResult | undefined;
    let cleanupFailed = false;
    let signalOutputLimit!: () => void;
    const outputLimit = new Promise<"OUTPUT_LIMIT">((resolve) => { signalOutputLimit = () => resolve("OUTPUT_LIMIT"); });
    let signalAbort!: () => void;
    const aborted = new Promise<"ABORTED">((resolve) => { signalAbort = () => { abortTriggered = true; resolve("ABORTED"); }; });
    request.signal?.addEventListener("abort", signalAbort, { once: true });
    const runner = runProcess("docker", args, this.policy.timeoutMs + 10_000, this.policy.outputBytes, archive, signalOutputLimit).then((result) => {
      execution = result;
      return result;
    });
    let timeoutHandle: NodeJS.Timeout;
    const timeout = new Promise<"TIMEOUT">((resolve) => { timeoutHandle = setTimeout(() => { timeoutTriggered = true; resolve("TIMEOUT"); }, this.policy.timeoutMs); });
    try {
      const winner = await Promise.race([runner, timeout, outputLimit, aborted]);
      clearTimeout(timeoutHandle!);
      if (winner === "TIMEOUT" || winner === "OUTPUT_LIMIT" || winner === "ABORTED") {
        outputLimitTriggered = winner === "OUTPUT_LIMIT";
        const killed = await runProcess("docker", ["kill", "--signal", "KILL", containerName], 2_000, 1024);
        if (killed.error || killed.code !== 0) {
          const engine = await runProcess("docker", ["info", "--format", "{{.OSType}}"], 2_000, 1024);
          infrastructureLost = Boolean(engine.error || engine.code !== 0 || engine.stdout.toString("utf8").trim() !== "linux");
        }
        execution = await runner;
        if (!execution) execution = { code: null, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), overflow: false };
      } else {
        execution = winner;
      }
      const state = await runProcess("docker", ["inspect", "--format", "{{.State.OOMKilled}}|{{.State.ExitCode}}", containerName], 2_000, 1024);
      if (state.error || state.code !== 0) infrastructureLost = true;
      const memoryLimited = state.code === 0 && state.stdout.toString("utf8").trim().startsWith("true|");
      const processLimited = /(?:can't|cannot) fork|resource temporarily unavailable/i.test(execution.stderr.toString("utf8"));
      const resourceLimit = outputLimitTriggered || execution.overflow ? "OUTPUT" : memoryLimited ? "MEMORY" : processLimited ? "PROCESS" : null;
      const status: SandboxStatus = abortTriggered || infrastructureLost || execution.error || execution.code === null || execution.code === 125 ? "SANDBOX_UNAVAILABLE" : timeoutTriggered ? "TIMEOUT" : resourceLimit ? "RESOURCE_LIMIT" : execution.code === 0 ? "SUCCEEDED" : "TARGET_FAILED";
      const safe = (buffer: Buffer) => buffer.toString("utf8").split("").map((character) => {
        const code = character.charCodeAt(0);
        return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127) ? character : "\uFFFD";
      }).join("");
      sandboxResult = {
        status,
        exitCode: execution.code,
        signal: execution.signal,
        stdout: status === "SANDBOX_UNAVAILABLE" ? "" : safe(execution.stdout),
        stderr: status === "SANDBOX_UNAVAILABLE" ? "" : safe(execution.stderr),
        outputTruncated: outputLimitTriggered || execution.overflow,
        resourceLimit,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        environmentDigest: runtimeIdentity.environmentDigest,
        dockerEngineVersion: runtimeIdentity.dockerEngineVersion,
        architecture: runtimeIdentity.architecture,
        resourcePolicyRevision: policyRevision(this.policy),
        backend: "DOCKER_LINUX",
        networkPolicy: "DENY"
      };
    } finally {
      request.signal?.removeEventListener("abort", signalAbort);
      clearTimeout(timeoutHandle!);
      const cleanup = await runProcess("docker", ["rm", "--force", containerName], 3_000, 1024);
      this.active = false;
      cleanupFailed = Boolean(cleanup.error);
      if (cleanup.code !== 0 && !cleanupFailed) {
        const engine = await runProcess("docker", ["info", "--format", "{{.OSType}}"], 2_000, 1024);
        if (engine.error || engine.code !== 0 || engine.stdout.toString("utf8").trim() !== "linux") cleanupFailed = true;
        else {
          const remaining = await runProcess("docker", ["inspect", "--format", "{{.Id}}", containerName], 2_000, 1024);
          cleanupFailed = Boolean(remaining.error || remaining.code === 0);
        }
      }
    }
    if (cleanupFailed || !sandboxResult) throw new SandboxUnavailableError("SANDBOX_UNAVAILABLE");
    return sandboxResult;
  }
}
