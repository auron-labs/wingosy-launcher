import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Pagination from "@mui/material/Pagination";
import SearchIcon from "@mui/icons-material/Search";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import GameCard from "./GameCard";
import { tauriDragRegionProps, tauriDragRegionSx, tauriNoDragProps, tauriNoDragSx } from "../utils/isTauri";
import { useRomDownloads } from "../RomDownloadsContext";

export default function Library({
  games,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  searchQuery,
  onSearchChange,
  onSelectGame,
  onToggleFavorite,
  onLaunchGame,
  onNavigateLibrarySettings,
  onNavigateRommSettings,
  error,
  onDismissError,
}) {
  const { getProgress, getLaunchProgress } = useRomDownloads();
  const pageCount = Math.ceil(total / pageSize);

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" onClose={onDismissError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography
          variant="h4"
          component="h1"
          {...tauriDragRegionProps()}
          sx={{ flexShrink: 0, lineHeight: 1.2, ...tauriDragRegionSx }}
        >
          Library
        </Typography>
        <Box
          {...tauriDragRegionProps()}
          sx={{
            display: { xs: "none", sm: "block" },
            flex: 1,
            minWidth: 16,
            minHeight: 40,
            alignSelf: "stretch",
            ...tauriDragRegionSx,
          }}
        />
        <TextField
          {...tauriNoDragProps()}
          size="small"
          placeholder="Search games..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{
            width: "100%",
            maxWidth: { sm: 360 },
            flexShrink: 0,
            ...tauriNoDragSx,
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {loading ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            height: "60vh",
            gap: 2,
          }}
        >
          <CircularProgress color="primary" />
          <Typography variant="body2" color="text.secondary">
            Loading your library...
          </Typography>
        </Box>
      ) : games.length === 0 ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            color: "text.secondary",
          }}
        >
          <Typography variant="h6" gutterBottom>
            No games found
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            Scan a local ROM folder or sync from your RomM server.
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<FolderOpenIcon />}
              onClick={onNavigateLibrarySettings}
            >
              Scan ROM Folder
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudSyncIcon />}
              onClick={onNavigateRommSettings}
              color="info"
            >
              Sync from RomM
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, 1fr)",
                sm: "repeat(3, 1fr)",
                md: "repeat(4, 1fr)",
                lg: "repeat(5, 1fr)",
                xl: "repeat(6, 1fr)",
              },
              gap: 2.5,
              pb: 3,
            }}
          >
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onClick={() => onSelectGame(game)}
                onToggleFavorite={() => onToggleFavorite(game.id)}
                onLaunch={() => onLaunchGame(game.id)}
                downloadProgress={getProgress(game.id)}
                launchProgress={getLaunchProgress(game.id)}
              />
            ))}
          </Box>
          {pageCount > 1 && (
            <Pagination
              count={pageCount}
              page={page}
              onChange={(_event, nextPage) => onPageChange(nextPage)}
              showFirstButton
              showLastButton
              color="primary"
              sx={{ display: "flex", justifyContent: "center", pb: 4 }}
            />
          )}
        </>
      )}
    </Box>
  );
}
