import { invoke } from "@tauri-apps/api/core";
import type { InvokeArgs } from "@tauri-apps/api/core";

import type {
  GameDetailsCollection,
  GameDetailsConfig,
  GameDetailsGame,
  GameDetailsSave,
  GameDetailsSwitchPathInfo,
  GameDetailsSwitchSyncResult,
} from "./game-details-types";

const command = async <T>(name: string, args?: InvokeArgs) =>
  args === undefined ? await invoke<T>(name) : await invoke<T>(name, args);

export const getGameDetailsConfig = async () =>
  await command<GameDetailsConfig>("get_config");

export const getSwitchSavePathInfo = async (gameId: GameDetailsGame["id"]) =>
  await command<GameDetailsSwitchPathInfo>("get_switch_save_path_info", {
    gameId,
  });

export const downloadRom = async (
  gameId: GameDetailsGame["id"],
  serverUrl: string,
  token: string
) => await command<unknown>("download_rom", { gameId, serverUrl, token });

export const syncSwitchContent = async (gameId: GameDetailsGame["id"]) =>
  await command<GameDetailsSwitchSyncResult>("sync_switch_content", { gameId });

export const getGameSaves = async (
  rommId: number,
  serverUrl: string,
  token: string
) =>
  await command<GameDetailsSave[]>("get_game_saves", {
    rommId,
    serverUrl,
    token,
  });

export const downloadSwitchSave = async (
  gameId: GameDetailsGame["id"],
  saveId: number | null,
  slot: string | null
) =>
  await command<GameDetailsSwitchSyncResult>("download_switch_save", {
    gameId,
    saveId,
    slot,
  });

export const downloadGameSave = async (
  rommId: number,
  saveId: number,
  serverUrl: string,
  token: string
) =>
  await command<string>("download_game_save", {
    rommId,
    saveId,
    serverUrl,
    token,
  });

export const uploadSwitchSave = async (
  gameId: GameDetailsGame["id"],
  slot: string | null
) =>
  await command<GameDetailsSwitchSyncResult>("upload_switch_save", {
    gameId,
    slot,
  });

export const uploadGameSave = async (
  filePath: string,
  rommId: number,
  serverUrl: string,
  token: string
) =>
  await command<unknown>("upload_game_save", {
    filePath,
    rommId,
    serverUrl,
    token,
  });

export const deleteLocalRom = async (gameId: GameDetailsGame["id"]) =>
  await command<unknown>("delete_local_rom", { gameId });

export const toggleGameHidden = async (gameId: GameDetailsGame["id"]) =>
  await command<unknown>("toggle_game_hidden", { gameId });

export const refreshGameMetadata = async (
  gameId: GameDetailsGame["id"],
  serverUrl: string,
  token: string
) =>
  await command<unknown>("refresh_game_metadata", { gameId, serverUrl, token });

export const openRomLocation = async (gameId: GameDetailsGame["id"]) =>
  await command<unknown>("open_rom_location", { gameId });

export const getCollections = async () =>
  await command<GameDetailsCollection[]>("get_collections");

export const addGameToCollection = async (
  collectionId: number,
  gameId: GameDetailsGame["id"]
) => await command<unknown>("add_game_to_collection", { collectionId, gameId });

export const gameDetailsIpc = {
  addGameToCollection,
  deleteLocalRom,
  downloadGameSave,
  downloadRom,
  downloadSwitchSave,
  getCollections,
  getGameDetailsConfig,
  getGameSaves,
  getSwitchSavePathInfo,
  openRomLocation,
  refreshGameMetadata,
  syncSwitchContent,
  toggleGameHidden,
  uploadGameSave,
  uploadSwitchSave,
};

export type GameDetailsIpc = typeof gameDetailsIpc;
