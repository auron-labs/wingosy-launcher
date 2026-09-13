import { useRef, useState } from "react";

/** @typedef {import("./game-details-types").GameDetailsCollection} GameDetailsCollection */
/** @typedef {import("./game-details-types").GameDetailsStatus} GameDetailsStatus */

/** @returns {string|null} Initial launch error. */
const initialLaunchError = () => null;
/** @returns {HTMLElement|null} Initial menu anchor. */
const initialMenuAnchor = () => null;
/** @returns {GameDetailsStatus|null} Initial action status. */
const initialActionStatus = () => null;
/** @returns {GameDetailsStatus|null} Initial download status. */
const initialDownloadStatus = () => null;

/** @type {GameDetailsCollection[]} */
const INITIAL_COLLECTIONS = [];

export const useGameDetailsActionState = () => {
  const [downloading, setDownloading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(initialLaunchError);
  const [downloadStatus, setDownloadStatus] = useState(initialDownloadStatus);
  const [justDownloaded, setJustDownloaded] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(initialMenuAnchor);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionStatus, setActionStatus] = useState(initialActionStatus);
  const [switchContentSyncing, setSwitchContentSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState(INITIAL_COLLECTIONS);
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false);
  const downloadInFlightRef = useRef(false);
  const launchInFlightRef = useRef(false);
  const switchContentInFlightRef = useRef(false);

  return {
    actionStatus,
    collectionDialogOpen,
    collections,
    deleteDialogOpen,
    downloadInFlightRef,
    downloadStatus,
    downloading,
    justDownloaded,
    launchError,
    launchInFlightRef,
    launching,
    menuAnchor,
    refreshing,
    setActionStatus,
    setCollectionDialogOpen,
    setCollections,
    setDeleteDialogOpen,
    setDownloadStatus,
    setDownloading,
    setJustDownloaded,
    setLaunchError,
    setLaunching,
    setMenuAnchor,
    setRefreshing,
    setSwitchContentSyncing,
    switchContentInFlightRef,
    switchContentSyncing,
  };
};
