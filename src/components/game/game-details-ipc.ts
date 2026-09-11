import { invoke } from '@tauri-apps/api/core';
import type { InvokeArgs } from '@tauri-apps/api/core';

import type {
  GameDetailsCollection,
  GameDetailsConfig,
  GameDetailsGame,
  GameDetailsSave,
  GameDetailsSwitchPathInfo,
  GameDetailsSwitchSyncResult,
} from "./game-details-types";

const command = <T>(name: string, args?: InvokeArgs) => invoke<T>(name, args);

export const getGameDetailsConfig = () =>
  command<GameDetailsConfig>("get_config");

export const getSwitchSavePathInfo = (gameId: GameDetailsGame["id"]) =>
  command<GameDetailsSwitchPathInfo>("get_switch_save_path_info", { gameId });

export const downloadRom = (
  gameId: GameDetailsGame["id"],
  serverUrl: string,
  token: string
) => command<unknown>("download_rom", { gameId, serverUrl, token });

export const syncSwitchContent = (gameId: GameDetailsGame["id"]) =>
  command<GameDetailsSwitchSyncResult>("sync_switch_content", { gameId });

export const getGameSaves = (
  rommId: number,
  serverUrl: string,
  token: string
) => command<GameDetailsSave[]>("get_game_saves", { rommId, serverUrl, token });

export const downloadSwitchSave = (
  gameId: GameDetailsGame["id"],
  saveId: number | null,
  slot: string | null
) =>
  command<GameDetailsSwitchSyncResult>("download_switch_save", {
    gameId,
    saveId,
    slot,
  });

export const downloadGameSave = (
  rommId: number,
  saveId: number,
  serverUrl: string,
  token: string
) =>
  command<string>("download_game_save", {
    rommId,
    saveId,
    serverUrl,
    token,
  });

export const uploadSwitchSave = (
  gameId: GameDetailsGame["id"],
  slot: string | null
) =>
  command<GameDetailsSwitchSyncResult>("upload_switch_save", { gameId, slot });

export const uploadGameSave = (
  filePath: string,
  rommId: number,
  serverUrl: string,
  token: string
) => command<unknown>("upload_game_save", { filePath, rommId, serverUrl, token });

export const deleteLocalRom = (gameId: GameDetailsGame["id"]) =>
  command<unknown>("delete_local_rom", { gameId });

export const toggleGameHidden = (gameId: GameDetailsGame["id"]) =>
  command<unknown>("toggle_game_hidden", { gameId });

export const refreshGameMetadata = (
  gameId: GameDetailsGame["id"],
  serverUrl: string,
  token: string
) => command<unknown>("refresh_game_metadata", { gameId, serverUrl, token });

export const openRomLocation = (gameId: GameDetailsGame["id"]) =>
  command<unknown>("open_rom_location", { gameId });

export const getCollections = () =>
  command<GameDetailsCollection[]>("get_collections");

export const addGameToCollection = (
  collectionId: number,
  gameId: GameDetailsGame["id"]
) => command<unknown>("add_game_to_collection", { collectionId, gameId });
