import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

import { isTauri } from "../utils/is-tauri";
import { listAmbientAudioFiles } from "./immersive-mode-ipc";

/** @typedef {import("./immersive-types").AmbientAudioConfig} AmbientAudioConfig */

/** @param {string|null|undefined} path Audio path to normalize. */
const toAudioUrl = (path) => {
  if (path === null || path === undefined || path === "") {
    return null;
  }
  if (/^https?:\/\//iu.test(path)) {
    return path;
  }
  if (!isTauri()) {
    return null;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
};

/** @param {string[]} arr Tracks to shuffle. */
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** @returns {HTMLAudioElement|null} Initial audio element. */
const getInitialAudioElement = () => null;

/** @param {HTMLAudioElement} element Audio element to play. @returns {Promise<void>} Playback attempt. */
const playAudioSafely = async (element) => {
  try {
    await element.play();
  } catch (error) {
    void error;
  }
};

/** @param {{path: string|null, isFolder: boolean, shuffle: boolean, setTracks: (tracks: string[]) => void, setIx: (index: number) => void}} options Track loading options. */
const useAmbientTracks = ({ isFolder, path, setIx, setTracks, shuffle }) => {
  useEffect(() => {
    let cancel = false;
    const loadTracks = async () => {
      if (path === null || path === undefined || path === "") {
        setTracks([]);
        setIx(0);
        return;
      }
      if (!isFolder) {
        setTracks([path]);
        setIx(0);
        return;
      }
      try {
        const files = await listAmbientAudioFiles(path);
        if (cancel) {
          return;
        }
        const list = files.filter((file) => file !== "");
        setTracks(shuffle ? shuffleArray(list) : list.toSorted());
        setIx(0);
      } catch {
        if (!cancel) {
          setTracks([]);
        }
      }
    };
    void loadTracks();
    return () => {
      cancel = true;
    };
  }, [isFolder, path, setIx, setTracks, shuffle]);
};

/** @param {{audioRef: {current: HTMLAudioElement|null}, enabled: boolean, src: string|null, tracksRef: {current: string[]}, setIx: (update: (index: number) => number) => void}} options Playback options. */
const useAmbientPlayback = ({ audioRef, enabled, setIx, src, tracksRef }) => {
  useEffect(() => {
    const element = audioRef.current;
    /** @type {(() => void)|null} */
    let removeEndedListener = null;
    if (element && (!enabled || src === null || src === "")) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    } else if (element && src !== null && src !== "") {
      const onEnded = () => {
        const count = tracksRef.current.length;
        if (count <= 1) {
          element.currentTime = 0;
          void playAudioSafely(element);
          return;
        }
        setIx((index) => (index + 1) % count);
      };
      element.loop = tracksRef.current.length <= 1;
      element.src = src;
      void playAudioSafely(element);
      element.addEventListener("ended", onEnded);
      removeEndedListener = () => {
        element.removeEventListener("ended", onEnded);
      };
    }
    return () => {
      if (removeEndedListener !== null) {
        removeEndedListener();
      }
    };
  }, [audioRef, enabled, setIx, src, tracksRef]);
};

/**
 * Argosy-style ambient BGM for Immersive mode (config from `get_config().audio`).
 * @param {{audio?: AmbientAudioConfig|null}} props Ambient audio properties.
 */
const AmbientAudioPlayer = ({ audio }) => {
  const elRef = useRef(getInitialAudioElement());
  /** @type {string[]} */
  const initialTracks = [];
  const tracksRef = useRef(initialTracks);
  /** @type {string[]} */
  const initialTrackList = [];
  const [tracks, setTracks] = useState(initialTrackList);
  const [ix, setIx] = useState(0);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const enabled =
    audio?.ambient_enabled === true &&
    audio.ambient_path !== null &&
    audio.ambient_path !== undefined &&
    audio.ambient_path !== "";
  const configuredVolume = audio?.ambient_volume;
  const vol =
    configuredVolume !== undefined && Number.isFinite(configuredVolume)
      ? configuredVolume
      : 35;
  const path = audio?.ambient_path ?? null;
  const isFolder = Boolean(audio?.ambient_is_folder);
  const shuffle = Boolean(audio?.ambient_shuffle);

  useAmbientTracks({ isFolder, path, setIx, setTracks, shuffle });

  const safeIx = tracks.length > 0 ? ix % tracks.length : 0;
  const currentPath = tracks.length > 0 ? tracks[safeIx] : null;
  const src =
    currentPath === null || currentPath === "" ? null : toAudioUrl(currentPath);

  useEffect(() => {
    const element = elRef.current;
    if (element) {
      element.volume = Math.min(1, Math.max(0, vol / 100));
    }
  }, [vol]);
  useAmbientPlayback({
    audioRef: elRef,
    enabled,
    setIx,
    src,
    tracksRef,
  });

  if (!enabled || src === null || src === "") {
    return null;
  }

  return (
    <audio ref={elRef} preload="auto" style={{ display: "none" }} aria-hidden>
      <track kind="captions" />
    </audio>
  );
};

export default AmbientAudioPlayer;
