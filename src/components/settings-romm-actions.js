import normalizeUrl from "../utils/normalize-url";

/** @typedef {{device_code: string, user_code: string, verification_path?: string, verification_path_complete?: string, expires_in?: number, interval?: number}} RommPairing */
/** @typedef {{status: string, access_token?: string}} RommPollResult */
/** @typedef {{type: "error"|"warning"|"info"|"success", message: string}} SettingsMessage */
/** @typedef {"checking"|"downloaded-not-synced"|"not-configured"|"offline"|"online"|"remote-only"|"synced"} SyncStatus */
/** @typedef {{autoSync: boolean, lastSyncedAt: string|null, libraryCount: number|null}} RommSyncMetadata */
/** @typedef {{pairingAttemptRef: {current: number}, rommUrl: string, rommToken: string|null, runtime: import("./settings-runtime").SettingsRuntime, rommAuthMode: "pairing"|"token", rommDeviceName: string, rommDirectToken: string, rommSessionSaved: boolean, rommConnectionStatus: SyncStatus, setRommUrl: SettingsSetter<string>, setRommPairing: SettingsSetter<RommPairing|null>, setRommStatus: SettingsSetter<SettingsMessage|null>, setRommSessionSaved: SettingsSetter<boolean>, setRommConnectionStatus: SettingsSetter<SyncStatus>, setRommSyncMetadata: SettingsSetter<RommSyncMetadata>, setRommDirectToken: SettingsSetter<string>, onRommConnect?: (url: string, token: string) => void, onRommDisconnect?: (() => void)|null}} RommActionsContext */
/** @template T @typedef {(value: T | ((previous: T) => T)) => void} SettingsSetter */

/** @param {unknown} error Error from a RomM operation. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {Pick<RommActionsContext, "rommUrl"|"rommToken"|"runtime"|"setRommConnectionStatus"|"setRommSessionSaved"|"setRommSyncMetadata"|"setRommDirectToken"|"setRommStatus"|"onRommDisconnect">} context RomM state. */
export const checkRommConnection = async ({
  rommUrl,
  rommToken,
  runtime,
  setRommConnectionStatus,
  setRommSessionSaved,
  setRommSyncMetadata,
  setRommDirectToken,
  setRommStatus,
  onRommDisconnect,
}) => {
  if (rommUrl === "" || rommToken === null || rommToken === "") {
    setRommConnectionStatus("not-configured");
    return;
  }
  setRommConnectionStatus("checking");
  try {
    /** @type {"online"|"offline"|"not-configured"|"unauthorized"} */
    const status = await runtime.invoke("check_romm_connection", {
      serverUrl: rommUrl,
      token: rommToken,
    });
    if (status === "unauthorized") {
      await runtime.invoke("disconnect_romm");
      setRommSessionSaved(false);
      setRommConnectionStatus("not-configured");
      setRommSyncMetadata({
        autoSync: false,
        lastSyncedAt: null,
        libraryCount: null,
      });
      setRommDirectToken("");
      onRommDisconnect?.();
      setRommStatus({
        message:
          "RomM no longer accepts this session, so Wingosy disconnected automatically.",
        type: "info",
      });
      return;
    }
    /** @type {SyncStatus} */
    let nextStatus = "offline";
    if (status === "online") {
      nextStatus = "online";
    } else if (status === "not-configured") {
      nextStatus = "not-configured";
    }
    setRommConnectionStatus(nextStatus);
  } catch {
    setRommConnectionStatus("offline");
  }
};

/** @param {{pairing: RommPairing, attempt: number, deadline: number, intervalMs: number, pairingAttemptRef: {current: number}, runtime: import("./settings-runtime").SettingsRuntime, setRommSessionSaved: SettingsSetter<boolean>, setRommConnectionStatus: SettingsSetter<string>, setRommPairing: SettingsSetter<RommPairing|null>, setRommStatus: SettingsSetter<object|null>, onRommConnect?: (url: string, token: string) => void, normalizedUrl: string}} context Pairing state. */
const schedulePairingPoll = (context) => {
  const poll = async () => {
    const {
      attempt,
      deadline,
      intervalMs,
      pairing,
      pairingAttemptRef,
      runtime,
      normalizedUrl,
      setRommConnectionStatus,
      setRommPairing,
      setRommSessionSaved,
      setRommStatus,
      onRommConnect,
    } = context;
    if (pairingAttemptRef.current !== attempt) {
      return;
    }
    if (Date.now() >= deadline) {
      setRommPairing(null);
      setRommStatus({
        message: "RomM pairing expired. Try again.",
        type: "error",
      });
      return;
    }
    try {
      /** @type {RommPollResult} */
      const result = await runtime.invoke("poll_romm_device_auth", {
        deviceCode: pairing.device_code,
        serverUrl: normalizedUrl,
      });
      if (result.status === "authorization_pending") {
        window.setTimeout(() => {
          schedulePairingPoll({ ...context, intervalMs });
        }, intervalMs);
        return;
      }
      if (result.status === "slow_down") {
        window.setTimeout(() => {
          schedulePairingPoll({
            ...context,
            intervalMs: intervalMs + 5000,
          });
        }, intervalMs);
        return;
      }
      if (
        result.status === "approved" &&
        result.access_token !== undefined &&
        result.access_token !== ""
      ) {
        onRommConnect?.(normalizedUrl, result.access_token);
        setRommSessionSaved(true);
        setRommConnectionStatus("online");
        setRommPairing(null);
        setRommStatus({
          message:
            "Wingosy is paired with RomM. Click 'Sync Library' to pull your games.",
          type: "success",
        });
        return;
      }
      let message = `RomM pairing failed: ${result.status}`;
      if (result.status === "access_denied") {
        message = "RomM pairing was denied.";
      } else if (result.status === "expired_token") {
        message = "RomM pairing expired. Try again.";
      }
      throw new Error(message);
    } catch (error) {
      if (pairingAttemptRef.current !== attempt) {
        return;
      }
      setRommPairing(null);
      setRommStatus({ message: getErrorMessage(error), type: "error" });
    }
  };
  void poll();
};

/** @param {Pick<RommActionsContext, "pairingAttemptRef"|"rommUrl"|"runtime"|"setRommUrl"|"setRommPairing"|"setRommStatus"|"setRommSessionSaved"|"setRommConnectionStatus"|"onRommConnect">} context RomM state. */
const handleDevicePairing = async ({
  pairingAttemptRef,
  rommUrl,
  runtime,
  setRommUrl,
  setRommPairing,
  setRommStatus,
  setRommSessionSaved,
  setRommConnectionStatus,
  onRommConnect,
}) => {
  const attempt = pairingAttemptRef.current + 1;
  pairingAttemptRef.current = attempt;
  try {
    setRommPairing(null);
    setRommStatus({ message: "Starting secure RomM pairing...", type: "info" });
    const normalizedUrl = normalizeUrl(rommUrl) ?? "";
    setRommUrl(normalizedUrl);
    /** @type {RommPairing} */
    const pairing = await runtime.invoke("begin_romm_device_auth", {
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
    const verificationPath =
      pairing.verification_path_complete ?? pairing.verification_path;
    if (
      verificationPath === undefined ||
      verificationPath === null ||
      verificationPath === ""
    ) {
      throw new Error("RomM did not provide a verification URL.");
    }
    await runtime.shellOpen(verificationPath);
    const deadline = Date.now() + (pairing.expires_in ?? 600) * 1000;
    const intervalMs = Math.max(2, pairing.interval ?? 5) * 1000;
    schedulePairingPoll({
      attempt,
      deadline,
      intervalMs,
      normalizedUrl,
      onRommConnect,
      pairing,
      pairingAttemptRef,
      runtime,
      setRommConnectionStatus,
      setRommPairing,
      setRommSessionSaved,
      setRommStatus,
    });
  } catch (error) {
    if (pairingAttemptRef.current !== attempt) {
      return;
    }
    setRommPairing(null);
    setRommStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {Pick<RommActionsContext, "rommSessionSaved"|"rommConnectionStatus"|"rommAuthMode"|"runtime"|"setRommStatus"|"rommUrl"|"setRommUrl"|"rommDeviceName"|"rommDirectToken"|"setRommSessionSaved"|"setRommConnectionStatus"|"setRommDirectToken"|"onRommConnect"> & {handleDevicePairing: () => Promise<void>}} context RomM state. */
const handleConnectRomM = async (context) => {
  const {
    rommSessionSaved,
    rommConnectionStatus,
    rommAuthMode,
    setRommStatus,
    handleDevicePairing: pairDevice,
    rommUrl,
    setRommUrl,
    rommDeviceName,
    rommDirectToken,
    setRommSessionSaved,
    setRommConnectionStatus,
    setRommDirectToken,
    onRommConnect,
  } = context;
  if (rommSessionSaved || rommConnectionStatus === "online") {
    setRommStatus({
      message:
        "Disconnect the current RomM session before changing authentication methods.",
      type: "info",
    });
    return;
  }
  if (rommAuthMode === "pairing") {
    await pairDevice();
    return;
  }
  try {
    setRommStatus(null);
    setRommUrl(rommUrl);
    /** @type {string} */
    const token = await context.runtime.invoke("connect_romm_with_token", {
      deviceName: rommDeviceName.trim() || null,
      serverUrl: rommUrl,
      token: rommDirectToken.trim(),
    });
    onRommConnect?.(rommUrl, token);
    setRommSessionSaved(true);
    setRommConnectionStatus("online");
    setRommDirectToken("");
    setRommStatus({
      message: "Connected! Click 'Sync Library' to pull your games.",
      type: "success",
    });
  } catch (error) {
    setRommStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {Pick<RommActionsContext, "pairingAttemptRef"|"setRommPairing"|"setRommStatus">} context RomM state. */
const cancelDevicePairing = ({
  pairingAttemptRef,
  setRommPairing,
  setRommStatus,
}) => {
  pairingAttemptRef.current += 1;
  setRommPairing(null);
  setRommStatus(null);
};

/** @param {Pick<RommActionsContext, "rommUrl"|"rommToken"|"runtime"|"setRommStatus"|"setRommSyncMetadata"> & {onLibraryChange?: (() => void|Promise<void>)|null}} context RomM state. */
const handleSyncRomM = async ({
  rommUrl,
  rommToken,
  runtime,
  setRommStatus,
  setRommSyncMetadata,
  onLibraryChange,
}) => {
  if (rommUrl === "") {
    setRommStatus({ message: "Enter a server URL first.", type: "error" });
    return;
  }
  try {
    setRommStatus({ message: "Syncing library...", type: "info" });
    if (rommToken === null || rommToken === "") {
      setRommStatus({
        message:
          "Pair Wingosy with RomM or connect with a client access token first.",
        type: "error",
      });
      return;
    }
    /** @type {unknown[]} */
    const games = await runtime.invoke("sync_romm_library", {
      serverUrl: rommUrl,
      token: rommToken,
    });
    setRommSyncMetadata((previous) => ({
      ...previous,
      lastSyncedAt: new Date().toISOString(),
      libraryCount: games.length,
    }));
    setRommStatus({
      message: `Synced ${games.length} games from RomM!`,
      type: "success",
    });
    if (onLibraryChange) {
      await onLibraryChange();
    }
  } catch (error) {
    setRommStatus({ message: getErrorMessage(error), type: "error" });
  }
};

/** @param {RommActionsContext} context RomM state and callbacks. */
export const createSettingsRommActions = (context) => ({
  cancelDevicePairing: () => {
    cancelDevicePairing(context);
  },
  handleConnectRomM: async () => {
    await handleConnectRomM({
      ...context,
      handleDevicePairing: async () => {
        await handleDevicePairing(context);
      },
    });
  },
  handleDevicePairing: async () => {
    await handleDevicePairing(context);
  },
  handleDisconnectRomM: async () => {
    cancelDevicePairing(context);
    try {
      await context.runtime.invoke("disconnect_romm");
      context.setRommSessionSaved(false);
      context.setRommConnectionStatus("not-configured");
      context.setRommSyncMetadata({
        autoSync: false,
        lastSyncedAt: null,
        libraryCount: null,
      });
      context.setRommDirectToken("");
      context.onRommDisconnect?.();
      context.setRommStatus({
        message: "Disconnected from RomM and removed the saved credential.",
        type: "success",
      });
    } catch (error) {
      context.setRommStatus({ message: getErrorMessage(error), type: "error" });
    }
  },
  handleSyncRomM: async () => {
    await handleSyncRomM(context);
  },
});
