import { useCallback } from "react";
/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */

import { toggleFavorite } from "./immersive-mode-ipc";

/** @typedef {typeof toggleFavorite} ToggleFavorite */

/** @param {unknown} error Error from an IPC boundary. @returns {string} Error message. */
const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/** @param {{gamesRef: {current: ImmersiveGame[]}, selectedGame: ImmersiveGame|null, setGames: (update: (games: ImmersiveGame[]) => ImmersiveGame[]) => void, setSelectedGame: (update: (game: ImmersiveGame|null) => ImmersiveGame|null) => void, setError: (error: string|null) => void, toggleGameFavorite?: ToggleFavorite}} options Favorite options. @returns {(gameId: number|string) => Promise<void>} Favorite callback. */
export const useImmersiveModeFavorite = ({
  gamesRef,
  selectedGame,
  setError,
  setGames,
  setSelectedGame,
  toggleGameFavorite = toggleFavorite,
}) =>
  useCallback(
    async (gameId) => {
      try {
        const newState = await toggleGameFavorite(gameId);
        setGames((previous) => {
          const nextGames = previous.map((game) =>
            game.id === gameId ? { ...game, is_favorite: newState } : game
          );
          gamesRef.current = nextGames;
          return nextGames;
        });
        if (selectedGame?.id === gameId) {
          setSelectedGame((previous) =>
            previous === null
              ? previous
              : { ...previous, is_favorite: newState }
          );
        }
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    [
      gamesRef,
      selectedGame,
      setError,
      setGames,
      setSelectedGame,
      toggleGameFavorite,
    ]
  );
