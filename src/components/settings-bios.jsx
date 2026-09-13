import * as Components from "./settings-components";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
const BiosSettingsPanel = (settings) => (
  <Components.BiosSettings
    invokeBios={settings.runtime.invoke}
    libraryPlatforms={settings.platforms}
    openDirectory={settings.runtime.openDialog}
  />
);

export default BiosSettingsPanel;
