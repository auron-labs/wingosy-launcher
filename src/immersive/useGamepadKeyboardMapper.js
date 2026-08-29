import { useEffect, useRef, useState } from "react";

export const DEFAULT_GAMEPAD_DEADZONE = 0.35;
export const GAMEPAD_DEADZONE_MIN = 0.1;
export const GAMEPAD_DEADZONE_MAX = 0.8;

export function normalizeGamepadDeadzone(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_GAMEPAD_DEADZONE;
  return Math.max(GAMEPAD_DEADZONE_MIN, Math.min(GAMEPAD_DEADZONE_MAX, numeric));
}

function axisToDir(value, deadzone) {
  const v = Math.max(-1, Math.min(1, Number(value) || 0));
  if (v <= -deadzone) return -1;
  if (v >= deadzone) return 1;
  return 0;
}

function emptyDigital() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    confirmOpen: false,
    back: false,
    previousSection: false,
    nextSection: false,
    menu: false,
    view: false,
  };
}

function readStandardPad(pad, deadzone) {
  const buttons = pad.buttons || [];
  const axes = pad.axes || [];
  const digital = {
    up: Boolean(buttons[12]?.pressed) || axisToDir(axes[1], deadzone) === -1,
    down: Boolean(buttons[13]?.pressed) || axisToDir(axes[1], deadzone) === 1,
    left: Boolean(buttons[14]?.pressed) || axisToDir(axes[0], deadzone) === -1,
    right: Boolean(buttons[15]?.pressed) || axisToDir(axes[0], deadzone) === 1,
    confirmOpen: Boolean(buttons[0]?.pressed),
    back: Boolean(buttons[1]?.pressed),
    previousSection: Boolean(buttons[4]?.pressed),
    nextSection: Boolean(buttons[5]?.pressed),
    view: Boolean(buttons[8]?.pressed),
    menu: Boolean(buttons[9]?.pressed),
  };

  return {
    digital,
    hasInput: Object.values(digital).some(Boolean),
  };
}

/** Maps logical keys to `code` for closer-to-real keyboard events (WebView / MUI). */
const KEY_TO_CODE = {
  Escape: "Escape",
  Enter: "Enter",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  PageUp: "PageUp",
  PageDown: "PageDown",
  s: "KeyS",
  S: "KeyS",
  h: "KeyH",
  H: "KeyH",
};

function buildKeydown(key) {
  const code = KEY_TO_CODE[key] || "";
  return new KeyboardEvent("keydown", {
    key,
    ...(code ? { code } : {}),
    bubbles: true,
    cancelable: true,
  });
}

function dispatchKey(key) {
  try {
    const menu = document.querySelector('[role="menu"]');
    if (menu) {
      // MUI's menu keyboard handling is attached to the focused menu item/list, not window.
      const activeElement = document.activeElement;
      const target = activeElement && menu.contains(activeElement) ? activeElement : menu;
      target.dispatchEvent(buildKeydown(key));
      return;
    }

    const evt = buildKeydown(key);
    // Shell routing (Escape, hints, launch) listens on `window` in `ImmersiveModeApp`.
    window.dispatchEvent(evt);
    // Library grid listens on its root `[data-testid="immersive-library"]`, not on `window`.
    const lib = document.querySelector('[data-testid="immersive-library"]');
    if (
      lib &&
      (key.startsWith("Arrow") ||
        key === "Enter" ||
        key === "PageUp" ||
        key === "PageDown" ||
        key === "s" ||
        key === "S")
    ) {
      lib.dispatchEvent(buildKeydown(key));
    }
  } catch {
    // ignore
  }
}

/**
 * Minimal "Big Picture" style controller mapping by translating gamepad input to existing keyboard handlers.
 *
 * Standard-layout intents:
 * - Directional navigation: D-pad / left stick -> Arrow keys
 * - Confirm/Open: South -> Enter
 * - Back: East -> Escape
 * - Sections: LB/RB -> PageUp/PageDown
 * - Menu: Start -> "s" (open settings in library)
 * - View: Back/View -> "h" (toggle on-screen help/hints)
 */
export function useGamepadKeyboardMapper({
  enabled = true,
  // used to prevent repeating navigation too fast
  repeatDelayMs = 240,
  repeatRateMs = 110,
  deadzone = DEFAULT_GAMEPAD_DEADZONE,
} = {}) {
  const rafRef = useRef(0);
  const repeatState = useRef(new Map());
  const activePadKey = useRef(null);
  const blockedPadKey = useRef(null);
  const unsupportedGamepadRef = useRef(false);
  const [unsupportedGamepad, setUnsupportedGamepad] = useState(false);
  const lastDigital = useRef(emptyDigital());

  useEffect(() => {
    function resetInputState() {
      activePadKey.current = null;
      blockedPadKey.current = null;
      lastDigital.current = emptyDigital();
      repeatState.current.clear();
    }

    if (!enabled) {
      resetInputState();
      if (unsupportedGamepadRef.current) {
        unsupportedGamepadRef.current = false;
        setUnsupportedGamepad(false);
      }
      return undefined;
    }

    function updateUnsupportedGamepad(value) {
      if (unsupportedGamepadRef.current === value) return;
      unsupportedGamepadRef.current = value;
      setUnsupportedGamepad(value);
    }

    function canFire(key, wasHeld) {
      const now = Date.now();
      const previous = repeatState.current.get(key);
      if (!wasHeld || !previous) {
        repeatState.current.set(key, { at: now, repeating: false });
        return true;
      }
      const min = previous.repeating ? repeatRateMs : repeatDelayMs;
      if (now - previous.at < min) return false;
      repeatState.current.set(key, { at: now, repeating: true });
      return true;
    }

    function tick() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connectedPads = Array.from(pads || [])
        .map((pad, slot) => (pad ? { key: pad.index ?? slot, pad } : null))
        .filter(Boolean);
      const standardPads = connectedPads
        .filter(({ pad }) => pad.mapping === "standard")
        .map((entry) => ({
          ...entry,
          input: readStandardPad(entry.pad, normalizeGamepadDeadzone(deadzone)),
        }));
      updateUnsupportedGamepad(connectedPads.length > 0 && standardPads.length === 0);

      const active = standardPads.find(({ key }) => key === activePadKey.current) || null;
      const disconnectedPadKey = activePadKey.current;
      if (!active && disconnectedPadKey !== null) {
        resetInputState();
        blockedPadKey.current = disconnectedPadKey;
      }

      const blocked = standardPads.find(({ key }) => key === blockedPadKey.current);
      if (blocked && !blocked.input.hasInput) blockedPadKey.current = null;

      // Poll all standard pads, but route one owner's input so two pads cannot duplicate actions.
      const producing = standardPads.filter(
        ({ key, input }) => input.hasInput && key !== blockedPadKey.current,
      );
      const selected = active || producing.at(-1) || null;
      if (!selected) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      activePadKey.current = selected.key;
      const digital = selected.input.digital;

      const prev = lastDigital.current;

      // Edge-triggered intents
      if (digital.confirmOpen && !prev.confirmOpen) dispatchKey("Enter");
      if (digital.back && !prev.back) dispatchKey("Escape");
      if (digital.previousSection && !prev.previousSection) dispatchKey("PageUp");
      if (digital.nextSection && !prev.nextSection) dispatchKey("PageDown");
      if (digital.menu && !prev.menu) dispatchKey("s");
      if (digital.view && !prev.view) dispatchKey("h");

      // Held navigation (dpad/stick)
      if (digital.up && canFire("ArrowUp", prev.up)) dispatchKey("ArrowUp");
      if (digital.down && canFire("ArrowDown", prev.down)) dispatchKey("ArrowDown");
      if (digital.left && canFire("ArrowLeft", prev.left)) dispatchKey("ArrowLeft");
      if (digital.right && canFire("ArrowRight", prev.right)) dispatchKey("ArrowRight");

      lastDigital.current = digital;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resetInputState();
    };
  }, [deadzone, enabled, repeatDelayMs, repeatRateMs]);

  return { unsupportedGamepad };
}
