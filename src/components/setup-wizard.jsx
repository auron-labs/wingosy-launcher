import { SetupWizardView } from "./setup-wizard-view";
import { useSetupWizard } from "./use-setup-wizard";

/** @param {import("./use-setup-wizard").SetupWizardOptions} props - Setup completion and RomM callbacks. */
const SetupWizard = (props) => <SetupWizardView {...useSetupWizard(props)} />;

export default SetupWizard;
