import { Icon } from "@iconify/react";
import Box from "@mui/material/Box";
import { useState } from "react";

import "../iconify-setup";
import {
  platformIconSource,
  rommPlatformIconCandidates,
} from "../utils/platform-icons";

/** @param {{src: string, size: number, onError: () => void}} props Remote art properties. */
const RemoteArt = ({ src, size, onError }) => (
  <Box
    component="img"
    src={src}
    alt=""
    loading="lazy"
    draggable={false}
    onError={onError}
    sx={{
      height: "72%",
      objectFit: "contain",
      width: "72%",
    }}
  />
);

/** @param {{icon: string, size: number}} props Bundled glyph properties. */
const BundledArt = ({ icon, size }) => (
  <Icon
    icon={icon}
    width={Math.round(size * 0.62)}
    height={Math.round(size * 0.62)}
  />
);

/** @param {{label: string, selected: boolean}} props Initials properties. */
const InitialsArt = ({ label, selected }) => (
  <Box
    component="span"
    sx={{
      fontSize: selected ? "0.8rem" : "0.7rem",
      fontWeight: 800,
    }}
  >
    {label}
  </Box>
);

/** @param {{platformId: string, rommUrl?: string|null, selected: boolean}} props Spine platform badge properties. */
export const ImmersivePlatformBadge = ({
  platformId,
  rommUrl,
  selected,
}) => {
  const candidates = rommPlatformIconCandidates(platformId, rommUrl ?? null);
  const source = platformIconSource({ id: platformId });
  const [remoteStep, setRemoteStep] = useState(0);
  const remoteSrc = candidates[remoteStep] ?? null;
  const size = selected ? 44 : 36;
  const advanceRemote = () => {
    setRemoteStep((step) => step + 1);
  };
  return (
    <Box
      sx={{
        alignItems: "center",
        border: selected
          ? "1px solid rgba(165, 180, 252, 0.9)"
          : "1px solid rgba(255,255,255,0.18)",
        borderRadius: "50%",
        color: selected ? "primary.light" : "text.secondary",
        display: "flex",
        flexShrink: 0,
        height: size,
        justifyContent: "center",
        letterSpacing: "0.04em",
        overflow: "hidden",
        width: size,
      }}
    >
      {remoteSrc === null ? null : (
        <RemoteArt src={remoteSrc} size={size} onError={advanceRemote} />
      )}
      {remoteSrc !== null || source.kind !== "bundled" ? null : (
        <BundledArt icon={source.value} size={size} />
      )}
      {remoteSrc !== null || source.kind === "bundled" ? null : (
        <InitialsArt label={source.value} selected={selected} />
      )}
    </Box>
  );
};
