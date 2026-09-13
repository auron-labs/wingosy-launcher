const MISSING_EMULATOR_ERROR =
  /(?:No compatible RetroArch core is installed for|No emulator configured for platform:)\s*(?<platform>.+)$/iu;

/** @typedef {string|{message?: string}|null|undefined} LaunchError */

/** @param {LaunchError} error Candidate error. @returns {error is string} Whether the error is text. */
const isLaunchErrorString = (error) =>
  Object.prototype.toString.call(error) === "[object String]";

/** @param {LaunchError} error Candidate error. @returns {error is {message?: string}} Whether the error has a message property. */
const isLaunchErrorObject = (error) => error instanceof Object;

/** @param {LaunchError} error - Error returned by a launch attempt. */
const getErrorMessage = (error) => {
  if (isLaunchErrorString(error)) {
    return error.trim();
  }
  if (isLaunchErrorObject(error)) {
    return error.message?.trim() ?? "";
  }
  return "";
};

/** @param {LaunchError} error - Error returned by a launch attempt. */
export const canRetryLaunch = (error) =>
  !MISSING_EMULATOR_ERROR.test(getErrorMessage(error));

/**
 * @param {LaunchError} error - Error returned by a launch attempt.
 * @param {string|null|undefined} platformLabel - Human-readable platform name.
 */
export const getLaunchErrorPresentation = (error, platformLabel) => {
  const message = getErrorMessage(error);
  const rawMessage = message === "" ? "Unable to launch this game." : message;
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
