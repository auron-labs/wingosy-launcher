import { BiosSettingsView } from "./bios-settings-view";
import { useBiosSettings } from "./use-bios-settings";

/** @param {{libraryPlatforms?: import("./bios-types").LibraryPlatformEntry[]}} props - BIOS library context. */
const BiosSettings = (props) => {
  return <BiosSettingsView {...useBiosSettings(props)} />;
};

export default BiosSettings;
