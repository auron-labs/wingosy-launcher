/** @typedef {"log"|"info"|"debug"|"warn"|"error"} ConsoleLevel */
/** @typedef {(...args: unknown[]) => void} ConsoleMethod */

export const isVerboseDebugEnabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_WINGOSY_DEBUG === "1";

/** @param {string} scope Debug scope. @param {string} message Debug message. @param {unknown} [details] Additional details. */
export const debugLog = (scope, message, details) => {
  if (!isVerboseDebugEnabled()) {
    return;
  }

  const prefix = `[Wingosy][debug][${scope}] ${message}`;
  if (details === undefined) {
    console.info(prefix);
  } else {
    console.info(prefix, details);
  }
};

/** @type {ConsoleLevel[]} */
const CONSOLE_LEVELS = ["log", "info", "debug", "warn", "error"];

/** @param {string} key JSON property name. @param {unknown} value Property value. @returns {unknown} Redacted or original property value. */
const redactConsoleProperty = (key, value) => {
  if (/token|password|secret|authorization/iu.test(key)) {
    return "[redacted]";
  }
  return value;
};

/** @param {unknown} value Console argument. @returns {string} Safe console representation. */
const formatConsoleArgument = (value) => {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  const stringValue = String(value);
  if (value === stringValue) {
    return stringValue;
  }

  try {
    return JSON.stringify(value, redactConsoleProperty) ?? stringValue;
  } catch {
    return String(value);
  }
};

/** @param {(command: string, args: Record<string, unknown>) => Promise<unknown>} invoke Tauri invocation function. @param {ConsoleLevel} level Console level. @param {string} message Console message. */
const forwardConsoleMessage = async (invoke, level, message) => {
  try {
    await invoke("log_frontend", { level, message });
  } catch {
    // Forwarding is best-effort when the native bridge is unavailable.
  }
};

/** @param {(command: string, args: Record<string, unknown>) => Promise<unknown>} invoke Tauri invocation function. */
export const installNativeConsoleForwarding = (invoke) => {
  for (const level of CONSOLE_LEVELS) {
    /** @type {ConsoleMethod} */
    const originalMethod = console[level];
    /** @type {ConsoleMethod} */
    const forwardingMethod = (...args) => {
      originalMethod(...args);
      const message = args.map(formatConsoleArgument).join(" ");
      void forwardConsoleMessage(invoke, level, message);
    };
    console[level] = forwardingMethod;
  }
};
