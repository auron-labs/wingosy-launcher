import { useCallback, useState } from "react";

import { getImmersiveConfig, saveImmersiveConfig } from "./immersive-mode-ipc";
import { useFullscreen } from "./use-fullscreen";

/** @typedef {import("./immersive-types").AmbientAudioConfig} AmbientAudioConfig */
/** @typedef {import("./immersive-types").ImmersiveConfig} ImmersiveConfig */

const DEFAULT_GAMEPAD_DEADZONE = 0.35;
const GAMEPAD_DEADZONE_MIN = 0.1;
const GAMEPAD_DEADZONE_MAX = 0.8;

/** @param {unknown} value Candidate deadzone. @returns {number} Normalized deadzone. */
export const normalizeControllerDeadzone = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_GAMEPAD_DEADZONE;
  }
  return Math.max(
    GAMEPAD_DEADZONE_MIN,
    Math.min(GAMEPAD_DEADZONE_MAX, numeric)
  );
};

/** @param {boolean} requestedFullscreen Requested initial fullscreen state. @returns {{big_picture: boolean, fullscreen: boolean}} Initial display settings. */
const getInitialDisplayConfig = (requestedFullscreen) => ({
  big_picture: true,
  fullscreen: requestedFullscreen,
});

/** @returns {AmbientAudioConfig|null} Initial audio configuration. */
const getInitialAudioConfig = () => null;

/** @param {ImmersiveConfig} config Loaded configuration. @param {{big_picture?: boolean, fullscreen?: boolean}} next Display changes. @returns {ImmersiveConfig} Updated configuration. */
const getDisplayConfig = (config, next) => {
  const display = { ...config.display };
  if (next.big_picture !== undefined) {
    display.big_picture = next.big_picture;
  }
  if (next.fullscreen !== undefined) {
    display.fullscreen = next.fullscreen;
  }
  return { ...config, display };
};

/** @param {{getConfig?: typeof getImmersiveConfig, requestedFullscreen: boolean, saveConfig?: typeof saveImmersiveConfig}} options Display options. */
export const useImmersiveModeDisplay = ({
  getConfig = getImmersiveConfig,
  requestedFullscreen,
  saveConfig = saveImmersiveConfig,
}) => {
  const [displayConfig, setDisplayConfig] = useState(() =>
    getInitialDisplayConfig(requestedFullscreen)
  );
  const [controllerDeadzone, setControllerDeadzone] = useState(
    DEFAULT_GAMEPAD_DEADZONE
  );
  const [audioConfig, setAudioConfig] = useState(getInitialAudioConfig);
  const [retroachievementsEnabled, setRetroachievementsEnabled] =
    useState(false);

  const applyConfig = useCallback(
    /** @param {ImmersiveConfig} config Loaded configuration. */
    (config) => {
      setDisplayConfig({
        big_picture: config.display?.big_picture === true,
        fullscreen: config.display?.fullscreen === true,
      });
      setControllerDeadzone(
        normalizeControllerDeadzone(
          config.display?.controller_deadzone ?? DEFAULT_GAMEPAD_DEADZONE
        )
      );
      setAudioConfig(config.audio ?? null);
      setRetroachievementsEnabled(
        config.display?.retroachievements_enabled === true
      );
    },
    []
  );

  const persistDisplay = useCallback(
    /** @param {{big_picture?: boolean, fullscreen?: boolean}} next Display changes. */
    async (next) => {
      const config = await getConfig();
      const nextConfig = getDisplayConfig(config, next);
      await saveConfig(nextConfig);
      applyConfig(nextConfig);
      return nextConfig;
    },
    [applyConfig, getConfig, saveConfig]
  );

  const persistFullscreen = useCallback(
    /** @param {boolean} enabled Fullscreen state. */
    (enabled) => {
      const saveFullscreen = async () => {
        try {
          await persistDisplay({ fullscreen: enabled });
        } catch {
          return null;
        }
        return null;
      };
      void saveFullscreen();
    },
    [persistDisplay]
  );
  const fullscreen = useFullscreen({
    enabled: displayConfig.fullscreen,
    onChange: persistFullscreen,
  });

  return {
    applyConfig,
    audioConfig,
    controllerDeadzone,
    displayConfig,
    persistDisplay,
    retroachievementsEnabled,
    setControllerDeadzone,
    ...fullscreen,
  };
};
