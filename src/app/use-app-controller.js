import { useCallback, useState } from "react";

import { useRommSyncMonitor } from "../components/use-romm-sync-monitor";
import { useAppLibrary } from "./use-app-library";
import { useAppStartup } from "./use-app-startup";

/** @typedef {import("./app-runtime").AppRuntime} AppRuntime */

/** @typedef {ReturnType<typeof useAppStartup> & ReturnType<typeof useAppLibrary> & {error: string|null, handleCloseMessages: () => void, handleCloseUpdate: () => void, handleInstallUpdate: () => void, handleOpenRelease: () => void, handleRetryLaunch: () => Promise<unknown>|null, rommSyncMonitor: ReturnType<typeof import("../components/use-romm-sync-monitor").useRommSyncMonitor>, runtime: AppRuntime}} AppController */

/** @returns {string|null} Initial application error. */
const initialError = () => null;

/** @param {{runtime: AppRuntime}} options - Runtime dependency for application controllers. */
export const useAppController = ({ runtime }) => {
  const [error, setError] = useState(initialError);
  const startup = useAppStartup({ runtime, setError });
  const library = useAppLibrary({
    loadData: startup.loadData,
    platforms: startup.platforms,
    runtime,
    setError,
    showSetup: startup.showSetup,
  });

  const {
    handleLaunchGame,
    libraryLaunchError,
    reloadLibrary: handleReloadLibrary,
  } = library;
  const rommSyncMonitor = useRommSyncMonitor({
    refreshLibrary: handleReloadLibrary,
    rommToken: startup.rommToken,
    rommUrl: startup.rommUrl,
    runtime,
  });
  const launchErrorGameId = libraryLaunchError?.gameId;
  const exitImmersive = startup.handleImmersiveExit;
  const handleRetryLaunch = useCallback(async () => {
    if (launchErrorGameId === undefined) {
      return null;
    }
    return await handleLaunchGame(launchErrorGameId);
  }, [handleLaunchGame, launchErrorGameId]);

  const handleImmersiveExit = useCallback(async () => {
    await exitImmersive(handleReloadLibrary);
  }, [exitImmersive, handleReloadLibrary]);

  return {
    ...library,
    ...startup,
    error,
    handleImmersiveExit,
    handleRetryLaunch,
    rommSyncMonitor,
    runtime,
  };
};
