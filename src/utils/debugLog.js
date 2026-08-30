export function isVerboseDebugEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_WINGOSY_DEBUG === "1";
}

export function debugLog(scope, message, details) {
  if (!isVerboseDebugEnabled()) return;

  const prefix = `[Wingosy][debug][${scope}] ${message}`;
  if (details === undefined) {
    console.info(prefix);
  } else {
    console.info(prefix, details);
  }
}

const CONSOLE_LEVELS = ["log", "info", "debug", "warn", "error"];

function formatConsoleArgument(value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  try {
    return JSON.stringify(value, (key, nestedValue) => {
      if (/token|password|secret|authorization/i.test(key)) return "[redacted]";
      return nestedValue;
    });
  } catch {
    return String(value);
  }
}

export function installNativeConsoleForwarding(invoke) {
  for (const level of CONSOLE_LEVELS) {
    const original = console[level];
    if (typeof original !== "function") continue;

    console[level] = (...args) => {
      original.apply(console, args);
      const message = args.map(formatConsoleArgument).join(" ");
      void invoke("log_frontend", { level, message }).catch(() => {});
    };
  }
}
