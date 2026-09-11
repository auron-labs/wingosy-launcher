export interface WizardStatus {
  message: string;
  type: "error" | "info" | "success";
}

export interface DevicePairing {
  device_code: string;
  expires_in?: number;
  interval?: number;
  user_code: string;
  verification_path: string;
  verification_path_complete?: string;
}

export interface ScanResult {
  platforms: Record<string, number>;
  total: number;
}

export interface SyncResult {
  total: number;
}

export interface SetupWizardOptions {
  onComplete: () => void;
  onRommConnect?: (url: string, token: string) => void;
}

export interface SetupWizardViewProps {
  activeStep: number;
  error: string | null;
  handleBack: () => void;
  handleConnectRomM: () => void;
  handleFinish: () => void;
  handleNext: () => void;
  handleScan: () => void;
  handleSelectFolder: () => void;
  handleSyncRomM: () => void;
  onCancelPairing: () => void;
  rommConnected: boolean;
  rommPairing: DevicePairing | null;
  rommStatus: WizardStatus | null;
  rommUrl: string;
  romsDir: string;
  scanResult: ScanResult | null;
  scanning: boolean;
  setError: (error: string | null) => void;
  setRommUrl: (url: string) => void;
  setRomsDir: (directory: string) => void;
  syncResult: SyncResult | null;
  syncing: boolean;
}
