/** @typedef {{display?: {big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number, ui_sounds_enabled?: boolean, retroachievements_enabled?: boolean}, audio?: {ambient_enabled?: boolean, ambient_volume?: number, ambient_path?: string|null, ambient_is_folder?: boolean, ambient_shuffle?: boolean, ui_sounds_volume?: number}}} SettingsConfig */
/** @typedef {{config: SettingsConfig|null, runtime: import("./settings-runtime").SettingsRuntime, setConfig: SettingsSetter<SettingsConfig|null>, setImmersiveModeEnabled: SettingsSetter<boolean>, setFullscreenEnabled: SettingsSetter<boolean>, setControllerDeadzone: SettingsSetter<number>, onControllerDeadzoneChange?: ((value: number) => void)|null, onRetroAchievementsChange?: ((value: boolean) => void)|null, normalizeGamepadDeadzone: (value: number) => number, setUiSoundsEnabled: SettingsSetter<boolean>, setUiSoundsVolume: SettingsSetter<number>, refreshUiSoundsFromConfig: (config: SettingsConfig) => void, onLibraryChange?: (() => void|Promise<void>)|null, setAmbientEnabled: SettingsSetter<boolean>, setAmbientVolume: SettingsSetter<number>, setAmbientPath: SettingsSetter<string|null>, setAmbientIsFolder: SettingsSetter<boolean>, setAmbientShuffle: SettingsSetter<boolean>}} AudioActionsContext */
/** @typedef {{ambient_enabled?: boolean, ambient_volume?: number, ambient_path?: string|null, ambient_is_folder?: boolean, ambient_shuffle?: boolean}} AmbientUpdate */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */

/** @param {unknown} error Error from an audio operation. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {SettingsConfig|null} config Current settings configuration. @param {() => Promise<SettingsConfig>} loadConfig Load fallback configuration. @returns {Promise<SettingsConfig>} A cloned configuration. */
const cloneSettingsConfig = async (config, loadConfig) => {
  if (config !== null) {
    return structuredClone(config);
  }
  /** @type {SettingsConfig} */
  const loadedConfig = await loadConfig();
  return structuredClone(loadedConfig);
};

/** @param {Pick<AudioActionsContext, "config"|"runtime"|"setConfig"|"setImmersiveModeEnabled"|"setFullscreenEnabled">} context Display state. @param {boolean} nextImmersive Immersive mode value. @param {boolean} nextFullscreen Fullscreen value. */
const persistDisplayFlags = async (
  { config, runtime, setConfig, setImmersiveModeEnabled, setFullscreenEnabled },
  nextImmersive,
  nextFullscreen
) => {
  const cfg = await cloneSettingsConfig(
    config,
    async () => await runtime.invoke("get_config")
  );
  cfg.display ??= {};
  cfg.display.big_picture = nextImmersive;
  cfg.display.fullscreen = nextFullscreen;
  await runtime.invoke("save_config", { config: cfg });
  setConfig(cfg);
  setImmersiveModeEnabled(nextImmersive);
  setFullscreenEnabled(nextFullscreen);
};

/** @param {Pick<AudioActionsContext, "config"|"runtime"|"setConfig"|"onRetroAchievementsChange">} context Display state. @param {boolean} nextEnabled Whether RetroAchievements is enabled. */
const persistRetroAchievements = async (
  { config, onRetroAchievementsChange, runtime, setConfig },
  nextEnabled
) => {
  try {
    const cfg = await cloneSettingsConfig(
      config,
      async () => await runtime.invoke("get_config")
    );
    cfg.display ??= {};
    cfg.display.retroachievements_enabled = nextEnabled;
    await runtime.invoke("save_config", { config: cfg });
    setConfig(cfg);
    onRetroAchievementsChange?.(nextEnabled);
  } catch (error) {
    console.error("Failed to save RetroAchievements setting:", error);
  }
};

/** @param {Pick<AudioActionsContext, "config"|"runtime"|"setConfig"|"setControllerDeadzone"|"onControllerDeadzoneChange"|"normalizeGamepadDeadzone">} context Display state. @param {number} nextDeadzone Requested deadzone. */
const persistControllerDeadzone = async (
  {
    config,
    runtime,
    setConfig,
    setControllerDeadzone,
    onControllerDeadzoneChange,
    normalizeGamepadDeadzone,
  },
  nextDeadzone
) => {
  const bounded = normalizeGamepadDeadzone(nextDeadzone);
  const cfg = await cloneSettingsConfig(
    config,
    async () => await runtime.invoke("get_config")
  );
  cfg.display ??= {};
  cfg.display.controller_deadzone = bounded;
  await runtime.invoke("save_config", { config: cfg });
  setConfig(cfg);
  setControllerDeadzone(bounded);
  onControllerDeadzoneChange?.(bounded);
};

/** @param {Pick<AudioActionsContext, "config"|"runtime"|"setConfig"|"setUiSoundsEnabled"|"refreshUiSoundsFromConfig"|"onLibraryChange">} context UI sound state. @param {boolean} next Whether UI sounds are enabled. */
const persistUiSounds = async (
  {
    config,
    runtime,
    setConfig,
    setUiSoundsEnabled,
    refreshUiSoundsFromConfig,
    onLibraryChange,
  },
  next
) => {
  try {
    const cfg = await cloneSettingsConfig(
      config,
      async () => await runtime.invoke("get_config")
    );
    cfg.display ??= {};
    cfg.display.ui_sounds_enabled = next;
    await runtime.invoke("save_config", { config: cfg });
    setConfig(cfg);
    setUiSoundsEnabled(next);
    refreshUiSoundsFromConfig(cfg);
    if (onLibraryChange) {
      await onLibraryChange();
    }
  } catch {
    // UI sound persistence is best-effort while the backend is unavailable.
  }
};

/** @param {Pick<AudioActionsContext, "config"|"runtime"|"setConfig"|"setUiSoundsVolume"|"refreshUiSoundsFromConfig"|"onLibraryChange">} context UI sound state. @param {number} volume Requested volume. */
const persistUiSoundsVolume = async (
  {
    config,
    runtime,
    setConfig,
    setUiSoundsVolume,
    refreshUiSoundsFromConfig,
    onLibraryChange,
  },
  volume
) => {
  try {
    const cfg = await cloneSettingsConfig(
      config,
      async () => await runtime.invoke("get_config")
    );
    cfg.audio ??= {};
    cfg.audio.ui_sounds_volume = Math.min(100, Math.max(0, Math.round(volume)));
    await runtime.invoke("save_config", { config: cfg });
    setConfig(cfg);
    setUiSoundsVolume(cfg.audio.ui_sounds_volume);
    refreshUiSoundsFromConfig(cfg);
    if (onLibraryChange) {
      await onLibraryChange();
    }
  } catch {
    // UI sound persistence is best-effort while the backend is unavailable.
  }
};

/** @param {Pick<AudioActionsContext, "config"|"runtime"|"setConfig"|"setAmbientEnabled"|"setAmbientVolume"|"setAmbientPath"|"setAmbientIsFolder"|"setAmbientShuffle"|"refreshUiSoundsFromConfig"|"onLibraryChange">} context Ambient state. @param {AmbientUpdate} partial Ambient fields to update. */
const persistAmbient = async (
  {
    config,
    runtime,
    setConfig,
    setAmbientEnabled,
    setAmbientVolume,
    setAmbientPath,
    setAmbientIsFolder,
    setAmbientShuffle,
    refreshUiSoundsFromConfig,
    onLibraryChange,
  },
  partial
) => {
  try {
    const cfg = await cloneSettingsConfig(
      config,
      async () => await runtime.invoke("get_config")
    );
    cfg.audio = { ...cfg.audio, ...partial };
    await runtime.invoke("save_config", { config: cfg });
    setConfig(cfg);
    const audio = cfg.audio ?? {};
    if (audio.ambient_enabled !== undefined) {
      setAmbientEnabled(audio.ambient_enabled);
    }
    if (audio.ambient_volume !== undefined) {
      setAmbientVolume(audio.ambient_volume);
    }
    setAmbientPath(audio.ambient_path ?? null);
    if (audio.ambient_is_folder !== undefined) {
      setAmbientIsFolder(audio.ambient_is_folder);
    }
    if (audio.ambient_shuffle !== undefined) {
      setAmbientShuffle(audio.ambient_shuffle);
    }
    refreshUiSoundsFromConfig(cfg);
    if (onLibraryChange) {
      await onLibraryChange();
    }
  } catch {
    // Ambient persistence is best-effort while the backend is unavailable.
  }
};

/** @param {{openDialog: import("./settings-runtime").SettingsRuntime["openDialog"], persistAmbient: (partial: AmbientUpdate) => Promise<void>}} context Ambient state. */
const pickAmbientFile = async ({ openDialog, persistAmbient: saveAmbient }) => {
  try {
    const selected = await openDialog({
      filters: [
        {
          extensions: ["mp3", "ogg", "wav", "flac", "m4a", "opus"],
          name: "Audio",
        },
      ],
      multiple: false,
    });
    if (selected === null || selected === "") {
      return;
    }
    await saveAmbient({ ambient_is_folder: false, ambient_path: selected });
  } catch (error) {
    getErrorMessage(error);
  }
};

/** @param {{openDialog: import("./settings-runtime").SettingsRuntime["openDialog"], persistAmbient: (partial: AmbientUpdate) => Promise<void>}} context Ambient state. */
const pickAmbientFolder = async ({
  openDialog,
  persistAmbient: saveAmbient,
}) => {
  try {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected === null || selected === "") {
      return;
    }
    await saveAmbient({ ambient_is_folder: true, ambient_path: selected });
  } catch (error) {
    getErrorMessage(error);
  }
};

/** @param {{persistAmbient: (partial: AmbientUpdate) => Promise<void>}} context Ambient state. */
const clearAmbientSource = async ({ persistAmbient: saveAmbient }) => {
  await saveAmbient({
    ambient_enabled: false,
    ambient_is_folder: false,
    ambient_path: null,
    ambient_shuffle: false,
  });
};

/** @param {AudioActionsContext} context Audio state. */
export const createSettingsAudioActions = (context) => {
  /** @type {(partial: AmbientUpdate) => Promise<void>} */
  const saveAmbient = async (partial) => {
    await persistAmbient(context, partial);
  };
  const clearAmbient = async () => {
    await clearAmbientSource({ persistAmbient: saveAmbient });
  };
  /** @type {(nextDeadzone: number) => Promise<void>} */
  const saveControllerDeadzone = async (nextDeadzone) => {
    await persistControllerDeadzone(context, nextDeadzone);
  };
  /** @type {(nextImmersive: boolean, nextFullscreen: boolean) => Promise<void>} */
  const saveDisplayFlags = async (nextImmersive, nextFullscreen) => {
    await persistDisplayFlags(context, nextImmersive, nextFullscreen);
  };
  /** @param {boolean} nextEnabled Whether RetroAchievements is enabled. */
  const saveRetroAchievements = async (nextEnabled) => {
    await persistRetroAchievements(context, nextEnabled);
  };
  /** @type {(next: boolean) => Promise<void>} */
  const saveUiSounds = async (next) => {
    await persistUiSounds(context, next);
  };
  /** @type {(volume: number) => Promise<void>} */
  const saveUiSoundsVolume = async (volume) => {
    await persistUiSoundsVolume(context, volume);
  };
  const chooseAmbientFile = async () => {
    await pickAmbientFile({
      openDialog: context.runtime.openDialog,
      persistAmbient: saveAmbient,
    });
  };
  const chooseAmbientFolder = async () => {
    await pickAmbientFolder({
      openDialog: context.runtime.openDialog,
      persistAmbient: saveAmbient,
    });
  };
  return {
    clearAmbientSource: clearAmbient,
    persistAmbient: saveAmbient,
    persistControllerDeadzone: saveControllerDeadzone,
    persistDisplayFlags: saveDisplayFlags,
    persistRetroAchievements: saveRetroAchievements,
    persistUiSounds: saveUiSounds,
    persistUiSoundsVolume: saveUiSoundsVolume,
    pickAmbientFile: chooseAmbientFile,
    pickAmbientFolder: chooseAmbientFolder,
  };
};
