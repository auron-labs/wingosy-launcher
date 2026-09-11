import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useEffect, useRef, useState } from "react";

import normalizeUrl from "../utils/normalizeUrl";

/** @typedef {"error"|"info"|"success"} WizardStatusType */
/** @typedef {{message: string, type: WizardStatusType}} WizardStatus */
/** @typedef {{device_code: string, expires_in?: number, interval?: number, user_code: string, verification_path: string, verification_path_complete?: string}} DevicePairing */
/** @typedef {{access_token?: string, status: string}} DeviceAuthResult */
/** @typedef {{platform_id: string}} ScannedGame */
/** @typedef {{[platform: string]: number}} PlatformCounts */
/** @typedef {{platforms: PlatformCounts, total: number}} ScanResult */
/** @typedef {{total: number}} SyncResult */

/**
 * @typedef {object} SetupWizardOptions
 * @property {() => void} onComplete
 * @property {(url: string, token: string) => void} [onRommConnect]
 */

/** @param {unknown} error - Error value returned by an async command. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * @param {object} options - Device polling options.
 * @param {number} options.attempt - Current pairing attempt.
 * @param {number} options.deadline - Pairing expiry timestamp.
 * @param {number} options.intervalMs - Delay before the next poll.
 * @param {string} options.normalizedUrl - Normalized RomM server URL.
 * @param {React.RefObject<number>} options.pairingAttemptRef - Cancellation ref.
 * @param {string} options.deviceCode - RomM device code.
 * @param {(result: DeviceAuthResult) => void} options.onSuccess - Successful auth callback.
 * @param {(error: Error) => void} options.onError - Failed auth callback.
 */
const pollDeviceAuth = ({
  attempt,
  deadline,
  deviceCode,
  intervalMs,
  normalizedUrl,
  onError,
  onSuccess,
  pairingAttemptRef,
}) => {
  if (pairingAttemptRef.current !== attempt) {
    return;
  }
  if (Date.now() >= deadline) {
    onError(new Error("RomM pairing expired. Try again."));
    return;
  }

  setTimeout(() => {
    if (pairingAttemptRef.current !== attempt) {
      return;
    }
    void invoke<DeviceAuthResult>("poll_romm_device_auth", {
      deviceCode,
      serverUrl: normalizedUrl,
    })
      .then((result) => {
        if (result.status === "authorization_pending") {
          pollDeviceAuth({
            attempt,
            deadline,
            deviceCode,
            intervalMs,
            normalizedUrl,
            onError,
            onSuccess,
            pairingAttemptRef,
          });
          return;
        }
        if (result.status === "slow_down") {
          pollDeviceAuth({
            attempt,
            deadline,
            deviceCode,
            intervalMs: intervalMs + 5000,
            normalizedUrl,
            onError,
            onSuccess,
            pairingAttemptRef,
          });
          return;
        }
        if (
          result.status !== "approved" ||
          result.access_token === undefined ||
          result.access_token === ""
        ) {
          onError(
            new Error(
              result.status === "access_denied"
                ? "RomM pairing was denied."
                : "RomM pairing expired. Try again."
            )
          );
          return;
        }
        onSuccess(result);
      })
      .catch((error) => {
        onError(error instanceof Error ? error : new Error(String(error)));
      });
  }, intervalMs);
};

/**
 * @param {object} options
 * @param {number} options.attempt
 * @param {React.MutableRefObject<number>} options.pairingAttemptRef
 * @param {(status: WizardStatus|null) => void} options.setRommStatus
 * @param {(pairing: DevicePairing|null) => void} options.setRommPairing
 * @param {(connected: boolean) => void} options.setRommConnected
 * @param {(token: string|null) => void} options.setRommToken
 * @param {(error: string|null) => void} options.setError
 * @param {(url: string) => void} options.setRommUrl
 * @param {string} options.rommUrl
 * @param {(url: string, token: string) => void} [options.onRommConnect]
 */
const connectRomM = async ({
  attempt,
  onRommConnect,
  pairingAttemptRef,
  rommUrl,
  setError,
  setRommConnected,
  setRommPairing,
  setRommStatus,
  setRommToken,
  setRommUrl,
}) => {
  try {
    setError(null);
    const normalizedUrl = normalizeUrl(rommUrl);
    setRommUrl(normalizedUrl);
    setRommStatus({ message: "Starting secure RomM pairing...", type: "info" });
    const pairing = await invoke<DevicePairing>("begin_romm_device_auth", {
      serverUrl: normalizedUrl,
    });
    if (pairingAttemptRef.current !== attempt) {
      return;
    }
    setRommPairing(pairing);
    setRommStatus({
      message: `Approve Wingosy in RomM. Pairing code: ${pairing.user_code}`,
      type: "info",
    });
    await shellOpen(
      pairing.verification_path_complete ?? pairing.verification_path
    );

    const deadline = Date.now() + Number(pairing.expires_in ?? 600) * 1000;
    pollDeviceAuth({
      attempt,
      deadline,
      deviceCode: pairing.device_code,
      intervalMs: Math.max(2, Number(pairing.interval ?? 5)) * 1000,
      normalizedUrl,
      onError: (error) => {
        if (pairingAttemptRef.current !== attempt) {
          return;
        }
        setRommPairing(null);
        setRommStatus({ type: "error", message: getErrorMessage(error) });
      },
      onSuccess: (result) => {
        setRommConnected(true);
        setRommToken(result.access_token ?? null);
        setRommPairing(null);
        if (result.access_token !== undefined && result.access_token !== "") {
          onRommConnect?.(normalizedUrl, result.access_token);
        }
        setRommStatus({ message: "Paired successfully!", type: "success" });
      },
      pairingAttemptRef,
    });
  } catch (error) {
    if (pairingAttemptRef.current !== attempt) {
      return;
    }
    setRommPairing(null);
    setRommStatus({ type: "error", message: getErrorMessage(error) });
  }
};

/**
 * @param {object} options
 * @param {string} options.rommUrl
 * @param {string|null} options.rommToken
 * @param {boolean} options.rommConnected
 * @param {(busy: boolean) => void} options.setSyncing
 * @param {(result: SyncResult|null) => void} options.setSyncResult
 * @param {(error: string|null) => void} options.setError
 */
const syncRomM = async ({
  rommConnected,
  rommToken,
  rommUrl,
  setError,
  setSyncResult,
  setSyncing,
}) => {
  if (rommUrl === "") {
    return;
  }
  try {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    if (!rommConnected) {
      throw new Error("Pair Wingosy with RomM before syncing.");
    }
    const games = await invoke<unknown[]>("sync_romm_library", {
      serverUrl: normalizeUrl(rommUrl),
      token: rommToken,
    });
    setSyncResult({ total: games.length });
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setSyncing(false);
  }
};

/**
 * @param {object} options
 * @param {string} options.romsDir
 * @param {(busy: boolean) => void} options.setScanning
 * @param {(result: ScanResult|null) => void} options.setScanResult
 * @param {(error: string|null) => void} options.setError
 */
const scanDirectory = async ({
  romsDir,
  setError,
  setScanResult,
  setScanning,
}) => {
  if (romsDir === "") {
    return;
  }
  try {
    setScanning(true);
    setScanResult(null);
    setError(null);
    const games = await invoke<ScannedGame[]>("scan_directory", {
      path: romsDir,
      recursive: true,
    });
    const platformCounts = /** @type {PlatformCounts} */ ({});
    for (const game of games) {
      platformCounts[game.platform_id] =
        (platformCounts[game.platform_id] ?? 0) + 1;
    }
    setScanResult({ platforms: platformCounts, total: games.length });
  } catch (error) {
    setError(getErrorMessage(error));
  } finally {
    setScanning(false);
  }
};

/**
 * @param {object} options
 * @param {string} options.rommUrl
 * @param {boolean} options.rommConnected
 * @param {string} options.romsDir
 * @param {() => void} options.onComplete
 * @param {(error: string|null) => void} options.setError
 */
const finishSetup = async ({
  onComplete,
  rommConnected,
  rommUrl,
  romsDir,
  setError,
}) => {
  try {
      await invoke<void>("complete_setup", {
      rommUrl: rommConnected ? rommUrl : null,
      rommUsername: null,
      romsDirectory: romsDir || null,
    });
    onComplete();
  } catch (error) {
    setError(getErrorMessage(error));
  }
};

/** @param {SetupWizardOptions} options */
export const useSetupWizard = ({ onComplete, onRommConnect }) => {
  const [activeStep, setActiveStep] = useState(-1);
  const [rommUrl, setRommUrl] = useState("");
  const [rommPairing, setRommPairing] = useState(
    /** @type {DevicePairing|null} */ (null)
  );
  const pairingAttemptRef = useRef(0);
  const [rommStatus, setRommStatus] = useState(
    /** @type {WizardStatus|null} */ (null)
  );
  const [rommConnected, setRommConnected] = useState(false);
  const [rommToken, setRommToken] = useState(/** @type {string|null} */ (null));
  const [romsDir, setRomsDir] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(
    /** @type {ScanResult|null} */ (null)
  );
  const [syncResult, setSyncResult] = useState(
    /** @type {SyncResult|null} */ (null)
  );
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  useEffect(
    () => () => {
      pairingAttemptRef.current += 1;
    },
    []
  );

  const handleConnectRomM = () => {
    const attempt = pairingAttemptRef.current + 1;
    pairingAttemptRef.current = attempt;
    void connectRomM({
      attempt,
      onRommConnect,
      pairingAttemptRef,
      rommUrl,
      setError,
      setRommConnected,
      setRommPairing,
      setRommStatus,
      setRommToken,
      setRommUrl,
    });
  };
  const handleSyncRomM = () => {
    void syncRomM({
      rommConnected,
      rommToken,
      rommUrl,
      setError,
      setSyncResult,
      setSyncing,
    });
  };
  const handleSelectFolder = () => {
    void (async () => {
      try {
        const selected = await open({ directory: true, multiple: false });
        if (selected) {
          setRomsDir(selected);
        }
      } catch (error) {
        setError(getErrorMessage(error));
      }
    })();
  };
  const handleScan = () => {
    void scanDirectory({ romsDir, setError, setScanResult, setScanning });
  };
  const handleFinish = () => {
    void finishSetup({
      onComplete,
      rommConnected,
      rommUrl,
      romsDir,
      setError,
    });
  };
  const handleNext = () => {
    setActiveStep((previous) => previous + 1);
    setError(null);
  };
  const handleBack = () => {
    setActiveStep((previous) => previous - 1);
    setError(null);
  };

  return {
    activeStep,
    error,
    handleBack,
    handleConnectRomM,
    handleFinish,
    handleNext,
    handleScan,
    handleSelectFolder,
    handleSyncRomM,
    onCancelPairing: () => {
      pairingAttemptRef.current += 1;
      setRommPairing(null);
      setRommStatus(null);
    },
    rommConnected,
    rommPairing,
    rommStatus,
    rommUrl,
    romsDir,
    scanResult,
    scanning,
    setError,
    setRommUrl,
    setRomsDir,
    syncResult,
    syncing,
  };
};
