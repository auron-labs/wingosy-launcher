import { useState } from "react";

/** @typedef {{current_version: string, latest_version: string|null, release_url: string|null, signed_update_manifest_url: string|null, is_update_available: boolean, channel: "stable"|"beta"|"nightly", error?: string}} UpdateCheckResult */
/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */

/** @param {SettingsMessage|null} value Initial settings message. @returns {SettingsMessage|null} Initial settings message. */
const createEmptySettingsMessage = (value) => value;
/** @param {UpdateCheckResult|null} value Initial update result. @returns {UpdateCheckResult|null} Initial update result. */
const createEmptyUpdateResult = (value) => value;
/** @param {"nightly"|"beta"|null} value Initial prerelease channel. @returns {"nightly"|"beta"|null} Initial prerelease channel. */
const createEmptyPrereleaseChannel = (value) => value;
/** @param {"stable"|"beta"|"nightly"} value Default update channel. @returns {"stable"|"beta"|"nightly"} Default update channel. */
const getDefaultUpdateChannel = (value) => value;

/** @param {{initialSection: string}} props Initial settings section. */
const useSettingsUpdateState = ({ initialSection }) => {
  const [settingsSection, setSettingsSection] = useState(initialSection);
  const [appVersion, setAppVersion] = useState("");
  const [supportMessage, setSupportMessage] = useState(
    createEmptySettingsMessage(null)
  );
  const [updatePreference, setUpdatePreference] = useState("off");
  const [updateChannel, setUpdateChannel] = useState(
    getDefaultUpdateChannel("stable")
  );
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState(
    createEmptyUpdateResult(null)
  );
  const [updateMessage, setUpdateMessage] = useState(
    createEmptySettingsMessage(null)
  );
  const [signedUpdateInstalling, setSignedUpdateInstalling] = useState(false);
  const [prereleaseLeaveDialogOpen, setPrereleaseLeaveDialogOpen] =
    useState(false);
  const [leavingPrereleaseChannel, setLeavingPrereleaseChannel] = useState(
    createEmptyPrereleaseChannel(null)
  );
  const [pendingChannel, setPendingChannel] = useState(
    getDefaultUpdateChannel("stable")
  );

  return {
    appVersion,
    leavingPrereleaseChannel,
    pendingChannel,
    prereleaseLeaveDialogOpen,
    setAppVersion,
    setLeavingPrereleaseChannel,
    setPendingChannel,
    setPrereleaseLeaveDialogOpen,
    setSettingsSection,
    setSignedUpdateInstalling,
    setSupportMessage,
    setUpdateChannel,
    setUpdateCheckLoading,
    setUpdateCheckResult,
    setUpdateMessage,
    setUpdatePreference,
    settingsSection,
    signedUpdateInstalling,
    supportMessage,
    updateChannel,
    updateCheckLoading,
    updateCheckResult,
    updateMessage,
    updatePreference,
  };
};

export default useSettingsUpdateState;
