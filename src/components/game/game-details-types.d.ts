export interface GameDetailsGame {
  id: number | string;
  platform_id: string;
  name: string;
  file_path?: string;
  source?: string | null;
  romm_id?: number | null;
  summary?: string | null;
  developer?: string | null;
  publisher?: string | null;
  release_year?: number | null;
  genres?: string[] | null;
  player_count?: string | null;
  cover_path?: string | null;
  screenshot_paths?: string[] | null;
  is_favorite?: boolean;
  is_hidden?: boolean;
  user_rating?: number | null;
  last_played_at?: string | Date | null;
  play_count?: number | null;
  play_time_minutes?: number | null;
  sync_state?: string | null;
  local_file_path?: string | null;
}

export interface GameDetailsPlatform {
  id: string;
  name: string;
}

export interface GameDetailsSave {
  id: number;
  file_name: string;
  slot?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface GameDetailsCollection {
  id: number;
  name: string;
  is_smart?: boolean;
}

export interface GameDetailsProgress {
  active?: boolean;
  stage?: string;
  percent?: number | null;
  downloaded?: number | null;
  total?: number | null;
  file_index?: number | null;
  total_files?: number | null;
  error?: string | null;
}

export interface GameDetailsLaunchResult {
  success?: boolean;
  error?: string | { message?: string } | null;
  save_sync_messages?: string[] | null;
  save_sync_warnings?: string[] | null;
}

export interface GameDetailsLaunchErrorPresentation {
  message: string;
  guidance: string;
  retryable: boolean;
  kind: "missing-emulator" | "other";
}

export interface EmulatorInfo {
  id: string;
  name: string;
  is_installed: boolean;
  installed_path: string | null;
  install_type: string | null;
  version: string | null;
  has_download: boolean;
  supported_platforms: string[];
}

export interface GameDetailsSwitchSyncResult {
  backupSaveId?: number | null;
  backupSlot?: string | null;
  message?: string | null;
  downloaded?: number | null;
  reused?: number | null;
}

export interface GameDetailsSwitchSaveRevision {
  id: number;
  file_name: string;
  file_size_bytes?: number | null;
  emulator?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  slot?: string | null;
}

export interface GameDetailsSwitchSaveRestoreProtection {
  selected_revision: GameDetailsSwitchSaveRevision;
}

export interface GameDetailsSwitchPathInfo {
  title_id: string;
  local_save_path: string;
}

export interface GameDetailsConfig {
  display?: {
    retroachievements_enabled?: boolean;
  };
  romm?: {
    sync_saves?: boolean;
  };
}

export interface GameDetailsAchievementsAchievement {
  id: string | number;
  title: string;
  description?: string | null;
  points?: number | null;
  achievement_type?: string | null;
  badge_url?: string | null;
  badge_url_lock?: string | null;
  unlocked?: boolean;
  unlocked_hardcore?: boolean;
  unlocked_at?: string | null;
}

export interface GameDetailsStatus {
  message: string;
  type: "error" | "info" | "success";
  retry?: () => Promise<void>;
  conflict?: boolean;
}
