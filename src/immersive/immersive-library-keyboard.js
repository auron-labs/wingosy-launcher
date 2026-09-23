import {
  describeControllerElement,
  getControllerAction,
  isTextInputTarget,
  logControllerOutcome,
} from "./controller-debug";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {{columns: number, gridRef: {current: HTMLElement|null}, platformButtonRefs: {current: (HTMLButtonElement|null)[]}, platformOptions: {id: string|null}[], selectedPlatform: string|null, rootRef: {current: HTMLElement|null}, visibleGames: ImmersiveGame[]}} LibraryKeyboardData */

/** @param {HTMLElement|null} grid Game grid element. @param {number} index Game index to focus. @returns {HTMLElement|null} Focused element. */
export const focusGameAtIndex = (grid, index) => {
  const card =
    grid?.querySelector?.(`[data-immersive-index="${index}"] button`) ??
    grid?.querySelector?.(`[data-immersive-index="${index}"]`);
  if (card instanceof HTMLElement) {
    card.focus();
    return card;
  }
  return null;
};

/** @param {HTMLElement|null} grid Game grid element. */
export const focusFirstGame = (grid) => {
  focusGameAtIndex(grid, 0);
};

/** @param {number} index Platform index. @param {{current: (HTMLButtonElement|null)[]}} refs Platform button refs. @param {number} count Platform count. */
const focusPlatform = (index, refs, count) => {
  const nextIndex = Math.max(0, Math.min(count - 1, index));
  refs.current[nextIndex]?.focus?.();
};

/** @param {{platformOptions: {id: string|null}[], platformButtonRefs: {current: (HTMLButtonElement|null)[]}, selectedPlatform: string|null}} data Library keyboard data. */
const focusSelectedPlatform = (data) => {
  const selectedIndex = Math.max(
    0,
    data.platformOptions.findIndex(
      (option) => option.id === data.selectedPlatform
    )
  );
  focusPlatform(
    selectedIndex,
    data.platformButtonRefs,
    data.platformOptions.length
  );
};

/** @param {{event: KeyboardEvent, platformButton: HTMLButtonElement, refs: {current: (HTMLButtonElement|null)[]}, visibleGames: {length: number, [index: number]: ImmersiveGame|undefined}, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, gridRef: {current: HTMLElement|null}, rootRef: {current: HTMLElement|null}}} options Platform keyboard dependencies. */
const handlePlatformKeyDown = ({
  event,
  platformButton,
  refs,
  visibleGames,
  onSelectedIndexChange,
  gridRef,
  rootRef,
}) => {
  const platformIndex = refs.current.indexOf(platformButton);
  if (platformIndex === -1) {
    return false;
  }
  const focusGrid = () => {
    if (visibleGames.length > 0) {
      onSelectedIndexChange(0, visibleGames[0]);
      focusFirstGame(gridRef.current);
    } else {
      rootRef.current?.focus?.();
    }
  };
  /** @param {number} nextIndex Platform index to move to and select. */
  const selectPlatform = (nextIndex) => {
    const clamped = Math.max(0, Math.min(refs.current.length - 1, nextIndex));
    focusPlatform(clamped, refs, refs.current.length);
    refs.current[clamped]?.click?.();
  };
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    platformButton.click();
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selectPlatform(platformIndex - 1);
    return true;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (platformIndex < refs.current.length - 1) {
      selectPlatform(platformIndex + 1);
    } else {
      focusGrid();
    }
    return true;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusGrid();
    return true;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    return true;
  }
  return false;
};

/** @param {{event: KeyboardEvent, action: ReturnType<typeof getControllerAction>, cycleSection: (delta: number) => void, onOpenSettings: () => void}} options Library shortcut dependencies. */
const handleLibraryShortcut = ({
  event,
  action,
  cycleSection,
  onOpenSettings,
}) => {
  if (event.key === "F11" || event.key === "Escape") {
    logControllerOutcome(action, "library", "ignored", {
      reason: "handled-by-shell",
    });
    return true;
  }
  if (event.key === "s" || event.key === "S") {
    event.preventDefault();
    onOpenSettings();
    logControllerOutcome(action, "library", "handled", {
      reason: "open-settings",
    });
    return true;
  }
  if (event.key === "PageUp" || event.key === "PageDown") {
    const beforeFocus = describeControllerElement(document.activeElement);
    event.preventDefault();
    cycleSection(event.key === "PageUp" ? -1 : 1);
    logControllerOutcome(action, "library", "handled", {
      afterFocus: describeControllerElement(document.activeElement),
      beforeFocus,
      reason: "cycle-section",
    });
    return true;
  }
  return false;
};

/** @param {string} key Keyboard key. @param {number} selectedIndex Selected game index. @param {number} gameCount Number of visible games. @param {number} columns Grid columns. @returns {number|null} Next game index, or null when the key is not a grid action. */
const getGridNextIndex = (key, selectedIndex, gameCount, columns) => {
  switch (key) {
    case "ArrowLeft": {
      return Math.max(0, selectedIndex - 1);
    }
    case "ArrowRight": {
      return Math.min(gameCount - 1, selectedIndex + 1);
    }
    case "ArrowUp": {
      return Math.max(0, selectedIndex - columns);
    }
    case "ArrowDown": {
      return Math.min(gameCount - 1, selectedIndex + columns);
    }
    default: {
      return null;
    }
  }
};

/** @param {{event: KeyboardEvent, action: ReturnType<typeof getControllerAction>, visibleGames: ImmersiveGame[], selectedIndex: number, columns: number, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, gridRef: {current: HTMLElement|null}}} options Grid keyboard dependencies. */
const handleGridKeyDown = ({
  event,
  action,
  visibleGames,
  selectedIndex,
  columns,
  onSelectedIndexChange,
  onSelectGame,
  gridRef,
}) => {
  if (event.key === "Enter") {
    event.preventDefault();
    onSelectGame(visibleGames[selectedIndex]);
    logControllerOutcome(action, "library", "handled", {
      reason: "open-selected-game",
      selectedIndex,
    });
    return true;
  }
  const next = getGridNextIndex(
    event.key,
    selectedIndex,
    visibleGames.length,
    columns
  );
  if (next === null) {
    return false;
  }
  const beforeFocus = describeControllerElement(document.activeElement);
  if (next === selectedIndex) {
    logControllerOutcome(action, "library", "ignored", {
      afterFocus: beforeFocus,
      beforeFocus,
      reason: "focus-boundary",
    });
    return true;
  }
  event.preventDefault();
  onSelectedIndexChange(next, visibleGames[next]);
  const element = gridRef.current?.querySelector?.(
    `[data-immersive-index="${next}"]`
  );
  const focusTarget =
    element instanceof HTMLElement
      ? (element.querySelector("button") ?? element)
      : null;
  focusTarget?.focus?.();
  try {
    element?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  } catch {
    // Ignore unavailable scrolling in test DOMs.
  }
  const afterFocus = describeControllerElement(document.activeElement);
  const focused = document.activeElement === focusTarget;
  logControllerOutcome(action, "library", focused ? "handled" : "ignored", {
    afterFocus,
    beforeFocus,
    reason: focused ? "focus-moved" : "focus-target-not-focused",
    targetFocus: element ? describeControllerElement(element) : undefined,
  });
  return true;
};

/** @param {KeyboardEvent} event Keyboard event. @param {LibraryKeyboardData} data Library keyboard data. @param {number} selectedIndex Focused game index. @returns {boolean} Whether the event moved focus to the platform filter. */
const handlePlatformEdgeKey = (event, data, selectedIndex) => {
  const { columns, platformOptions } = data;
  if (platformOptions.length === 0) {
    return false;
  }
  const atPlatformEdge =
    (event.key === "ArrowLeft" &&
      columns > 0 &&
      selectedIndex % columns === 0) ||
    (event.key === "ArrowUp" && selectedIndex === 0);
  if (!atPlatformEdge) {
    return false;
  }
  event.preventDefault();
  focusSelectedPlatform(data);
  return true;
};

/** @param {KeyboardEvent} event Keyboard event. @param {{data: LibraryKeyboardData, loading: boolean, selectedIndex: number, onOpenSettings: () => void, onSelectGame: (game: ImmersiveGame) => void, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, cycleSection: (delta: number) => void}} options Library keyboard dependencies. */
export const handleLibraryKeyDown = (event, options) => {
  const {
    data,
    loading,
    selectedIndex,
    onOpenSettings,
    onSelectGame,
    onSelectedIndexChange,
    cycleSection,
  } = options;
  const action = getControllerAction(event);
  if (isTextInputTarget(event.target)) {
    if (event.key === "Escape" && event.target instanceof HTMLElement) {
      event.preventDefault();
      event.target.blur();
      logControllerOutcome(action, "library", "handled", {
        reason: "blur-text-input",
      });
      return;
    }
    logControllerOutcome(action, "library", "suppressed", {
      reason: "text-input-focused",
    });
    return;
  }
  const target =
    event.target instanceof Element
      ? event.target.closest("[data-immersive-platform-filter]")
      : null;
  const platformTarget =
    target ??
    document.activeElement?.closest?.("[data-immersive-platform-filter]");
  if (
    platformTarget instanceof HTMLButtonElement &&
    handlePlatformKeyDown({
      event,
      gridRef: data.gridRef,
      onSelectedIndexChange,
      platformButton: platformTarget,
      refs: data.platformButtonRefs,
      rootRef: data.rootRef,
      visibleGames: data.visibleGames,
    })
  ) {
    return;
  }
  if (handleLibraryShortcut({ action, cycleSection, event, onOpenSettings })) {
    return;
  }
  if (loading) {
    logControllerOutcome(action, "library", "ignored", {
      reason: "library-loading",
    });
    return;
  }
  if (data.visibleGames.length === 0) {
    logControllerOutcome(action, "library", "ignored", {
      reason: "no-visible-actions",
    });
    return;
  }
  if (handlePlatformEdgeKey(event, data, selectedIndex)) {
    logControllerOutcome(action, "library", "handled", {
      reason: "focus-platform",
    });
    return;
  }
  handleGridKeyDown({
    action,
    columns: data.columns,
    event,
    gridRef: data.gridRef,
    onSelectGame,
    onSelectedIndexChange,
    selectedIndex,
    visibleGames: data.visibleGames,
  });
};
