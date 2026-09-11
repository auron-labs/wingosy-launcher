export const isText = (value: string | null | undefined): value is string =>
  typeof value === "string";

export const hasTauriIpc = (
  runtime: Pick<Window, "__TAURI_INTERNALS__">
): runtime is { __TAURI_INTERNALS__: object } =>
  typeof runtime.__TAURI_INTERNALS__ === "object" &&
  runtime.__TAURI_INTERNALS__ !== null;
