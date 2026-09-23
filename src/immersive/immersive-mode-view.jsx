import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import { useRef } from "react";

import RomDownloadsView from "../components/rom-downloads-view";
import RommSyncMonitor from "../components/romm-sync-monitor";
import Settings from "../components/settings";
import AmbientAudioPlayer from "./ambient-audio-player";
import ImmersiveGameDetails from "./immersive-game-details";
import ImmersiveHintBar from "./immersive-hint-bar";
import ImmersiveLibrary from "./immersive-library";
import { useImmersiveSettingsNavigation } from "./use-immersive-settings-navigation";

/** @typedef {import("./immersive-types").AmbientAudioConfig} AmbientAudioConfig */
/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").LaunchResult} LaunchResult */
/** @typedef {import("./immersive-types").PlatformEntry} PlatformEntry */

/** @typedef {{audio?: typeof AmbientAudioPlayer, details?: typeof ImmersiveGameDetails, downloads?: typeof RomDownloadsView, hintBar?: typeof ImmersiveHintBar, library?: typeof ImmersiveLibrary, settings?: typeof Settings}} ImmersiveModeComponents */

/** @typedef {{view: string, selectedGame: ImmersiveGame|null, settingsInitialSection: string, games: ImmersiveGame[], platforms: PlatformEntry[], selectedPlatform: string|null, searchQuery: string, selectedIndex: number, loading: boolean, error: string|null, audioConfig: AmbientAudioConfig|null, showHints: boolean, unsupportedGamepad: boolean, saveSyncMessages: string[], platformDisplayNameById: Map<string, string>, controllerRouteRef?: {current: HTMLDivElement|null}, rommSyncMonitor: ReturnType<typeof import("../components/use-romm-sync-monitor").useRommSyncMonitor>, components?: ImmersiveModeComponents, rommToken?: string|null, rommUrl?: string|null, retroachievementsEnabled: boolean, onRommConnect?: (url: string, token: string) => void, onImmersiveModeChange: (enabled: boolean) => void, onFullscreenChange: (enabled: boolean) => void, onControllerDeadzoneChange: (value: number) => void, onRetroAchievementsChange: (enabled: boolean) => void, handleExit: () => Promise<void>, handleLaunchGame: (gameId: number|string) => Promise<LaunchResult|null>, handleToggleFavorite: (gameId: number|string) => Promise<void>, onSelectedPlatformChange: (platform: string|null) => void, onSearchChange: (query: string) => void, onSelectedIndexChange: (index: number, game?: ImmersiveGame) => void, onSelectGame: (game: ImmersiveGame) => void, loadData: () => Promise<ImmersiveGame[]>, openSettings: (section?: string) => void, setView: (view: string) => void, setSelectedGame: (game: ImmersiveGame|null) => void, setShowHints: (update: boolean|((previous: boolean) => boolean)) => void, setSaveSyncMessages: (messages: string[]) => void, exitConfirmOpen?: boolean, confirmExit?: () => void, cancelExit?: () => void}} ImmersiveModeViewProps */

/** @param {{components: ImmersiveModeComponents, setView: (view: string) => void}} props Downloads view properties. */
const DownloadsMain = ({ components, setView }) => {
  const DownloadsView = components.downloads ?? RomDownloadsView;
  return (
    <Box
      sx={{
        bgcolor: "background.default",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        overflowX: "hidden",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
    >
      <DownloadsView
        immersive
        onBack={() => {
          setView("library");
        }}
        onOpenGameDetails={() => {
          setView("library");
        }}
        onOpenCloudLibrary={() => {
          setView("library");
        }}
      />
    </Box>
  );
};

/** @param {{monitor: ImmersiveModeViewProps["rommSyncMonitor"], setView: (view: string) => void}} props RomM sync view properties. */
const RommSyncMain = ({ monitor, setView }) => (
  <Box
    sx={{
      bgcolor: "background.default",
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      overflowX: "hidden",
      overflowY: "auto",
      overscrollBehavior: "contain",
    }}
  >
    <RommSyncMonitor
      immersive
      monitor={monitor}
      onBack={() => {
        setView("library");
      }}
    />
  </Box>
);

/** @param {Pick<ImmersiveModeViewProps, "settingsInitialSection"|"rommToken"|"rommUrl"|"onRommConnect"|"onImmersiveModeChange"|"onFullscreenChange"|"onControllerDeadzoneChange"|"onRetroAchievementsChange"|"setView"> & {components: ImmersiveModeComponents, loadData: () => Promise<unknown>}} props Settings view properties. */
const SettingsMain = ({
  components,
  settingsInitialSection,
  rommToken,
  rommUrl,
  onRommConnect,
  onImmersiveModeChange,
  onFullscreenChange,
  onControllerDeadzoneChange,
  onRetroAchievementsChange,
  setView,
  loadData,
}) => {
  const SettingsView = components.settings ?? Settings;
  const settingsRootRef = useRef(null);
  useImmersiveSettingsNavigation(settingsRootRef);
  return (
    <Box
      ref={settingsRootRef}
      sx={{
        bgcolor: "background.default",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <SettingsView
        initialSection={settingsInitialSection}
        rommToken={rommToken ?? null}
        rommUrl={rommUrl ?? ""}
        onRommConnect={onRommConnect}
        onLibraryChange={() => {
          void loadData();
        }}
        onImmersiveModeChange={onImmersiveModeChange}
        onFullscreenChange={onFullscreenChange}
        onControllerDeadzoneChange={onControllerDeadzoneChange}
        onRetroAchievementsChange={onRetroAchievementsChange}
        onBack={() => {
          setView("details");
        }}
      />
    </Box>
  );
};

/** @param {Pick<ImmersiveModeViewProps, "selectedGame"|"platformDisplayNameById"|"handleLaunchGame"|"handleToggleFavorite"|"openSettings"|"loadData"|"rommToken"|"rommUrl"|"retroachievementsEnabled"|"setView"|"setSelectedGame"> & {components: ImmersiveModeComponents}} props Details view properties. */
const DetailsMain = ({
  components,
  selectedGame,
  platformDisplayNameById,
  handleLaunchGame,
  handleToggleFavorite,
  openSettings,
  loadData,
  rommToken,
  rommUrl,
  retroachievementsEnabled,
  setView,
  setSelectedGame,
}) => {
  if (selectedGame === null) {
    return null;
  }
  const platformLabel =
    platformDisplayNameById.get(selectedGame.platform_id) ??
    selectedGame.platform_id;
  const DetailsView = components.details ?? ImmersiveGameDetails;
  return (
    <DetailsView
      game={selectedGame}
      platformLabel={platformLabel}
      onBack={() => {
        setView("library");
        setSelectedGame(null);
      }}
      onLaunch={handleLaunchGame}
      onToggleFavorite={handleToggleFavorite}
      onOpenSettings={() => {
        openSettings("emulators");
      }}
      onOpenIntegrations={() => {
        openSettings("integrations");
      }}
      onGameUpdate={async (gameId) => {
        const refreshedGames = await loadData();
        if (!Array.isArray(refreshedGames)) {
          return;
        }
        const updated = refreshedGames.find((game) => game.id === gameId);
        if (updated !== undefined) {
          setSelectedGame(updated);
        }
      }}
      rommToken={rommToken}
      rommUrl={rommUrl}
      retroachievementsEnabled={retroachievementsEnabled}
    />
  );
};

/** @param {Pick<ImmersiveModeViewProps, "games"|"platforms"|"selectedPlatform"|"searchQuery"|"selectedIndex"|"loading"|"error"|"onSelectedPlatformChange"|"onSearchChange"|"onSelectedIndexChange"|"onSelectGame"|"handleExit"|"openSettings"|"setView"|"controllerRouteRef"> & {components: ImmersiveModeComponents}} props Library view properties. */
const LibraryMain = (props) => {
  const LibraryView = props.components.library ?? ImmersiveLibrary;
  return (
    <LibraryView
      loading={props.loading}
      error={props.error}
      games={props.games}
      platforms={props.platforms}
      selectedPlatform={props.selectedPlatform}
      onSelectedPlatformChange={props.onSelectedPlatformChange}
      searchQuery={props.searchQuery}
      onSearchChange={props.onSearchChange}
      selectedIndex={props.selectedIndex}
      onSelectedIndexChange={props.onSelectedIndexChange}
      onSelectGame={props.onSelectGame}
      controllerRouteRef={props.controllerRouteRef}
      onExitImmersive={props.handleExit}
      onOpenSettings={() => {
        props.openSettings();
      }}
      onOpenDownloads={() => {
        props.setView("downloads");
      }}
      onOpenRommSync={() => {
        props.setView("romm-sync");
      }}
    />
  );
};

/** @param {ImmersiveModeViewProps} props View properties. */
const MainView = (props) => {
  const components = props.components ?? {};
  if (props.view === "downloads") {
    return <DownloadsMain components={components} setView={props.setView} />;
  }
  if (props.view === "romm-sync") {
    return (
      <RommSyncMain monitor={props.rommSyncMonitor} setView={props.setView} />
    );
  }
  if (props.view === "settings") {
    return <SettingsMain {...props} components={components} />;
  }
  if (props.view === "details") {
    return <DetailsMain {...props} components={components} />;
  }
  return <LibraryMain {...props} components={components} />;
};

/** @param {ImmersiveModeViewProps} props View properties. */
const ImmersiveModeView = (props) => {
  const components = props.components ?? {};
  const AudioPlayer = components.audio ?? AmbientAudioPlayer;
  const HintBar = components.hintBar ?? ImmersiveHintBar;
  return (
    <Box
      sx={{
        bgcolor: "background.default",
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <AudioPlayer audio={props.audioConfig} />
      <Box
        sx={{ display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}
      >
        <MainView {...props} components={components} />
      </Box>
      <HintBar
        view={props.view}
        visible={props.showHints}
        unsupportedGamepad={props.unsupportedGamepad}
      />
      <Dialog
        open={props.exitConfirmOpen === true}
        onClose={() => props.cancelExit?.()}
        aria-labelledby="immersive-exit-dialog-title"
      >
        <DialogTitle id="immersive-exit-dialog-title">
          Exit immersive mode?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Immersive mode will close and the window will leave fullscreen.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => props.cancelExit?.()}>
            Stay
          </Button>
          <Button
            color="primary"
            onClick={() => props.confirmExit?.()}
            variant="contained"
          >
            Exit
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={props.saveSyncMessages.length > 0}
        autoHideDuration={7000}
        onClose={() => {
          props.setSaveSyncMessages([]);
        }}
        message={props.saveSyncMessages.join("\n")}
        anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
      />
    </Box>
  );
};

export default ImmersiveModeView;
