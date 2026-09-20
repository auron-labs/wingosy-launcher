import { useCallback, useRef } from "react";

import { prepareAndLaunchGame } from "./immersive-mode-ipc";
import { getLaunchErrorPresentation } from "./launch-error";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").LaunchResult} LaunchResult */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */
/** @typedef {typeof prepareAndLaunchGame} PrepareLaunch */

/** @param {unknown} error Error from an IPC boundary. @returns {string} Error message. */
const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/** @param {ImmersiveGame[]} games Games in the library. @param {PlatformEntry[]} platforms Available platforms. @param {number|string} gameId Selected game identifier. @returns {string|undefined} Platform label. */
const getPlatformLabel = (games, platforms, gameId) => {
  const game = games.find((item) => item.id === gameId);
  return platforms.find(([platform]) => platform.id === game?.platform_id)?.[0]
    ?.name;
};

/** @param {{games: ImmersiveGame[], platforms: PlatformEntry[], loadData: () => Promise<ImmersiveGame[]>, prepareLaunch?: PrepareLaunch, setError: (error: string|null) => void, setSaveSyncMessages: (messages: string[]) => void}} options Launch options. @returns {(gameId: number|string) => Promise<LaunchResult|null>} Launch callback. */
export const useImmersiveModeLaunch = ({
  games,
  platforms,
  loadData,
  prepareLaunch = prepareAndLaunchGame,
  setError,
  setSaveSyncMessages,
}) => {
  const launchInFlightRef = useRef(false);
  return useCallback(
    async (gameId) => {
      if (launchInFlightRef.current) {
        return null;
      }
      launchInFlightRef.current = true;
      try {
        const result = await prepareLaunch(gameId);
        const messages = Array.isArray(result.save_sync_messages)
          ? result.save_sync_messages
              .map(String)
              .map((message) => message.trim())
          : [];
        setSaveSyncMessages(messages);
        if (
          !result.success &&
          result.error !== undefined &&
          result.error !== ""
        ) {
          const platformLabel = getPlatformLabel(games, platforms, gameId);
          const presentation = getLaunchErrorPresentation(
            result.error,
            platformLabel
          );
          setError(`${presentation.message} ${presentation.guidance}`);
        } else if (
          Array.isArray(result.save_sync_warnings) &&
          result.save_sync_warnings.length > 0
        ) {
          setError(result.save_sync_warnings.join("\n"));
        }
        await loadData();
        launchInFlightRef.current = false;
        return result;
      } catch (error) {
        const platformLabel = getPlatformLabel(games, platforms, gameId);
        const presentation = getLaunchErrorPresentation(
          getErrorMessage(error),
          platformLabel
        );
        setError(`${presentation.message} ${presentation.guidance}`);
        setSaveSyncMessages([]);
        launchInFlightRef.current = false;
        return { error: getErrorMessage(error), success: false };
      }
    },
    [games, loadData, platforms, prepareLaunch, setError, setSaveSyncMessages]
  );
};
