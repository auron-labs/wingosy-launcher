import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [busy, setBusy] = useState(/** @type {string|null} */ (null));
  const [message, setMessage] = useState(
    /** @type {BiosMessage|null} */ (null)
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [directory, items] = await Promise.all([
        /** @type {Promise<string>} */ (invoke("get_bios_directory")),
        /** @type {Promise<BiosFirmware[]>} */ (invoke("list_bios_firmware")),
      ]);
      setBiosDirectory(directory);
      setFirmware(Array.isArray(items) ? items : []);
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    setBusy(`file:${id}`);
    setMessage(null);
    try {
      const path = await /** @type {Promise<string>} */ (
        invoke("download_bios_firmware", { firmwareId: id })
      );
      setMessage({
        text: `${fileName} downloaded to ${path}`,
        type: "success",
      });
      await load();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setBusy("all");
    setMessage(null);
    try {
      const result = await /** @type {Promise<BiosDownloadSummary>} */ (
        invoke("download_all_bios_firmware")
      );
      setMessage({
        text: `Downloaded ${result.downloaded}; ${result.skipped} already present.`,
        type: "success",
      });
      await load();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const downloadGroup = async (group) => {
    const missingItems = group.items.filter(
      (item) => !item.missing_from_fs && !item.is_downloaded
    );
    if (missingItems.length === 0) {
      return;
    }

    setBusy(`platform:${group.slug}`);
    setMessage(null);
    try {
      await downloadFirmwareItems(missingItems);
      setMessage({
        text: `Downloaded ${missingItems.length} ${group.name} firmware file${missingItems.length === 1 ? "" : "s"}.`,
        type: "success",
      });
      await load();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
    } finally {
      setBusy(null);
    }
  };

  const distribute = async () => {
    setBusy("distribute");
    setMessage(null);
    try {
      const results = await /** @type {Promise<BiosDistributionResult[]>} */ (
        invoke("distribute_bios_firmware")
      );
      const copied = results.reduce((sum, item) => sum + item.files_copied, 0);
      const detail = results
        .filter((item) => item.files_copied > 0)
        .map((item) => `${item.emulator_id}: ${item.files_copied}`)
        .join(", ");
      setMessage({
        text:
          copied > 0
            ? `Distributed ${copied} file copies (${detail}).`
            : "No BIOS files were copied. Configure a supported emulator first.",
        type: copied > 0 ? "success" : "warning",
      });
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
    } finally {
      setBusy(null);
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
      setMessage({
        text: `BIOS directory set to ${directory}`,
        type: "success",
      });
      await load();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
    }
  };

  const resetDirectory = async () => {
    try {
      const directory = await /** @type {Promise<string>} */ (
        invoke("set_bios_directory", { path: null })
      );
      setBiosDirectory(directory);
      setMessage({
        text: `BIOS directory reset to ${directory}`,
        type: "success",
      });
      await load();
    } catch (error) {
      setMessage({ text: getErrorMessage(error), type: "error" });
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
