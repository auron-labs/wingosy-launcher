import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import * as Mui from "@mui/material";

import AmbientMusicSettings from "./settings-ambient-music";
import * as Components from "./settings-components";

/** @typedef {import("./settings-types").SettingsPanelProps} SettingsPanelProps */
/** @typedef {import("./settings-types").SettingsSliderValue} SettingsSliderValue */

/** @param {SettingsSliderValue} value Slider value. @returns {number} Scalar value. */
const getSliderValue = (value) => (Array.isArray(value) ? value[0] : value);

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const UiSoundSettings = (settings) => (
  <>
    <Mui.Typography variant="subtitle2" sx={{ mb: 0.5 }}>
      UI sounds
    </Mui.Typography>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 1 }}
    >
      Argosy-style feedback sounds (bundled clips). Preview each sound below.
    </Mui.Typography>
    <Mui.FormControlLabel
      control={
        <Mui.Switch
          checked={settings.uiSoundsEnabled}
          onChange={(event) => {
            void settings.persistUiSounds(event.target.checked);
          }}
        />
      }
      label="Enable UI sounds"
    />
    <Mui.Box sx={{ maxWidth: 400, mb: 2, mt: 1, px: 1 }}>
      <Components.SettingSlider
        label="UI sounds volume"
        value={settings.uiSoundsVolume}
        valueTestId="ui-sounds-value"
        formatValue={(value) => `${Math.round(value)}%`}
        size="small"
        disabled={!settings.uiSoundsEnabled}
        min={0}
        max={100}
        valueLabelDisplay="auto"
        onChange={(_, value) => {
          settings.setUiSoundsVolume(getSliderValue(value));
        }}
        onChangeCommitted={(_, value) => {
          void settings.persistUiSoundsVolume(value);
        }}
      />
    </Mui.Box>
    <Mui.List dense sx={{ maxWidth: 520, mb: 2 }}>
      {settings.argosySoundEntries.map(({ id, label }) => (
        <Mui.ListItem
          key={id}
          secondaryAction={
            <Mui.Button
              size="small"
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              disabled={!settings.uiSoundsEnabled}
              onClick={() => {
                settings.previewArgosySound?.(id);
              }}
              data-testid={`ui-sound-preview-${id}`}
            >
              Preview
            </Mui.Button>
          }
        >
          <Mui.ListItemText primary={label} />
        </Mui.ListItem>
      ))}
    </Mui.List>
  </>
);

/** @param {SettingsPanelProps} settings Settings panel state and actions. */
const SoundSettings = (settings) => (
  <Components.SettingsCard>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      UI feedback and background music are used while Immersive mode is active;
      desktop mode remains silent.
    </Mui.Typography>
    <UiSoundSettings {...settings} />
    <AmbientMusicSettings {...settings} />
  </Components.SettingsCard>
);

export default SoundSettings;
