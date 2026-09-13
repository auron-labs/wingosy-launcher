/** @param {number|null|undefined} id RomM identifier. @returns {boolean} Whether an identifier is configured. */
export const hasRommId = (id) => id !== null && id !== undefined;

/** @param {string|null|undefined} token RomM token. @param {string|null|undefined} url RomM URL. @returns {boolean} Whether RomM is configured. */
export const hasRommConnection = (token, url) =>
  token !== null &&
  token !== undefined &&
  token !== "" &&
  url !== null &&
  url !== undefined &&
  url !== "";

/** @param {{platform_id: string, romm_id?: number|null, source?: string|null}} game Game being viewed. @param {string|null|undefined} rommToken RomM token. @param {string|null|undefined} rommUrl RomM URL. @returns {boolean} Whether Switch content synchronization is available. */
export const canSyncImmersiveSwitchContent = (game, rommToken, rommUrl) =>
  game.platform_id === "switch" &&
  game.source === "RomM" &&
  hasRommId(game.romm_id) &&
  hasRommConnection(rommToken, rommUrl);

/** @param {{game: {local_file_path?: string|null, platform_id: string, romm_id?: number|null, source?: string|null}, justDownloaded: boolean, launchError: string|null, launchProgress: {stage?: string, error?: string|null}|null, launching: boolean, rommToken: string|null|undefined, rommUrl: string|null|undefined, staleLaunchProgress: {stage?: string, error?: string|null}|null}} options Details state inputs. @returns {{canDownload: boolean, canPlay: boolean, canSyncSwitchContent: boolean, hasLocalFile: boolean, launchDialogOpen: boolean, launchFailure: boolean, visibleLaunchProgress: {stage?: string, error?: string|null}|null}} Derived details state. */
export const getImmersiveDetailsState = ({
  game,
  justDownloaded,
  launchError,
  launchProgress,
  launching,
  rommToken,
  rommUrl,
  staleLaunchProgress,
}) => {
  const hasLocalFile = justDownloaded || Boolean(game.local_file_path?.trim());
  const canPlay =
    hasLocalFile || (!hasRommId(game.romm_id) && game.source !== "RomM");
  const canDownload =
    hasRommId(game.romm_id) && hasRommConnection(rommToken, rommUrl);
  const canSyncSwitchContent = canSyncImmersiveSwitchContent(
    game,
    rommToken,
    rommUrl
  );
  const attemptProgress =
    launchProgress !== null && launchProgress !== staleLaunchProgress
      ? launchProgress
      : null;
  const visibleLaunchProgress =
    (launching || launchError !== null) && attemptProgress !== null
      ? attemptProgress
      : null;
  const launchFailure =
    launchError !== null || visibleLaunchProgress?.stage === "failure";
  const launchDialogOpen =
    launching || visibleLaunchProgress !== null || launchFailure;
  return {
    canDownload,
    canPlay,
    canSyncSwitchContent,
    hasLocalFile,
    launchDialogOpen,
    launchFailure,
    visibleLaunchProgress,
  };
};
