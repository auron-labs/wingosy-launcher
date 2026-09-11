export interface BiosFirmware {
  file_name: string;
  file_size_bytes: number;
  id: number;
  is_downloaded: boolean;
  local_path: string | null;
  md5_hash: string | null;
  missing_from_fs: boolean;
  platform_name: string;
  platform_slug: string;
}

export interface BiosGroup {
  items: BiosFirmware[];
  name: string;
  slug: string;
}

export interface LibraryPlatform {
  id?: number | string;
  name?: string;
}

export type LibraryPlatformEntry = LibraryPlatform | [LibraryPlatform, number];

export interface BiosTotals {
  available: number;
  downloaded: number;
  listed: number;
  missing: number;
  unavailable: number;
}

export interface BiosMessage {
  text: string;
  type: "error" | "info" | "success" | "warning";
}

export interface BiosDownloadSummary {
  downloaded: number;
  skipped: number;
}

export interface BiosDistributionResult {
  emulator_id: string;
  files_copied: number;
  target_path: string;
}
