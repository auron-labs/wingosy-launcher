import { invoke } from "@tauri-apps/api/core";
import type { InvokeArgs } from "@tauri-apps/api/core";

import type {
  GamesPage,
  ImmersiveConfig,
  LaunchResult,
  PlatformEntry,
} from "./immersive-types";

const command = async <T>(name: string, args?: InvokeArgs) =>
  await invoke<T>(name, args);

export const getGamesPage = async (
  page: number,
  platformId: string | null,
  searchQuery: string | null
) =>
  await command<GamesPage>("get_games_page", {
    page,
    pageSize: 60,
    platformId,
    searchQuery,
  });

export const getPlatformsWithGames = async () =>
  await command<PlatformEntry[]>("get_platforms_with_games");

export const getImmersiveConfig = async () =>
  await command<ImmersiveConfig>("get_config");

export const listAmbientAudioFiles = async (directory: string) =>
  await command<string[]>("list_ambient_audio_files", { dir: directory });

export const saveImmersiveConfig = async (config: ImmersiveConfig) =>
  await command<unknown>("save_config", { config });

export const prepareAndLaunchGame = async (gameId: number | string) =>
  await command<LaunchResult>("prepare_and_launch_game", { gameId });

export const toggleFavorite = async (gameId: number | string) =>
  await command<boolean>("toggle_favorite", { gameId });
