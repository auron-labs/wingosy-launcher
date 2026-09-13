import { useCallback, useRef, useState } from "react";

/** @typedef {import("../components/game/game-details-types").GameDetailsGame} AppGame */
/** @typedef {"name"|"recent"|"play_time"} AppSortBy */
/** @typedef {"all"|"favorites"|"recent"|"downloaded"|"not_downloaded"} AppFilterBy */

/** @returns {string|null} Initial selected platform. */
const initialSelectedPlatform = () => null;

/** @returns {AppGame|null} Initial selected game. */
const initialSelectedGame = () => null;

/** @returns {AppSortBy} Initial sort mode. */
const initialSort = () => "name";

/** @returns {AppFilterBy} Initial filter mode. */
const initialFilter = () => "all";

/** @returns {HTMLDivElement|null} Initial library scroll container. */
const initialLibraryScroll = () => null;

/** @param {ReturnType<typeof useLibraryNavigationState>} state Navigation state. */
const useLibraryQueryActions = (state) => {
  const { setLibraryFilterBy, setLibrarySortBy, setPage, setSearchQuery } =
    state;
  const handleSearchChange = useCallback(
    /** @param {string} query Updated search text. */
    (query) => {
      setPage(1);
      setSearchQuery(query);
    },
    [setPage, setSearchQuery]
  );
  const handleLibrarySortChange = useCallback(
    /** @param {AppSortBy} sortBy Updated sort mode. */
    (sortBy) => {
      setPage(1);
      setLibrarySortBy(sortBy);
    },
    [setLibrarySortBy, setPage]
  );
  const handleLibraryFilterChange = useCallback(
    /** @param {AppFilterBy} filterBy Updated filter mode. */
    (filterBy) => {
      setPage(1);
      setLibraryFilterBy(filterBy);
    },
    [setLibraryFilterBy, setPage]
  );

  return {
    handleLibraryFilterChange,
    handleLibrarySortChange,
    handleSearchChange,
  };
};

/** @param {ReturnType<typeof useLibraryNavigationState>} state Navigation state. */
const useLibraryViewActions = (state) => {
  const {
    libraryScrollRef,
    setLibraryFilterBy,
    setPage,
    setSearchQuery,
    setSelectedGame,
    setSelectedPlatform,
    setSettingsInitialSection,
    setView,
  } = state;
  const handleSelectGame = useCallback(
    /** @param {AppGame} game Selected game. */
    (game) => {
      setSelectedGame(game);
      setView("details");
    },
    [setSelectedGame, setView]
  );
  const handleSelectPlatform = useCallback(
    /** @param {string|null} platformId Selected platform. */
    (platformId) => {
      setPage(1);
      setSelectedPlatform(platformId);
      setLibraryFilterBy("all");
      setView("library");
      setSelectedGame(null);
    },
    [setLibraryFilterBy, setPage, setSelectedGame, setSelectedPlatform, setView]
  );
  const handlePageChange = useCallback(
    /** @param {number} nextPage Requested page. */
    (nextPage) => {
      setPage(nextPage);
      libraryScrollRef.current?.scrollTo({ top: 0 });
    },
    [libraryScrollRef, setPage]
  );
  const handleNavigate = useCallback(
    /** @param {string} newView Destination view. @param {{filterBy?: AppFilterBy, settingsSection?: string}} [options] Navigation options. */
    (newView, options = {}) => {
      setView(newView);
      if (newView === "library" || newView === "downloads") {
        setSelectedGame(null);
      }
      if (newView === "library" && options.filterBy) {
        setPage(1);
        setSelectedPlatform(null);
        setSearchQuery("");
        setLibraryFilterBy(options.filterBy);
      }
      if (newView === "settings") {
        setSettingsInitialSection(options.settingsSection ?? "general");
      }
    },
    [
      setLibraryFilterBy,
      setPage,
      setSearchQuery,
      setSelectedGame,
      setSelectedPlatform,
      setSettingsInitialSection,
      setView,
    ]
  );

  return {
    handleNavigate,
    handlePageChange,
    handleSelectGame,
    handleSelectPlatform,
  };
};

const useLibraryNavigationState = () => {
  const [page, setPage] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState(
    initialSelectedPlatform
  );
  const [selectedGame, setSelectedGame] = useState(initialSelectedGame);
  const [view, setView] = useState("library");
  const [settingsInitialSection, setSettingsInitialSection] =
    useState("general");
  const [searchQuery, setSearchQuery] = useState("");
  const [librarySortBy, setLibrarySortBy] = useState(initialSort);
  const [libraryFilterBy, setLibraryFilterBy] = useState(initialFilter);
  const libraryScrollRef = useRef(initialLibraryScroll());

  return {
    libraryFilterBy,
    libraryScrollRef,
    librarySortBy,
    page,
    searchQuery,
    selectedGame,
    selectedPlatform,
    setLibraryFilterBy,
    setLibrarySortBy,
    setPage,
    setSearchQuery,
    setSelectedGame,
    setSelectedPlatform,
    setSettingsInitialSection,
    setView,
    settingsInitialSection,
    view,
  };
};

/** @param {ReturnType<typeof useLibraryNavigationState>} state Navigation state. */
const useLibraryNavigationActions = (state) => ({
  ...useLibraryQueryActions(state),
  ...useLibraryViewActions(state),
});

/** @returns {ReturnType<typeof useLibraryNavigationState> & ReturnType<typeof useLibraryNavigationActions>} Library navigation state and actions. */
export const useLibraryNavigation = () => {
  const state = useLibraryNavigationState();
  return { ...state, ...useLibraryNavigationActions(state) };
};
