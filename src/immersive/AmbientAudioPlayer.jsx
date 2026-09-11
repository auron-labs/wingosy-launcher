import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

import { isTauri } from "../utils/isTauri";
import { isText } from "../utils/value-guards";

/** @typedef {import("./immersive-types").AmbientAudioConfig} AmbientAudioConfig */

/** @param {string|null|undefined} path */
const toAudioUrl = (path) => {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
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

/** @param {string[]} arr */
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Argosy-style ambient BGM for Immersive mode (config from `get_config().audio`).
 * @param {{audio?: AmbientAudioConfig|null}} props
 */
const AmbientAudioPlayer = ({ audio }) => {
  const elRef = useRef(/** @type {HTMLAudioElement|null} */ (null));
  const tracksRef = useRef(/** @type {string[]} */ ([]));
  const [tracks, setTracks] = useState(/** @type {string[]} */ ([]));
  const [ix, setIx] = useState(0);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  const enabled = Boolean(audio?.ambient_enabled && audio?.ambient_path);
  const vol =
    typeof audio?.ambient_volume === "number" ? audio.ambient_volume : 35;
  const path = audio?.ambient_path || null;
  const isFolder = Boolean(audio?.ambient_is_folder);
  const shuffle = Boolean(audio?.ambient_shuffle);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!path) {
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
        const files = await invoke("list_ambient_audio_files", { dir: path });
        if (cancel) {
          return;
        }
        const list = Array.isArray(files) ? files.filter(isText) : [];
        setTracks(shuffle ? shuffleArray(list) : list.toSorted());
        setIx(0);
      } catch {
        if (!cancel) {
          setTracks([]);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [path, isFolder, shuffle]);

  const safeIx = tracks.length > 0 ? ix % tracks.length : 0;
  const currentPath = tracks.length > 0 ? tracks[safeIx] : null;
  const src = currentPath ? toAudioUrl(currentPath) : null;

  useEffect(() => {
    const el = elRef.current;
    if (!el) {
      return;
    }
    el.volume = Math.min(1, Math.max(0, vol / 100));
  }, [vol]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) {
      return;
    }

    if (!enabled || !src) {
      el.pause();
      el.removeAttribute("src");
      el.load();
      return;
    }

    const onEnded = () => {
      const n = tracksRef.current.length;
      if (n <= 1) {
        el.currentTime = 0;
        void el.play().catch(() => {});
        return;
      }
      setIx((i) => (i + 1) % n);
    };

    el.loop = tracksRef.current.length <= 1;
    el.src = src;
    void el.play().catch(() => undefined);
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, [enabled, src, tracks.length]);

  if (!enabled || !src) {
    return null;
  }

  return (
    <audio ref={elRef} preload="auto" style={{ display: "none" }} aria-hidden />
  );
};

export default AmbientAudioPlayer;
