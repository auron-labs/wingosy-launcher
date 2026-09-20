import { useEffect, useRef, useState } from "react";

/** @type {Array<[{id: string, name: string}, number]>} */
const emptyPlatforms = [];

/** @param {{actionTestId: string, onClose?: () => void}} props Test menu properties. */
const TestMenu = ({ actionTestId, onClose }) => {
  const [lastAction, setLastAction] = useState("");
  return (
    <div
      role="menu"
      tabIndex={-1}
      onKeyDown={(event) => {
        setLastAction(event.key);
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
        }
      }}
    >
      <span data-testid={actionTestId}>{lastAction}</span>
    </div>
  );
};

/** @param {{onToggle: () => void}} props Test menu toggle properties. */
const TestMenuToggle = ({ onToggle }) => (
  <button type="button" onClick={onToggle}>
    Open menu
  </button>
);

const TestLibraryMenu = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <TestMenuToggle
        onToggle={() => {
          setMenuOpen((open) => !open);
        }}
      />
      {menuOpen ? (
        <TestMenu
          actionTestId="library-menu-action"
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      ) : null}
    </>
  );
};

/** @typedef {{loading: boolean, error: string|null, games: import("./immersive-types").ImmersiveGame[], platforms?: import("./immersive-types").PlatformEntry[], selectedPlatform?: string|null, onSelectedPlatformChange?: (platform: string|null) => void, searchQuery?: string, onSearchChange?: (query: string) => void, selectedIndex: number, onSelectedIndexChange: (index: number, game?: import("./immersive-types").ImmersiveGame) => void, onSelectGame: (game: import("./immersive-types").ImmersiveGame) => void, onExitImmersive: () => void|Promise<void>, onOpenSettings: () => void, onOpenDownloads?: () => void, onOpenRommSync?: () => void, controllerRouteRef?: {current: HTMLDivElement|null}}} TestLibraryProps */

/** @param {{games: import("./immersive-types").ImmersiveGame[], gameCount: number, onOpenSettings: () => void, onSelectGame: (game: import("./immersive-types").ImmersiveGame) => void, onSelectedIndexChange: (index: number) => void, rootRef: React.RefObject<HTMLDivElement|null>, selectedIndex: number}} options Test library keyboard options. */
const useLibraryKeyboard = ({
  games,
  gameCount,
  onOpenSettings,
  onSelectGame,
  onSelectedIndexChange,
  rootRef,
  selectedIndex,
}) => {
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
      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        onOpenSettings();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const game = games[selectedIndex];
        if (game !== undefined) {
          onSelectGame(game);
        }
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelectedIndexChange(Math.min(gameCount - 1, selectedIndex + 1));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelectedIndexChange(Math.max(0, selectedIndex - 1));
      }
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
  }, [
    gameCount,
    games,
    onOpenSettings,
    onSelectGame,
    onSelectedIndexChange,
    rootRef,
    selectedIndex,
  ]);
};

/** @param {{games: import("./immersive-types").ImmersiveGame[], selectedIndex: number, onSelectedIndexChange: (index: number, game?: import("./immersive-types").ImmersiveGame) => void, onSelectGame: (game: import("./immersive-types").ImmersiveGame) => void}} props Game list properties. */
const TestGameList = ({
  games,
  onSelectGame,
  onSelectedIndexChange,
  selectedIndex,
}) => (
  <>
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
  </>
);

/** @param {TestLibraryProps} props Test library properties. */
export const TestLibrary = ({
  error,
  games,
  onSearchChange,
  onSelectGame,
  onSelectedIndexChange,
  onSelectedPlatformChange,
  onOpenSettings,
  onOpenRommSync,
  controllerRouteRef,
  platforms = emptyPlatforms,
  searchQuery = "",
  selectedIndex,
  selectedPlatform = null,
}) => {
  /** @type {HTMLDivElement|null} */
  const initialRoot = null;
  const localRootRef = useRef(initialRoot);
  const rootRef = controllerRouteRef ?? localRootRef;
  useLibraryKeyboard({
    gameCount: games.length,
    games,
    onOpenSettings,
    onSelectGame,
    onSelectedIndexChange,
    rootRef,
    selectedIndex,
  });

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
      <TestLibraryMenu />
      <button type="button" onClick={() => onOpenRommSync?.()}>
        RomM Sync
      </button>
      <span data-testid="selected-index">{selectedIndex}</span>
      <TestGameList
        games={games}
        onSelectGame={onSelectGame}
        onSelectedIndexChange={onSelectedIndexChange}
        selectedIndex={selectedIndex}
      />
    </div>
  );
};

/** @typedef {{game: import("./immersive-types").ImmersiveGame, platformLabel?: string, onBack: () => void, onLaunch: (gameId: number|string) => Promise<import("./immersive-types").LaunchResult|null|undefined>, onToggleFavorite: (gameId: number|string) => void|Promise<void>, onGameUpdate?: (gameId: number|string) => void|Promise<void>, onOpenSettings?: () => void, onOpenIntegrations?: (() => void)|null, rommToken?: string|null, rommUrl?: string|null, retroachievementsEnabled?: boolean}} TestDetailsProps */

/** @param {{current: HTMLDivElement|null}} rootRef Details root reference. */
const useTestDetailsKeyboard = (rootRef) => {
  useEffect(() => {
    /** @param {KeyboardEvent} event Controller keyboard event. */
    const handleKeyDown = (event) => {
      if (event.target instanceof Element) {
        return;
      }
      /** @type {HTMLButtonElement[]} */
      const actions = [
        ...(rootRef.current?.querySelectorAll("button:not(:disabled)") ?? []),
      ].filter((element) => element instanceof HTMLButtonElement);
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const focusedIndex =
          document.activeElement instanceof HTMLButtonElement
            ? actions.indexOf(document.activeElement)
            : -1;
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = Math.max(
          0,
          Math.min(actions.length - 1, focusedIndex + direction)
        );
        actions[nextIndex]?.focus();
        event.preventDefault();
        return;
      }
      if (event.key === "Enter") {
        actions.find((button) => button === document.activeElement)?.click();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rootRef]);
};

/** @param {{onClose: () => void}} props Test dialog properties. */
const TestDetailsDialog = ({ onClose }) => (
  <dialog
    open
    role="alertdialog"
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }}
  >
    Details dialog
  </dialog>
);

/** @param {TestDetailsProps} props Test details properties. */
export const TestDetails = ({
  game,
  onBack,
  onLaunch,
  onOpenSettings,
  retroachievementsEnabled = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  /** @type {import("react").RefObject<HTMLDivElement|null>} */
  const detailsRootRef = useRef(null);
  useTestDetailsKeyboard(detailsRootRef);
  return (
    <div ref={detailsRootRef} data-testid="immersive-details">
      <span data-testid="details-game">{game.name}</span>
      <span data-testid="details-retroachievements">
        {String(retroachievementsEnabled)}
      </span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          void onLaunch(game.id);
        }}
      >
        Play
      </button>
      <button
        type="button"
        aria-label={favorited ? "Unfavorite" : "Favorite"}
        onClick={() => {
          setFavorited(true);
        }}
      >
        {favorited ? "Unfavorite" : "Favorite"}
      </button>
      <button type="button" disabled>
        Unavailable
      </button>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onOpenSettings}>
        Open settings
      </button>
      <button
        type="button"
        onClick={() => {
          setMenuOpen((open) => !open);
        }}
      >
        Open menu
      </button>
      <button
        type="button"
        onClick={() => {
          setDialogOpen(true);
        }}
      >
        Open dialog
      </button>
      {menuOpen ? (
        <TestMenu
          actionTestId="details-menu-action"
          onClose={() => {
            setMenuOpen(false);
          }}
        />
      ) : null}
      {dialogOpen ? (
        <TestDetailsDialog
          onClose={() => {
            setDialogOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

export const TestAudioPlayer = () => null;
/** @param {{visible?: boolean}} props Hint bar properties. */
export const TestHintBar = ({ visible = false }) => (
  <span data-testid="immersive-hints">{String(visible)}</span>
);
/** @param {{onBack?: () => void, onRetroAchievementsChange?: ((enabled: boolean) => void)|null} & Record<string, unknown>} props Test settings properties. */
export const TestSettings = ({ onBack, onRetroAchievementsChange }) => (
  <div data-testid="immersive-settings">
    <button
      type="button"
      onClick={() => {
        onRetroAchievementsChange?.(true);
      }}
    >
      Save RetroAchievements
    </button>
    <button type="button" onClick={onBack}>
      Back to details
    </button>
  </div>
);
export const TestDownloads = () => <span data-testid="immersive-downloads" />;
