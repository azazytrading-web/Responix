import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

function localSetting(key, file, fallback) {
  if (process.env[key]) return process.env[key];
  try {
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.trimStart().startsWith(`${key}=`));
    if (!line) return fallback;
    return line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(
        /^(?:"(.*)"|'(.*)')$/,
        (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted
      );
  } catch {
    return fallback;
  }
}

function localPort(key, file, fallback) {
  const value = localSetting(key, file, fallback);
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }
  return String(port);
}

const apiPort = localPort("API_PORT", ".env", "4000");
const oicPort = localPort("OIC_PORT", ".env.oic.local", "4100");
const portalPort = localPort("PORTAL_PORT", ".env", "3000");
const responixPort = localPort("RESPONIX_PORT", ".env", "3001");
const startupTimeoutMs = Number(process.env.PLATFORM_STARTUP_TIMEOUT_MS ?? 120_000);
if (!Number.isInteger(startupTimeoutMs) || startupTimeoutMs < 5000 || startupTimeoutMs > 600_000) {
  throw new Error("PLATFORM_STARTUP_TIMEOUT_MS must be an integer between 5000 and 600000");
}
const root = process.cwd();
const services = [
  {
    label: "OIC API",
    cwd: resolve(root, "apps/oic-api"),
    args: [resolve(root, "apps/oic-api/dist/main.js")],
    url: `http://127.0.0.1:${oicPort}`,
    readyUrl: `http://127.0.0.1:${oicPort}/api/v1/health/ready`,
    env: { OIC_HOST: "127.0.0.1", OIC_PORT: oicPort }
  },
  {
    label: "Responix API",
    cwd: resolve(root, "apps/api"),
    args: [resolve(root, "apps/api/dist/main.js")],
    url: `http://127.0.0.1:${apiPort}`,
    readyUrl: `http://127.0.0.1:${apiPort}/api/v1/health`,
    env: {
      API_HOST: "127.0.0.1",
      API_PORT: apiPort,
      DASHBOARD_URL: `http://localhost:${responixPort}`,
      OIC_BASE_URL: `http://127.0.0.1:${oicPort}`
    }
  },
  {
    label: "Platform Portal",
    cwd: resolve(root, "apps/platform-portal"),
    args: [
      resolve(root, "apps/platform-portal/node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      portalPort
    ],
    url: `http://127.0.0.1:${portalPort}`,
    readyUrl: `http://127.0.0.1:${portalPort}/`,
    env: {
      PORT: portalPort,
      OIC_API_INTERNAL_URL: `http://127.0.0.1:${oicPort}`,
      NEXT_PUBLIC_RESPONIX_URL: `http://127.0.0.1:${responixPort}`
    }
  },
  {
    label: "Responix",
    cwd: resolve(root, "apps/dashboard"),
    args: [
      resolve(root, "apps/dashboard/node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      responixPort
    ],
    url: `http://127.0.0.1:${responixPort}`,
    readyUrl: `http://127.0.0.1:${responixPort}/`,
    env: { PORT: responixPort, NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}` }
  }
];
const children = [];
let stopping = false;

let stoppingPromise;
function stopChild(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveStop) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      child.removeListener("exit", finish);
      resolveStop();
    };
    child.once("exit", finish);
    if (process.platform === "win32" && child.pid) {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      killer.once("error", () => child.kill(signal));
      killer.once("exit", (code) => {
        if (code !== 0 && child.exitCode === null && child.signalCode === null) child.kill(signal);
      });
    } else {
      child.kill(signal);
    }
    const timeout = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill(signal);
      finish();
    }, 10_000);
    timeout.unref();
    child.once("exit", () => clearTimeout(timeout));
  });
}

function stop(signal = "SIGTERM") {
  if (stoppingPromise) return stoppingPromise;
  stopping = true;
  const pending = children.filter((child) => child.exitCode === null && child.signalCode === null);
  stoppingPromise = Promise.all(pending.map((child) => stopChild(child, signal)));
  return stoppingPromise;
}

process.on("SIGINT", () => {
  void stop("SIGINT");
});
process.on("SIGTERM", () => {
  void stop("SIGTERM");
});
process.on("SIGBREAK", () => {
  void stop("SIGTERM");
});

function start({ label, cwd, url, env: serviceEnv, args = [] }) {
  let child;
  try {
    child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ...serviceEnv },
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true
    });
  } catch (error) {
    throw new Error(`[${label}] failed to start: ${error.message}`);
  }
  children.push(child);
  let exitResolve;
  const exited = new Promise((resolve) => {
    exitResolve = resolve;
  });
  for (const [stream, output] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr]
  ]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      for (const line of chunk.split(/(?<=\n)/)) output.write(`[${label}] ${line}`);
    });
  }
  child.once("error", (error) => {
    process.stderr.write(`[${label}] failed to start: ${error.message}\n`);
    process.exitCode = 1;
    exitResolve({ code: 1 });
    stop("SIGTERM");
  });
  child.once("exit", (code, signal) => {
    process.stdout.write(`[${label}] stopped (${signal ?? code ?? "unknown"}) ${url}\n`);
    exitResolve({ code, signal });
    if (!stopping) {
      process.exitCode = code || 1;
      stop("SIGTERM");
    }
  });
  return {
    exited,
    hasExited() {
      return child.exitCode !== null || child.signalCode !== null;
    }
  };
}

async function waitUntilReady(service, processState, timeoutMs = startupTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!stopping && Date.now() < deadline) {
    if (processState.hasExited()) {
      throw new Error(`[${service.label}] exited before readiness`);
    }
    try {
      const response = await fetch(service.readyUrl, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        process.stdout.write(`[${service.label}] ready at ${service.url}\n`);
        return;
      }
    } catch {
      // The service is still starting or its local dependency is unavailable.
    }
    await Promise.race([new Promise((resolve) => setTimeout(resolve, 1000)), processState.exited]);
  }
  if (!stopping) throw new Error(`[${service.label}] did not become ready within ${timeoutMs}ms`);
}

async function main() {
  process.stdout.write(
    "Oi Mega Platform starting. Required PostgreSQL and Redis services must already be running.\n"
  );
  process.env.NEXT_PUBLIC_API_URL = `http://127.0.0.1:${apiPort}`;
  process.env.NEXT_PUBLIC_RESPONIX_URL = `http://localhost:${responixPort}`;
  const builds = [
    {
      label: "@oic/api",
      cwd: resolve(root, "apps/oic-api"),
      args: ["node_modules/@nestjs/cli/bin/nest.js", "build"]
    },
    {
      label: "@responix/api",
      cwd: resolve(root, "apps/api"),
      args: ["node_modules/@nestjs/cli/bin/nest.js", "build"]
    },
    {
      label: "@oi/platform-portal",
      cwd: resolve(root, "apps/platform-portal"),
      args: ["node_modules/next/dist/bin/next", "build"],
      nodeOptions: "--max-old-space-size=4096"
    },
    {
      label: "@responix/dashboard",
      cwd: resolve(root, "apps/dashboard"),
      args: ["node_modules/next/dist/bin/next", "build"],
      nodeOptions: "--max-old-space-size=8192"
    }
  ];
  for (const build of builds) {
    await runBuild(build);
  }
  process.stdout.write("Starting local platform processes.\n");
  for (const service of services) {
    const processState = start(service);
    await waitUntilReady(service, processState);
    if (stopping) break;
  }
  if (!stopping) {
    process.stdout.write("Oi Mega Platform started\n");
    process.stdout.write(`Platform Portal: http://localhost:${portalPort}\n`);
    process.stdout.write(`Responix: http://localhost:${responixPort}\n`);
    process.stdout.write(`OIC API: http://127.0.0.1:${oicPort}\n`);
    process.stdout.write("OIC Console: NOT INSTALLED (Portal placeholder)\n");
  }
  await Promise.all(
    children.map((child) =>
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once("exit", resolve))
    )
  );
}

function runBuild({ label, cwd, args, nodeOptions }) {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: {
        ...process.env,
        NODE_OPTIONS: nodeOptions ?? process.env.NODE_OPTIONS ?? "--max-old-space-size=4096"
      },
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true
    });
    children.push(child);
    for (const [stream, output] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr]
    ]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        for (const line of chunk.split(/(?<=\n)/)) output.write(`[Build ${label}] ${line}`);
      });
    }
    child.once("error", (error) =>
      rejectBuild(new Error(`[Build ${label}] failed to start: ${error.message}`))
    );
    child.once("exit", (code) =>
      code === 0
        ? resolveBuild()
        : rejectBuild(new Error(`[Build ${label}] exited with code ${code ?? "unknown"}`))
    );
  });
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
  void stop("SIGTERM");
});
