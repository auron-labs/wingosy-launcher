import { invoke } from "@tauri-apps/api/core";
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
} from "./biosPresentation";

/** @typedef {import("./bios-types").BiosDistributionResult} BiosDistributionResult */
/** @typedef {import("./bios-types").BiosDownloadSummary} BiosDownloadSummary */
/** @typedef {import("./bios-types").BiosFirmware} BiosFirmware */
/** @typedef {import("./bios-types").BiosGroup} BiosGroup */
/** @typedef {import("./bios-types").BiosMessage} BiosMessage */
/** @typedef {import("./bios-types").LibraryPlatformEntry} LibraryPlatformEntry */

/** @typedef {{busy: string|null, message: BiosMessage|null, refresh: boolean}} BiosOperationSnapshot */

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

/** @param {unknown} error */
const getErrorMessage = (error) =>
  error instanceof Error ? error.message : String(error);

/**
 * @param {BiosFirmware[]} items
 * @param {number} index
 * @returns {Promise<void>}
 */
const downloadFirmwareItems = async (items, index = 0) => {
  const item = items[index];
  if (!item) {
    return;
  }
  await invoke("download_bios_firmware", { firmwareId: item.id });
  await downloadFirmwareItems(items, index + 1);
};

/**
 * @typedef {object} BiosSettingsOptions
 * @property {LibraryPlatformEntry[]} [libraryPlatforms]
 */

/** @param {BiosSettingsOptions} options */
export const useBiosSettings = ({ libraryPlatforms = [] }) => {
  const [firmware, setFirmware] = useState(/** @type {BiosFirmware[]} */ ([]));
  const [biosDirectory, setBiosDirectory] = useState("");
  const [expanded, setExpanded] = useState(
    /** @type {Record<string, boolean>} */ ({})
  );
  const [loading, setLoading] = useState(true);
  const { busy, message, refresh } = useSyncExternalStore(
    subscribeToBiosOperation,
    getBiosOperationSnapshot,
    getBiosOperationSnapshot
  );
  const isMountedRef = useRef(false);
  const initialLoadRef = useRef(true);
  // Refresh events must be consumed once, including under StrictMode effect replay.
  const refreshHandledRef = useRef(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    try {
      const [directory, items] = await Promise.all([
        /** @type {Promise<string>} */ (invoke("get_bios_directory")),
        /** @type {Promise<BiosFirmware[]>} */ (invoke("list_bios_firmware")),
      ]);
      if (requestId !== loadRequestRef.current) {
        return;
      }
      setBiosDirectory(directory);
      setFirmware(Array.isArray(items) ? items : []);
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        updateBiosOperation({
          message: { text: getErrorMessage(error), type: "error" },
        });
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
  }, [load, refresh]);

  const groups = useMemo(() => {
    const byPlatform = /** @type {Map<string, BiosGroup>} */ (new Map());
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

  const libraryPlatformIds = useMemo(
    () =>
      new Set(
        libraryPlatforms
          .map((entry) => (Array.isArray(entry) ? entry[0]?.id : entry?.id))
          .filter((id) => id !== undefined && id !== null && id !== "")
      ),
    [libraryPlatforms]
  );

  const totals = getBiosTotals(firmware);

  const downloadOne = async (id, fileName) => {
    const operation = `file:${id}`;
    if (!beginBiosOperation(operation)) {
      return;
    }
    try {
      const path = await /** @type {Promise<string>} */ (
        invoke("download_bios_firmware", { firmwareId: id })
      );
      updateBiosOperation({
        message: { text: `${fileName} downloaded to ${path}`, type: "success" },
      });
      if (isMountedRef.current) {
        await load();
      }
    } catch (error) {
      updateBiosOperation({
        message: { text: getErrorMessage(error), type: "error" },
      });
    } finally {
      finishBiosOperation(operation, !isMountedRef.current);
    }
  };

  const downloadAll = async () => {
    const operation = "all";
    if (!beginBiosOperation(operation)) {
      return;
    }
    try {
      const result = await /** @type {Promise<BiosDownloadSummary>} */ (
        invoke("download_all_bios_firmware")
      );
      updateBiosOperation({
        message: {
          text: `Downloaded ${result.downloaded}; ${result.skipped} already present.`,
          type: "success",
        },
      });
      if (isMountedRef.current) {
        await load();
      }
    } catch (error) {
      updateBiosOperation({
        message: { text: getErrorMessage(error), type: "error" },
      });
    } finally {
      finishBiosOperation(operation, !isMountedRef.current);
    }
  };

  const downloadGroup = async (group) => {
    const missingItems = group.items.filter(
      (item) => !item.missing_from_fs && !item.is_downloaded
    );
    if (missingItems.length === 0) {
      return;
    }

    const operation = `platform:${group.slug}`;
    if (!beginBiosOperation(operation)) {
      return;
    }
    try {
      await downloadFirmwareItems(missingItems);
      updateBiosOperation({
        message: {
          text: `Downloaded ${missingItems.length} ${group.name} firmware file${missingItems.length === 1 ? "" : "s"}.`,
          type: "success",
        },
      });
      if (isMountedRef.current) {
        await load();
      }
    } catch (error) {
      updateBiosOperation({
        message: { text: getErrorMessage(error), type: "error" },
      });
    } finally {
      finishBiosOperation(operation, !isMountedRef.current);
    }
  };

  const distribute = async () => {
    const operation = "distribute";
    if (!beginBiosOperation(operation)) {
      return;
    }
    try {
      const results = await /** @type {Promise<BiosDistributionResult[]>} */ (
        invoke("distribute_bios_firmware")
      );
      const copied = results.reduce((sum, item) => sum + item.files_copied, 0);
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
    } catch (error) {
      updateBiosOperation({
        message: { text: getErrorMessage(error), type: "error" },
      });
    } finally {
      finishBiosOperation(operation, false);
    }
  };

  const chooseDirectory = async () => {
    const selected = await /** @type {Promise<string|null>} */ (
      open({ directory: true, multiple: false })
    );
    if (!selected) {
      return;
    }
    try {
      const directory = await /** @type {Promise<string>} */ (
        invoke("set_bios_directory", { path: selected })
      );
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
      const directory = await /** @type {Promise<string>} */ (
        invoke("set_bios_directory", { path: null })
      );
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

  return {
    biosDirectory,
    busy,
    chooseDirectory,
    distribute,
    downloadAll,
    downloadGroup,
    downloadOne,
    expanded,
    firmware,
    groups,
    libraryPlatformIds,
    load,
    loading,
    message,
    resetDirectory,
    setExpanded,
    totals,
  };
};
