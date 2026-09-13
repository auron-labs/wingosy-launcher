import { useState } from "react";

/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */

/** @param {import("./settings-types").SettingsConfig|null} value Initial settings configuration. @returns {import("./settings-types").SettingsConfig|null} Initial settings configuration. */
const createEmptyConfig = (value) => value;
/** @param {SettingsMessage|null} value Initial settings message. @returns {SettingsMessage|null} Initial settings message. */
const createEmptySettingsMessage = (value) => value;
/** @param {string|null} value Initial ambient source path. @returns {string|null} Initial ambient source path. */
const createEmptyAmbientPath = (value) => value;

const useSettingsCoreState = () => {
  const [config, setConfig] = useState(createEmptyConfig(null));
  const [scanMessage, setScanMessage] = useState(
    createEmptySettingsMessage(null)
  );
  const [immersiveModeEnabled, setImmersiveModeEnabled] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [controllerDeadzone, setControllerDeadzone] = useState(0.35);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [ambientVolume, setAmbientVolume] = useState(35);
  const [ambientPath, setAmbientPath] = useState(createEmptyAmbientPath(null));
  const [ambientIsFolder, setAmbientIsFolder] = useState(false);
  const [ambientShuffle, setAmbientShuffle] = useState(false);

  return {
    ambientEnabled,
    ambientIsFolder,
    ambientPath,
    ambientShuffle,
    ambientVolume,
    config,
    controllerDeadzone,
    fullscreenEnabled,
    immersiveModeEnabled,
    scanMessage,
    setAmbientEnabled,
    setAmbientIsFolder,
    setAmbientPath,
    setAmbientShuffle,
    setAmbientVolume,
    setConfig,
    setControllerDeadzone,
    setFullscreenEnabled,
    setImmersiveModeEnabled,
    setScanMessage,
  };
};

export default useSettingsCoreState;
