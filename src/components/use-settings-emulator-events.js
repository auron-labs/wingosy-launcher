import { useEffect } from "react";

/** @typedef {{emulator_id: string|number, filename?: string|null, phase?: string, downloaded?: number, total?: number|null, percent?: number|null}} EmulatorInstallEvent */
/** @typedef {{downloaded: number, total: number|null, percent: number|null, filename?: string, phase?: "pending"|"download"|"extract"}} EmulatorInstallProgress */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */
/** @param {{runtime: import("./settings-runtime").SettingsRuntime, setEmuInstallProgress: SettingsSetter<Record<string|number, EmulatorInstallProgress>>}} context Emulator progress state. */
const useSettingsEmulatorEvents = ({ runtime, setEmuInstallProgress }) => {
  useEffect(() => {
    let cancelled = false;
    /** @type {Array<() => void>} */
    const unlisteners = [];
    /** @param {string} eventName Event name. @param {(event: import("@tauri-apps/api/event").Event<EmulatorInstallEvent>) => void} handler Event handler. */
    const listen = async (eventName, handler) => {
      const unlisten = await runtime.listen(eventName, handler);
      if (cancelled) {
        unlisten();
        return;
      }
      unlisteners.push(unlisten);
    };
    /** @param {import("@tauri-apps/api/event").Event<EmulatorInstallEvent>} event Install event. */
    const handleStarted = (event) => {
      const { emulator_id, filename } = event.payload;
      /** @type {EmulatorInstallProgress} */
      const progress = {
        downloaded: 0,
        filename: filename ?? "",
        percent: null,
        phase: "download",
        total: null,
      };
      setEmuInstallProgress((previous) => ({
        ...previous,
        [emulator_id]: progress,
      }));
    };
    /** @param {import("@tauri-apps/api/event").Event<EmulatorInstallEvent>} event Install event. */
    const handleProgress = (event) => {
      const { emulator_id, phase, downloaded, total, percent } = event.payload;
      setEmuInstallProgress((previous) => {
        /** @type {EmulatorInstallProgress} */
        const progress = {
          ...(previous[emulator_id] ?? {
            downloaded: 0,
            percent: null,
            phase: "pending",
            total: null,
          }),
          downloaded: downloaded ?? previous[emulator_id]?.downloaded ?? 0,
          percent: percent ?? null,
          phase: phase === "extract" ? "extract" : "download",
          total: total ?? null,
        };
        return {
          ...previous,
          [emulator_id]: progress,
        };
      });
    };
    /** @param {import("@tauri-apps/api/event").Event<EmulatorInstallEvent>} event Install event. */
    const handleFinished = (event) => {
      const { emulator_id } = event.payload;
      setEmuInstallProgress((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([id]) => id !== String(emulator_id))
        )
      );
    };
    void listen("emulator-download-started", handleStarted);
    void listen("emulator-download-progress", handleProgress);
    void listen("emulator-download-complete", handleFinished);
    void listen("emulator-download-error", handleFinished);
    return () => {
      cancelled = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [runtime, setEmuInstallProgress]);
};

export default useSettingsEmulatorEvents;
