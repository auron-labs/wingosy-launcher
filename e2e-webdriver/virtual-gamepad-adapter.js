import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const ADAPTER_BINARY_NAME =
  process.platform === "win32"
    ? "wingosy-virtual-gamepad-adapter.exe"
    : "wingosy-virtual-gamepad-adapter";
const DEFAULT_ADAPTER_PATH = path.join(
  REPO_ROOT,
  "tools",
  "virtual-gamepad-adapter",
  "target",
  "debug",
  ADAPTER_BINARY_NAME
);
const RESPONSE_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 2_000;

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(exited);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once("close", () => finish(true));
  });
}

export function defaultVirtualGamepadAdapterPath() {
  return (
    process.env.WINGOSY_VIRTUAL_GAMEPAD_ADAPTER_PATH || DEFAULT_ADAPTER_PATH
  );
}

export function createVirtualGamepadAdapter({
  binaryPath = defaultVirtualGamepadAdapterPath(),
  responseTimeoutMs = RESPONSE_TIMEOUT_MS,
} = {}) {
  let child = null;
  let started = false;
  let stdoutBuffer = "";
  let pendingResponse = null;
  let processError = null;
  let requestTail = Promise.resolve();
  let shutdownPromise = null;

  function settlePending(error, response) {
    if (!pendingResponse) return false;
    const pending = pendingResponse;
    pendingResponse = null;
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve(response);
    return true;
  }

  function failProcess(error) {
    if (!processError) processError = error;
    settlePending(processError);
  }

  function handleStdout(data) {
    stdoutBuffer += data.toString();
    let newlineIndex = stdoutBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex).replace(/\r$/, "");
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      if (!line.trim()) {
        failProcess(new Error("adapter returned a blank response line"));
      } else {
        try {
          const response = JSON.parse(line);
          if (!settlePending(null, response))
            failProcess(new Error("adapter returned an unexpected response"));
        } catch (error) {
          failProcess(
            new Error(`adapter returned invalid JSON: ${describeError(error)}`)
          );
        }
      }
      newlineIndex = stdoutBuffer.indexOf("\n");
    }
  }

  function handleProcessError(error) {
    failProcess(new Error(`adapter process error: ${describeError(error)}`));
  }

  function handleProcessClose(code, signal) {
    const reason =
      code !== 0 && code !== null
        ? `adapter exited with code ${code}${signal ? ` (${signal})` : ""}`
        : signal
          ? `adapter terminated by ${signal}`
          : "adapter exited before responding";
    failProcess(new Error(reason));
  }

  function start() {
    if (started)
      throw new Error("virtual gamepad adapter can only be started once");
    started = true;

    if (!existsSync(binaryPath)) {
      throw new Error(
        `virtual gamepad adapter binary was not found at ${binaryPath}; build the debug adapter first`
      );
    }

    try {
      child = spawn(binaryPath, [], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      throw new Error(
        `could not start virtual gamepad adapter: ${describeError(error)}`
      );
    }

    child.stdout.on("data", handleStdout);
    child.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) console.error(`[virtual-gamepad-adapter] ${message}`);
    });
    child.once("error", handleProcessError);
    child.once("close", handleProcessClose);
  }

  function send(command) {
    const operation = requestTail.then(() => sendSequential(command));
    requestTail = operation.catch(() => undefined);
    return operation;
  }

  function sendSequential(command) {
    if (!child)
      return Promise.reject(
        new Error("virtual gamepad adapter is not running")
      );
    if (processError) return Promise.reject(processError);

    let line;
    try {
      line = `${JSON.stringify(command)}\n`;
    } catch (error) {
      return Promise.reject(
        new Error(
          `could not serialize adapter command: ${describeError(error)}`
        )
      );
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        settlePending(
          new Error(`adapter response timed out after ${responseTimeoutMs}ms`)
        );
      }, responseTimeoutMs);
      pendingResponse = { reject, resolve, timer };
      try {
        child.stdin.write(line, (error) => {
          if (error)
            settlePending(
              new Error(
                `could not write adapter command: ${describeError(error)}`
              )
            );
        });
      } catch (error) {
        settlePending(
          new Error(`could not write adapter command: ${describeError(error)}`)
        );
      }
    });
  }

  async function shutdown() {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      if (!child) return;
      if (child.exitCode !== null || child.signalCode !== null) return;

      try {
        child.stdin.end();
      } catch (error) {
        throw new Error(
          `could not close adapter input: ${describeError(error)}`
        );
      }

      if (await waitForExit(child, SHUTDOWN_TIMEOUT_MS)) return;

      child.kill();
      if (!(await waitForExit(child, SHUTDOWN_TIMEOUT_MS))) {
        throw new Error(
          `adapter did not exit within ${SHUTDOWN_TIMEOUT_MS * 2}ms`
        );
      }
    })();
    return shutdownPromise;
  }

  return { send, shutdown, start };
}
