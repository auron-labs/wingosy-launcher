import { useEffect, useRef } from "react";

/** @param {Record<string, string|number>} previous Platform defaults. @param {string} platformId Platform identifier. @returns {Record<string, string|number>} Defaults without the platform. */
const removePlatformDefault = (previous, platformId) =>
  Object.fromEntries(
    Object.entries(previous).filter(([id]) => id !== platformId)
  );

/** @param {string} platformId Platform identifier. @param {() => boolean} isCancelled Cancellation check. @param {(value: Record<string, string|number> | ((previous: Record<string, string|number>) => Record<string, string|number>)) => void} setPlatformDefaults Platform defaults setter. @param {import("./settings-runtime").SettingsRuntime} runtime Runtime dependencies. */
const clearPlatformDefault = async (
  platformId,
  isCancelled,
  setPlatformDefaults,
  runtime
) => {
  try {
    await runtime.invoke("set_platform_default_emulator", {
      emulatorId: null,
      platformId,
    });
    if (!isCancelled()) {
      setPlatformDefaults((previous) =>
        removePlatformDefault(previous, platformId)
      );
    }
  } catch {
    // A missing core should not prevent the settings screen from loading.
  }
};

/** @param {{actions: {loadConfig: () => Promise<void>, loadEmulators: () => Promise<void>, loadMissingCores: () => Promise<void>, loadPlatformDefaults: () => Promise<void>, loadPlatforms: () => Promise<void>}, platformDefaults: Record<string, string|number>, retroarchCoreReadyPlatformIds: string[], runtime: import("./settings-runtime").SettingsRuntime, setPlatformDefaults: (value: Record<string, string|number> | ((previous: Record<string, string|number>) => Record<string, string|number>)) => void, setAppVersion: (value: string) => void, setRommDeviceName: (value: string) => void, pairingAttemptRef: {current: number}}} context Settings lifecycle dependencies. */
const useSettingsLifecycle = ({
  actions,
  platformDefaults,
  retroarchCoreReadyPlatformIds,
  runtime,
  setPlatformDefaults,
  setAppVersion,
  setRommDeviceName,
  pairingAttemptRef,
}) => {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    void Promise.all([
      actions.loadConfig(),
      actions.loadEmulators(),
      actions.loadMissingCores(),
      actions.loadPlatformDefaults(),
      actions.loadPlatforms(),
    ]);
  }, [actions]);

  useEffect(() => {
    let cancelled = false;
    const toClear = Object.entries(platformDefaults).filter(
      ([platformId, emulatorId]) =>
        emulatorId === "retroarch" &&
        !retroarchCoreReadyPlatformIds.includes(platformId)
    );
    if (toClear.length > 0) {
      void Promise.all(
        toClear.map(async ([platformId]) => {
          await clearPlatformDefault(
            platformId,
            () => cancelled,
            setPlatformDefaults,
            runtime
          );
        })
      );
    }
    return () => {
      cancelled = true;
    };
  }, [
    platformDefaults,
    retroarchCoreReadyPlatformIds,
    runtime,
    setPlatformDefaults,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        /** @type {string} */
        const version = await runtime.invoke("get_app_version");
        setAppVersion(version);
      } catch {
        setAppVersion("");
      }
    })();
  }, [runtime, setAppVersion]);

  useEffect(() => {
    void (async () => {
      try {
        /** @type {string} */
        const name = await runtime.invoke("get_default_romm_device_name");
        setRommDeviceName(name);
      } catch {
        setRommDeviceName("Windows PC");
      }
    })();
  }, [runtime, setRommDeviceName]);

  useEffect(
    () => () => {
      pairingAttemptRef.current += 1;
    },
    [pairingAttemptRef]
  );
};

export default useSettingsLifecycle;
