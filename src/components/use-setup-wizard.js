import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { useEffect, useRef, useState } from "react";

import normalizeUrl from "../utils/normalize-url";

/** @type {<T>(command: string, args?: Record<string, unknown>) => Promise<T> & PromiseLike<T>} */
const invoke = tauriInvoke;

/** @typedef {"error"|"info"|"success"} WizardStatusType */
/** @typedef {{message: string, type: WizardStatusType}} WizardStatus */
/** @typedef {{device_code: string, expires_in?: number, interval?: number, user_code: string, verification_path: string, verification_path_complete?: string}} DevicePairing */
/** @typedef {{access_token?: string, status: string}} DeviceAuthResult */
/** @typedef {{platform_id: string}} ScannedGame */
/** @typedef {{[platform: string]: number}} PlatformCounts */
/** @typedef {{platforms: PlatformCounts, total: number}} ScanResult */
/** @typedef {{total: number}} SyncResult */
/** @typedef {{attempt: number, deadline: number, deviceCode: string, intervalMs: number, normalizedUrl: string, onError: (error: Error) => void, onSuccess: (result: DeviceAuthResult) => void, pairingAttemptRef: {current: number}}} DevicePollingOptions */

/**
 * @typedef {object} SetupWizardOptions
 * @property {() => void} onComplete Completes the setup wizard.
 * @property {(url: string, token: string) => void} [onRommConnect] Saves the RomM session.
 */

/** @param {unknown} error - Error value returned by an async command. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {DevicePollingOptions} options Device polling request. */
const pollDeviceAuth = async ({
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

  try {
    /** @type {DeviceAuthResult} */
    const result = await invoke("poll_romm_device_auth", {
      deviceCode,
      serverUrl: normalizedUrl,
    });
    if (result.status === "authorization_pending") {
      setTimeout(() => {
        void pollDeviceAuth({
          attempt,
          deadline,
          deviceCode,
          intervalMs,
          normalizedUrl,
          onError,
          onSuccess,
          pairingAttemptRef,
        });
      }, intervalMs);
      return;
    }
    if (result.status === "slow_down") {
      setTimeout(() => {
        void pollDeviceAuth({
          attempt,
          deadline,
          deviceCode,
          intervalMs: intervalMs + 5000,
          normalizedUrl,
          onError,
          onSuccess,
          pairingAttemptRef,
        });
      }, intervalMs + 5000);
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
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * @param {object} options RomM connection state and callbacks.
 * @param {number} options.attempt Current pairing attempt.
 * @param {{current: number}} options.pairingAttemptRef Pairing cancellation ref.
 * @param {(status: WizardStatus|null) => void} options.setRommStatus Updates pairing status.
 * @param {(pairing: DevicePairing|null) => void} options.setRommPairing Updates pairing details.
 * @param {(connected: boolean) => void} options.setRommConnected Updates connection state.
 * @param {(token: string|null) => void} options.setRommToken Updates the RomM token.
 * @param {(error: string|null) => void} options.setError Updates the setup error.
 * @param {(url: string) => void} options.setRommUrl Updates the RomM URL.
 * @param {string} options.rommUrl RomM server URL.
 * @param {(url: string, token: string) => void} [options.onRommConnect] Reports a successful connection.
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
    const normalizedUrl = normalizeUrl(rommUrl) ?? "";
    setRommUrl(normalizedUrl);
    setRommStatus({ message: "Starting secure RomM pairing...", type: "info" });
    /** @type {DevicePairing} */
    const pairing = await invoke("begin_romm_device_auth", {
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

    const deadline = Date.now() + (pairing.expires_in ?? 600) * 1000;
    setTimeout(
      () => {
        void pollDeviceAuth({
          attempt,
          deadline,
          deviceCode: pairing.device_code,
          intervalMs: Math.max(2, pairing.interval ?? 5) * 1000,
          normalizedUrl,
          onError: (error) => {
            if (pairingAttemptRef.current !== attempt) {
              return;
            }
            setRommPairing(null);
            setRommStatus({ message: getErrorMessage(error), type: "error" });
          },
          onSuccess: (result) => {
            setRommConnected(true);
            setRommToken(result.access_token ?? null);
            setRommPairing(null);
            if (
              result.access_token !== undefined &&
              result.access_token !== ""
            ) {
              onRommConnect?.(normalizedUrl, result.access_token);
            }
            setRommStatus({ message: "Paired successfully!", type: "success" });
          },
          pairingAttemptRef,
        });
      },
      Math.max(2, pairing.interval ?? 5) * 1000
    );
  } catch (error) {
    if (pairingAttemptRef.current !== attempt) {
      return;
    }
    setRommPairing(null);
    setRommStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/**
 * @param {object} options RomM synchronization state and callbacks.
 * @param {string} options.rommUrl RomM server URL.
 * @param {string|null} options.rommToken RomM access token.
 * @param {boolean} options.rommConnected Whether RomM is connected.
 * @param {(busy: boolean) => void} options.setSyncing Updates sync activity.
 * @param {(result: SyncResult|null) => void} options.setSyncResult Updates sync results.
 * @param {(error: string|null) => void} options.setError Updates the setup error.
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
    /** @type {unknown[]} */
    const games = await invoke("sync_romm_library", {
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
 * @param {object} options Directory scan state and callbacks.
 * @param {string} options.romsDir ROM directory to scan.
 * @param {(busy: boolean) => void} options.setScanning Updates scan activity.
 * @param {(result: ScanResult|null) => void} options.setScanResult Updates scan results.
 * @param {(error: string|null) => void} options.setError Updates the setup error.
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
    /** @type {ScannedGame[]} */
    const games = await invoke("scan_directory", {
      path: romsDir,
      recursive: true,
    });
    /** @type {PlatformCounts} */
    const platformCounts = {};
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
 * @param {object} options Setup completion state and callbacks.
 * @param {string} options.rommUrl RomM server URL.
 * @param {boolean} options.rommConnected Whether RomM is connected.
 * @param {string} options.romsDir Selected ROM directory.
 * @param {() => void} options.onComplete Completes setup.
 * @param {(error: string|null) => void} options.setError Updates the setup error.
 */
const finishSetup = async ({
  onComplete,
  rommConnected,
  rommUrl,
  romsDir,
  setError,
}) => {
  try {
    await invoke("complete_setup", {
      rommUrl: rommConnected ? rommUrl : null,
      rommUsername: null,
      romsDirectory: romsDir || null,
    });
    onComplete();
  } catch (error) {
    setError(getErrorMessage(error));
  }
};

/** @returns {DevicePairing|null} Initial RomM pairing. */
const initialRommPairing = () => null;
/** @returns {WizardStatus|null} Initial RomM status. */
const initialRommStatus = () => null;
/** @returns {string|null} Initial RomM token. */
const initialRommToken = () => null;
/** @returns {ScanResult|null} Initial scan result. */
const initialScanResult = () => null;
/** @returns {SyncResult|null} Initial sync result. */
const initialSyncResult = () => null;
/** @returns {string|null} Initial error. */
const initialError = () => null;

const useSetupWizardState = () => {
  const [activeStep, setActiveStep] = useState(-1);
  const [rommUrl, setRommUrl] = useState("");
  const [rommPairing, setRommPairing] = useState(initialRommPairing);
  const pairingAttemptRef = useRef(0);
  const [rommStatus, setRommStatus] = useState(initialRommStatus);
  const [rommConnected, setRommConnected] = useState(false);
  const [rommToken, setRommToken] = useState(initialRommToken);
  const [romsDir, setRomsDir] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(initialScanResult);
  const [syncResult, setSyncResult] = useState(initialSyncResult);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(
    () => () => {
      pairingAttemptRef.current += 1;
    },
    []
  );

  return {
    activeStep,
    error,
    pairingAttemptRef,
    rommConnected,
    rommPairing,
    rommStatus,
    rommToken,
    rommUrl,
    romsDir,
    scanResult,
    scanning,
    setActiveStep,
    setError,
    setRommConnected,
    setRommPairing,
    setRommStatus,
    setRommToken,
    setRommUrl,
    setRomsDir,
    setScanResult,
    setScanning,
    setSyncResult,
    setSyncing,
    syncResult,
    syncing,
  };
};

/** @param {ReturnType<typeof useSetupWizardState>} state Wizard state. @param {SetupWizardOptions} options Wizard callbacks. */
const useSetupWizardHandlers = (state, { onComplete, onRommConnect }) => {
  const handleConnectRomM = () => {
    const attempt = state.pairingAttemptRef.current + 1;
    state.pairingAttemptRef.current = attempt;
    void connectRomM({
      attempt,
      onRommConnect,
      pairingAttemptRef: state.pairingAttemptRef,
      rommUrl: state.rommUrl,
      setError: state.setError,
      setRommConnected: state.setRommConnected,
      setRommPairing: state.setRommPairing,
      setRommStatus: state.setRommStatus,
      setRommToken: state.setRommToken,
      setRommUrl: state.setRommUrl,
    });
  };
  const handleSyncRomM = () => {
    void syncRomM({
      rommConnected: state.rommConnected,
      rommToken: state.rommToken,
      rommUrl: state.rommUrl,
      setError: state.setError,
      setSyncResult: state.setSyncResult,
      setSyncing: state.setSyncing,
    });
  };
  const handleSelectFolder = () => {
    void (async () => {
      try {
        const selected = await open({ directory: true, multiple: false });
        if (selected !== null && selected !== "" && !Array.isArray(selected)) {
          state.setRomsDir(selected);
        }
      } catch (error) {
        state.setError(getErrorMessage(error));
      }
    })();
  };
  const handleScan = () => {
    void scanDirectory({
      romsDir: state.romsDir,
      setError: state.setError,
      setScanResult: state.setScanResult,
      setScanning: state.setScanning,
    });
  };
  const handleFinish = () => {
    void finishSetup({
      onComplete,
      rommConnected: state.rommConnected,
      rommUrl: state.rommUrl,
      romsDir: state.romsDir,
      setError: state.setError,
    });
  };
  const handleNext = () => {
    state.setActiveStep((previous) => previous + 1);
    state.setError(null);
  };
  const handleBack = () => {
    state.setActiveStep((previous) => previous - 1);
    state.setError(null);
  };

  return {
    handleBack,
    handleConnectRomM,
    handleFinish,
    handleNext,
    handleScan,
    handleSelectFolder,
    handleSyncRomM,
    onCancelPairing: () => {
      state.pairingAttemptRef.current += 1;
      state.setRommPairing(null);
      state.setRommStatus(null);
    },
  };
};

/** @param {SetupWizardOptions} options Setup wizard options. */
export const useSetupWizard = (options) => {
  const state = useSetupWizardState();
  return {
    activeStep: state.activeStep,
    error: state.error,
    ...useSetupWizardHandlers(state, options),
    rommConnected: state.rommConnected,
    rommPairing: state.rommPairing,
    rommStatus: state.rommStatus,
    rommUrl: state.rommUrl,
    romsDir: state.romsDir,
    scanResult: state.scanResult,
    scanning: state.scanning,
    setError: state.setError,
    setRommUrl: state.setRommUrl,
    setRomsDir: state.setRomsDir,
    syncResult: state.syncResult,
    syncing: state.syncing,
  };
};
