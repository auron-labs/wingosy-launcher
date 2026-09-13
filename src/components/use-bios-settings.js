import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  getBiosTotals,
  orderBiosGroupsByLibraryRelevance,
} from "./bios-presentation";

/** @type {<T>(command: string, args?: Record<string, unknown>) => Promise<T> & PromiseLike<T>} */
const invoke = tauriInvoke;
/** @typedef {typeof invoke} BiosInvoke */

/** @typedef {import("./bios-types").BiosDistributionResult} BiosDistributionResult */
/** @typedef {import("./bios-types").BiosDownloadSummary} BiosDownloadSummary */
/** @typedef {import("./bios-types").BiosFirmware} BiosFirmware */
/** @typedef {import("./bios-types").BiosGroup} BiosGroup */
/** @typedef {import("./bios-types").BiosMessage} BiosMessage */
/** @typedef {import("./bios-types").LibraryPlatformEntry} LibraryPlatformEntry */

/** @typedef {{busy: string|null, message: BiosMessage|null, refresh: boolean}} BiosOperationSnapshot */

/** @type {LibraryPlatformEntry[]} */
const EMPTY_LIBRARY_PLATFORMS = [];

// BIOS pages are conditionally mounted, so operation state must outlive the page.
/** @type {Set<() => void>} */
const biosOperationListeners = new Set();
/** @type {BiosOperationSnapshot} */
let biosOperationSnapshot = { busy: null, message: null, refresh: false };

/** @param {() => void} listener - Subscriber to notify after an operation update. */
const subscribeToBiosOperation = (listener) => {
  biosOperationListeners.add(listener);
  return () => biosOperationListeners.delete(listener);
};

const getBiosOperationSnapshot = () => biosOperationSnapshot;

/** @param {Partial<BiosOperationSnapshot>} update - Snapshot fields to replace. */
const updateBiosOperation = (update) => {
  biosOperationSnapshot = { ...biosOperationSnapshot, ...update };
  for (const listener of biosOperationListeners) {
    listener();
  }
};

/** @param {string} operation - Identifier for the operation to start. */
const beginBiosOperation = (operation) => {
  if (biosOperationSnapshot.busy !== null) {
    return false;
  }
  updateBiosOperation({ busy: operation, message: null, refresh: false });
  return true;
};

/**
 * @param {string} operation - Identifier for the operation to finish.
 * @param {boolean} refresh - Whether a mounted page should reload firmware.
 */
const finishBiosOperation = (operation, refresh) => {
  if (biosOperationSnapshot.busy === operation) {
    updateBiosOperation({ busy: null, refresh });
  }
};

/** @param {unknown} error Error value from an operation. */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * @param {BiosFirmware[]} items Firmware entries to download.
 * @param {BiosInvoke} invokeBios BIOS command boundary.
 * @param {number} index Current firmware index.
 * @returns {Promise<void>} Resolves after the item is downloaded.
 */
const downloadFirmwareItems = async (items, invokeBios, index = 0) => {
  if (index >= items.length) {
    return;
  }
  const item = items[index];
  await invokeBios("download_bios_firmware", { firmwareId: item.id });
  await downloadFirmwareItems(items, invokeBios, index + 1);
};

/** @param {{operation: string, action: () => Promise<void>, isMountedRef: {current: boolean}, load: () => Promise<void>, reload: boolean}} options BIOS operation dependencies. */
const runBiosOperation = async ({
  operation,
  action,
  isMountedRef,
  load,
  reload,
}) => {
  if (!beginBiosOperation(operation)) {
    return;
  }
  try {
    await action();
    if (reload && isMountedRef.current) {
      await load();
    }
  } catch (error) {
    updateBiosOperation({
      message: { text: getErrorMessage(error), type: "error" },
    });
  }
  finishBiosOperation(operation, !isMountedRef.current);
};

/** @param {{invokeBios: BiosInvoke, load: () => Promise<void>, isMountedRef: {current: boolean}}} dependencies Download dependencies. @returns {(id: string|number, fileName: string) => Promise<void>} Download action. */
const createDownloadOne =
  ({ invokeBios, load, isMountedRef }) =>
  async (id, fileName) => {
    await runBiosOperation({
      action: async () => {
        /** @type {string} */
        const path = await invokeBios("download_bios_firmware", {
          firmwareId: id,
        });
        updateBiosOperation({
          message: {
            text: `${fileName} downloaded to ${path}`,
            type: "success",
          },
        });
      },
      isMountedRef,
      load,
      operation: `file:${id}`,
      reload: true,
    });
  };

/** @param {{invokeBios: BiosInvoke, load: () => Promise<void>, isMountedRef: {current: boolean}}} dependencies Download dependencies. @returns {() => Promise<void>} Download-all action. */
const createDownloadAll =
  ({ invokeBios, load, isMountedRef }) =>
  async () => {
    await runBiosOperation({
      action: async () => {
        /** @type {BiosDownloadSummary} */
        const result = await invokeBios("download_all_bios_firmware");
        updateBiosOperation({
          message: {
            text: `Downloaded ${result.downloaded}; ${result.skipped} already present.`,
            type: "success",
          },
        });
      },
      isMountedRef,
      load,
      operation: "all",
      reload: true,
    });
  };

/** @param {{invokeBios: BiosInvoke, load: () => Promise<void>, isMountedRef: {current: boolean}}} dependencies Download dependencies. @returns {(group: BiosGroup) => Promise<void>} Group download action. */
const createDownloadGroup =
  ({ invokeBios, load, isMountedRef }) =>
  /** @param {BiosGroup} group Firmware group. */
  async (group) => {
    const missingItems = group.items.filter(
      (item) => !item.missing_from_fs && !item.is_downloaded
    );
    if (missingItems.length === 0) {
      return;
    }
    await runBiosOperation({
      action: async () => {
        await downloadFirmwareItems(missingItems, invokeBios);
        updateBiosOperation({
          message: {
            text: `Downloaded ${missingItems.length} ${group.name} firmware file${missingItems.length === 1 ? "" : "s"}.`,
            type: "success",
          },
        });
      },
      isMountedRef,
      load,
      operation: `platform:${group.slug}`,
      reload: true,
    });
  };

/** @param {{invokeBios: BiosInvoke, load: () => Promise<void>, isMountedRef: {current: boolean}}} dependencies Download dependencies. @returns {() => Promise<void>} Distribution action. */
const createDistribute =
  ({ invokeBios, load, isMountedRef }) =>
  async () => {
    await runBiosOperation({
      action: async () => {
        /** @type {BiosDistributionResult[]} */
        const results = await invokeBios("distribute_bios_firmware");
        const copied = results.reduce(
          (sum, item) => sum + item.files_copied,
          0
        );
        const detail = results
          .filter((item) => item.files_copied > 0)
          .map((item) => `${item.emulator_id}: ${item.files_copied}`)
          .join(", ");
        updateBiosOperation({
          message: {
            text:
              copied > 0
                ? `Distributed ${copied} file copies (${detail}).`
                : "No BIOS files were copied. Configure a supported emulator first.",
            type: copied > 0 ? "success" : "warning",
          },
        });
      },
      isMountedRef,
      load,
      operation: "distribute",
      reload: false,
    });
  };

/** @param {{invokeBios: BiosInvoke, load: () => Promise<void>, isMountedRef: {current: boolean}}} dependencies Download dependencies. @returns {{distribute: () => Promise<void>, downloadAll: () => Promise<void>, downloadGroup: (group: BiosGroup) => Promise<void>, downloadOne: (id: string|number, fileName: string) => Promise<void>}} Actions. */
const useBiosDownloadActions = (dependencies) => ({
  distribute: createDistribute(dependencies),
  downloadAll: createDownloadAll(dependencies),
  downloadGroup: createDownloadGroup(dependencies),
  downloadOne: createDownloadOne(dependencies),
});

/** @param {{invokeBios: BiosInvoke, load: () => Promise<void>, openDirectory: (options: {directory: boolean, multiple: boolean}) => Promise<string|string[]|null>, setBiosDirectory: (directory: string) => void}} options BIOS directory dependencies. */
const useBiosDirectoryActions = ({
  invokeBios,
  load,
  openDirectory,
  setBiosDirectory,
}) => {
  const chooseDirectory = async () => {
    const selected = await openDirectory({ directory: true, multiple: false });
    if (selected === null || Array.isArray(selected) || selected === "") {
      return;
    }
    try {
      /** @type {string} */
      const directory = await invokeBios("set_bios_directory", {
        path: selected,
      });
      setBiosDirectory(directory);
      updateBiosOperation({
        message: {
          text: `BIOS directory set to ${directory}`,
          type: "success",
        },
      });
      await load();
    } catch (error) {
      updateBiosOperation({
        message: { text: getErrorMessage(error), type: "error" },
      });
    }
  };

  const resetDirectory = async () => {
    try {
      /** @type {string} */
      const directory = await invokeBios("set_bios_directory", { path: null });
      setBiosDirectory(directory);
      updateBiosOperation({
        message: {
          text: `BIOS directory reset to ${directory}`,
          type: "success",
        },
      });
      await load();
    } catch (error) {
      updateBiosOperation({
        message: { text: getErrorMessage(error), type: "error" },
      });
    }
  };

  return { chooseDirectory, resetDirectory };
};

/** @param {{firmware: BiosFirmware[], libraryPlatforms: LibraryPlatformEntry[]}} options BIOS presentation data. */
const useBiosPresentation = ({ firmware, libraryPlatforms }) => {
  const groups = useMemo(() => {
    /** @type {Map<string, BiosGroup>} */
    const byPlatform = new Map();
    for (const item of firmware) {
      const group = byPlatform.get(item.platform_slug) ?? {
        items: [],
        name: item.platform_name,
        slug: item.platform_slug,
      };
      group.items.push(item);
      byPlatform.set(item.platform_slug, group);
    }
    return orderBiosGroupsByLibraryRelevance(
      [...byPlatform.values()],
      libraryPlatforms
    );
  }, [firmware, libraryPlatforms]);

  const libraryPlatformIds = useMemo(() => {
    /** @type {Set<string|number>} */
    const ids = new Set();
    for (const entry of libraryPlatforms) {
      const id = Array.isArray(entry) ? entry[0]?.id : entry?.id;
      if (id !== undefined) {
        ids.add(id);
      }
    }
    return ids;
  }, [libraryPlatforms]);

  return { groups, libraryPlatformIds, totals: getBiosTotals(firmware) };
};

/** @returns {{biosDirectory: string, expanded: Record<string, boolean>, firmware: BiosFirmware[], initialLoadRef: {current: boolean}, isMountedRef: {current: boolean}, loadRequestRef: {current: number}, loading: boolean, operation: BiosOperationSnapshot, refreshHandledRef: {current: boolean}, setBiosDirectory: import("react").Dispatch<import("react").SetStateAction<string>>, setExpanded: import("react").Dispatch<import("react").SetStateAction<Record<string, boolean>>>, setFirmware: import("react").Dispatch<import("react").SetStateAction<BiosFirmware[]>>, setLoading: import("react").Dispatch<import("react").SetStateAction<boolean>>}} BIOS state. */
const useBiosState = () => {
  /** @type {BiosFirmware[]} */
  const initialFirmware = [];
  const [firmware, setFirmware] = useState(initialFirmware);
  const [biosDirectory, setBiosDirectory] = useState("");
  /** @type {Record<string, boolean>} */
  const initialExpanded = {};
  const [expanded, setExpanded] = useState(initialExpanded);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(false);
  const initialLoadRef = useRef(true);
  const refreshHandledRef = useRef(false);
  const loadRequestRef = useRef(0);
  const operation = useSyncExternalStore(
    subscribeToBiosOperation,
    getBiosOperationSnapshot,
    getBiosOperationSnapshot
  );
  return {
    biosDirectory,
    expanded,
    firmware,
    initialLoadRef,
    isMountedRef,
    loadRequestRef,
    loading,
    operation,
    refreshHandledRef,
    setBiosDirectory,
    setExpanded,
    setFirmware,
    setLoading,
  };
};

/** @param {{invokeBios: BiosInvoke, state: ReturnType<typeof useBiosState>}} options BIOS loading dependencies. */
const useBiosLoading = ({ invokeBios, state }) => {
  const {
    initialLoadRef,
    isMountedRef,
    loadRequestRef,
    refreshHandledRef,
    setBiosDirectory,
    setFirmware,
    setLoading,
  } = state;
  const { refresh } = state.operation;
  const load = useCallback(async () => {
    loadRequestRef.current += 1;
    const requestId = loadRequestRef.current;
    setLoading(true);
    try {
      /** @type {Promise<string>} */
      const directoryPromise = invokeBios("get_bios_directory");
      /** @type {Promise<BiosFirmware[]>} */
      const itemsPromise = invokeBios("list_bios_firmware");
      const [directory, items] = await Promise.all([
        directoryPromise,
        itemsPromise,
      ]);
      if (requestId === loadRequestRef.current) {
        setBiosDirectory(directory);
        setFirmware(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        updateBiosOperation({
          message: { text: getErrorMessage(error), type: "error" },
        });
      }
    }
    if (requestId === loadRequestRef.current) {
      setLoading(false);
    }
  }, [invokeBios, loadRequestRef, setBiosDirectory, setFirmware, setLoading]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [isMountedRef]);

  useEffect(() => {
    if (!initialLoadRef.current && !refresh) {
      refreshHandledRef.current = false;
      return;
    }
    if (refresh && refreshHandledRef.current) {
      return;
    }
    initialLoadRef.current = false;
    refreshHandledRef.current = refresh;
    void load();
  }, [initialLoadRef, load, refresh, refreshHandledRef]);

  return { isMountedRef, load };
};

/**
 * @typedef {object} BiosSettingsOptions
 * @property {LibraryPlatformEntry[]} [libraryPlatforms] Platforms available in the library.
 * @property {BiosInvoke} [invokeBios] BIOS command boundary.
 * @property {(options: {directory: boolean, multiple: boolean}) => Promise<string|string[]|null>} [openDirectory] Directory picker boundary.
 */

/** @param {BiosSettingsOptions} options BIOS settings options. */
export const useBiosSettings = ({
  invokeBios = invoke,
  libraryPlatforms = EMPTY_LIBRARY_PLATFORMS,
  openDirectory = open,
}) => {
  const state = useBiosState();
  const { isMountedRef, load } = useBiosLoading({ invokeBios, state });
  const { busy, message } = state.operation;
  const {
    biosDirectory,
    expanded,
    firmware,
    loading,
    setBiosDirectory,
    setExpanded,
  } = state;

  const { groups, libraryPlatformIds, totals } = useBiosPresentation({
    firmware,
    libraryPlatforms,
  });
  const downloadActions = useBiosDownloadActions({
    invokeBios,
    isMountedRef,
    load,
  });
  const directoryActions = useBiosDirectoryActions({
    invokeBios,
    load,
    openDirectory,
    setBiosDirectory,
  });

  return {
    biosDirectory,
    busy,
    ...directoryActions,
    ...downloadActions,
    expanded,
    firmware,
    groups,
    libraryPlatformIds,
    load,
    loading,
    message,
    setExpanded,
    totals,
  };
};
