/**
 * Opt-in Windows system-controller proof for immersive library navigation.
 *
 * Prerequisites:
 *   mise exec -- cargo build --manifest-path tools/virtual-gamepad-adapter/Cargo.toml --locked
 *   a provisioned ViGEmBus driver and the normal native E2E prerequisites
 */

import {
  ensureDesktopMode,
  ensureMainApp,
  goToSettings,
  waitForAppReady,
} from "./helpers.js";
import { createVirtualGamepadAdapter } from "./virtual-gamepad-adapter.js";

const FIRST_GAME_SELECTOR = '[data-immersive-index="0"] button';
const SECOND_GAME_SELECTOR = '[data-immersive-index="1"] button';

const RIGHT_PRESSED_STATE = {
  command: "set_state",
  state: {
    buttons: {
      a: false,
      b: false,
      x: false,
      y: false,
      start: false,
      back: false,
      guide: false,
      left_thumb: false,
      right_thumb: false,
      left_shoulder: false,
      right_shoulder: false,
    },
    dpad: "right",
    left_stick: { x: 0, y: 0 },
    right_stick: { x: 0, y: 0 },
    left_trigger: 0,
    right_trigger: 0,
  },
};

function responseDescription(response) {
  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

function requireSuccessfulResponse(response, command) {
  if (response?.ok !== true) {
    throw new Error(
      `adapter ${command} failed: ${response?.error || responseDescription(response)}`
    );
  }
}

async function requireDisplayed(selector, description) {
  const element = await $(selector);
  if (!(await element.isDisplayed().catch(() => false))) {
    throw new Error(
      `immersive navigation fixture is missing visible ${description} (${selector})`
    );
  }
  return element;
}

async function isSelectorFocused(selector) {
  try {
    return Boolean(
      await browser.execute((query) => {
        const element = document.querySelector(query);
        return Boolean(element && document.activeElement === element);
      }, selector)
    );
  } catch {
    return false;
  }
}

async function requireFocused(selector, description) {
  await browser.waitUntil(() => isSelectorFocused(selector), {
    timeout: 15_000,
    interval: 100,
    timeoutMsg: `expected ${description} to have actual DOM focus (${selector})`,
  });
  if (!(await isSelectorFocused(selector))) {
    throw new Error(`actual DOM focus was not on ${description} (${selector})`);
  }
}

async function enterImmersiveLibrary() {
  if (!(await waitForAppReady(45))) {
    throw new Error("Wingosy app shell did not become ready");
  }
  if (!(await ensureMainApp())) {
    throw new Error("Wingosy did not reach the main desktop app");
  }

  await ensureDesktopMode();
  if (
    !(await $("*=All Games")
      .isDisplayed()
      .catch(() => false))
  ) {
    throw new Error(
      "desktop navigation was not visible after leaving immersive mode"
    );
  }

  if (!(await goToSettings())) {
    throw new Error("Settings navigation did not reach its heading");
  }

  const row = await requireDisplayed(
    '[data-testid="immersive-mode-row"]',
    "immersive mode setting"
  );
  let toggle = await row.$('input[type="checkbox"]');
  if (!(await toggle.isExisting().catch(() => false))) {
    throw new Error("immersive mode setting has no checkbox control");
  }

  if (await toggle.isSelected()) {
    await toggle.click();
    await browser.pause(2_000);
    toggle = await $(
      '[data-testid="immersive-mode-row"] input[type="checkbox"]'
    );
  }
  await toggle.click();

  await browser.waitUntil(
    async () => {
      const library = await $('[data-testid="immersive-library"]');
      return await library.isDisplayed().catch(() => false);
    },
    {
      timeout: 20_000,
      interval: 250,
      timeoutMsg:
        "immersive library did not appear after enabling immersive mode",
    }
  );
}

async function cleanupAdapter(adapter) {
  const failures = [];
  for (const command of ["neutral", "disconnect"]) {
    try {
      const response = await adapter.send({ command });
      if (response?.ok !== true) {
        failures.push(
          `${command}: ${response?.error || responseDescription(response)}`
        );
      }
    } catch (error) {
      failures.push(
        `${command}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  try {
    await adapter.shutdown();
  } catch (error) {
    failures.push(
      `shutdown: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return failures;
}

describe("Virtual gamepad immersive navigation", function () {
  this.timeout(120_000);

  it("moves focus right and keeps it after neutral release", async () => {
    const adapter = createVirtualGamepadAdapter();
    let primaryError = null;

    try {
      if (process.platform !== "win32") {
        throw new Error("virtual gamepad immersive navigation is Windows-only");
      }

      adapter.start();
      const connected = await adapter.send({ command: "connect" });
      requireSuccessfulResponse(connected, "connect");
      if (
        connected.command !== "connect" ||
        connected.status?.connected !== true ||
        connected.status?.ready !== true
      ) {
        throw new Error(
          `adapter did not report a ready connected target: ${responseDescription(connected)}`
        );
      }

      await enterImmersiveLibrary();
      await requireDisplayed(
        '[data-testid="immersive-library"]',
        "immersive library"
      );
      const gameControls = await $$("[data-immersive-index] button");
      if (gameControls.length < 2) {
        throw new Error(
          `prepared immersive fixture needs game controls at indices 0 and 1; found ${gameControls.length}`
        );
      }
      await requireDisplayed(
        FIRST_GAME_SELECTOR,
        "first game control at index 0"
      );
      await requireDisplayed(
        SECOND_GAME_SELECTOR,
        "second game control at index 1"
      );

      await requireFocused(
        FIRST_GAME_SELECTOR,
        "first game control at index 0"
      );

      const pressed = await adapter.send(RIGHT_PRESSED_STATE);
      requireSuccessfulResponse(pressed, "set_state right press");
      await requireFocused(
        SECOND_GAME_SELECTOR,
        "second game control at index 1 after D-pad right"
      );

      const neutral = await adapter.send({ command: "neutral" });
      requireSuccessfulResponse(neutral, "neutral release");
      await requireFocused(
        SECOND_GAME_SELECTOR,
        "second game control at index 1 after neutral release"
      );
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      const cleanupFailures = await cleanupAdapter(adapter);
      if (cleanupFailures.length > 0) {
        const message = `virtual gamepad cleanup failed: ${cleanupFailures.join("; ")}`;
        if (primaryError) {
          console.error(`[virtual-gamepad-navigation] ${message}`);
        } else {
          throw new Error(message);
        }
      }
    }
  });
});
