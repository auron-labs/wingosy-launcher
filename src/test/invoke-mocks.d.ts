import type {
  GameDetailsCollection,
  GameDetailsConfig,
  GameDetailsSave,
  GameDetailsSwitchPathInfo,
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
  filePath?: string;
  gameId?: number | string;
  page?: number;
  pageSize?: number;
  platformId?: string | null;
  rommId?: number;
  saveId?: number | null;
  searchQuery?: string | null;
  serverUrl?: string;
  slot?: string | null;
  token?: string;
}

export interface GameDetailsTestInvoke {
  (command: "download_game_save", args?: TestInvokeArgs): Promise<string>;
  (
    command:
      | "download_switch_save"
      | "sync_switch_content"
      | "upload_switch_save",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSwitchSyncResult>;
  (
    command: "get_collections",
    args?: TestInvokeArgs
  ): Promise<GameDetailsCollection[]>;
  (command: "get_config", args?: TestInvokeArgs): Promise<GameDetailsConfig>;
  (
    command: "get_game_saves",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSave[]>;
  (
    command: "get_switch_save_path_info",
    args?: TestInvokeArgs
  ): Promise<GameDetailsSwitchPathInfo>;
  (
    command:
      | "add_game_to_collection"
      | "delete_local_rom"
      | "download_rom"
      | "open_rom_location"
      | "refresh_game_metadata"
      | "toggle_game_hidden"
      | "upload_game_save",
    args?: TestInvokeArgs
  ): Promise<object>;
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
