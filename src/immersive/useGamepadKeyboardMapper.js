import { useEffect, useRef, useState } from "react";

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function axisToDir(v, deadzone = 0.35) {
  if (v <= -deadzone) return -1;
  if (v >= deadzone) return 1;
  return 0;
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
 * Standard-layout actions:
 * - D-pad / Left stick: Arrow keys
 * - South: Enter
 * - East: Escape
 * - LB/RB: PageUp/PageDown (section switching in library)
 * - Start: "s" (open settings in library)
 * - Back/View: "h" (toggle on-screen help/hints)
 */
export function useGamepadKeyboardMapper({
  enabled = true,
  // used to prevent repeating navigation too fast
  repeatDelayMs = 240,
  repeatRateMs = 110,
} = {}) {
  const rafRef = useRef(0);
  const lastFireAt = useRef(new Map());
  const connectedOnce = useRef(false);
  const unsupportedGamepadRef = useRef(false);
  const [unsupportedGamepad, setUnsupportedGamepad] = useState(false);
  const lastDigital = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    a: false,
    b: false,
    lb: false,
    rb: false,
    start: false,
    back: false,
  });

  useEffect(() => {
    if (!enabled) {
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

    function canFire(key, isHeld) {
      const now = Date.now();
      const last = lastFireAt.current.get(key) || 0;
      const min = isHeld ? repeatRateMs : repeatDelayMs;
      if (now - last < min) return false;
      lastFireAt.current.set(key, now);
      return true;
    }

    function tick() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connectedPads = Array.from(pads || []).filter(Boolean);
      const gp = connectedPads.find((pad) => pad.mapping === "standard") || null;
      updateUnsupportedGamepad(connectedPads.length > 0 && !gp);
      if (!gp) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      connectedOnce.current = true;

      const b = gp.buttons || [];
      const ax = gp.axes || [];

      // Standard mapping indices
      const pressedA = Boolean(b[0]?.pressed);
      const pressedB = Boolean(b[1]?.pressed);
      const pressedLB = Boolean(b[4]?.pressed);
      const pressedRB = Boolean(b[5]?.pressed);
      const pressedBack = Boolean(b[8]?.pressed);
      const pressedStart = Boolean(b[9]?.pressed);
      const pressedUp = Boolean(b[12]?.pressed);
      const pressedDown = Boolean(b[13]?.pressed);
      const pressedLeft = Boolean(b[14]?.pressed);
      const pressedRight = Boolean(b[15]?.pressed);

      const stickX = clamp01(Math.abs(ax[0] || 0)) * (ax[0] || 0);
      const stickY = clamp01(Math.abs(ax[1] || 0)) * (ax[1] || 0);
      const stickDirX = axisToDir(stickX);
      const stickDirY = axisToDir(stickY);

      const digital = {
        up: pressedUp || stickDirY === -1,
        down: pressedDown || stickDirY === 1,
        left: pressedLeft || stickDirX === -1,
        right: pressedRight || stickDirX === 1,
        a: pressedA,
        b: pressedB,
        lb: pressedLB,
        rb: pressedRB,
        start: pressedStart,
        back: pressedBack,
      };

      const prev = lastDigital.current;

      // Edge-triggered buttons
      if (digital.a && !prev.a) dispatchKey("Enter");
      if (digital.b && !prev.b) dispatchKey("Escape");
      if (digital.lb && !prev.lb) dispatchKey("PageUp");
      if (digital.rb && !prev.rb) dispatchKey("PageDown");
      if (digital.start && !prev.start) dispatchKey("s");
      if (digital.back && !prev.back) dispatchKey("h");

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
    };
  }, [enabled, repeatDelayMs, repeatRateMs]);

  useEffect(() => {
    if (!enabled) return undefined;

    function onConnect() {
      connectedOnce.current = true;
    }
    window.addEventListener("gamepadconnected", onConnect);
    return () => window.removeEventListener("gamepadconnected", onConnect);
  }, [enabled]);

  return { unsupportedGamepad };
}
