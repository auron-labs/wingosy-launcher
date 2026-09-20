// @ts-nocheck
import { mkdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 9223;
const APP_READY_TIMEOUT = 45_000;
const SCREEN_TIMEOUT = 20_000;
const EXECUTION_GRACE_PERIOD = 5_000;
const SETTING_ROUTES = [
  ["general", `selectorVisible('[data-testid="immersive-mode-row"]')`],
  ["appearance", `selectorVisible('[data-testid="theme-preview-light"]')`],
  ["sound", `textVisible('h6', 'Sound')`],
  ["romm", `selectorVisible('[data-testid="romm-settings-card"]')`],
  ["library", `textVisible('h6', 'Storage')`],
  ["bios", `selectorVisible('[data-testid="bios-count-explanation"]')`],
  ["emulators", `textVisible('h6', 'Emulators')`],
  ["integrations", `textVisible('h6', 'Integrations')`],
  ["updates", `textVisible('h6', 'Updates')`],
];

const DOM_HELPERS = `
const isVisible = (element) => { if (!element) return false; const style = getComputedStyle(element); return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && element.getClientRects().length > 0; };
const normalise = (value) => (value || '').replace(/\\s+/gu, ' ').trim();
const text = (element) => normalise(element?.innerText || element?.textContent);
const selectorVisible = (selector) => Array.from(document.querySelectorAll(selector)).some(isVisible);
const textVisible = (selector, wanted) => Array.from(document.querySelectorAll(selector)).some((element) => isVisible(element) && text(element).includes(wanted));
const interactiveElements = () => Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"], [role="menuitem"], [tabindex]')).filter(isVisible);
const interactive = (wanted) => interactiveElements().find((element) => { const content = text(element); const accessibleName = normalise(element.getAttribute('aria-label')); return accessibleName === wanted || content === wanted || content.endsWith(' ' + wanted); });
const dialogByTitle = (wanted) => Array.from(document.querySelectorAll('[role="dialog"]')).find((dialog) => { if (!isVisible(dialog)) return false; const labelId = dialog.getAttribute('aria-labelledby'); return labelId ? text(document.getElementById(labelId)) === wanted : Array.from(dialog.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).some((heading) => text(heading) === wanted); });
const screenState = () => { const desktopDetails = textVisible('button', 'Back to Library'); const desktopLibrary = selectorVisible('[data-testid="library-result-count"]'); const desktopSync = selectorVisible('[data-testid="romm-sync-monitor"]') && Boolean(interactive('RomM Sync')); const settings = selectorVisible('[data-testid="settings-nav-general"]'); const desktop = Boolean(interactive('All Games') || desktopLibrary || desktopDetails || desktopSync); const immersiveSync = selectorVisible('[data-testid="romm-sync-monitor"]') && !interactive('All Games'); return { desktop, desktopDetails, desktopLibrary, desktopSync, immersiveDetails: selectorVisible('[data-testid="immersive-game-details"]'), immersiveDownloads: textVisible('h1', 'Downloads') && !interactive('All Games'), immersiveLibrary: selectorVisible('[data-testid="immersive-library"]'), immersiveSettings: settings && !desktop, immersiveSync, setup: Boolean(interactive('Get Started')), settings }; };
`;

let cliCommandPromise;

function printHelp() {
  console.log(`Usage: bun scripts/capture-screenshots.mjs [options]

Capture unique reachable Wingosy app views from an already-running Tauri debug app.
First-run setup screens are captured only when the app is currently in setup; configured apps skip them.

Options:
  --host <value>  Tauri debug host (default: ${DEFAULT_HOST})
  --port <value>  Tauri debug port (default: ${DEFAULT_PORT})
  -h, --help      Show this help`);
}

function parseOptions(argv) {
  const options = { host: DEFAULT_HOST, port: DEFAULT_PORT };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "-h" || argument === "--help") return { help: true };
    const match = argument.match(/^--(host|port)(?:=(.*))?$/u);
    if (!match) throw new Error(`Unknown option: ${argument}`);
    const value = match[2] ?? argv[++index];
    if (!value || value.startsWith("-"))
      throw new Error(`${argument} requires a value.`);
    if (match[1] === "host") options.host = value;
    else options.port = Number(value);
  }
  if (
    !Number.isInteger(options.port) ||
    options.port < 1 ||
    options.port > 65_535
  ) {
    throw new Error("--port must be an integer between 1 and 65535.");
  }
  return options;
}

async function resolveCliCommand() {
  const packageEntry = path.resolve(
    import.meta.dirname,
    "../node_modules/@hypothesi/tauri-mcp-cli/dist/index.js"
  );
  if (await Bun.file(packageEntry).exists()) {
    return [process.execPath, packageEntry];
  }
  if (process.platform === "win32") {
    throw new Error(
      "The local @hypothesi/tauri-mcp-cli package is missing; run bun install."
    );
  }
  return ["tauri-mcp"];
}

async function runMcp(argumentsList) {
  cliCommandPromise ??= resolveCliCommand();
  const command = await cliCommandPromise;
  let processHandle;
  try {
    processHandle = Bun.spawn([...command, ...argumentsList, "--json"], {
      stderr: "pipe",
      stdout: "pipe",
    });
  } catch (error) {
    throw new Error(
      `Unable to start @hypothesi/tauri-mcp-cli: ${error.message ?? error}`
    );
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  if (exitCode !== 0)
    throw new Error(
      `tauri-mcp exited with code ${exitCode}: ${(stderr || stdout).trim() || "no output"}`
    );
  const payload = parseJson(stdout);
  const errorText = payloadTexts(payload).find((text) =>
    /^(?:Error:|Session start failed\b)/u.test(text.trim())
  );
  if (errorText) throw new Error(errorText.trim());
  return payload;
}

function parseJson(stdout) {
  const value = stdout.trim();
  for (const candidate of [
    value,
    value.slice(value.indexOf("{"), value.lastIndexOf("}") + 1),
  ]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the bounded JSON candidate when the CLI emitted an incidental line.
    }
  }
  throw new Error(
    `tauri-mcp returned invalid JSON: ${value.slice(0, 500) || "no output"}`
  );
}

function payloadTexts(payload) {
  const texts = typeof payload?.text === "string" ? [payload.text] : [];
  for (const content of payload?.content ?? []) {
    if (content?.type === "text" && typeof content.text === "string")
      texts.push(content.text);
  }
  return texts;
}

function executionValue(payload) {
  const value =
    payloadTexts(payload)[0]
      ?.replace(/\s*\n\n\[Executed in window: [^\]]+\]\s*$/u, "")
      .trim() ?? "";
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function executeScript(body, timeout = SCREEN_TIMEOUT) {
  const payload = await runMcp([
    "webview-execute-js",
    "--call-timeout",
    String(timeout + 5_000),
    "--script",
    `return await (async () => { ${DOM_HELPERS}${body} })();`,
    "--timeout",
    String(timeout),
  ]);
  return executionValue(payload);
}

async function waitFor(condition, description, timeout = SCREEN_TIMEOUT) {
  const result = await executeScript(
    `const deadline = Date.now() + ${timeout}; while (Date.now() < deadline) { if (${condition}) return true; await new Promise((resolve) => setTimeout(resolve, 100)); } return false;`,
    timeout + EXECUTION_GRACE_PERIOD
  );
  if (result !== true) throw new Error(`Timed out waiting for ${description}.`);
}

async function waitForSelector(
  selector,
  description,
  timeout = SCREEN_TIMEOUT
) {
  try {
    await runMcp([
      "webview-wait-for",
      "--call-timeout",
      String(timeout + EXECUTION_GRACE_PERIOD),
      "--type",
      "selector",
      "--value",
      selector,
      "--strategy",
      "css",
      "--timeout",
      String(timeout),
    ]);
  } catch (error) {
    throw new Error(
      `Could not reach ${description}: ${error.message ?? error}`
    );
  }
}

async function click(target, description) {
  const expression = target.selector
    ? `Array.from(document.querySelectorAll(${JSON.stringify(target.selector)})).find(isVisible)`
    : `interactive(${JSON.stringify(target.text)})`;
  const result = await executeScript(
    `const deadline = Date.now() + ${SCREEN_TIMEOUT}; while (Date.now() < deadline) { const element = ${expression}; if (element && !element.disabled) { element.click(); return true; } await new Promise((resolve) => setTimeout(resolve, 100)); } return false;`,
    SCREEN_TIMEOUT + EXECUTION_GRACE_PERIOD
  );
  if (result !== true) throw new Error(`Could not click ${description}.`);
}

async function clickAny(texts) {
  const result = await executeScript(
    `const wanted = ${JSON.stringify(texts)}; const element = interactiveElements().find((candidate) => wanted.includes(text(candidate))); if (!element || element.disabled) return false; element.click(); return true;`
  );
  if (result !== true)
    throw new Error(
      `Could not click any of ${texts.map((text) => JSON.stringify(text)).join(", ")}.`
    );
}

const clickText = (text) =>
  click({ text }, `visible text ${JSON.stringify(text)}`);
const clickTestId = (id, description = `data-testid ${id}`) =>
  click({ selector: `[data-testid="${id}"]` }, description);

async function interactClickTestId(id, description = `data-testid ${id}`) {
  const selector = `[data-testid="${id}"]`;
  await waitFor(
    `(() => { const element = document.querySelector(${JSON.stringify(selector)}); return Boolean(element && !element.disabled); })()`,
    `clickable ${description}`
  );
  await runMcp([
    "webview-interact",
    "--action",
    "click",
    "--selector",
    selector,
    "--strategy",
    "css",
  ]);
  await Bun.sleep(1_000);
}

async function getState() {
  return executeScript("return screenState();");
}

async function waitForApp() {
  await waitFor(
    "Object.values(screenState()).some(Boolean)",
    "a recognizable Wingosy screen",
    APP_READY_TIMEOUT
  );
  return getState();
}

async function requireConnectedApp() {
  const status = executionValue(await runMcp(["driver-session", "status"]));
  if (status?.connected !== true) {
    throw new Error("No connected Tauri app was found on the debug session.");
  }
}

async function readConfig() {
  const config = await executeScript(
    "return await window.__TAURI_INTERNALS__.invoke('get_config');"
  );
  if (!config || typeof config !== "object")
    throw new Error("The running app returned no configuration.");
  return config;
}

async function restoreDisplay(display) {
  const value = JSON.stringify(display ?? null);
  await executeScript(
    `const originalDisplay = ${value}; const config = await window.__TAURI_INTERNALS__.invoke('get_config'); if (originalDisplay === null) delete config.display; else config.display = originalDisplay; await window.__TAURI_INTERNALS__.invoke('save_config', { config }); return true;`
  );
}

function timestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

async function capture(routeId, directory, routes, ready) {
  if (routes.has(routeId)) return;
  if (ready) await ready();
  const outputPath = path.join(directory, `${routeId}.png`);
  await runMcp(["webview-screenshot", "--file", outputPath, "--format", "png"]);
  if (!(await Bun.file(outputPath).exists()))
    throw new Error(`Screenshot tool did not write ${outputPath}.`);
  routes.add(routeId);
  console.log(`Captured ${routeId}: ${outputPath}`);
}

async function gameCount(selector) {
  const result = await executeScript(
    `return { count: Array.from(document.querySelectorAll(${JSON.stringify(selector)})).filter(isVisible).length };`
  );
  return result?.count ?? 0;
}

async function openSwitchDesktopGame() {
  const result = await executeScript(
    `const card = Array.from(document.querySelectorAll('[data-testid="game-card"]')).find((candidate) => Array.from(candidate.querySelectorAll('*')).some((element) => text(element) === 'NS')); const button = card?.querySelector('button[aria-label]'); if (!button) return false; button.click(); return true;`
  );
  return result === true;
}

async function dismissDialog(title) {
  const closeText = title === "Restore this save?" ? "Cancel" : "Close";
  const result = await executeScript(
    `const dialog = dialogByTitle(${JSON.stringify(title)}); const button = dialog ? Array.from(dialog.querySelectorAll('.MuiDialogActions-root button')).find((element) => isVisible(element) && normalise(element.getAttribute('aria-label') || text(element)) === ${JSON.stringify(closeText)}) : null; if (!button || button.disabled) return false; button.click(); return true;`
  );
  if (result !== true) throw new Error(`Could not close the ${title} dialog.`);
  await waitFor(
    `!dialogByTitle(${JSON.stringify(title)})`,
    `the ${title} dialog to close`
  );
}

async function openRestoreConfirmation() {
  const result = await executeScript(
    `const dialog = dialogByTitle('Save history'); const button = dialog ? Array.from(dialog.querySelectorAll('button')).find((element) => isVisible(element) && normalise(element.getAttribute('aria-label') || text(element)).startsWith('Restore')) : null; if (!button || button.disabled) return false; button.click(); return true;`
  );
  return result === true;
}

async function captureSetup(directory, routes) {
  if (!(await getState()).setup) {
    console.log(
      "SKIP setup wizard: the configured app is not in first-run setup."
    );
    return;
  }
  await capture("setup-welcome", directory, routes);
  await clickText("Get Started");
  await waitFor(
    "textVisible('body', 'Connect to RomM Server')",
    "the RomM setup page"
  );
  await capture("setup-romm", directory, routes);
  await clickAny(["Continue", "Finish", "Skip"]);
  await waitFor(
    "textVisible('body', 'Select ROM Folder')",
    "the ROM folder setup page"
  );
  await capture("setup-rom-folder", directory, routes);
  await clickAny(["Continue", "Finish", "Skip"]);
  await waitFor("textVisible('body', 'Scan for Games')", "the scan setup page");
  await capture("setup-scan", directory, routes);
  await clickAny(["Continue", "Finish", "Skip"]);
  await waitForApp();
  console.log("Completed first-run setup after capturing every wizard page.");
}

async function goToDesktopLibrary() {
  const state = await getState();
  if (!state.desktop && !state.settings)
    throw new Error(
      "Expected the desktop shell before navigating to its library."
    );
  if (state.desktopDetails) await clickText("Back to Library");
  else await clickText("All Games");
  await waitFor(
    "selectorVisible('[data-testid=\"library-result-count\"]') && !selectorVisible('[role=\"progressbar\"]')",
    "the desktop library data",
    APP_READY_TIMEOUT
  );
}

function noGameSkip(routeId, reportSkip) {
  reportSkip(routeId, "the library contains no games");
}

async function captureCloudSaveViews(directory, routes, reportSkip) {
  await goToDesktopLibrary();
  if (!(await openSwitchDesktopGame())) {
    reportSkip(
      "cloud-save-history",
      "no Switch game is visible in the library"
    );
    reportSkip(
      "cloud-save-restore-confirmation",
      "no Switch game is visible in the library"
    );
    return;
  }
  let historyCaptured = false;
  try {
    await waitFor(
      "textVisible('button', 'Back to Library')",
      "Switch game details"
    );
    if (
      !(await executeScript(
        "return Boolean(interactive('History') && !interactive('History').disabled);"
      ))
    ) {
      reportSkip(
        "cloud-save-history",
        "the selected Switch game has no available cloud save history"
      );
      reportSkip(
        "cloud-save-restore-confirmation",
        "the selected Switch game has no available cloud save history"
      );
      return;
    }
    await clickText("History");
    await waitFor(
      "Boolean(dialogByTitle('Save history')) && !textVisible('[role=\"dialog\"]', 'Loading save history…')",
      "cloud save history"
    );
    await capture("cloud-save-history", directory, routes);
    historyCaptured = true;
    if (!(await openRestoreConfirmation())) {
      reportSkip(
        "cloud-save-restore-confirmation",
        "the cloud save history contains no restore candidates"
      );
      return;
    }
    await waitFor(
      "Boolean(dialogByTitle('Restore this save?'))",
      "restore save confirmation"
    );
    await capture("cloud-save-restore-confirmation", directory, routes);
  } catch (error) {
    const reason = `the cloud save UI was unavailable (${error.message ?? error})`;
    if (!historyCaptured) reportSkip("cloud-save-history", reason);
    reportSkip("cloud-save-restore-confirmation", reason);
  } finally {
    if (
      await executeScript(
        "return Boolean(dialogByTitle('Restore this save?'));"
      )
    )
      await dismissDialog("Restore this save?");
    if (await executeScript("return Boolean(dialogByTitle('Save history'));"))
      await dismissDialog("Save history");
    await goToDesktopLibrary();
  }
}

async function captureDesktop(directory, routes, reportSkip) {
  await goToDesktopLibrary();
  await capture("desktop-library", directory, routes);
  await clickText("RomM Sync");
  await waitForSelector(
    '[data-testid="romm-sync-monitor"]',
    "desktop RomM sync monitor"
  );
  await capture("desktop-romm-sync", directory, routes);
  await clickText("All Games");
  await waitFor(
    "selectorVisible('[data-testid=\"library-result-count\"]')",
    "the desktop library after RomM sync monitor"
  );
  if ((await gameCount('[data-testid="game-card"]')) > 0) {
    await clickTestId("game-card", "the first desktop game card");
    await waitFor(
      "textVisible('button', 'Back to Library')",
      "desktop game details"
    );
    await capture("desktop-details", directory, routes);
    await clickText("Back to Library");
    await waitFor(
      "selectorVisible('[data-testid=\"library-result-count\"]')",
      "the desktop library after game details"
    );
  } else noGameSkip("desktop-details", reportSkip);
  await captureCloudSaveViews(directory, routes, reportSkip);
  await clickText("Downloads");
  await waitFor("textVisible('main h1', 'Downloads')", "desktop downloads");
  await capture("desktop-downloads", directory, routes);
  await clickText("All Games");
  await waitFor(
    "selectorVisible('[data-testid=\"library-result-count\"]')",
    "the desktop library before settings"
  );
  await clickText("Settings");
  await captureSettings("desktop-settings", directory, routes);
  await clickText("All Games");
  await waitFor(
    "selectorVisible('[data-testid=\"library-result-count\"]')",
    "the desktop library after settings"
  );
}

async function captureSettings(prefix, directory, routes) {
  await waitFor(
    "selectorVisible('[data-testid=\"settings-nav-general\"]')",
    "the settings navigation"
  );
  for (const [id, ready] of SETTING_ROUTES) {
    if (id !== "general") {
      await clickTestId(`settings-nav-${id}`, `Settings navigation ${id}`);
    }
    await waitFor(ready, `Settings ${id}`, APP_READY_TIMEOUT);
    await capture(`${prefix}-${id}`, directory, routes);
  }
}

async function captureImmersive(directory, routes, reportSkip) {
  let state = await getState();
  if (state.immersiveDownloads) {
    await clickText("Back");
    await waitFor(
      "selectorVisible('[data-testid=\"immersive-library\"]')",
      "the immersive library"
    );
    state = await getState();
  }
  if (state.immersiveSync) {
    await clickText("Back to library");
    await waitFor(
      "selectorVisible('[data-testid=\"immersive-library\"]')",
      "the immersive library after RomM sync monitor"
    );
    state = await getState();
  }
  if (state.immersiveDetails) {
    await capture("immersive-details", directory, routes);
    await clickText("Back");
    await waitFor(
      "selectorVisible('[data-testid=\"immersive-library\"]')",
      "the immersive library after game details"
    );
  }
  await waitFor(
    "selectorVisible('[data-testid=\"immersive-library\"]')",
    "the immersive library"
  );
  await capture("immersive-library", directory, routes);
  await clickText("RomM Sync");
  await waitForSelector(
    '[data-testid="romm-sync-monitor"]',
    "immersive RomM sync monitor"
  );
  await capture("immersive-romm-sync", directory, routes);
  await clickText("Back to library");
  await waitForSelector(
    '[data-testid="immersive-library"]',
    "the immersive library after RomM sync monitor"
  );
  if ((await gameCount('[data-testid="immersive-grid"] button')) > 0) {
    await click(
      { selector: '[data-testid="immersive-grid"] button' },
      "the first immersive game tile"
    );
    await waitFor(
      "selectorVisible('[data-testid=\"immersive-game-details\"]')",
      "immersive game details"
    );
    await capture("immersive-details", directory, routes);
    await clickText("Back");
    await waitFor(
      "selectorVisible('[data-testid=\"immersive-library\"]')",
      "the immersive library after game details"
    );
  } else noGameSkip("immersive-details", reportSkip);
  await clickText("Downloads");
  await waitFor("textVisible('h1', 'Downloads')", "immersive downloads");
  await capture("immersive-downloads", directory, routes);
  await clickText("Back");
  await waitFor(
    "selectorVisible('[data-testid=\"immersive-library\"]')",
    "the immersive library before exit"
  );
}

async function leaveImmersive() {
  const state = await getState();
  if (
    state.immersiveLibrary ||
    state.immersiveDetails ||
    state.immersiveDownloads ||
    state.immersiveSync
  ) {
    if (
      state.immersiveDetails ||
      state.immersiveDownloads ||
      state.immersiveSync
    ) {
      await clickText(state.immersiveSync ? "Back to library" : "Back");
      await waitFor(
        "selectorVisible('[data-testid=\"immersive-library\"]')",
        "the immersive library before exit"
      );
    }
    await interactClickTestId(
      "immersive-exit-to-desktop",
      "the immersive exit button"
    );
    await waitFor(
      "Boolean(interactive('All Games'))",
      "the desktop shell after immersive mode",
      APP_READY_TIMEOUT
    );
  } else if (state.immersiveSettings) {
    await clickTestId("settings-nav-general", "Settings navigation general");
    await waitFor(
      "selectorVisible('[data-testid=\"immersive-mode-row\"]')",
      "immersive Settings general",
      APP_READY_TIMEOUT
    );
    const switchState = await executeScript(
      "const input = document.querySelector('[data-testid=\"immersive-mode-switch\"]'); return input ? { checked: Boolean(input.checked) } : null;"
    );
    if (switchState?.checked) {
      await interactClickTestId(
        "immersive-mode-switch",
        "the immersive mode switch"
      );
      await waitFor(
        "Boolean(interactive('All Games'))",
        "the desktop shell after immersive Settings",
        APP_READY_TIMEOUT
      );
    }
  }
}

async function enterImmersive() {
  await clickText("Settings");
  await waitFor(
    "selectorVisible('[data-testid=\"settings-nav-general\"]')",
    "the settings navigation"
  );
  await clickTestId("settings-nav-general", "Settings navigation general");
  await waitFor(
    "selectorVisible('[data-testid=\"immersive-mode-row\"]')",
    "desktop Settings general",
    APP_READY_TIMEOUT
  );
  const switchState = await executeScript(
    "const input = document.querySelector('[data-testid=\"immersive-mode-switch\"]'); return input ? { checked: Boolean(input.checked) } : null;"
  );
  if (!switchState)
    throw new Error("Immersive mode switch was not rendered in Settings.");
  if (!switchState.checked)
    await interactClickTestId(
      "immersive-mode-switch",
      "the immersive mode switch"
    );
  try {
    await waitForSelector(
      '[data-testid="immersive-library"]',
      "the immersive library",
      15_000
    );
  } catch (error) {
    if (!String(error.message ?? error).includes("Timed out")) throw error;
    console.log(
      "Immersive mode did not transition live; reloading to apply its saved display configuration."
    );
    await executeScript("window.location.reload(); return true;", 10_000);
    await waitForApp();
    await waitForSelector(
      '[data-testid="immersive-library"]',
      "the immersive library after reload",
      APP_READY_TIMEOUT
    );
  }
}

async function captureAll(options) {
  const routes = new Set();
  const skips = new Set();
  const reportSkip = (routeId, reason) => {
    if (!skips.has(routeId)) console.log(`SKIP ${routeId}: ${reason}.`);
    skips.add(routeId);
  };
  let sessionStarted = false;
  let originalDisplay;
  let operationError;
  const cleanupErrors = [];
  const directory = path.resolve(
    process.cwd(),
    ".scratch",
    "screenshots",
    timestamp()
  );
  try {
    await runMcp([
      "driver-session",
      "start",
      "--host",
      options.host,
      "--port",
      String(options.port),
    ]);
    sessionStarted = true;
    await requireConnectedApp();
    await waitForApp();
    originalDisplay = (await readConfig()).display ?? null;
    await mkdir(directory, { recursive: true });
    await captureSetup(directory, routes);
    await waitForApp();
    let state = await getState();
    if (
      state.immersiveLibrary ||
      state.immersiveDetails ||
      state.immersiveDownloads ||
      state.immersiveSync
    ) {
      await captureImmersive(directory, routes, reportSkip);
      await leaveImmersive();
    } else if (state.immersiveSettings) await leaveImmersive();
    await captureDesktop(directory, routes, reportSkip);
    state = await getState();
    if (state.desktop) {
      await enterImmersive();
      await captureImmersive(directory, routes, reportSkip);
      await leaveImmersive();
    } else
      console.log(
        "SKIP immersive views: the desktop shell was not reachable after desktop captures."
      );
    console.log(
      `Captured ${routes.size} unique reachable app routes under ${directory}.`
    );
  } catch (error) {
    operationError = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (sessionStarted && originalDisplay !== undefined) {
      try {
        await restoreDisplay(originalDisplay);
        console.log("Restored the original display configuration.");
      } catch (error) {
        cleanupErrors.push(
          `Could not restore the original display configuration: ${error.message ?? error}`
        );
      }
    }
    if (sessionStarted) {
      try {
        await runMcp([
          "driver-session",
          "stop",
          "--host",
          options.host,
          "--port",
          String(options.port),
          "--app-identifier",
          String(options.port),
        ]);
        console.log("Stopped the Tauri MCP driver session.");
      } catch (error) {
        cleanupErrors.push(
          `Could not stop the Tauri MCP driver session: ${error.message ?? error}`
        );
      }
    }
  }
  const cleanupError = cleanupErrors.length
    ? new Error(cleanupErrors.join(" "))
    : null;
  if (operationError && cleanupError)
    throw new Error(
      `${operationError.message} Cleanup also failed: ${cleanupError.message}`
    );
  if (operationError) throw operationError;
  if (cleanupError) throw cleanupError;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) printHelp();
  else await captureAll(options);
}

try {
  await main();
} catch (error) {
  console.error(`Screenshot capture failed: ${error.message ?? error}`);
  process.exitCode = 1;
}
