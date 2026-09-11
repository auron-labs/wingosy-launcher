import { appRuntime } from "./app/app-runtime";
import AppView from "./app/app-view";
import { useAppController } from "./app/use-app-controller";

/** @typedef {{getCurrentWindow: () => {isFullscreen: () => Promise<boolean>, onResized: (handler: () => void) => Promise<() => void>, startDragging: () => Promise<void>}, invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>, listen: (event: string, handler: (event: {payload?: unknown}) => void) => Promise<() => void>, openUrl: (url: string) => Promise<unknown>}} AppRuntime */

/** @param {{runtime?: AppRuntime}} [props] */
const App = ({ runtime = appRuntime } = {}) => {
  const controller = useAppController({ runtime });
  return <AppView runtime={runtime} controller={controller} />;
};

export default App;
