import { useEffect, useRef, useState } from "react";

/** @type {Array<[{id: string, name: string}, number]>} */
const emptyPlatforms = [];

/** @typedef {{loading: boolean, error: string|null, games: import("./immersive-types").ImmersiveGame[], platforms?: import("./immersive-types").PlatformEntry[], selectedPlatform?: string|null, onSelectedPlatformChange?: (platform: string|null) => void, searchQuery?: string, onSearchChange?: (query: string) => void, selectedIndex: number, onSelectedIndexChange: (index: number, game?: import("./immersive-types").ImmersiveGame) => void, onSelectGame: (game: import("./immersive-types").ImmersiveGame) => void, onExitImmersive: () => void|Promise<void>, onOpenSettings: () => void, onOpenDownloads?: () => void}} TestLibraryProps */

/** @param {React.RefObject<HTMLDivElement|null>} rootRef @param {number} gameCount @param {number} selectedIndex @param {(index: number) => void} onSelectedIndexChange */
const useLibraryKeyboard = (
  rootRef,
  gameCount,
  selectedIndex,
  onSelectedIndexChange
) => {
  useEffect(() => {
    const root = rootRef.current;
    /** @param {KeyboardEvent} event Keyboard event. */
    const handleKeyDown = (event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [role='textbox']")
      ) {
        return;
      }
      if (event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      onSelectedIndexChange(Math.min(gameCount - 1, selectedIndex + 1));
    };
    const removeKeyDownListener = () => {
      if (root !== null) {
        root.removeEventListener("keydown", handleKeyDown);
      }
    };
    if (root === null) {
      return removeKeyDownListener;
    }
    root.tabIndex = 0;
    root.addEventListener("keydown", handleKeyDown);
    return () => {
      root.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameCount, onSelectedIndexChange, rootRef, selectedIndex]);
};

/** @param {TestLibraryProps} props Test library properties. */
export const TestLibrary = ({
  error,
  games,
  onSearchChange,
  onSelectGame,
  onSelectedIndexChange,
  onSelectedPlatformChange,
  platforms = emptyPlatforms,
  searchQuery = "",
  selectedIndex,
  selectedPlatform = null,
}) => {
  /** @type {HTMLDivElement|null} */
  const initialRoot = null;
  const rootRef = useRef(initialRoot);
  useLibraryKeyboard(
    rootRef,
    games.length,
    selectedIndex,
    onSelectedIndexChange
  );

  return (
    <div ref={rootRef} data-testid="immersive-library" role="application">
      {error !== null && error !== "" ? (
        <span data-testid="immersive-launch-error">{error}</span>
      ) : null}
      <button type="button" onClick={() => onSelectedPlatformChange?.(null)}>
        All platforms
      </button>
      {platforms.map(([platform]) => (
        <button
          type="button"
          key={platform.id}
          aria-pressed={selectedPlatform === platform.id}
          onClick={() => onSelectedPlatformChange?.(platform.id)}
        >
          {platform.name}
        </button>
      ))}
      <input
        aria-label="Search games by name"
        value={searchQuery}
        onChange={(event) => onSearchChange?.(event.target.value)}
      />
      {searchQuery ? (
        <button
          type="button"
          onClick={() => {
            onSearchChange?.("");
          }}
        >
          Clear game search
        </button>
      ) : null}
      <span data-testid="selected-index">{selectedIndex}</span>
      {games.map((game, index) => (
        <button
          type="button"
          key={game.id}
          data-testid={`game-${game.id}`}
          data-focused={String(index === selectedIndex)}
          onClick={() => {
            onSelectedIndexChange(index);
            onSelectGame(game);
          }}
        >
          {game.name}
        </button>
      ))}
    </div>
  );
};

/** @typedef {{game: import("./immersive-types").ImmersiveGame, platformLabel?: string, onBack: () => void, onLaunch: (gameId: number|string) => Promise<import("./immersive-types").LaunchResult|null|undefined>, onToggleFavorite: (gameId: number|string) => void|Promise<void>, onGameUpdate?: (gameId: number|string) => void|Promise<void>, onOpenSettings?: () => void, onOpenIntegrations?: (() => void)|null, rommToken?: string|null, rommUrl?: string|null, retroachievementsEnabled?: boolean}} TestDetailsProps */
/** @param {TestDetailsProps} props Test details properties. */
export const TestDetails = ({ game, onBack, onLaunch }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div data-testid="immersive-details">
      <span data-testid="details-game">{game.name}</span>
      <button
        type="button"
        onClick={() => {
          void onLaunch(game.id);
        }}
      >
        Play
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button
        type="button"
        onClick={() => {
          setMenuOpen((open) => !open);
        }}
      >
        Open menu
      </button>
      {menuOpen ? <div role="menu">Menu owns input</div> : null}
    </div>
  );
};

export const TestAudioPlayer = () => null;
/** @param {{visible?: boolean}} props Hint bar properties. */
export const TestHintBar = ({ visible = false }) => (
  <span data-testid="immersive-hints">{String(visible)}</span>
);
export const TestSettings = () => <span data-testid="immersive-settings" />;
export const TestDownloads = () => <span data-testid="immersive-downloads" />;
