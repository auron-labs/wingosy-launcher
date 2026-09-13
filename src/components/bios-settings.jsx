import { BiosSettingsView } from "./bios-settings-view";
import { useBiosSettings } from "./use-bios-settings";

/** @param {{libraryPlatforms?: import("./bios-types").LibraryPlatformEntry[], invokeBios?: import("./use-bios-settings").BiosInvoke, openDirectory?: (options: {directory: boolean, multiple: boolean}) => Promise<string|string[]|null>}} props - BIOS library context and command boundaries. */
const BiosSettings = (props) => (
  <BiosSettingsView {...useBiosSettings(props)} />
);

export default BiosSettings;
