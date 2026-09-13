import { useEffect } from "react";

import { checkRommConnection } from "./settings-romm-actions";

/** @param {{rommUrl: string, rommToken: string|null, runtime: import("./settings-runtime").SettingsRuntime, onRommDisconnect?: (() => void)|null, setRommConnectionStatus: (value: "checking"|"downloaded-not-synced"|"not-configured"|"offline"|"online"|"remote-only"|"synced") => void, setRommSessionSaved: (value: boolean) => void, setRommSyncMetadata: (value: object) => void, setRommDirectToken: (value: string) => void, setRommStatus: (value: object|null) => void}} context RomM connection dependencies. */
const useSettingsRommLifecycle = (context) => {
  const {
    onRommDisconnect,
    rommToken,
    rommUrl,
    runtime,
    setRommConnectionStatus,
    setRommDirectToken,
    setRommSessionSaved,
    setRommStatus,
    setRommSyncMetadata,
  } = context;

  useEffect(() => {
    const check = () => {
      void checkRommConnection({
        onRommDisconnect,
        rommToken,
        rommUrl,
        runtime,
        setRommConnectionStatus,
        setRommDirectToken,
        setRommSessionSaved,
        setRommStatus,
        setRommSyncMetadata,
      });
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      window.clearInterval(timer);
    };
  }, [
    onRommDisconnect,
    rommToken,
    rommUrl,
    runtime,
    setRommConnectionStatus,
    setRommDirectToken,
    setRommSessionSaved,
    setRommStatus,
    setRommSyncMetadata,
  ]);
};

export default useSettingsRommLifecycle;
