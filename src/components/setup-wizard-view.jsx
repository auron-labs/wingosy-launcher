import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import FolderIcon from "@mui/icons-material/Folder";
import SearchIcon from "@mui/icons-material/Search";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const STEPS = ["RomM Server", "ROM Folder", "Scan Games"];

/** @typedef {import("./setup-wizard-types").SetupWizardViewProps} SetupWizardViewProps */

/** @param {SetupWizardViewProps} props - State and actions for the wizard view. */

export const SetupWizardView = (props) => {
  if (props.activeStep === -1) {
    return (
      <WizardContainer>
        <WelcomeStep onNext={props.handleNext} />
      </WizardContainer>
    );
  }

  return (
    <WizardContainer>
      <Stepper activeStep={props.activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {props.error && (
        <WizardError message={props.error} onClose={props.setError} />
      )}
      <Fade in timeout={400} key={props.activeStep}>
        <Box>
          <WizardStep {...props} />
        </Box>
      </Fade>
    </WizardContainer>
  );
};

/** @param {SetupWizardViewProps} props - Wizard actions used by the welcome step. */
const WelcomeStep = ({ handleNext }) => (
  <Fade in timeout={600}>
    <Box sx={{ py: 6, textAlign: "center" }}>
      <SportsEsportsIcon sx={{ color: "primary.main", fontSize: 80, mb: 3 }} />
      <Typography
        variant="h3"
        sx={{
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          background: "linear-gradient(135deg, #4a90e2 0%, #8c5cc5 100%)",
          backgroundClip: "text",
          fontWeight: 800,
          mb: 1,
        }}
      >
        Wingosy
      </Typography>
      <Typography
        variant="h6"
        color="text.secondary"
        sx={{ fontWeight: 400, mb: 5 }}
      >
        Your Windows game launcher. Let&apos;s get you set up.
      </Typography>
      <Button
        variant="contained"
        size="large"
        endIcon={<ArrowForwardIcon />}
        onClick={handleNext}
        sx={{ borderRadius: 3, fontSize: "1.1rem", px: 5, py: 1.5 }}
      >
        Get Started
      </Button>
    </Box>
  </Fade>
);

/** @param {{message: string, onClose: (error: string|null) => void}} props - Error message and dismissal callback. */
const WizardError = ({ message, onClose }) => (
  <Alert severity="error" onClose={() => onClose(null)} sx={{ mb: 3 }}>
    {message}
  </Alert>
);

/** @param {SetupWizardViewProps} props - Wizard state and actions for the active step. */
const WizardStep = (props) => {
  switch (props.activeStep) {
    case 0:
      return <RommStep {...props} />;
    case 1:
      return <RomFolderStep {...props} />;
    case 2:
      return <ScanStep {...props} />;
    default:
      return null;
  }
};

/** @param {SetupWizardViewProps} props - RomM pairing state and actions. */
const RommStep = ({
  handleBack,
  handleConnectRomM,
  handleNext,
  onCancelPairing,
  rommConnected,
  rommPairing,
  rommStatus,
  rommUrl,
  setRommUrl,
}) => (
  <StepPanel
    icon={<CloudIcon sx={{ color: "primary.main", fontSize: 48 }} />}
    title="Connect to RomM Server"
    subtitle="RomM lets you sync your game library from a self-hosted server. This is optional — you can use local files only."
  >
    {rommConnected ? (
      <Alert severity="success" icon={<CheckCircleIcon />}>
        Connected to {rommUrl}
      </Alert>
    ) : (
      <>
        <TextField
          fullWidth
          label="Server URL"
          placeholder="romm.example.com or 192.168.1.2:3000"
          value={rommUrl}
          onChange={(event) => setRommUrl(event.target.value)}
          sx={{ mb: 2 }}
        />
        <Alert severity="success" sx={{ mb: 2 }}>
          Secure device pairing opens RomM in your browser. Wingosy never
          receives or stores your password.
        </Alert>
        {rommStatus && (
          <Alert severity={rommStatus.type} sx={{ mb: 2 }}>
            {rommStatus.message}
          </Alert>
        )}
        <Button
          variant="contained"
          onClick={handleConnectRomM}
          disabled={!rommUrl || Boolean(rommPairing)}
          sx={{ mr: 2 }}
        >
          {rommPairing ? "Waiting for approval..." : "Pair with RomM"}
        </Button>
        {rommPairing && <Button onClick={onCancelPairing}>Cancel</Button>}
      </>
    )}
    <StepNav
      onBack={handleBack}
      onNext={handleNext}
      onSkip={handleNext}
      showSkip={!rommConnected}
      showBack={false}
      nextLabel={rommConnected ? "Continue" : "Skip"}
    />
  </StepPanel>
);

/** @param {SetupWizardViewProps} props - ROM directory state and actions. */
const RomFolderStep = ({
  handleBack,
  handleNext,
  handleSelectFolder,
  romsDir,
  setRomsDir,
}) => (
  <StepPanel
    icon={<FolderIcon sx={{ color: "primary.main", fontSize: 48 }} />}
    title="Select ROM Folder"
    subtitle="Choose the folder where your game files (ROMs) are stored. Wingosy will scan subfolders automatically."
  >
    <Box sx={{ alignItems: "center", display: "flex", gap: 2, mb: 2 }}>
      <TextField
        fullWidth
        label="ROM Directory"
        value={romsDir}
        onChange={(event) => setRomsDir(event.target.value)}
        placeholder="C:\\Games\\ROMs"
        slotProps={{ input: { readOnly: true } }}
      />
      <Button
        variant="outlined"
        onClick={handleSelectFolder}
        sx={{ py: 1.8, whiteSpace: "nowrap" }}
      >
        Browse
      </Button>
    </Box>
    {romsDir && (
      <Alert severity="info" sx={{ mb: 2 }}>
        Selected: {romsDir}
      </Alert>
    )}
    <StepNav
      onBack={handleBack}
      onNext={handleNext}
      onSkip={handleNext}
      showSkip={!romsDir}
      nextLabel={romsDir ? "Continue" : "Skip"}
    />
  </StepPanel>
);

/** @param {SetupWizardViewProps} props - Scan and sync state and actions. */
const ScanStep = (props) => {
  const { rommConnected, romsDir, scanResult, scanning, syncResult, syncing } =
    props;
  const subtitle = romsDir
    ? `Ready to scan ${romsDir} for game files.`
    : rommConnected
      ? "Sync your RomM library to get started."
      : "No ROM folder selected. You can scan later from Settings.";

  return (
    <StepPanel
      icon={<SearchIcon sx={{ color: "primary.main", fontSize: 48 }} />}
      title="Scan for Games"
      subtitle={subtitle}
    >
      {!scanResult && !scanning && romsDir && (
        <Button
          variant="contained"
          size="large"
          startIcon={<SearchIcon />}
          onClick={props.handleScan}
          sx={{ mb: 2 }}
        >
          Scan Local ROMs
        </Button>
      )}
      {rommConnected && !syncResult && !syncing && (
        <Button
          variant="outlined"
          size="large"
          startIcon={<CloudSyncIcon />}
          onClick={props.handleSyncRomM}
          sx={{ mb: 2, ml: romsDir && !scanResult && !scanning ? 2 : 0 }}
        >
          Sync RomM Library
        </Button>
      )}
      {scanning && <ProgressMessage text="Scanning for games..." />}
      {syncing && <ProgressMessage text="Syncing RomM library..." />}
      {scanResult && <ScanSummary result={scanResult} />}
      {syncResult && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            Synced {syncResult.total} games from RomM!
          </Alert>
        </Box>
      )}
      <StepNav
        onBack={props.handleBack}
        onNext={props.handleFinish}
        showSkip={!scanResult && !syncResult && !romsDir && !rommConnected}
        onSkip={props.handleFinish}
        nextLabel={scanResult || syncResult || !romsDir ? "Finish" : "Skip"}
      />
    </StepPanel>
  );
};

/** @param {{text: string}} props - Progress message text. */
const ProgressMessage = ({ text }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {text}
    </Typography>
    <LinearProgress sx={{ borderRadius: 2 }} />
  </Box>
);

/** @param {{result: import("./setup-wizard-types").ScanResult}} props - Scan result to summarize. */
const ScanSummary = ({ result }) => (
  <Box sx={{ mb: 3 }}>
    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
      Found {result.total} games from local scan!
    </Alert>
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {Object.entries(result.platforms).map(([platform, count]) => (
        <Chip
          key={platform}
          label={`${platform.toUpperCase()}: ${count}`}
          variant="outlined"
          color="primary"
        />
      ))}
    </Box>
  </Box>
);

/** @param {{children: import("react").ReactNode}} props - Content inside the wizard card. */
const WizardContainer = ({ children }) => (
  <Box
    sx={{
      alignItems: "center",
      bgcolor: "background.default",
      display: "flex",
      justifyContent: "center",
      minHeight: "100vh",
      p: 3,
    }}
  >
    <Paper
      elevation={6}
      sx={{
        background: "linear-gradient(180deg, #1e1e26 0%, #232330 100%)",
        borderRadius: 4,
        maxWidth: 640,
        p: 5,
        width: "100%",
      }}
    >
      {children}
    </Paper>
  </Box>
);

/** @param {{icon: import("react").ReactNode, title: string, subtitle: string, children: import("react").ReactNode}} props - Step heading and content. */
const StepPanel = ({ icon, title, subtitle, children }) => (
  <Box>
    <Box sx={{ mb: 4, textAlign: "center" }}>
      {icon}
      <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 480, mt: 1, mx: "auto" }}
      >
        {subtitle}
      </Typography>
    </Box>
    {children}
  </Box>
);

/** @param {{onBack: () => void, onNext: () => void, onSkip?: () => void, showBack?: boolean, showSkip?: boolean, nextLabel?: string}} props - Navigation callbacks and visibility options. */
const StepNav = ({
  onBack,
  onNext,
  onSkip,
  showBack = true,
  showSkip = false,
  nextLabel = "Continue",
}) => (
  <Box
    sx={{
      borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      justifyContent: "space-between",
      mt: 4,
      pt: 3,
    }}
  >
    <Box>
      {showBack && (
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} color="inherit">
          Back
        </Button>
      )}
    </Box>
    <Box sx={{ display: "flex", gap: 1 }}>
      {showSkip && (
        <Button endIcon={<SkipNextIcon />} onClick={onSkip} color="inherit">
          Skip
        </Button>
      )}
      {!showSkip && (
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      )}
    </Box>
  </Box>
);
