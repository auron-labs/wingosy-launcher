import { createContext, useContext } from "react";

/** @typedef {{gameId?: number|string, gameName?: string, downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {{kind: "complete", gameId: number|string, gameName: string, path: string, at: number}|{kind: "error", gameId: number|string, gameName: string, message: string, at: number}} RecentDownload */
/** @typedef {Record<string|number, DownloadProgress>} ProgressMap */
/** @typedef {{activeByGameId: ProgressMap, activeDownloads: DownloadProgress[], recentDownloads: RecentDownload[], clearRecentDownloads: () => void, getProgress: (gameId: number|string) => DownloadProgress|null, getLaunchProgress: (gameId: number|string) => DownloadProgress|null, getSwitchContentProgress: (gameId: number|string) => DownloadProgress|null, activeCount: number}} RomDownloadsContextValue */

/** No-op download callback. */
const noop = () => null;

/** @type {import("react").Context<RomDownloadsContextValue>} */
export const RomDownloadsContext = createContext({
  activeByGameId: {},
  activeCount: 0,
  /** @type {DownloadProgress[]} */
  activeDownloads: [],
  clearRecentDownloads: noop,
  getLaunchProgress: (_gameId) => null,
  getProgress: (_gameId) => null,
  getSwitchContentProgress: (_gameId) => null,
  /** @type {RecentDownload[]} */
  recentDownloads: [],
});

export const useRomDownloads = () => useContext(RomDownloadsContext);
