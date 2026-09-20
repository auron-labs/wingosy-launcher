export interface ImmersiveGame {
  id: number | string;
  name: string;
  platform_id: string;
  file_path?: string;
  source?: string | null;
  romm_id?: number | null;
  summary?: string | null;
  cover_path?: string | null;
  genres?: string[] | null;
  screenshot_paths?: string[];
  is_favorite?: boolean;
  is_hidden?: boolean;
  local_file_path?: string | null;
  sync_state?: string | null;
  last_played_at?: string | Date | null;
  genres?: string[] | null;
}

export interface ImmersivePlatform {
  id: string;
  name: string;
  short_name?: string | null;
}

export type PlatformEntry = [ImmersivePlatform, number];

export interface GamesPage {
  games: ImmersiveGame[];
  total: number;
}

export interface AmbientAudioConfig {
  ambient_enabled?: boolean;
  ambient_path?: string | null;
  ambient_is_folder?: boolean;
  ambient_shuffle?: boolean;
  ambient_volume?: number;
}

export interface ImmersiveConfig {
  display?: {
    big_picture?: boolean;
    fullscreen?: boolean;
    controller_deadzone?: number;
    retroachievements_enabled?: boolean;
  };
  audio?: AmbientAudioConfig;
}

export interface LaunchResult {
  success: boolean;
  error?: string;
  save_sync_messages?: string[] | null;
  save_sync_warnings?: string[] | null;
}
