const MISSING_EMULATOR_ERROR =
  /(?:No compatible RetroArch core is installed for|No emulator configured for platform:)\s*(.+)$/i;

function getErrorMessage(error) {
  if (typeof error === "string") return error.trim();
  return error?.message ? String(error.message).trim() : "";
}

export function canRetryLaunch(error) {
  return !MISSING_EMULATOR_ERROR.test(getErrorMessage(error));
}

export function getLaunchErrorPresentation(error, platformLabel) {
  const rawMessage = getErrorMessage(error) || "Unable to launch this game.";
  const missingEmulator = rawMessage.match(MISSING_EMULATOR_ERROR);
  const retryable = canRetryLaunch(rawMessage);

  if (missingEmulator) {
    const platform = platformLabel?.trim() || missingEmulator[1].trim();
    return {
      message: `This game cannot start because no compatible emulator is installed for ${platform}.`,
      guidance: `Open Settings → Emulators to install or select a compatible emulator for ${platform}.`,
      retryable,
    };
  }

  return {
    message: rawMessage,
    guidance: "Check Settings → Emulators, then try again.",
    retryable,
  };
}
