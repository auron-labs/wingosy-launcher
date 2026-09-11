import { useCallback, useState } from "react";

import { useAppLibrary } from "./use-app-library";
import { useAppStartup } from "./use-app-startup";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */

/** @typedef {ReturnType<typeof useAppStartup> & ReturnType<typeof useAppLibrary> & {error: string|null, handleCloseMessages: () => void, handleCloseUpdate: () => void, handleInstallUpdate: () => void, handleOpenRelease: () => void, handleRetryLaunch: () => Promise<unknown>|null, runtime: AppRuntime}} AppController */

/** @param {{runtime: AppRuntime}} options - Runtime dependency for application controllers. */
export const useAppController = ({ runtime }) => {
  const [error, setError] = useState(null);
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
  const launchErrorGameId = libraryLaunchError?.gameId;
  const exitImmersive = startup.handleImmersiveExit;
  const handleRetryLaunch = useCallback(async () => {
    if (launchErrorGameId === undefined) {
      return null;
    }
    return await handleLaunchGame(launchErrorGameId);
  }, [handleLaunchGame, launchErrorGameId]);

  const handleImmersiveExit = useCallback(
    async () => await exitImmersive(handleReloadLibrary),
    [exitImmersive, handleReloadLibrary]
  );

  return {
    ...library,
    ...startup,
    error,
    handleImmersiveExit,
    handleRetryLaunch,
    runtime,
  };
};
