import { useCallback, useEffect, useState } from "react";

import { loadUiSoundsConfig } from "./ui-sounds-config";
import { clampUiSoundsVolume, readUiSoundsConfig } from "./ui-sounds-logic";

/** @typedef {import('./ui-sounds-context').UiSoundsConfig} UiSoundsConfig */

export const useUiSoundSettings = () => {
  const [uiSoundsEnabled, setUiSoundsEnabled] = useState(false);
  const [uiSoundsVolume, setUiSoundsVolume] = useState(80);

  const refreshFromConfig = useCallback(
    /** @param {UiSoundsConfig} config Persisted sound settings. */
    (config) => {
      const settings = readUiSoundsConfig(config);
      setUiSoundsEnabled(settings.enabled);
      setUiSoundsVolume(settings.volume);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const config = await loadUiSoundsConfig();
        if (!cancelled) {
          refreshFromConfig(config);
        }
      } catch {
        if (!cancelled) {
          setUiSoundsEnabled(false);
          setUiSoundsVolume(80);
        }
      }
    };
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [refreshFromConfig]);

  const updateUiSoundsEnabled = useCallback(
    /** @param {boolean} next Requested enabled state. */
    (next) => {
      setUiSoundsEnabled(next);
    },
    []
  );
  const updateUiSoundsVolume = useCallback(
    /** @param {number} next Requested volume percentage. */
    (next) => {
      setUiSoundsVolume(clampUiSoundsVolume(next));
    },
    []
  );

  return {
    refreshFromConfig,
    setUiSoundsEnabled: updateUiSoundsEnabled,
    setUiSoundsVolume: updateUiSoundsVolume,
    uiSoundsEnabled,
    uiSoundsVolume,
  };
};
