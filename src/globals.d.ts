/// <reference lib="es2023.array" />

declare module "*.css";

interface Window {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: object;
}

declare let isTauri: boolean | undefined;

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_WINGOSY_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
