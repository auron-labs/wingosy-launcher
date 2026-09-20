import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { gameDetailsIpc } from "./game-details-ipc";
import { getErrorMessage } from "./game-details-utils";

/** @typedef {import("./game-details-ipc").GameDetailsIpc} GameDetailsIpc */
/** @typedef {import("./game-details-types").GameDetailsAchievementsAchievement} Achievement */
/** @typedef {{game: {id: number|string, romm_id?: number|null}, retroachievementsEnabled: boolean, rommToken?: string|null, rommUrl?: string|null, ipc?: GameDetailsIpc}} GameDetailsAchievementsOptions */
/** @typedef {{rommId: number, serverUrl: string, token: string}} AchievementRequest */
/** @typedef {{gameId: number|string, request: AchievementRequest}} AchievementIdentity */
/** @typedef {{identity: AchievementIdentity|null, achievements: Achievement[], error: string|null, loading: boolean, previousResult: boolean, refreshing: boolean}} AchievementState */

/** @typedef {{achievements: Achievement[], canRefresh: boolean, error: string|null, loading: boolean, previousResult: boolean, refreshAchievements: () => Promise<void>, refreshing: boolean}} GameDetailsAchievementsState */

/** @type {Achievement[]} */
const EMPTY_ACHIEVEMENTS = [];

/** @param {{rommId?: number|null, retroachievementsEnabled: boolean, rommToken?: string|null, rommUrl?: string|null}} options Request identity values. @returns {AchievementRequest|null} Valid RomM request credentials. */
const getAchievementRequest = ({
  rommId,
  retroachievementsEnabled,
  rommToken,
  rommUrl,
}) => {
  if (
    !retroachievementsEnabled ||
    rommId === null ||
    rommId === undefined ||
    !Number.isInteger(rommId) ||
    rommId <= 0 ||
    rommToken === null ||
    rommToken === undefined ||
    rommToken.trim() === "" ||
    rommUrl === null ||
    rommUrl === undefined ||
    rommUrl.trim() === ""
  ) {
    return null;
  }
  return { rommId, serverUrl: rommUrl, token: rommToken };
};

/** @param {AchievementIdentity|null} identity Identity for the state. @param {boolean} [loading] Whether loading starts immediately. @returns {AchievementState} Initial state. */
const createInitialState = (identity, loading = false) => ({
  achievements: EMPTY_ACHIEVEMENTS,
  error: null,
  identity,
  loading,
  previousResult: false,
  refreshing: false,
});

/** @param {unknown} error Error value. @returns {string} Non-empty user-facing error. */
const getAchievementError = (error) => {
  const message = getErrorMessage(error).trim();
  return message === "" ? "The RomM achievement request failed." : message;
};

/** @param {{current: number}} requestSequence Request sequence ref. @returns {number} New request id. */
const startRequest = (requestSequence) => {
  requestSequence.current += 1;
  return requestSequence.current;
};

/** @param {{current: number}} requestSequence Request sequence ref. @param {number} requestId Request id. @returns {boolean} Whether the request is still current. */
const isCurrentRequest = (requestSequence, requestId) =>
  requestSequence.current === requestId;

/** @param {{ipc: GameDetailsIpc, request: AchievementRequest, identity: AchievementIdentity, refreshProgression: boolean, requestId: number, requestSequence: {current: number}, setState: (update: AchievementState|((previous: AchievementState) => AchievementState)) => void}} context Request context. @returns {Promise<void>} Completion promise. */
const loadAchievementState = async ({
  identity,
  ipc,
  refreshProgression,
  request,
  requestId,
  requestSequence,
  setState,
}) => {
  try {
    const result = await ipc.getRommRetroAchievements(
      request.rommId,
      request.serverUrl,
      request.token,
      refreshProgression
    );
    if (!isCurrentRequest(requestSequence, requestId)) {
      return;
    }
    setState({
      achievements: Array.isArray(result) ? result : EMPTY_ACHIEVEMENTS,
      error: null,
      identity,
      loading: false,
      previousResult: false,
      refreshing: false,
    });
  } catch (error) {
    if (!isCurrentRequest(requestSequence, requestId)) {
      return;
    }
    setState((previous) => {
      if (refreshProgression && previous.identity === identity) {
        return {
          achievements: previous.achievements,
          error: getAchievementError(error),
          identity,
          loading: false,
          previousResult: previous.achievements.length > 0,
          refreshing: false,
        };
      }
      return {
        ...createInitialState(identity),
        error: getAchievementError(error),
      };
    });
  }
};

/** @param {{identity: AchievementIdentity|null, ipc: GameDetailsIpc, request: AchievementRequest|null, requestSequence: {current: number}, setState: (update: AchievementState|((previous: AchievementState) => AchievementState)) => void}} options Initial load options. */
const useInitialAchievementLoad = ({
  identity,
  ipc,
  request,
  requestSequence,
  setState,
}) => {
  useEffect(() => {
    const requestId = startRequest(requestSequence);
    if (request === null || identity === null) {
      return () => {
        if (isCurrentRequest(requestSequence, requestId)) {
          requestSequence.current += 1;
        }
      };
    }
    void loadAchievementState({
      identity,
      ipc,
      refreshProgression: false,
      request,
      requestId,
      requestSequence,
      setState,
    });
    return () => {
      if (isCurrentRequest(requestSequence, requestId)) {
        requestSequence.current += 1;
      }
    };
  }, [identity, ipc, request, requestSequence, setState]);
};

/** @param {GameDetailsAchievementsOptions} options Hook options. @returns {GameDetailsAchievementsState} Achievement state and actions. */
export const useGameDetailsAchievements = ({
  game,
  ipc = gameDetailsIpc,
  retroachievementsEnabled,
  rommToken = null,
  rommUrl = null,
}) => {
  const request = useMemo(
    () =>
      getAchievementRequest({
        retroachievementsEnabled,
        rommId: game.romm_id,
        rommToken,
        rommUrl,
      }),
    [game.romm_id, retroachievementsEnabled, rommToken, rommUrl]
  );
  const identity = useMemo(
    () => (request === null ? null : { gameId: game.id, request }),
    [game.id, request]
  );
  const [state, setState] = useState(() =>
    createInitialState(identity, identity !== null)
  );
  const requestSequence = useRef(0);

  useInitialAchievementLoad({
    identity,
    ipc,
    request,
    requestSequence,
    setState,
  });

  const refreshAchievements = useCallback(async () => {
    if (request === null || identity === null) {
      return;
    }
    const requestId = startRequest(requestSequence);
    setState((previous) => ({
      achievements: previous.identity === identity ? previous.achievements : [],
      error: null,
      identity,
      loading: true,
      previousResult: false,
      refreshing: true,
    }));
    await loadAchievementState({
      identity,
      ipc,
      refreshProgression: true,
      request,
      requestId,
      requestSequence,
      setState,
    });
  }, [identity, ipc, request]);

  const visibleState =
    state.identity === identity
      ? state
      : createInitialState(identity, identity !== null);
  return {
    achievements: visibleState.achievements,
    canRefresh: request !== null,
    error: visibleState.error,
    loading: visibleState.loading,
    previousResult: visibleState.previousResult,
    refreshAchievements,
    refreshing: visibleState.refreshing,
  };
};
