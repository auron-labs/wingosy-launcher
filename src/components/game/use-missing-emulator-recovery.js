import { useCallback, useEffect, useRef, useState } from "react";

import { gameDetailsIpc } from "./game-details-ipc";
import { getErrorMessage } from "./game-details-utils";

/** @typedef {import("./game-details-types").EmulatorInfo} EmulatorInfo */
/** @typedef {import("./game-details-types").GameDetailsLaunchErrorPresentation} GameDetailsLaunchErrorPresentation */
/** @typedef {"idle"|"loading"|"ready"|"cancelled"|"installing"|"success"|"error"} MissingEmulatorRecoveryStatus */
/** @typedef {Pick<typeof gameDetailsIpc, "downloadEmulator"|"getEmulatorsForPlatform">} MissingEmulatorRecoveryIpc */
/** @typedef {{key: string|null, offer: EmulatorInfo|null, status: MissingEmulatorRecoveryStatus, error: string|null}} MissingEmulatorRecoveryState */

/** @param {EmulatorInfo[]} emulators Compatible emulator candidates. @returns {EmulatorInfo|null} The sole downloadable, uninstalled candidate. */
export const getSoleDownloadableEmulator = (emulators) => {
  if (emulators.some((emulator) => emulator.is_installed)) {
    return null;
  }
  const downloadable = emulators.filter(
    (emulator) => !emulator.is_installed && emulator.has_download
  );
  return downloadable.length === 1 ? downloadable[0] : null;
};

/** @returns {MissingEmulatorRecoveryState} Empty recovery state. */
const getInitialRecoveryState = () => ({
  error: null,
  key: null,
  offer: null,
  status: "idle",
});

/** @param {GameDetailsLaunchErrorPresentation} presentation Classified launch error. @param {string|null|undefined} platformId Game platform identifier. @param {unknown} launchError Launch error. */
const getRecoveryKey = (presentation, platformId, launchError) => {
  if (
    presentation.kind !== "missing-emulator" ||
    platformId === null ||
    platformId === undefined ||
    platformId === ""
  ) {
    return null;
  }
  return `${platformId}\u0000${getErrorMessage(launchError)}`;
};

/**
 * @param {MissingEmulatorRecoveryState} state Stored recovery state.
 * @param {string|null} key Current recovery identity.
 * @returns {MissingEmulatorRecoveryState} State relevant to the current launch failure.
 */
const getVisibleRecoveryState = (state, key) => {
  if (state.key === key) {
    return state;
  }
  return {
    ...getInitialRecoveryState(),
    key,
    status: key === null ? "idle" : "loading",
  };
};

/** @param {{ipc: MissingEmulatorRecoveryIpc, platformId: string|null|undefined, recoveryKey: string|null, requestIdRef: {current: number}, setRecoveryState: import("react").Dispatch<import("react").SetStateAction<MissingEmulatorRecoveryState>>}} options Candidate query dependencies. */
const useEmulatorCandidates = ({
  ipc,
  platformId,
  recoveryKey,
  requestIdRef,
  setRecoveryState,
}) => {
  useEffect(() => {
    requestIdRef.current += 1;
    if (
      recoveryKey === null ||
      platformId === null ||
      platformId === undefined
    ) {
      return;
    }
    const requestId = requestIdRef.current;
    const loadCandidates = async () => {
      try {
        const emulators = await ipc.getEmulatorsForPlatform(platformId);
        if (requestId === requestIdRef.current) {
          setRecoveryState({
            error: null,
            key: recoveryKey,
            offer: getSoleDownloadableEmulator(emulators),
            status: "ready",
          });
        }
      } catch (requestError) {
        if (requestId === requestIdRef.current) {
          setRecoveryState({
            error: getErrorMessage(requestError),
            key: recoveryKey,
            offer: null,
            status: "error",
          });
        }
      }
    };
    void loadCandidates();
  }, [ipc, platformId, recoveryKey, requestIdRef, setRecoveryState]);
};

/**
 * @param {{launchError: unknown, launchErrorPresentation: GameDetailsLaunchErrorPresentation, platformId: string|null|undefined, ipc?: MissingEmulatorRecoveryIpc}} options Missing-emulator recovery inputs.
 * @returns {{offer: EmulatorInfo|null, status: "idle"|"loading"|"ready"|"cancelled"|"installing"|"success"|"error", pending: boolean, installed: boolean, error: string|null, confirm: () => Promise<void>, cancel: () => void}} Recovery state and actions.
 */
export const useMissingEmulatorRecovery = ({
  ipc = gameDetailsIpc,
  launchError,
  launchErrorPresentation,
  platformId,
}) => {
  const [recoveryState, setRecoveryState] = useState(getInitialRecoveryState);
  const requestIdRef = useRef(0);
  const recoveryKey = getRecoveryKey(
    launchErrorPresentation,
    platformId,
    launchError
  );
  const currentState = getVisibleRecoveryState(recoveryState, recoveryKey);
  useEmulatorCandidates({
    ipc,
    platformId,
    recoveryKey,
    requestIdRef,
    setRecoveryState,
  });

  const confirm = useCallback(async () => {
    if (currentState.offer === null || currentState.status === "installing") {
      return;
    }
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setRecoveryState({
      error: null,
      key: recoveryKey,
      offer: currentState.offer,
      status: "installing",
    });
    try {
      await ipc.downloadEmulator(currentState.offer.id);
      if (requestId === requestIdRef.current) {
        setRecoveryState({
          ...currentState,
          error: null,
          status: "success",
        });
      }
    } catch (installError) {
      if (requestId === requestIdRef.current) {
        setRecoveryState({
          ...currentState,
          error: getErrorMessage(installError),
          status: "error",
        });
      }
    }
  }, [currentState, ipc, recoveryKey]);

  const cancel = useCallback(() => {
    if (currentState.status === "installing") {
      return;
    }
    requestIdRef.current += 1;
    setRecoveryState({
      error: null,
      key: recoveryKey,
      offer: null,
      status: "cancelled",
    });
  }, [currentState.status, recoveryKey]);

  return {
    cancel,
    confirm,
    error: currentState.error,
    installed: currentState.status === "success",
    offer: currentState.offer,
    pending:
      currentState.status === "loading" || currentState.status === "installing",
    status: currentState.status,
  };
};
