import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";

/** @param {{id: string, label: string, active: boolean, onSelect: (section: string) => void}} props Section tab properties. */
const SectionTab = ({ id, label, active, onSelect }) => (
  <Button
    aria-current={active ? "page" : undefined}
    onClick={() => {
      onSelect(id);
    }}
    sx={{
      "&:focus-visible": {
        outline: "2px solid",
        outlineColor: "primary.light",
        outlineOffset: 4,
      },
      borderRadius: 0,
      color: active ? "common.white" : "text.secondary",
      fontSize: "1.05rem",
      fontWeight: active ? 700 : 500,
      minWidth: 0,
      position: "relative",
      px: 0.5,
      py: 1,
      textTransform: "none",
    }}
  >
    {label}
    <Box
      aria-hidden="true"
      sx={{
        bgcolor: "primary.light",
        borderRadius: 2,
        bottom: 2,
        height: 2,
        left: 4,
        opacity: active ? 1 : 0,
        position: "absolute",
        right: 4,
      }}
    />
  </Button>
);

/** @param {{section: string|null, onSectionChange: ((section: string) => void)|null}} props Section tab properties. */
const SectionTabs = ({ section, onSectionChange }) => {
  const tabs = [
    { id: "all", label: "Library" },
    { id: "favorites", label: "Favorites" },
    { id: "recent", label: "Recent" },
  ];
  /** @param {string} id Selected section. */
  const handleSelect = (id) => {
    onSectionChange?.(id);
  };
  return (
    <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
      {tabs.map((tab) => (
        <SectionTab
          key={tab.id}
          id={tab.id}
          label={tab.label}
          active={section === null ? tab.id === "all" : section === tab.id}
          onSelect={handleSelect}
        />
      ))}
    </Stack>
  );
};

/** @param {{searchInputRef: {current: HTMLInputElement|null}, searchQuery: string, onSearchChange: (query: string) => void}} props Header search properties. */
export const HeaderSearch = ({
  searchInputRef,
  searchQuery,
  onSearchChange,
}) => (
  <TextField
    inputRef={searchInputRef}
    data-testid="immersive-game-search"
    label="Search games by name"
    placeholder="Search by game name"
    size="small"
    value={searchQuery}
    onChange={
      /** @param {import("react").ChangeEvent<HTMLInputElement>} event Change event. */
      (event) => {
        onSearchChange(event.target.value);
      }
    }
    sx={{
      "& .MuiOutlinedInput-root": {
        "& fieldset": { borderColor: "rgba(255,255,255,0.16)" },
        borderRadius: 2,
        color: "common.white",
      },
      width: { lg: 260, md: 210, xs: 160 },
    }}
    slotProps={{
      input: {
        endAdornment:
          searchQuery === "" ? null : (
            <InputAdornment position="end">
              <IconButton
                aria-label="Clear game search"
                edge="end"
                size="small"
                onPointerDown={
                  /** @param {import("react").PointerEvent<HTMLButtonElement>} event Pointer event. */
                  (event) => {
                    event.stopPropagation();
                  }
                }
                onMouseDown={
                  /** @param {import("react").MouseEvent<HTMLButtonElement>} event Mouse event. */
                  (event) => {
                    event.preventDefault();
                  }
                }
                onClick={() => {
                  onSearchChange("");
                  searchInputRef.current?.focus?.();
                }}
                sx={{ color: "text.secondary" }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: "text.secondary" }} fontSize="small" />
          </InputAdornment>
        ),
      },
    }}
  />
);

/** @param {{section: string|null, onSectionChange: ((section: string) => void)|null, searchInputRef: {current: HTMLInputElement|null}, searchQuery?: string, onSearchChange?: (query: string) => void, menuLabel?: string, onOpenMenu?: () => void}} props Top bar properties. */
export const ImmersiveTopBar = ({
  section,
  onSectionChange,
  searchInputRef,
  searchQuery = "",
  onSearchChange,
  menuLabel = "Menu",
  onOpenMenu,
}) => (
  <Box
    sx={{
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: 2,
      justifyContent: "space-between",
      px: { lg: 5, md: 4, xs: 2.5 },
      py: 1.5,
      rowGap: 1,
    }}
  >
    <SectionTabs section={section} onSectionChange={onSectionChange} />
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      {onSearchChange ? (
        <HeaderSearch
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
      ) : null}
      {onOpenMenu ? (
        <Button
          onClick={onOpenMenu}
          sx={{
            color: "text.secondary",
            fontSize: "1rem",
            fontWeight: 600,
            textTransform: "none",
          }}
        >
          {menuLabel}
        </Button>
      ) : null}
    </Stack>
  </Box>
);
