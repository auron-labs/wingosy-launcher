import { useState } from "react";

/** @typedef {{id: string|number, name: string, platform_id?: string, local_file_path?: string|null, source?: string, romm_id?: number|null}} SettingsGame */
/** @typedef {{tracked_rom_count?: number, tracked_rom_bytes?: number, active_rom_downloads?: number, free_disk_bytes?: number, using_default_roms_directory?: boolean, migratable_rom_count?: number, migratable_rom_bytes?: number, roms_directory?: string, locations: Array<{key: string, label: string, path: string, exists: boolean, bytes?: number}>}} StorageOverview */

/** @type {SettingsGame[]} */
const EMPTY_HIDDEN_GAMES = [];
/** @param {StorageOverview|null} value Initial storage overview. @returns {StorageOverview|null} Initial storage overview. */
const createEmptyStorageOverview = (value) => value;

const useSettingsLibraryState = () => {
  const [hiddenGames, setHiddenGames] = useState(EMPTY_HIDDEN_GAMES);
  const [hiddenDialogOpen, setHiddenDialogOpen] = useState(false);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [romsDirectory, setRomsDirectory] = useState("");
  const [storageOverview, setStorageOverview] = useState(
    createEmptyStorageOverview(null)
  );
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageChangeBusy, setStorageChangeBusy] = useState(false);
  const [pendingRomsDirectory, setPendingRomsDirectory] = useState("");
  const [storageMigrationDialogOpen, setStorageMigrationDialogOpen] =
    useState(false);

  return {
    hiddenDialogOpen,
    hiddenGames,
    hiddenLoading,
    pendingRomsDirectory,
    romsDirectory,
    setHiddenDialogOpen,
    setHiddenGames,
    setHiddenLoading,
    setPendingRomsDirectory,
    setRomsDirectory,
    setStorageChangeBusy,
    setStorageLoading,
    setStorageMigrationDialogOpen,
    setStorageOverview,
    storageChangeBusy,
    storageLoading,
    storageMigrationDialogOpen,
    storageOverview,
  };
};

export default useSettingsLibraryState;
