import type {
  GameDetailsAchievementsAchievement,
  GameDetailsCollection,
  GameDetailsConfig,
  EmulatorInfo,
  GameDetailsSave,
  GameDetailsSwitchPathInfo,
  GameDetailsSwitchSaveRestoreProtection,
  GameDetailsSwitchSyncResult,
} from "../components/game/game-details-types";
import type {
  GamesPage,
  ImmersiveConfig,
  LaunchResult,
  PlatformEntry,
} from "../immersive/immersive-types";

interface TestInvokeArgs {
  collectionId?: number;
  config?: ImmersiveConfig;
  emulatorId?: string;
  filePath?: string;
  gameId?: number | string;
  page?: number;
  pageSize?: number;
  platformId?: string | null;
  rommId?: number;
  refreshProgression?: boolean;
  saveId?: number | null;
  searchQuery?: string | null;
  serverUrl?: string;
  slot?: string | null;
  token?: string;
}

export interface GameDetailsTestInvoke {
  (
    command: "download_emulator" | "download_game_save",
    args?: TestInvokeArgs
  ): Promise<string>;
  (
    command:
      | "download_switch_save"
      | "sync_current_switch_save"
      | "sync_switch_content"
      | "upload_switch_save",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSwitchSyncResult>;
  (
    command: "get_collections",
    args?: TestInvokeArgs
  ): Promise<GameDetailsCollection[]>;
  (
    command: "get_emulators_for_platform",
    args?: TestInvokeArgs
  ): Promise<EmulatorInfo[]>;
  (command: "get_config", args?: TestInvokeArgs): Promise<GameDetailsConfig>;
  (
    command: "get_game_saves" | "get_switch_game_saves",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSave[]>;
  (
    command: "get_switch_save_path_info",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSwitchPathInfo>;
  (
    command: "get_switch_save_restore_protection",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSwitchSaveRestoreProtection | null>;
  (
    command: "resume_switch_save_normal_sync",
    args?: TestInvokeArgs
  ): Promise<void>;
  (
    command:
      | "add_game_to_collection"
      | "delete_local_rom"
      | "download_rom"
      | "open_rom_location"
      | "refresh_game_metadata"
      | "save_config"
      | "toggle_game_hidden"
      | "upload_game_save",
    args?: TestInvokeArgs
  ): Promise<object>;
  (
    command: "get_romm_retroachievements",
    args?: TestInvokeArgs
  ): Promise<GameDetailsAchievementsAchievement[]>;
}

export interface ImmersiveTestInvoke {
  (
    command: "get_config",
    args?: TestInvokeArgs
  ): ImmersiveConfig | Promise<ImmersiveConfig>;
  (
    command: "get_games_page",
    args?: TestInvokeArgs
  ): GamesPage | Promise<GamesPage>;
  (
    command: "get_platforms_with_games",
    args?: TestInvokeArgs
  ): PlatformEntry[] | Promise<PlatformEntry[]>;
  (
    command: "prepare_and_launch_game",
    args?: TestInvokeArgs
  ): LaunchResult | Promise<LaunchResult>;
}
