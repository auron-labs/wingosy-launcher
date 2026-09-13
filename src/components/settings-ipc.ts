import { invoke } from "@tauri-apps/api/core";
import type { InvokeArgs } from "@tauri-apps/api/core";

import type { SettingsConfig } from "./settings-types";

const command = async <T>(name: string, args?: InvokeArgs) =>
  await invoke<T>(name, args);

export const getSettingsConfig = async () =>
  await command<SettingsConfig>("get_config");

export const saveSettingsConfig = async (config: SettingsConfig) =>
  await command<unknown>("save_config", { config });
