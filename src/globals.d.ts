declare module "*.css";

interface Window {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: object;
}

declare var isTauri: boolean | undefined;
