import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import MemoryIcon from "@mui/icons-material/Memory";
import RefreshIcon from "@mui/icons-material/Refresh";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const CARD_SX = {
  p: 3,
  mb: 3,
  borderRadius: 3,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function BiosSettings() {
  const [firmware, setFirmware] = useState([]);
  const [biosDirectory, setBiosDirectory] = useState("");
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [directory, items] = await Promise.all([
        invoke("get_bios_directory"),
        invoke("list_bios_firmware"),
      ]);
      setBiosDirectory(directory);
      setFirmware(items);
    } catch (error) {
      setMessage({ type: "error", text: error?.message || String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const byPlatform = new Map();
    for (const item of firmware) {
      const group = byPlatform.get(item.platform_slug) || {
        slug: item.platform_slug,
        name: item.platform_name,
        items: [],
      };
      group.items.push(item);
      byPlatform.set(item.platform_slug, group);
    }
    return [...byPlatform.values()];
  }, [firmware]);

  const downloaded = firmware.filter((item) => item.is_downloaded).length;
  const downloadable = firmware.filter((item) => !item.missing_from_fs);
  const missing = downloadable.filter((item) => !item.is_downloaded).length;

  async function downloadOne(id, fileName) {
    setBusy(`file:${id}`);
    setMessage(null);
    try {
      const path = await invoke("download_bios_firmware", { firmwareId: id });
      setMessage({ type: "success", text: `${fileName} downloaded to ${path}` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error?.message || String(error) });
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    setBusy("all");
    setMessage(null);
    try {
      const result = await invoke("download_all_bios_firmware");
      setMessage({
        type: "success",
        text: `Downloaded ${result.downloaded}; ${result.skipped} already present.`,
      });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error?.message || String(error) });
    } finally {
      setBusy(null);
    }
  }

  async function distribute() {
    setBusy("distribute");
    setMessage(null);
    try {
      const results = await invoke("distribute_bios_firmware");
      const copied = results.reduce((sum, item) => sum + item.files_copied, 0);
      const detail = results
        .filter((item) => item.files_copied > 0)
        .map((item) => `${item.emulator_id}: ${item.files_copied}`)
        .join(", ");
      setMessage({
        type: copied > 0 ? "success" : "warning",
        text: copied > 0
          ? `Distributed ${copied} file copies (${detail}).`
          : "No BIOS files were copied. Configure a supported emulator first.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || String(error) });
    } finally {
      setBusy(null);
    }
  }

  async function chooseDirectory() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    try {
      const directory = await invoke("set_bios_directory", { path: selected });
      setBiosDirectory(directory);
      setMessage({ type: "success", text: `BIOS directory set to ${directory}` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error?.message || String(error) });
    }
  }

  async function resetDirectory() {
    try {
      const directory = await invoke("set_bios_directory", { path: null });
      setBiosDirectory(directory);
      setMessage({ type: "success", text: `BIOS directory reset to ${directory}` });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error?.message || String(error) });
    }
  }

  return (
    <>
      <Paper sx={CARD_SX}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
          <MemoryIcon color="primary" />
          <Typography variant="h6" sx={{ flex: 1 }}>BIOS &amp; Firmware</Typography>
          <Chip size="small" label={`${downloaded}/${downloadable.length} downloaded`} color={missing === 0 && downloadable.length ? "success" : "default"} />
          <IconButton size="small" onClick={load} disabled={loading || Boolean(busy)} aria-label="Refresh BIOS list">
            <RefreshIcon />
          </IconButton>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Download firmware from your RomM server, verify its checksum, then install it into known emulator BIOS folders. For Switch, Wingosy installs prod.keys and firmware.zip into configured Eden instances.
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, mb: 2, bgcolor: "rgba(0,0,0,0.2)", borderRadius: 2 }}>
          <FolderOpenIcon color="action" />
          <Typography variant="body2" sx={{ flex: 1, fontFamily: "monospace", overflowWrap: "anywhere" }}>
            {biosDirectory || "Loading..."}
          </Typography>
          <Button size="small" variant="outlined" onClick={chooseDirectory}>Change</Button>
          <Button size="small" onClick={resetDirectory}>Default</Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button variant="contained" startIcon={busy === "all" ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />} onClick={downloadAll} disabled={loading || Boolean(busy) || downloadable.length === 0}>
            {missing > 0 ? `Download ${missing} missing` : "Verify / redownload"}
          </Button>
          <Button variant="outlined" onClick={distribute} disabled={loading || Boolean(busy) || downloaded === 0}>
            {busy === "distribute" ? "Distributing..." : "Distribute to emulators"}
          </Button>
        </Box>
        {message && <Alert severity={message.type} sx={{ mt: 2 }}>{message.text}</Alert>}
      </Paper>

      <Paper sx={CARD_SX}>
        <Typography variant="h6" gutterBottom>Available from RomM</Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>
        ) : groups.length === 0 ? (
          <Alert severity="info">No firmware was returned by RomM. Sync the library and confirm the token has the firmware.read scope.</Alert>
        ) : (
          <List disablePadding>
            {groups.map((group) => {
              const isExpanded = Boolean(expanded[group.slug]);
              const complete = group.items.filter((item) => !item.missing_from_fs).every((item) => item.is_downloaded);
              return (
                <Box key={group.slug} sx={{ borderBottom: 1, borderColor: "divider" }}>
                  <ListItem
                    secondaryAction={<IconButton onClick={() => setExpanded((prev) => ({ ...prev, [group.slug]: !isExpanded }))}>{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>}
                    sx={{ cursor: "pointer" }}
                    onClick={() => setExpanded((prev) => ({ ...prev, [group.slug]: !isExpanded }))}
                  >
                    <ListItemText primary={group.name} secondary={`${group.items.filter((item) => item.is_downloaded).length} of ${group.items.length} downloaded`} />
                    <Chip size="small" label={complete ? "Ready" : "Missing"} color={complete ? "success" : "warning"} sx={{ mr: 5 }} />
                  </ListItem>
                  <Collapse in={isExpanded} unmountOnExit>
                    <List disablePadding sx={{ pl: 3, pb: 1 }}>
                      {group.items.map((item) => (
                        <ListItem key={item.id} secondaryAction={
                          <Button
                            size="small"
                            startIcon={busy === `file:${item.id}` ? <CircularProgress size={14} /> : <DownloadIcon />}
                            disabled={Boolean(busy) || item.missing_from_fs}
                            onClick={() => downloadOne(item.id, item.file_name)}
                          >
                            {item.is_downloaded ? "Redownload" : "Download"}
                          </Button>
                        }>
                          <ListItemText
                            primary={item.file_name}
                            secondary={item.missing_from_fs ? "Missing from RomM filesystem" : item.is_downloaded ? item.local_path : formatBytes(item.file_size_bytes)}
                            slotProps={{
                              primary: { sx: { fontFamily: "monospace" }, variant: "body2" },
                              secondary: { sx: { overflowWrap: "anywhere", pr: 12 } },
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        )}
      </Paper>
    </>
  );
}
