import { useRef, useState } from "react";

/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */
/** @typedef {{device_code: string, user_code: string, verification_path?: string, verification_path_complete?: string, expires_in?: number, interval?: number}} RommPairing */
/** @typedef {"checking"|"downloaded-not-synced"|"not-configured"|"offline"|"online"|"remote-only"|"synced"} SyncStatus */

/** @type {{autoSync: boolean, lastSyncedAt: string|null, libraryCount: number|null}} */
export const EMPTY_ROMM_SYNC_METADATA = {
  autoSync: false,
  lastSyncedAt: null,
  libraryCount: null,
};
/** @param {"pairing"|"token"} value Default RomM authentication mode. @returns {"pairing"|"token"} Default RomM authentication mode. */
const getDefaultRommAuthMode = (value) => value;
/** @param {RommPairing|null} value Empty RomM pairing state. @returns {RommPairing|null} Empty RomM pairing state. */
const createEmptyRommPairing = (value) => value;
/** @param {SettingsMessage|null} value Empty RomM status message. @returns {SettingsMessage|null} Empty RomM status message. */
const createEmptyRommStatus = (value) => value;

/** @param {string|undefined} initialUrl Initial RomM URL. @param {string|null} rommToken Saved RomM token. @returns {SyncStatus} Initial connection status. */
const getInitialConnectionStatus = (initialUrl, rommToken) => {
  if (
    initialUrl !== undefined &&
    initialUrl !== "" &&
    rommToken !== null &&
    rommToken !== ""
  ) {
    return "checking";
  }
  return "not-configured";
};

/** @param {{rommToken: string|null, rommUrl?: string}} props RomM connection properties. */
const useSettingsRommState = ({ rommToken, rommUrl: initialUrl }) => {
  const [rommUrl, setRommUrl] = useState(initialUrl ?? "");
  const [rommDirectToken, setRommDirectToken] = useState("");
  const [rommDeviceName, setRommDeviceName] = useState("");
  const [rommAuthMode, setRommAuthMode] = useState(
    getDefaultRommAuthMode("pairing")
  );
  const [rommPairing, setRommPairing] = useState(createEmptyRommPairing(null));
  const pairingAttemptRef = useRef(0);
  const [rommSessionSaved, setRommSessionSaved] = useState(false);
  const initialConnectionStatus = getInitialConnectionStatus(
    initialUrl,
    rommToken
  );
  const [rommConnectionStatus, setRommConnectionStatus] = useState(
    initialConnectionStatus
  );
  const [rommSyncMetadata, setRommSyncMetadata] = useState(
    EMPTY_ROMM_SYNC_METADATA
  );
  const [rommStatus, setRommStatus] = useState(createEmptyRommStatus(null));
  const [rommDisconnectDialogOpen, setRommDisconnectDialogOpen] =
    useState(false);

  return {
    pairingAttemptRef,
    rommAuthMode,
    rommConnectionStatus,
    rommDeviceName,
    rommDirectToken,
    rommDisconnectDialogOpen,
    rommPairing,
    rommSessionSaved,
    rommStatus,
    rommSyncMetadata,
    rommUrl,
    setRommAuthMode,
    setRommConnectionStatus,
    setRommDeviceName,
    setRommDirectToken,
    setRommDisconnectDialogOpen,
    setRommPairing,
    setRommSessionSaved,
    setRommStatus,
    setRommSyncMetadata,
    setRommUrl,
  };
};

export default useSettingsRommState;
