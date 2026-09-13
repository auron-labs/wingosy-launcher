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
}

export interface GameDetailsLaunchErrorPresentation {
  message: string;
  guidance: string;
  retryable: boolean;
}

export interface GameDetailsSwitchSyncResult {
  message?: string | null;
  downloaded?: number | null;
  reused?: number | null;
}

export interface GameDetailsSwitchPathInfo {
  title_id: string;
  local_save_path: string;
}

export interface GameDetailsConfig {
  display?: {
    retroachievements_enabled?: boolean;
  };
}

export interface GameDetailsAchievementsAchievement {
  id: string | number;
  title: string;
  description?: string | null;
  points?: number | null;
  unlocked?: boolean;
}

export interface GameDetailsStatus {
  message: string;
  type: "error" | "info" | "success";
  retry?: () => Promise<void>;
}
