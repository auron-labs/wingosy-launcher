import { useState } from "react";

import { RomDownloadsContext } from "../rom-downloads-context-value";
import { ThemeContext } from "../theme-context";
import ImmersiveLibrary from "./immersive-library";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */

const noOp = () => {
  // Context callbacks are intentionally inert in fixture renders.
};
/** @type {import("../theme-context").ThemeContextValue} */
const themeValue = {
  accentHue: null,
  colors: {
    focusGlow: "rgba(92,107,192,0.4)",
    primary: "#5C6BC0",
    primaryLight: "#8E99F3",
  },
  setAccentHue: noOp,
  setThemeMode: noOp,
  themeMode: "dark",
};
const downloadsValue = {
  activeByGameId: {},
  activeCount: 0,
  activeDownloads: [],
  clearRecentDownloads: noOp,
  getLaunchProgress: () => null,
  getProgress: () => null,
  getSwitchContentProgress: () => null,
  recentDownloads: [],
};
/** @type {PlatformEntry[]} */
const emptyPlatforms = [];

/** @typedef {{initialIndex?: number, initialPlatform?: string|null, initialSearch?: string, onSelectGame?: (game: ImmersiveGame) => void, onSelectedIndexChange?: (index: number) => void, onSelectedPlatformChange?: (platform: string|null) => void, onSearchChange?: (query: string) => void, onOpenSettings?: () => void, games: ImmersiveGame[], platforms?: PlatformEntry[]}} LibraryWrapperProps */

/** @param {LibraryWrapperProps} props Library wrapper properties. */
export const LibraryWrapper = ({
  initialIndex = 0,
  initialPlatform = null,
  initialSearch = "",
  onSelectGame,
  onSelectedIndexChange,
  onSelectedPlatformChange,
  onSearchChange,
  onOpenSettings,
  games,
  platforms = emptyPlatforms,
  ...rest
}) => {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  /** @param {number} next Next game index. */
  const handleChange = (next) => {
    setSelectedIndex(next);
    onSelectedIndexChange?.(next);
  };
  /** @param {string|null} next Next platform. */
  const handlePlatformChange = (next) => {
    setSelectedPlatform(next);
    setSelectedIndex(0);
    onSelectedIndexChange?.(0);
    onSelectedPlatformChange?.(next);
  };
  /** @param {string} next Next query. */
  const handleSearchChange = (next) => {
    setSearchQuery(next);
    onSearchChange?.(next);
  };
  return (
    <ThemeContext.Provider value={themeValue}>
      <RomDownloadsContext.Provider value={downloadsValue}>
        <ImmersiveLibrary
          loading={false}
          error={null}
          games={games}
          platforms={platforms}
          selectedPlatform={selectedPlatform}
          onSelectedPlatformChange={handlePlatformChange}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={handleChange}
          onSelectGame={onSelectGame ?? noOp}
          onExitImmersive={noOp}
          onOpenSettings={onOpenSettings ?? noOp}
          onOpenDownloads={noOp}
          {...rest}
        />
      </RomDownloadsContext.Provider>
    </ThemeContext.Provider>
  );
};
