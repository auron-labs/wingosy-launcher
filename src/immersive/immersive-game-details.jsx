import ImmersiveGameDetailsView from "./immersive-game-details-view";
import { useImmersiveGameDetailsController } from "./use-immersive-game-details-controller";

/** @typedef {import("./immersive-types").ImmersiveGame} ImmersiveGame */
/** @typedef {import("./immersive-types").LaunchResult} LaunchResult */

const noop = () => null;

/** @param {Parameters<typeof useImmersiveGameDetailsController>[0]} props Immersive details properties. */
const ImmersiveGameDetails = (props) => {
  const {
    onOpenIntegrations = null,
    onOpenSettings = noop,
    retroachievementsEnabled = false,
  } = props;
  const controller = useImmersiveGameDetailsController(props);
  return (
    <ImmersiveGameDetailsView
      controller={controller}
      game={props.game}
      onBack={props.onBack}
      onOpenIntegrations={onOpenIntegrations}
      onOpenSettings={onOpenSettings}
      onToggleFavorite={props.onToggleFavorite}
      platformLabel={props.platformLabel}
      retroachievementsEnabled={retroachievementsEnabled}
    />
  );
};

export default ImmersiveGameDetails;
