import * as Mui from "@mui/material";

import SettingSlider from "./setting-slider";

/** @typedef {Pick<import("./settings-types").SettingsPanelProps, "ambientEnabled"|"ambientIsFolder"|"ambientPath"|"ambientShuffle"|"ambientVolume"|"persistAmbient"|"pickAmbientFile"|"pickAmbientFolder"|"clearAmbientSource"|"setAmbientVolume">} AmbientMusicProps */

/** @param {string|null} path Ambient source path. @returns {boolean} Whether a source is selected. */
const hasAmbientPath = (path) => path !== null && path !== "";

/** @param {{ambientEnabled: boolean, ambientPath: string|null, persistAmbient: AmbientMusicProps["persistAmbient"], pickAmbientFile: AmbientMusicProps["pickAmbientFile"], pickAmbientFolder: AmbientMusicProps["pickAmbientFolder"], clearAmbientSource: AmbientMusicProps["clearAmbientSource"]}} settings Ambient source state and actions. */
const AmbientSourceControls = (settings) => {
  const sourceSelected = hasAmbientPath(settings.ambientPath);
  return (
    <>
      <Mui.FormControlLabel
        control={
          <Mui.Switch
            checked={settings.ambientEnabled}
            onChange={(event) => {
              void settings.persistAmbient({
                ambient_enabled: event.target.checked,
              });
            }}
          />
        }
        label="Play background music"
      />
      {!sourceSelected && (
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
          onClick={() => {
            void settings.pickAmbientFile();
          }}
          disabled={!settings.ambientEnabled}
        >
          Audio file…
        </Mui.Button>
        <Mui.Button
          size="small"
          variant="outlined"
          onClick={() => {
            void settings.pickAmbientFolder();
          }}
          disabled={!settings.ambientEnabled}
        >
          Folder…
        </Mui.Button>
        {sourceSelected && (
          <Mui.Button
            size="small"
            color="inherit"
            onClick={() => {
              void settings.clearAmbientSource();
            }}
          >
            Clear
          </Mui.Button>
        )}
      </Mui.Box>
    </>
  );
};

/** @param {{ambientEnabled: boolean, ambientIsFolder: boolean, ambientPath: string|null, ambientShuffle: boolean, persistAmbient: AmbientMusicProps["persistAmbient"]}} settings Ambient shuffle state and actions. */
const AmbientShuffleControl = (settings) => {
  if (!settings.ambientIsFolder) {
    return null;
  }
  return (
    <Mui.FormControlLabel
      sx={{ mb: 2 }}
      control={
        <Mui.Switch
          checked={settings.ambientShuffle}
          onChange={(event) => {
            void settings.persistAmbient({
              ambient_shuffle: event.target.checked,
            });
          }}
          disabled={
            !settings.ambientEnabled || !hasAmbientPath(settings.ambientPath)
          }
        />
      }
      label="Shuffle tracks"
    />
  );
};

/** @param {{ambientEnabled: boolean, ambientPath: string|null, ambientVolume: number, setAmbientVolume: (value: number) => void, persistAmbient: AmbientMusicProps["persistAmbient"]}} settings Ambient volume state and actions. */
const AmbientVolumeControl = (settings) => (
  <Mui.Box sx={{ maxWidth: 400, px: 1 }}>
    <SettingSlider
      label="Background music volume"
      value={settings.ambientVolume}
      valueTestId="ambient-volume-value"
      formatValue={(value) => `${Math.round(value)}%`}
      size="small"
      disabled={
        !settings.ambientEnabled || !hasAmbientPath(settings.ambientPath)
      }
      min={0}
      max={100}
      valueLabelDisplay="auto"
      onChange={(_, value) => {
        settings.setAmbientVolume(Array.isArray(value) ? value[0] : value);
      }}
      onChangeCommitted={(_, value) => {
        const nextValue = Array.isArray(value) ? value[0] : value;
        void settings.persistAmbient({
          ambient_volume: Math.min(100, Math.max(0, Math.round(nextValue))),
        });
      }}
    />
  </Mui.Box>
);

/** @param {AmbientMusicProps} settings Ambient music state and actions. */
const AmbientMusicSettings = (settings) => {
  const sourceSelected = hasAmbientPath(settings.ambientPath);
  return (
    <>
      <Mui.Typography variant="subtitle2" sx={{ mb: 0.5, mt: 1 }}>
        Background music
      </Mui.Typography>
      <Mui.Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        Optional looping track or shuffled folder playback while browsing in
        Immersive mode.
      </Mui.Typography>
      <AmbientSourceControls {...settings} />
      {sourceSelected && (
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
      )}
      <AmbientShuffleControl {...settings} />
      <AmbientVolumeControl {...settings} />
    </>
  );
};

export default AmbientMusicSettings;
