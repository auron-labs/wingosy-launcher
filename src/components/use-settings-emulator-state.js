import { useRef, useState } from "react";

/** @typedef {{id: string|number, name: string, display_name?: string, install_type?: string, installed_path?: string|null, is_installed?: boolean, has_download?: boolean, version?: string|null, supported_platforms: string[], download_size_bytes?: number|null}} SettingsEmulator */
/** @typedef {{platform_id: string, platform_name: string, core_filename: string, required?: boolean, status?: string, emulators?: SettingsEmulator[]}} MissingCore */
/** @typedef {{platform_id: string, platform_name?: string, core_filename?: string, is_installed?: boolean, has_download?: boolean, installed_path?: string|null, required?: boolean, status?: string}} CoreInventory */
/** @typedef {{device_id: string, guid: string, name: string, configured?: boolean, platform_name?: string}} NativeController */
/** @typedef {{downloaded: number, total: number|null, percent: number|null, filename?: string, phase?: "pending"|"download"|"extract"}} EmulatorInstallProgress */
/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}|null} EmulatorMessage */

/** @type {SettingsEmulator[]} */
const EMPTY_EMULATORS = [];
/** @type {Record<string, string>} */
const EMPTY_CORE_DLLS = {};
/** @type {string[]} */
const EMPTY_PLATFORM_IDS = [];
/** @type {CoreInventory[]} */
const EMPTY_CORE_INVENTORY = [];
/** @type {Record<string|number, EmulatorInstallProgress>} */
const EMPTY_INSTALL_PROGRESS = {};
/** @type {MissingCore[]} */
const EMPTY_MISSING_CORES = [];
/** @param {string|null} value Initial optional string value. @returns {string|null} Initial optional string value. */
const createEmptyStringValue = (value) => value;
/** @param {EmulatorMessage} value Initial emulator message. @returns {EmulatorMessage} Initial emulator message. */
const createEmptyEmulatorMessage = (value) => value;
/** @param {HTMLElement|null} value Initial menu anchor. @returns {HTMLElement|null} Initial menu anchor. */
const createEmptyMenuAnchor = (value) => value;
/** @param {SettingsEmulator|null} value Initial selected emulator. @returns {SettingsEmulator|null} Initial selected emulator. */
const createEmptySelectedEmulator = (value) => value;
/** @param {string|number|null} value Initial expanded emulator identifier. @returns {string|number|null} Initial expanded emulator identifier. */
const createEmptyExpandedEmulator = (value) => value;
/** @type {NativeController[]} */
const EMPTY_NATIVE_CONTROLLERS = [];
/** @type {Record<string, string|number>} */
const EMPTY_PLATFORM_DEFAULTS = {};
/** @type {[{id: string, name: string}, number][]} */
const EMPTY_PLATFORMS = [];

const useSettingsEmulatorState = () => {
  const [emulators, setEmulators] = useState(EMPTY_EMULATORS);
  const [retroarchCoreDllByPlatform, setRetroarchCoreDllByPlatform] =
    useState(EMPTY_CORE_DLLS);
  const [retroarchCoreReadyPlatformIds, setRetroarchCoreReadyPlatformIds] =
    useState(EMPTY_PLATFORM_IDS);
  const [retroarchCoreInventory, setRetroarchCoreInventory] =
    useState(EMPTY_CORE_INVENTORY);
  const [emuInstallProgress, setEmuInstallProgress] = useState(
    EMPTY_INSTALL_PROGRESS
  );
  /** @type {import("react").RefObject<Set<string|number>>} */
  const emuDownloadInflightRef = useRef(new Set());
  const [missingCores, setMissingCores] = useState(EMPTY_MISSING_CORES);
  const [downloadingCore, setDownloadingCore] = useState(
    createEmptyStringValue(null)
  );
  const [emuMessage, setEmuMessage] = useState(
    createEmptyEmulatorMessage(null)
  );
  const [emuMenuAnchor, setEmuMenuAnchor] = useState(
    createEmptyMenuAnchor(null)
  );
  const [selectedEmu, setSelectedEmu] = useState(
    createEmptySelectedEmulator(null)
  );
  const [expandedEmu, setExpandedEmu] = useState(
    createEmptyExpandedEmulator(null)
  );
  const [nativeControllers, setNativeControllers] = useState(
    EMPTY_NATIVE_CONTROLLERS
  );
  const [nativeControllerLoading, setNativeControllerLoading] = useState(false);
  const [nativeControllerCapture, setNativeControllerCapture] = useState(
    createEmptyStringValue(null)
  );
  const [nativeControllerMessage, setNativeControllerMessage] = useState(
    createEmptyEmulatorMessage(null)
  );
  const [platformDefaults, setPlatformDefaults] = useState(
    EMPTY_PLATFORM_DEFAULTS
  );
  const [platforms, setPlatforms] = useState(EMPTY_PLATFORMS);

  return {
    downloadingCore,
    emuDownloadInflightRef,
    emuInstallProgress,
    emuMenuAnchor,
    emuMessage,
    emulators,
    expandedEmu,
    missingCores,
    nativeControllerCapture,
    nativeControllerLoading,
    nativeControllerMessage,
    nativeControllers,
    platformDefaults,
    platforms,
    retroarchCoreDllByPlatform,
    retroarchCoreInventory,
    retroarchCoreReadyPlatformIds,
    selectedEmu,
    setDownloadingCore,
    setEmuInstallProgress,
    setEmuMenuAnchor,
    setEmuMessage,
    setEmulators,
    setExpandedEmu,
    setMissingCores,
    setNativeControllerCapture,
    setNativeControllerLoading,
    setNativeControllerMessage,
    setNativeControllers,
    setPlatformDefaults,
    setPlatforms,
    setRetroarchCoreDllByPlatform,
    setRetroarchCoreInventory,
    setRetroarchCoreReadyPlatformIds,
    setSelectedEmu,
  };
};

export default useSettingsEmulatorState;
