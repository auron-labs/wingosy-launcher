import { useCallback, useEffect, useRef, useState } from "react";

import { gameDetailsIpc } from "../components/game/game-details-ipc";
import { useGameDetailsAchievements } from "../components/game/use-game-details-achievements";
import { useGameDetailsActions } from "../components/game/use-game-details-actions";
import { useGameDetailsSaves } from "../components/game/use-game-details-saves";
import { useMissingEmulatorRecovery } from "../components/game/use-missing-emulator-recovery";
import { useRomDownloads } from "../rom-downloads-context-value";
import { useAppTheme } from "../theme-context";
import {
  canSyncImmersiveSwitchContent,
  getImmersiveDetailsState,
  hasRommConnection,
} from "./immersive-game-details-state";
import { getLaunchErrorPresentation } from "./launch-error";
import { useImmersiveGameDetailsKeyboard } from "./use-immersive-game-details-keyboard";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").LaunchResult} LaunchResult */
/** @typedef {{downloaded?: number|null, total?: number|null, percent?: number|null, stage?: string, error?: string|null, active?: boolean, file_index?: number|null, total_files?: number|null}} DownloadProgress */
/** @typedef {typeof import("../components/game/game-details-ipc").gameDetailsIpc} ImmersiveDetailsIpc */

/** @typedef {{game: ImmersiveGame, platformLabel?: string, onBack: () => void, onLaunch: (gameId: number|string) => Promise<LaunchResult|null|undefined>, onToggleFavorite: (gameId: number|string) => void|Promise<void>, onGameUpdate?: (gameId: number|string) => void|Promise<void>, onOpenSettings?: () => void, onOpenIntegrations?: (() => void)|null, rommToken?: string|null, rommUrl?: string|null, retroachievementsEnabled?: boolean, dependencies?: {ipc?: ImmersiveDetailsIpc}}} ImmersiveGameDetailsProps */

const noop = () => null;
const noSaveFileDialog = async () => {
  await Promise.resolve();
  return null;
};

/** @param {((gameId: number|string) => void|Promise<void>)|undefined} onGameUpdate Game update callback. @param {number|string} gameId Game identifier. */
const notifyGameUpdate = (onGameUpdate, gameId) => {
  void onGameUpdate?.(gameId);
};

/** @returns {DownloadProgress|null} Initial launch progress. */
const getInitialLaunchProgress = () => null;
/** @returns {HTMLButtonElement|null} Initial primary action. */
const getInitialPrimaryAction = () => null;
/** @returns {HTMLDivElement|null} Initial details element. */
const getInitialDetailsElement = () => null;
/** @returns {HTMLDivElement|null} Initial saves section. */
const getInitialSavesSection = () => null;

/** @param {{game: ImmersiveGame, onBack: () => void, onLaunch: (gameId: number|string) => Promise<LaunchResult|null|undefined>, onGameUpdate?: (gameId: number|string) => void|Promise<void>, rommToken?: string|null, rommUrl?: string|null, ipc?: ImmersiveDetailsIpc}} props Resource properties. */
const useDetailsResources = ({
  game,
  ipc,
  onBack,
  onLaunch,
  onGameUpdate,
  rommToken,
  rommUrl,
}) => {
  const detailsIpc = ipc ?? gameDetailsIpc;
  const { colors } = useAppTheme();
  const { getProgress, getLaunchProgress, getSwitchContentProgress } =
    useRomDownloads();
  const romDl = getProgress(game.id);
  const launchProgress = getLaunchProgress(game.id);
  const switchContentProgress = getSwitchContentProgress(game.id);
  const [staleLaunchProgress, setStaleLaunchProgress] = useState(
    getInitialLaunchProgress
  );
  const primaryActionRef = useRef(getInitialPrimaryAction());
  const detailsRef = useRef(getInitialDetailsElement());
  const savesSectionRef = useRef(getInitialSavesSection());
  const canSyncSwitchContent = canSyncImmersiveSwitchContent(
    game,
    rommToken,
    rommUrl
  );
  const saves = useGameDetailsSaves({
    game,
    ipc: detailsIpc,
    isSwitch: game.platform_id === "switch",
    openDialog: noSaveFileDialog,
    rommToken: rommToken ?? null,
    rommUrl: rommUrl ?? null,
  });
  const launchRequest = useCallback(
    /** @param {number|string} gameId Game identifier. */
    async (gameId) => {
      setStaleLaunchProgress(launchProgress);
      return await onLaunch(gameId);
    },
    [launchProgress, onLaunch]
  );
  const actions = useGameDetailsActions({
    canSyncSwitchContent,
    game,
    ipc: detailsIpc,
    launchProgress,
    onBack,
    onGameUpdate: (gameId) => {
      notifyGameUpdate(onGameUpdate, gameId);
    },
    onLaunch: launchRequest,
    romDl,
    rommToken: rommToken ?? null,
    rommUrl: rommUrl ?? null,
  });
  return {
    actions,
    colors,
    detailsRef,
    launchProgress,
    primaryActionRef,
    romDl,
    saves,
    savesSectionRef,
    staleLaunchProgress,
    switchContentProgress,
  };
};

/** @param {{launching: boolean, launchFailure: boolean, primaryActionRef: {current: HTMLButtonElement|null}}} options Focus restoration options. */
const useRestoreDetailsFocus = ({
  launching,
  launchFailure,
  primaryActionRef,
}) => {
  const wasLaunchingRef = useRef(false);
  useEffect(() => {
    if (wasLaunchingRef.current && !launching && !launchFailure) {
      primaryActionRef.current?.focus();
    }
    wasLaunchingRef.current = launching;
  }, [launchFailure, launching, primaryActionRef]);
};

/** @param {{achievementState: ReturnType<typeof useGameDetailsAchievements>, detailsState: ReturnType<typeof getImmersiveDetailsState>, game: ImmersiveGame, launchErrorPresentation: ReturnType<typeof getLaunchErrorPresentation>, missingEmulatorRecovery: ReturnType<typeof useMissingEmulatorRecovery>, resources: ReturnType<typeof useDetailsResources>, retryableLaunchFailure: boolean, rommConfigured: boolean}} options Controller state. */
const getDetailsController = ({
  achievementState,
  detailsState,
  game,
  launchErrorPresentation,
  missingEmulatorRecovery,
  resources,
  retryableLaunchFailure,
  rommConfigured,
}) => ({
  achievementState,
  actions: resources.actions,
  colors: resources.colors,
  detailsRef: resources.detailsRef,
  ...detailsState,
  hasRomm: game.romm_id !== null && game.romm_id !== undefined,
  launchErrorPresentation,
  launchProgress: resources.launchProgress,
  missingEmulatorRecovery,
  primaryActionRef: resources.primaryActionRef,
  retryableLaunchFailure,
  romDl: resources.romDl,
  rommConfigured,
  saves: resources.saves,
  savesSectionRef: resources.savesSectionRef,
  staleLaunchProgress: resources.staleLaunchProgress,
  switchContentProgress: resources.switchContentProgress,
});

/** @param {{actions: ReturnType<typeof useGameDetailsActions>, detailsState: ReturnType<typeof getImmersiveDetailsState>, ipc: ImmersiveDetailsIpc|undefined, platformId: string, platformLabel: string|undefined}} options Launch failure presentation and recovery dependencies. */
const useImmersiveLaunchFailureRecovery = ({
  actions,
  detailsState,
  ipc,
  platformId,
  platformLabel,
}) => {
  const launchError =
    actions.launchError ?? detailsState.visibleLaunchProgress?.error;
  const launchErrorPresentation = getLaunchErrorPresentation(
    launchError,
    platformLabel
  );
  const missingEmulatorRecovery = useMissingEmulatorRecovery({
    ipc,
    launchError,
    launchErrorPresentation,
    platformId,
  });
  return {
    launchErrorPresentation,
    missingEmulatorRecovery,
    retryableLaunchFailure:
      detailsState.launchFailure && launchErrorPresentation.retryable,
  };
};

/** @param {ImmersiveGameDetailsProps} props Details properties. */
export const useImmersiveGameDetailsController = ({
  dependencies,
  game,
  platformLabel,
  onBack,
  onLaunch,
  onGameUpdate,
  onOpenSettings,
  retroachievementsEnabled = false,
  rommToken,
  rommUrl,
}) => {
  const achievementState = useGameDetailsAchievements({
    game,
    ipc: dependencies?.ipc,
    retroachievementsEnabled,
    rommToken,
    rommUrl,
  });
  const resources = useDetailsResources({
    game,
    ipc: dependencies?.ipc,
    onBack,
    onGameUpdate,
    onLaunch,
    rommToken,
    rommUrl,
  });
  const detailsState = getImmersiveDetailsState({
    game,
    justDownloaded: resources.actions.justDownloaded,
    launchError: resources.actions.launchError,
    launchProgress: resources.launchProgress,
    launching: resources.actions.launching,
    rommToken,
    rommUrl,
    staleLaunchProgress: resources.staleLaunchProgress,
  });
  const {
    launchErrorPresentation,
    missingEmulatorRecovery,
    retryableLaunchFailure,
  } = useImmersiveLaunchFailureRecovery({
    actions: resources.actions,
    detailsState,
    ipc: dependencies?.ipc,
    platformId: game.platform_id,
    platformLabel,
  });

  useRestoreDetailsFocus({
    launchFailure: detailsState.launchFailure,
    launching: resources.actions.launching,
    primaryActionRef: resources.primaryActionRef,
  });
  useImmersiveGameDetailsKeyboard({
    canPlay: detailsState.canPlay,
    detailsRef: resources.detailsRef,
    handleDownloadRom: resources.actions.handleDownloadRom,
    handleLaunchGame: resources.actions.handleLaunchGame,
    launchFailure: detailsState.launchFailure,
    launching: resources.actions.launching,
    missingEmulatorRecovery,
    onBack,
    onOpenSettings: onOpenSettings ?? noop,
    primaryActionRef: resources.primaryActionRef,
    retryableLaunchFailure,
    switchContentSyncing: resources.actions.switchContentSyncing,
  });
  return getDetailsController({
    achievementState,
    detailsState,
    game,
    launchErrorPresentation,
    missingEmulatorRecovery,
    resources,
    retryableLaunchFailure,
    rommConfigured: hasRommConnection(rommToken, rommUrl),
  });
};
