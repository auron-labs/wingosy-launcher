import { appRuntime } from "./app/app-runtime";
import AppView from "./app/app-view";
import { useAppController } from "./app/use-app-controller";

/** @typedef {import("./app/app-runtime").AppRuntime} AppRuntime */

/** @param {{runtime?: AppRuntime}} [props] Application properties. */
const App = ({ runtime = appRuntime } = {}) => {
  const controller = useAppController({ runtime });
  return <AppView runtime={runtime} controller={controller} />;
};

export default App;
