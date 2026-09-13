import { listen } from "@tauri-apps/api/event";

/** @typedef {{gameId?: number|string, gameName?: string, downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{kind: "complete", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", gameId: number|string, gameName: string, message: string, at: number}} RecentDownload */
/** @typedef {Record<string|number, DownloadProgress>} ProgressMap */
/** @typedef {{game_id: number|string, game_name?: string|null, downloaded?: number, total?: number|null, percent?: number|null}} RomDownloadProgressEvent */
/** @typedef {{game_id: number|string, game_name?: string|null, path: string}} RomDownloadCompleteEvent */
/** @typedef {{game_id: number|string, game_name?: string|null, message: string}} RomDownloadErrorEvent */
/** @typedef {{game_id?: number|string, game_name?: string|null, downloaded?: number, total?: number|null, percent?: number|null, stage?: string, error?: string|null}} LaunchProgressEvent */
/** @typedef {{game_id?: number|string, downloaded?: number, total?: number|null, percent?: number|null, stage?: string, error?: string|null}} SwitchContentProgressEvent */
/** @typedef {(update: (previous: ProgressMap) => ProgressMap) => void} ProgressUpdater */
/** @typedef {(update: (previous: RecentDownload[]) => RecentDownload[]) => void} RecentDownloadsUpdater */

/** @param {number|string} gameId Game identifier. @param {string|null|undefined} providedName Event-provided game name. @param {string} [currentName] Existing game name. */
const getGameName = (gameId, providedName, currentName) => {
  if (
    providedName !== null &&
    providedName !== undefined &&
    providedName !== ""
  ) {
    return providedName;
  }
  if (currentName !== undefined && currentName !== "") {
    return currentName;
  }
  return `Game #${gameId}`;
};

/** @param {ProgressMap} progress Progress map. @param {number|string} gameId Game identifier to remove. */
const withoutGame = (progress, gameId) =>
  Object.fromEntries(
    Object.entries(progress).filter(([key]) => key !== String(gameId))
  );

/** @param {ProgressUpdater} setActiveByGameId Active download updater. */
const createDownloadStartedHandler =
  (setActiveByGameId) =>
  /** @param {{payload: RomDownloadProgressEvent}} event Download-start event. */
  (event) => {
    const { game_id, game_name } = event.payload;
    setActiveByGameId((previous) => ({
      ...previous,
      [game_id]: {
        downloaded: 0,
        gameId: game_id,
        gameName: getGameName(game_id, game_name),
        percent: null,
        total: null,
      },
    }));
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. */
const createDownloadProgressHandler =
  (setActiveByGameId) =>
  /** @param {{payload: RomDownloadProgressEvent}} event Download-progress event. */
  (event) => {
    const { game_id, game_name, downloaded, total, percent } = event.payload;
    setActiveByGameId((previous) => {
      const current = previous[game_id];
      if (current === undefined) {
        return {
          ...previous,
          [game_id]: {
            downloaded,
            gameId: game_id,
            gameName: getGameName(game_id, game_name),
            percent,
            total,
          },
        };
      }
      return {
        ...previous,
        [game_id]: { ...current, downloaded, percent, total },
      };
    });
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. @param {{current: ProgressMap}} activeRef Active download ref. */
const createDownloadCompleteHandler =
  (setActiveByGameId, setRecentDownloads, activeRef) =>
  /** @param {{payload: RomDownloadCompleteEvent}} event Download-complete event. */
  (event) => {
    const { game_id, game_name, path } = event.payload;
    const gameName = getGameName(
      game_id,
      game_name,
      activeRef.current[game_id]?.gameName
    );
    setActiveByGameId((previous) => withoutGame(previous, game_id));
    /** @type {"complete"} */
    const completeKind = "complete";
    setRecentDownloads((recent) =>
      [
        { at: Date.now(), gameId: game_id, gameName, kind: completeKind, path },
        ...recent.filter(
          (item) =>
            item.kind !== "complete" ||
            item.gameId !== game_id ||
            item.path !== path
        ),
      ].slice(0, 25)
    );
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. @param {{current: ProgressMap}} activeRef Active download ref. */
const createDownloadErrorHandler =
  (setActiveByGameId, setRecentDownloads, activeRef) =>
  /** @param {{payload: RomDownloadErrorEvent}} event Download-error event. */
  (event) => {
    const { game_id, game_name, message } = event.payload;
    const gameName = getGameName(
      game_id,
      game_name,
      activeRef.current[game_id]?.gameName
    );
    setActiveByGameId((previous) => withoutGame(previous, game_id));
    /** @type {"error"} */
    const errorKind = "error";
    setRecentDownloads((recent) =>
      [
        { at: Date.now(), gameId: game_id, gameName, kind: errorKind, message },
        ...recent.filter(
          (item) =>
            item.kind !== "error" ||
            item.gameId !== game_id ||
            item.message !== message
        ),
      ].slice(0, 25)
    );
  };

/** @param {ProgressUpdater} setLaunchProgressByGameId Launch progress updater. */
const createLaunchProgressHandler =
  (setLaunchProgressByGameId) =>
  /** @param {{payload: LaunchProgressEvent}} event Launch-progress event. */
  (event) => {
    const progress = event.payload;
    const gameId = progress.game_id;
    if (gameId === null || gameId === undefined) {
      return;
    }
    const terminal =
      progress.stage === "completion" || progress.stage === "failure";
    setLaunchProgressByGameId((previous) => ({
      ...previous,
      [gameId]: {
        active: !terminal,
        downloaded: progress.downloaded,
        error: progress.error ?? null,
        gameId,
        gameName: getGameName(gameId, progress.game_name),
        percent: progress.percent,
        stage: progress.stage,
        total: progress.total,
      },
    }));
  };

/** @param {ProgressUpdater} setSwitchContentProgressByGameId Switch progress updater. */
const createSwitchProgressHandler =
  (setSwitchContentProgressByGameId) =>
  /** @param {{payload: SwitchContentProgressEvent}} event Switch progress event. */
  (event) => {
    const progress = event.payload;
    const gameId = progress.game_id;
    if (gameId === null || gameId === undefined) {
      return;
    }
    setSwitchContentProgressByGameId((previous) => ({
      ...previous,
      [gameId]: progress,
    }));
  };

/** @param {ProgressUpdater} setSwitchContentProgressByGameId Switch progress updater. */
const createSwitchProgressClearHandler =
  (setSwitchContentProgressByGameId) =>
  /** @param {{payload?: {game_id?: number|string}}} event Sync terminal event. */
  (event) => {
    const gameId = event.payload?.game_id;
    if (gameId === null || gameId === undefined) {
      return;
    }
    setSwitchContentProgressByGameId((previous) =>
      withoutGame(previous, gameId)
    );
  };

/** @param {{setActiveByGameId: ProgressUpdater, setRecentDownloads: RecentDownloadsUpdater, setLaunchProgressByGameId: ProgressUpdater, setSwitchContentProgressByGameId: ProgressUpdater, activeRef: {current: ProgressMap}}} dependencies Event handler dependencies. */
export const createRomDownloadEventHandlers = ({
  setActiveByGameId,
  setRecentDownloads,
  setLaunchProgressByGameId,
  setSwitchContentProgressByGameId,
  activeRef,
}) => ({
  downloadComplete: createDownloadCompleteHandler(
    setActiveByGameId,
    setRecentDownloads,
    activeRef
  ),
  downloadError: createDownloadErrorHandler(
    setActiveByGameId,
    setRecentDownloads,
    activeRef
  ),
  downloadProgress: createDownloadProgressHandler(setActiveByGameId),
  downloadStarted: createDownloadStartedHandler(setActiveByGameId),
  launchProgress: createLaunchProgressHandler(setLaunchProgressByGameId),
  switchProgress: createSwitchProgressHandler(setSwitchContentProgressByGameId),
  switchProgressClear: createSwitchProgressClearHandler(
    setSwitchContentProgressByGameId
  ),
});

/** @param {string} event Event name. @param {(event: object) => void} handler Event handler. @param {() => boolean} isCancelled Cancellation check. @param {Array<() => void>} unlisteners Listener cleanup functions. @param {typeof listen} listenFunction Event listener boundary. */
const listenSafely = async (
  event,
  handler,
  isCancelled,
  unlisteners,
  listenFunction
) => {
  const unlisten = await listenFunction(event, handler);
  if (isCancelled()) {
    unlisten();
    return;
  }
  unlisteners.push(unlisten);
};

/** @param {ReturnType<typeof createRomDownloadEventHandlers>} handlers Event handlers. @param {() => boolean} isCancelled Cancellation check. @param {Array<() => void>} unlisteners Listener cleanup functions. @param {typeof listen} listenFunction Event listener boundary. */
const registerRomDownloadListeners = async (
  handlers,
  isCancelled,
  unlisteners,
  listenFunction
) => {
  await listenSafely(
    "rom-download-started",
    handlers.downloadStarted,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "rom-download-progress",
    handlers.downloadProgress,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "rom-download-complete",
    handlers.downloadComplete,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "rom-download-error",
    handlers.downloadError,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "game-launch-progress",
    handlers.launchProgress,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "switch-content-sync-progress",
    handlers.switchProgress,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "switch-content-sync-complete",
    handlers.switchProgressClear,
    isCancelled,
    unlisteners,
    listenFunction
  );
  await listenSafely(
    "switch-content-sync-error",
    handlers.switchProgressClear,
    isCancelled,
    unlisteners,
    listenFunction
  );
};

/** @param {ReturnType<typeof createRomDownloadEventHandlers>} handlers Event handlers. @param {typeof listen} [listenFunction] Event listener boundary. @returns {() => void} Listener cleanup function. */
export const subscribeToRomDownloadEvents = (
  handlers,
  listenFunction = listen
) => {
  let cancelled = false;
  /** @type {Array<() => void>} */
  const unlisteners = [];
  void registerRomDownloadListeners(
    handlers,
    () => cancelled,
    unlisteners,
    listenFunction
  );

  return () => {
    cancelled = true;
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
};
