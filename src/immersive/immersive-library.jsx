import ImmersiveLibraryView from "./immersive-library-view";
import { useImmersiveLibraryController } from "./use-immersive-library-controller";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */

/**
 * @typedef {Object} ImmersiveLibraryProps
 * @property {boolean} loading Whether games are loading.
 * @property {string|null} error Current library error.
 * @property {ImmersiveGame[]} games Games shown in the library.
 * @property {PlatformEntry[]} [platforms] Available platforms.
 * @property {string|null} [selectedPlatform] Selected platform identifier.
 * @property {(platformId: string|null) => void} [onSelectedPlatformChange] Changes the selected platform.
 * @property {string} [searchQuery] Current search query.
 * @property {(query: string) => void} [onSearchChange] Changes the search query.
 * @property {number} selectedIndex Focused game index.
 * @property {(index: number, game?: ImmersiveGame) => void} onSelectedIndexChange Changes focused game.
 * @property {(game: ImmersiveGame) => void} onSelectGame Selects a game.
 * @property {() => void|Promise<void>} onExitImmersive Leaves immersive mode.
 * @property {() => void} onOpenSettings Opens settings.
 * @property {() => void} [onOpenDownloads] Opens downloads.
 * @property {{current: HTMLDivElement|null}} [controllerRouteRef] App-owned controller route target.
 */

/** @param {ImmersiveLibraryProps} props Immersive library properties. */
const ImmersiveLibrary = (props) => {
  const controller = useImmersiveLibraryController(props);
  return <ImmersiveLibraryView {...controller} />;
};

export default ImmersiveLibrary;
