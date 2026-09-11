import { isText } from "../utils/value-guards";

const MISSING_EMULATOR_ERROR =
  /(?:No compatible RetroArch core is installed for|No emulator configured for platform:)\s*(?<platform>.+)$/iu;

/** @typedef {string|{message?: string}|null|undefined} LaunchError */

/** @param {LaunchError} error - Error returned by a launch attempt. */
const getErrorMessage = (error) => {
  if (isText(error)) {
    return error.trim();
  }
  const message = error?.message;
  return message === null || message === undefined ? "" : message.trim();
};

/** @param {LaunchError} error - Error returned by a launch attempt. */
export const canRetryLaunch = (error) =>
  !MISSING_EMULATOR_ERROR.test(getErrorMessage(error));

/**
 * @param {LaunchError} error - Error returned by a launch attempt.
 * @param {string|null|undefined} platformLabel - Human-readable platform name.
 */
export const getLaunchErrorPresentation = (error, platformLabel) => {
  const rawMessage = getErrorMessage(error) || "Unable to launch this game.";
  const missingEmulator = MISSING_EMULATOR_ERROR.exec(rawMessage);
  const retryable = canRetryLaunch(rawMessage);

  if (missingEmulator) {
    const label = platformLabel?.trim() ?? "";
    const fallback = missingEmulator.groups?.platform?.trim() ?? "";
    const platform = label === "" ? fallback : label;
    return {
      guidance: `Open Settings → Emulators to install or select a compatible emulator for ${platform}.`,
      message: `This game cannot start because no compatible emulator is installed for ${platform}.`,
      retryable,
    };
  }

  return {
    guidance: "Check Settings → Emulators, then try again.",
    message: rawMessage,
    retryable,
  };
};
