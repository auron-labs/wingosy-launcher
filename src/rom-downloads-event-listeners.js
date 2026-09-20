import { listen } from "@tauri-apps/api/event";

/** @typedef {{transferId?: string, transferKind?: "rom"|"bios", gameId?: number|string, gameName?: string, firmwareId?: number|string, platformSlug?: string, platformName?: string, fileName?: string, downloaded?: number|null, total?: number|null, percent?: number|null, speed?: string|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{kind: "complete", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", transferId: string, transferKind: "rom", gameId: number|string, gameName: string, message: string, at: number}|{kind: "complete", transferId: string, transferKind: "bios", firmwareId: number|string, platformSlug: string, platformName: string, fileName: string, path?: string|null, at: number}|{kind: "error", transferId: string, transferKind: "bios", firmwareId: number|string, platformSlug: string, platformName: string, fileName: string, message?: string|null, at: number}} RecentDownload */
/** @typedef {Record<string, DownloadProgress>} ProgressMap */
/** @typedef {{game_id: number|string, game_name?: string|null, downloaded?: number, total?: number|null, percent?: number|null, speed?: string|null}} RomDownloadProgressEvent */
/** @typedef {{game_id: number|string, game_name?: string|null, path: string}} RomDownloadCompleteEvent */
/** @typedef {{game_id: number|string, game_name?: string|null, message: string}} RomDownloadErrorEvent */
/** @typedef {{game_id?: number|string, game_name?: string|null, downloaded?: number, total?: number|null, percent?: number|null, stage?: string, error?: string|null}} LaunchProgressEvent */
/** @typedef {{game_id?: number|string, downloaded?: number, total?: number|null, percent?: number|null, stage?: string, error?: string|null}} SwitchContentProgressEvent */
/** @typedef {{transfer_id: string, firmware_id: number|string, platform_slug: string, platform_name: string, file_name: string, downloaded?: number|null, total?: number|null, percent?: number|null, speed?: string|null, path?: string|null, message?: string|null}} BiosDownloadEvent */
/** @typedef {DownloadProgress & {transferId: string, transferKind: "bios"}} BiosProgress */
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

/** @param {number|string} gameId Game identifier. @returns {string} Namespaced ROM transfer identifier. */
export const getRomTransferId = (gameId) => `rom:${gameId}`;

/** @param {number|string} firmwareId Firmware identifier. @param {string} platformSlug Firmware platform slug. @returns {string} Namespaced BIOS transfer identifier. */
export const getBiosTransferId = (firmwareId, platformSlug) =>
  `bios:${platformSlug}:${firmwareId}`;

/** @param {ProgressMap} progress Progress map. @param {string} transferId Transfer identifier to remove. */
const withoutTransfer = (progress, transferId) =>
  Object.fromEntries(
    Object.entries(progress).filter(([key]) => key !== transferId)
  );

/** @param {ProgressUpdater} setActiveByGameId Active download updater. */
const createDownloadStartedHandler =
  (setActiveByGameId) =>
  /** @param {{payload: RomDownloadProgressEvent}} event Download-start event. */
  (event) => {
    const { game_id, game_name } = event.payload;
    const transferId = getRomTransferId(game_id);
    setActiveByGameId((previous) => ({
      ...previous,
      [transferId]: {
        downloaded: 0,
        gameId: game_id,
        gameName: getGameName(game_id, game_name),
        percent: null,
        speed: null,
        total: null,
        transferId,
        transferKind: "rom",
      },
    }));
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. */
const createDownloadProgressHandler =
  (setActiveByGameId) =>
  /** @param {{payload: RomDownloadProgressEvent}} event Download-progress event. */
  (event) => {
    const { game_id, game_name, downloaded, total, percent, speed } =
      event.payload;
    const transferId = getRomTransferId(game_id);
    setActiveByGameId((previous) => {
      const current = previous[transferId];
      if (current === undefined) {
        return {
          ...previous,
          [transferId]: {
            downloaded,
            gameId: game_id,
            gameName: getGameName(game_id, game_name),
            percent,
            speed,
            total,
            transferId,
            transferKind: "rom",
          },
        };
      }
      return {
        ...previous,
        [transferId]: { ...current, downloaded, percent, speed, total },
      };
    });
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. @param {{current: ProgressMap}} activeRef Active download ref. */
const createDownloadCompleteHandler =
  (setActiveByGameId, setRecentDownloads, activeRef) =>
  /** @param {{payload: RomDownloadCompleteEvent}} event Download-complete event. */
  (event) => {
    const { game_id, game_name, path } = event.payload;
    const transferId = getRomTransferId(game_id);
    const gameName = getGameName(
      game_id,
      game_name,
      activeRef.current[transferId]?.gameName
    );
    setActiveByGameId((previous) => withoutTransfer(previous, transferId));
    /** @type {"complete"} */
    const completeKind = "complete";
    setRecentDownloads((recent) => {
      /** @type {RecentDownload} */
      const item = {
        at: Date.now(),
        gameId: game_id,
        gameName,
        kind: completeKind,
        path,
        transferId,
        transferKind: "rom",
      };
      return [
        item,
        ...recent.filter(
          (recentItem) =>
            recentItem.transferId !== transferId ||
            recentItem.kind !== "complete" ||
            !("path" in recentItem) ||
            recentItem.path !== path
        ),
      ].slice(0, 25);
    });
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. @param {{current: ProgressMap}} activeRef Active download ref. */
const createDownloadErrorHandler =
  (setActiveByGameId, setRecentDownloads, activeRef) =>
  /** @param {{payload: RomDownloadErrorEvent}} event Download-error event. */
  (event) => {
    const { game_id, game_name, message } = event.payload;
    const transferId = getRomTransferId(game_id);
    const gameName = getGameName(
      game_id,
      game_name,
      activeRef.current[transferId]?.gameName
    );
    setActiveByGameId((previous) => withoutTransfer(previous, transferId));
    /** @type {"error"} */
    const errorKind = "error";
    setRecentDownloads((recent) => {
      /** @type {RecentDownload} */
      const item = {
        at: Date.now(),
        gameId: game_id,
        gameName,
        kind: errorKind,
        message,
        transferId,
        transferKind: "rom",
      };
      return [
        item,
        ...recent.filter(
          (recentItem) =>
            recentItem.transferId !== transferId ||
            recentItem.kind !== "error" ||
            !("message" in recentItem) ||
            recentItem.message !== message
        ),
      ].slice(0, 25);
    });
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
      withoutTransfer(previous, String(gameId))
    );
  };

/** @param {BiosDownloadEvent} event BIOS event payload. @param {"active"|"queued"} stage Current queue state. @returns {BiosProgress} Active BIOS transfer state. */
const toBiosProgress = (event, stage) => ({
  downloaded: stage === "queued" ? null : (event.downloaded ?? 0),
  fileName: event.file_name,
  firmwareId: event.firmware_id,
  percent: stage === "queued" ? null : (event.percent ?? null),
  platformName: event.platform_name,
  platformSlug: event.platform_slug,
  speed: stage === "queued" ? null : (event.speed ?? null),
  stage,
  total: stage === "queued" ? null : (event.total ?? null),
  transferId: event.transfer_id,
  transferKind: "bios",
});

/** @param {RecentDownload[]} recent Recent transfer history. @param {string} transferId BIOS transfer identifier. @returns {RecentDownload[]} History without this BIOS transfer. */
const withoutBiosHistory = (recent, transferId) =>
  recent.filter((item) => item.transferId !== transferId);

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. */
const createBiosDownloadStartedHandler =
  (setActiveByGameId, setRecentDownloads) =>
  /** @param {{payload: BiosDownloadEvent}} event BIOS download-start event. */
  (event) => {
    const progress = toBiosProgress(event.payload, "active");
    setActiveByGameId((previous) => ({
      ...previous,
      [progress.transferId]: progress,
    }));
    setRecentDownloads((recent) =>
      withoutBiosHistory(recent, progress.transferId)
    );
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. */
const createBiosDownloadQueuedHandler =
  (setActiveByGameId, setRecentDownloads) =>
  /** @param {{payload: BiosDownloadEvent}} event BIOS download-queued event. */
  (event) => {
    const progress = toBiosProgress(event.payload, "queued");
    setActiveByGameId((previous) => ({
      ...previous,
      [progress.transferId]: progress,
    }));
    setRecentDownloads((recent) =>
      withoutBiosHistory(recent, progress.transferId)
    );
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. */
const createBiosDownloadProgressHandler =
  (setActiveByGameId) =>
  /** @param {{payload: BiosDownloadEvent}} event BIOS download-progress event. */
  (event) => {
    const progress = toBiosProgress(event.payload, "active");
    setActiveByGameId((previous) => ({
      ...previous,
      [progress.transferId]: {
        ...previous[progress.transferId],
        ...progress,
      },
    }));
  };

/** @param {ProgressUpdater} setActiveByGameId Active download updater. @param {RecentDownloadsUpdater} setRecentDownloads Recent download updater. @param {"complete"|"error"} kind Terminal result kind. */
const createBiosDownloadTerminalHandler =
  (setActiveByGameId, setRecentDownloads, kind) =>
  /** @param {{payload: BiosDownloadEvent}} event BIOS terminal event. */
  (event) => {
    const { payload } = event;
    setActiveByGameId((previous) =>
      withoutTransfer(previous, payload.transfer_id)
    );
    setRecentDownloads((recent) => {
      /** @type {RecentDownload} */
      const item =
        kind === "complete"
          ? {
              at: Date.now(),
              fileName: payload.file_name,
              firmwareId: payload.firmware_id,
              kind,
              path: payload.path ?? null,
              platformName: payload.platform_name,
              platformSlug: payload.platform_slug,
              transferId: payload.transfer_id,
              transferKind: "bios",
            }
          : {
              at: Date.now(),
              fileName: payload.file_name,
              firmwareId: payload.firmware_id,
              kind,
              message: payload.message ?? null,
              platformName: payload.platform_name,
              platformSlug: payload.platform_slug,
              transferId: payload.transfer_id,
              transferKind: "bios",
            };
      return [item, ...withoutBiosHistory(recent, payload.transfer_id)].slice(
        0,
        25
      );
    });
  };

/** @param {{setActiveByGameId: ProgressUpdater, setRecentDownloads: RecentDownloadsUpdater, setLaunchProgressByGameId: ProgressUpdater, setSwitchContentProgressByGameId: ProgressUpdater, activeRef: {current: ProgressMap}}} dependencies Event handler dependencies. */
export const createRomDownloadEventHandlers = ({
  setActiveByGameId,
  setRecentDownloads,
  setLaunchProgressByGameId,
  setSwitchContentProgressByGameId,
  activeRef,
}) => ({
  biosDownloadComplete: createBiosDownloadTerminalHandler(
    setActiveByGameId,
    setRecentDownloads,
    "complete"
  ),
  biosDownloadError: createBiosDownloadTerminalHandler(
    setActiveByGameId,
    setRecentDownloads,
    "error"
  ),
  biosDownloadProgress: createBiosDownloadProgressHandler(setActiveByGameId),
  biosDownloadQueued: createBiosDownloadQueuedHandler(
    setActiveByGameId,
    setRecentDownloads
  ),
  biosDownloadStarted: createBiosDownloadStartedHandler(
    setActiveByGameId,
    setRecentDownloads
  ),
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
  const registrations = [
    { event: "bios-download-queued", handler: handlers.biosDownloadQueued },
    { event: "bios-download-started", handler: handlers.biosDownloadStarted },
    { event: "bios-download-progress", handler: handlers.biosDownloadProgress },
    { event: "bios-download-complete", handler: handlers.biosDownloadComplete },
    { event: "bios-download-error", handler: handlers.biosDownloadError },
    { event: "rom-download-started", handler: handlers.downloadStarted },
    { event: "rom-download-progress", handler: handlers.downloadProgress },
    { event: "rom-download-complete", handler: handlers.downloadComplete },
    { event: "rom-download-error", handler: handlers.downloadError },
    { event: "game-launch-progress", handler: handlers.launchProgress },
    { event: "switch-content-sync-progress", handler: handlers.switchProgress },
    {
      event: "switch-content-sync-complete",
      handler: handlers.switchProgressClear,
    },
    {
      event: "switch-content-sync-error",
      handler: handlers.switchProgressClear,
    },
  ];
  await Promise.all(
    registrations.map(async ({ event, handler }) => {
      await listenSafely(
        event,
        handler,
        isCancelled,
        unlisteners,
        listenFunction
      );
    })
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
