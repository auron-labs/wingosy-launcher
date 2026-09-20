import { useCallback, useEffect, useRef, useState } from "react";

/** @typedef {{romm_platform_id: number, platform_id: string, name: string, server_games: number, local_games: number, installed_games: number}} RommSyncPlatform */
/** @typedef {{games_added?: number, games_updated?: number, games_deleted?: number, total_games?: number}} RommSyncResult */
/** @typedef {{state: "idle"|"syncing"|"success"|"error", error?: string|null, progress?: {processed?: number, total?: number}|null, result?: RommSyncResult|null}} PlatformSyncStatus */
/** @typedef {{state: "idle"|"syncing"|"success"|"error", error?: string|null, totalGames?: number|null}} SyncAllStatus */
/** @typedef {{kind: "platform", platformId: number}|{kind: "all"}|null} ActiveSyncOperation */
/** @typedef {{platforms: RommSyncPlatform[], loading: boolean, error: string|null, platformStatuses: Record<string, PlatformSyncStatus>, syncAllStatus: SyncAllStatus, activeOperation: ActiveSyncOperation, loadOverview: () => Promise<void>, syncPlatform: (platformId: number) => Promise<void>, syncAll: () => Promise<void>}} RommSyncMonitorState */

const BUSY_ERROR =
  "A RomM library sync is already in progress; wait for it to finish, then retry.";
const NOT_CONFIGURED_ERROR =
  "Connect to RomM in Settings before synchronizing library metadata.";
const REFRESH_FAILED_ERROR =
  "Sync completed, but refreshing the library view failed: ";

/** @returns {RommSyncPlatform[]} Initial platform overview. */
const initialPlatforms = () => [];

/** @returns {string|null} Initial monitor error. */
const initialError = () => null;

/** @returns {Record<string, PlatformSyncStatus>} Initial platform statuses. */
const initialPlatformStatuses = () => ({});

/** @returns {ActiveSyncOperation} Initial active operation. */
const initialActiveOperation = () => null;

/** @returns {string|null} Initial session key. */
const initialSessionKey = () => null;

/** @param {unknown} error Error from an IPC boundary. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/** @param {unknown} error Error from a post-sync refresh. @returns {string} Refresh error message. */
const getRefreshErrorMessage = (error) =>
  `${REFRESH_FAILED_ERROR}${getErrorMessage(error)}`;

/** @returns {PlatformSyncStatus} Initial platform status. */
const initialPlatformStatus = () => ({
  error: null,
  progress: null,
  result: null,
  state: "idle",
});

/** @returns {SyncAllStatus} Initial full-sync status. */
const initialSyncAllStatus = () => ({
  error: null,
  state: "idle",
  totalGames: null,
});

/** @param {Record<string, PlatformSyncStatus>} statuses Current statuses. @param {number} platformId Remote platform identifier. @param {PlatformSyncStatus} status Next status. @returns {Record<string, PlatformSyncStatus>} Updated statuses. */
const setPlatformStatus = (statuses, platformId, status) => ({
  ...statuses,
  [String(platformId)]: status,
});

/** @param {RommSyncPlatform[]} platforms Platform overview. @returns {Record<string, PlatformSyncStatus>} Syncing statuses for every platform. */
const getSyncingPlatformStatuses = (platforms) =>
  Object.fromEntries(
    platforms.map((platform) => [
      String(platform.romm_platform_id),
      { ...initialPlatformStatus(), state: "syncing" },
    ])
  );

/** @param {string} url RomM server URL. @param {string|null} token RomM token. @returns {string} Session key. */
const getSessionKey = (url, token) => `${url}\u0000${token ?? ""}`;

/** @param {{runtime: import("../app/app-runtime").AppRuntime, setPlatformStatuses: (update: (current: Record<string, PlatformSyncStatus>) => Record<string, PlatformSyncStatus>) => void}} options Event listener options. */
const useRommSyncEvents = ({ runtime, setPlatformStatuses }) => {
  useEffect(() => {
    let cancelled = false;
    /** @type {(() => void)|null} */
    let unlisten = null;
    const register = async () => {
      try {
        const cleanup = await runtime.listen(
          "romm-platform-sync-progress",
          /** @param {{payload: {romm_platform_id?: number, processed?: number, total?: number}}} event Progress event. */
          (event) => {
            const platformId = event.payload.romm_platform_id;
            if (platformId === undefined || platformId === null) {
              return;
            }
            setPlatformStatuses((current) => {
              const previous = current[String(platformId)] ?? {
                ...initialPlatformStatus(),
                state: "syncing",
              };
              return setPlatformStatus(current, platformId, {
                ...previous,
                progress: {
                  processed: event.payload.processed,
                  total: event.payload.total,
                },
                state: "syncing",
              });
            });
          }
        );
        if (cancelled) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
      } catch {
        // Progress events are optional when the Tauri event bridge is unavailable.
      }
    };
    void register();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [runtime, setPlatformStatuses]);
};

/** @param {{configured: boolean, rommToken: string|null, rommUrl: string, runtime: import("../app/app-runtime").AppRuntime, setPlatformStatuses: (update: (current: Record<string, PlatformSyncStatus>) => Record<string, PlatformSyncStatus>) => void, setSyncAllStatus: (status: SyncAllStatus) => void}} options Overview options. @returns {{platforms: RommSyncPlatform[], loading: boolean, error: string|null, setError: (error: string|null) => void, loadOverview: () => Promise<void>}} Overview state and loader. */
const useRommSyncOverview = ({
  configured,
  rommToken,
  rommUrl,
  runtime,
  setPlatformStatuses,
  setSyncAllStatus,
}) => {
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const requestRef = useRef(0);
  const sessionRef = useRef(initialSessionKey());

  const loadOverview = useCallback(async () => {
    if (!configured) {
      sessionRef.current = null;
      setPlatforms([]);
      setPlatformStatuses(() => initialPlatformStatuses());
      setSyncAllStatus(initialSyncAllStatus());
      setLoading(false);
      setError(null);
      return;
    }
    const sessionKey = getSessionKey(rommUrl, rommToken);
    if (sessionRef.current !== sessionKey) {
      sessionRef.current = sessionKey;
      setPlatformStatuses(() => initialPlatformStatuses());
      setSyncAllStatus(initialSyncAllStatus());
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    try {
      const result = await runtime.invoke("list_romm_sync_platforms", {
        serverUrl: rommUrl,
        token: rommToken,
      });
      if (requestId === requestRef.current) {
        setPlatforms(Array.isArray(result) ? result : []);
        setError(null);
        setLoading(false);
      }
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setError(getErrorMessage(loadError));
        setLoading(false);
      }
    }
  }, [
    configured,
    rommToken,
    rommUrl,
    runtime,
    setPlatformStatuses,
    setSyncAllStatus,
  ]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadOverview();
    });
  }, [loadOverview]);

  return { error, loadOverview, loading, platforms, setError };
};

/** @typedef {object} SyncActionContext
 * @property {boolean} configured Whether RomM credentials are available.
 * @property {(update: (current: Record<string, PlatformSyncStatus>) => Record<string, PlatformSyncStatus>) => void} setPlatformStatuses Updates scoped statuses.
 * @property {(status: SyncAllStatus) => void} setSyncAllStatus Updates full-sync status.
 * @property {(operation: ActiveSyncOperation) => boolean} tryStartOperation Acquires the activity guard.
 * @property {() => void} clearOperation Releases the activity guard.
 * @property {(error: string|null) => void} setError Updates the monitor error.
 * @property {string|null} rommToken Current RomM token.
 * @property {string} rommUrl Current RomM URL.
 * @property {import("../app/app-runtime").AppRuntime} runtime IPC runtime.
 * @property {() => Promise<void>} finishRefresh Refreshes library and overview data.
 */

/** @param {SyncActionContext} context Action dependencies. @param {number} platformId Remote platform identifier. @returns {Promise<void>} Completed scoped sync. */
const runSyncPlatform = async (context, platformId) => {
  const {
    clearOperation,
    configured,
    finishRefresh,
    rommToken,
    rommUrl,
    runtime,
    setError,
    setPlatformStatuses,
    tryStartOperation,
  } = context;
  if (!configured || rommToken === null) {
    setError(NOT_CONFIGURED_ERROR);
    return;
  }
  if (!tryStartOperation({ kind: "platform", platformId })) {
    return;
  }
  setError(null);
  setPlatformStatuses((current) =>
    setPlatformStatus(current, platformId, {
      ...initialPlatformStatus(),
      state: "syncing",
    })
  );
  /** @type {RommSyncResult|undefined} */
  let result;
  try {
    result = await runtime.invoke("sync_romm_platform", {
      rommPlatformId: platformId,
      serverUrl: rommUrl,
      token: rommToken,
    });
  } catch (syncError) {
    const message = getErrorMessage(syncError);
    setError(message);
    setPlatformStatuses((current) =>
      setPlatformStatus(current, platformId, {
        error: message,
        progress: current[String(platformId)]?.progress ?? null,
        result: null,
        state: "error",
      })
    );
    clearOperation();
    return;
  }
  setPlatformStatuses((current) =>
    setPlatformStatus(current, platformId, {
      error: null,
      progress: null,
      result,
      state: "success",
    })
  );
  try {
    await finishRefresh();
  } catch (refreshError) {
    setError(getRefreshErrorMessage(refreshError));
  }
  clearOperation();
};

/** @param {SyncActionContext & {platforms: RommSyncPlatform[]}} context Action dependencies. @returns {Promise<void>} Completed full sync. */
const runSyncAll = async (context) => {
  const {
    clearOperation,
    configured,
    finishRefresh,
    platforms,
    rommToken,
    rommUrl,
    runtime,
    setError,
    setPlatformStatuses,
    setSyncAllStatus,
    tryStartOperation,
  } = context;
  if (!configured || rommToken === null) {
    setError(NOT_CONFIGURED_ERROR);
    return;
  }
  if (!tryStartOperation({ kind: "all" })) {
    return;
  }
  setError(null);
  setSyncAllStatus({ error: null, state: "syncing", totalGames: null });
  setPlatformStatuses(() => getSyncingPlatformStatuses(platforms));
  /** @type {RommSyncResult|unknown[]|undefined} */
  let result;
  try {
    result = await runtime.invoke("sync_romm_library", {
      serverUrl: rommUrl,
      token: rommToken,
    });
  } catch (syncError) {
    const message = getErrorMessage(syncError);
    setError(message);
    setSyncAllStatus({ error: message, state: "error", totalGames: null });
    setPlatformStatuses((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, status]) => [
          id,
          status.state === "syncing"
            ? { ...status, error: message, state: "error" }
            : status,
        ])
      )
    );
    clearOperation();
    return;
  }
  const totalGames = Array.isArray(result)
    ? result.length
    : (result?.total_games ?? null);
  setSyncAllStatus({ error: null, state: "success", totalGames });
  setPlatformStatuses((current) =>
    Object.fromEntries(
      Object.entries(current).map(([id, status]) => [
        id,
        status.state === "syncing"
          ? { ...status, error: null, progress: null, state: "success" }
          : status,
      ])
    )
  );
  try {
    await finishRefresh();
  } catch (refreshError) {
    setError(getRefreshErrorMessage(refreshError));
  }
  clearOperation();
};

/** @param {{activeOperationRef: {current: ActiveSyncOperation}, setActiveOperation: (operation: ActiveSyncOperation) => void, setError: (error: string|null) => void, setPlatformStatuses: (update: (current: Record<string, PlatformSyncStatus>) => Record<string, PlatformSyncStatus>) => void, setSyncAllStatus: (status: SyncAllStatus) => void}} options Guard dependencies. @returns {{tryStartOperation: (operation: ActiveSyncOperation) => boolean, clearOperation: () => void}} Guard actions. */
const useSyncOperationGuard = ({
  activeOperationRef,
  setActiveOperation,
  setError,
  setPlatformStatuses,
  setSyncAllStatus,
}) => {
  const tryStartOperation = useCallback(
    /** @param {ActiveSyncOperation} operation Operation to acquire. @returns {boolean} Whether the operation was acquired. */
    (operation) => {
      if (activeOperationRef.current !== null) {
        setError(BUSY_ERROR);
        if (operation?.kind === "platform") {
          setPlatformStatuses((current) =>
            setPlatformStatus(current, operation.platformId, {
              ...initialPlatformStatus(),
              error: BUSY_ERROR,
              state: "error",
            })
          );
        } else {
          setSyncAllStatus({
            error: BUSY_ERROR,
            state: "error",
            totalGames: null,
          });
        }
        return false;
      }
      activeOperationRef.current = operation;
      setActiveOperation(operation);
      return true;
    },
    [
      activeOperationRef,
      setActiveOperation,
      setError,
      setPlatformStatuses,
      setSyncAllStatus,
    ]
  );
  const clearOperation = useCallback(() => {
    activeOperationRef.current = null;
    setActiveOperation(null);
  }, [activeOperationRef, setActiveOperation]);
  return { clearOperation, tryStartOperation };
};

/** @param {SyncActionContext} context Action dependencies. @returns {(platformId: number) => Promise<void>} Scoped sync action. */
const useRommSyncPlatformAction = (context) => {
  const {
    clearOperation,
    configured,
    finishRefresh,
    rommToken,
    rommUrl,
    runtime,
    setError,
    setPlatformStatuses,
    setSyncAllStatus,
    tryStartOperation,
  } = context;
  return useCallback(
    /** @param {number} platformId Remote platform identifier. */
    async (platformId) => {
      await runSyncPlatform(
        {
          clearOperation,
          configured,
          finishRefresh,
          rommToken,
          rommUrl,
          runtime,
          setError,
          setPlatformStatuses,
          setSyncAllStatus,
          tryStartOperation,
        },
        platformId
      );
    },
    [
      clearOperation,
      configured,
      finishRefresh,
      rommToken,
      rommUrl,
      runtime,
      setError,
      setPlatformStatuses,
      setSyncAllStatus,
      tryStartOperation,
    ]
  );
};

/** @param {SyncActionContext & {platforms: RommSyncPlatform[]}} context Action dependencies. @returns {() => Promise<void>} Full sync action. */
const useRommSyncAllAction = (context) => {
  const {
    clearOperation,
    configured,
    finishRefresh,
    platforms,
    rommToken,
    rommUrl,
    runtime,
    setError,
    setPlatformStatuses,
    setSyncAllStatus,
    tryStartOperation,
  } = context;
  return useCallback(async () => {
    await runSyncAll({
      clearOperation,
      configured,
      finishRefresh,
      platforms,
      rommToken,
      rommUrl,
      runtime,
      setError,
      setPlatformStatuses,
      setSyncAllStatus,
      tryStartOperation,
    });
  }, [
    clearOperation,
    configured,
    finishRefresh,
    platforms,
    rommToken,
    rommUrl,
    runtime,
    setError,
    setPlatformStatuses,
    setSyncAllStatus,
    tryStartOperation,
  ]);
};

/** @param {Omit<SyncActionContext, "tryStartOperation"|"clearOperation"> & {activeOperationRef: {current: ActiveSyncOperation}, platforms: RommSyncPlatform[], setActiveOperation: (operation: ActiveSyncOperation) => void}} context Action dependencies. @returns {{syncPlatform: (platformId: number) => Promise<void>, syncAll: () => Promise<void>}} Sync actions. */
const useRommSyncActions = (context) => {
  const operationGuard = useSyncOperationGuard({
    activeOperationRef: context.activeOperationRef,
    setActiveOperation: context.setActiveOperation,
    setError: context.setError,
    setPlatformStatuses: context.setPlatformStatuses,
    setSyncAllStatus: context.setSyncAllStatus,
  });
  const actionContext = { ...context, ...operationGuard };
  return {
    syncAll: useRommSyncAllAction(actionContext),
    syncPlatform: useRommSyncPlatformAction(actionContext),
  };
};

/** @param {{runtime: import("../app/app-runtime").AppRuntime, rommToken: string|null, rommUrl: string, refreshLibrary: () => Promise<unknown>}} options Monitor dependencies. @returns {RommSyncMonitorState} Monitor state and actions. */
export const useRommSyncMonitor = ({
  refreshLibrary,
  rommToken,
  rommUrl,
  runtime,
}) => {
  const configured = rommUrl !== "" && rommToken !== null && rommToken !== "";
  const [platformStatuses, setPlatformStatuses] = useState(
    initialPlatformStatuses
  );
  const [syncAllStatus, setSyncAllStatus] = useState(initialSyncAllStatus);
  const [activeOperation, setActiveOperation] = useState(
    initialActiveOperation
  );
  const activeOperationRef = useRef(initialActiveOperation());
  const overview = useRommSyncOverview({
    configured,
    rommToken,
    rommUrl,
    runtime,
    setPlatformStatuses,
    setSyncAllStatus,
  });
  useRommSyncEvents({ runtime, setPlatformStatuses });
  const actions = useRommSyncActions({
    activeOperationRef,
    configured,
    finishRefresh: async () => {
      const refreshes = await Promise.allSettled([
        refreshLibrary(),
        overview.loadOverview(),
      ]);
      const failedRefresh = refreshes.find(
        (refresh) => refresh.status === "rejected"
      );
      if (failedRefresh?.status === "rejected") {
        throw failedRefresh.reason;
      }
    },
    platforms: overview.platforms,
    rommToken,
    rommUrl,
    runtime,
    setActiveOperation,
    setError: overview.setError,
    setPlatformStatuses,
    setSyncAllStatus,
  });

  return {
    activeOperation,
    error: overview.error,
    loadOverview: overview.loadOverview,
    loading: overview.loading,
    platformStatuses,
    platforms: overview.platforms,
    syncAll: actions.syncAll,
    syncAllStatus,
    syncPlatform: actions.syncPlatform,
  };
};
