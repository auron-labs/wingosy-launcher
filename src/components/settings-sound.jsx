import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import * as Mui from "@mui/material";

import * as Components from "./settings-components";
import * as Shared from "./settings-view-shared";

/** @param {import("./settings-types").SettingsPanelProps} settings - Settings panel state and actions. */
export default function SoundSettings(settings) {
  return (
  <Mui.Paper sx={Shared.SETTINGS_CARD_SX}>
    <Mui.Box
      sx={{ alignItems: "center", display: "flex", gap: 1, mb: 1 }}
    >
      <VolumeUpIcon color="primary" />
      <Mui.Typography variant="h6">Sound</Mui.Typography>
    </Mui.Box>
    <Mui.Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      UI feedback and background music are used while Immersive mode
      is active; desktop mode remains silent.
    </Mui.Typography>

    <Mui.Typography variant="subtitle2" sx={{ mb: 0.5 }}>
      UI sounds
    </Mui.Typography>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 1 }}
    >
      Argosy-style feedback sounds (bundled clips). Preview each sound
      below.
    </Mui.Typography>
    <Mui.FormControlLabel
      control={
        <Mui.Switch
          checked={settings.uiSoundsEnabled}
          onChange={async (e) => {
            await settings.persistUiSounds(e.target.checked);
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
        onChange={(_, v) => {
          settings.setUiSoundsVolume(Array.isArray(v) ? v[0] : v);
        }}
        onChangeCommitted={async (_, v) => settings.persistUiSoundsVolume(v)}
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
                settings.previewArgosySound?.(/** @type {import("./settings-types").SettingsSoundId} */ (id));
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

    <Mui.Typography variant="subtitle2" sx={{ mb: 0.5, mt: 1 }}>
      Background music
    </Mui.Typography>
    <Mui.Typography
      variant="caption"
      color="text.secondary"
      sx={{ display: "block", mb: 1 }}
    >
      Optional looping track or shuffled folder playback while
      browsing in Immersive mode.
    </Mui.Typography>
    <Mui.FormControlLabel
      control={
        <Mui.Switch
          checked={settings.ambientEnabled}
          onChange={async (e) => {
            await settings.persistAmbient({
              ambient_enabled: e.target.checked,
            });
          }}
        />
      }
      label="Play background music"
    />
    {settings.ambientPath ? null : (
      <Mui.Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1, ml: 4.5 }}
      >
        {settings.ambientEnabled
          ? "Choose an audio file or folder below to start playback."
          : "Turn on background music to choose an audio source."}
      </Mui.Typography>
    )}
    <Mui.Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
      <Mui.Button
        size="small"
        variant="outlined"
        onClick={settings.pickAmbientFile}
        disabled={!settings.ambientEnabled}
      >
        Audio file…
      </Mui.Button>
      <Mui.Button
        size="small"
        variant="outlined"
        onClick={settings.pickAmbientFolder}
        disabled={!settings.ambientEnabled}
      >
        Folder…
      </Mui.Button>
      {settings.ambientPath ? (
        <Mui.Button
          size="small"
          color="inherit"
          onClick={settings.clearAmbientSource}
        >
          Clear
        </Mui.Button>
      ) : null}
    </Mui.Box>
    {settings.ambientPath ? (
      <Mui.Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontFamily: "monospace",
          fontSize: "0.8125rem",
          mb: 2,
          wordBreak: "break-all",
        }}
      >
        {settings.ambientIsFolder ? "[Folder] " : "[File] "}
        {settings.ambientPath}
      </Mui.Typography>
    ) : null}
    {settings.ambientIsFolder ? (
      <Mui.FormControlLabel
        sx={{ mb: 2 }}
        control={
          <Mui.Switch
            checked={settings.ambientShuffle}
            onChange={async (e) => {
              await settings.persistAmbient({
                ambient_shuffle: e.target.checked,
              });
            }}
            disabled={!settings.ambientEnabled || !settings.ambientPath}
          />
        }
        label="Shuffle tracks"
      />
    ) : null}
    <Mui.Box sx={{ maxWidth: 400, px: 1 }}>
      <Components.SettingSlider
        label="Background music volume"
        value={settings.ambientVolume}
        valueTestId="ambient-volume-value"
        formatValue={(value) => `${Math.round(value)}%`}
        size="small"
        disabled={!settings.ambientEnabled || !settings.ambientPath}
        min={0}
        max={100}
        valueLabelDisplay="auto"
        onChange={(_, v) => {
          settings.setAmbientVolume(Array.isArray(v) ? v[0] : v);
        }}
        onChangeCommitted={(_, v) => {
          const value = Array.isArray(v) ? v[0] : v;
          settings.persistAmbient({
            ambient_volume: Math.min(
              100,
              Math.max(0, Math.round(value))
            ),
          });
        }}
      />
    </Mui.Box>
  </Mui.Paper>
  );
}
