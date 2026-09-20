import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  cleanupSettingsTest,
  invoke,
  renderSettings,
} from "./settings-test-fixtures";

const getLastSaveConfigCall = () => {
  for (let index = invoke.mock.calls.length - 1; index >= 0; index -= 1) {
    const call = invoke.mock.calls[index];
    if (call?.[0] === "save_config") {
      return call;
    }
  }
  return null;
};

describe("Settings RomM connection", () => {
  afterEach(cleanupSettingsTest);

  it("makes a connected RomM server URL read-only", async () => {
    renderSettings({
      config: { romm: { server_url: "https://romm.example" } },
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
    });

    const serverUrl = await screen.findByRole("textbox", {
      name: "Server URL",
    });
    await waitFor(() => {
      expect(serverUrl).toBeDisabled();
    });
    expect(screen.getByTestId("settings-sync-status")).toHaveTextContent(
      "Connected"
    );
    expect(
      screen.getByText("Connected. Disconnect before changing the server URL.")
    ).toBeInTheDocument();
  });
});

describe("Settings RomM status", () => {
  afterEach(cleanupSettingsTest);

  it("uses one RomM connection status instead of separate indicators", async () => {
    renderSettings({
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
    });

    await screen.findByTestId("romm-settings-card");
    await waitFor(() => {
      expect(screen.getByTestId("settings-sync-status")).toHaveTextContent(
        "Connected"
      );
    });
    expect(screen.queryByTestId("romm-sync-status")).not.toBeInTheDocument();
    const rommCard = screen.getByTestId("romm-settings-card");
    expect(
      within(rommCard).queryByText("Session saved")
    ).not.toBeInTheDocument();
    expect(
      within(rommCard).queryByRole("button", { name: "Connected" })
    ).not.toBeInTheDocument();
  });
});

describe("Settings RomM disconnect", () => {
  afterEach(cleanupSettingsTest);

  it("confirms the destructive RomM disconnect action", async () => {
    renderSettings({
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
    });

    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/removes the saved RomM session/u)
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("disconnect_romm");
    });
  });
});

describe("Settings RomM authentication", () => {
  afterEach(cleanupSettingsTest);

  it("explains each RomM authentication method and reveals the token field", async () => {
    renderSettings({ initialSection: "romm" });

    expect(
      screen.getAllByRole("button", { name: /Device pairing|Access token/u })
    ).toHaveLength(2);
    expect(
      screen.getByText(/Secure device pairing opens RomM in your browser/u)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Access token")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Access token" }));

    await expect(
      screen.findByText(/Use a RomM access token/u)
    ).resolves.toBeInTheDocument();
    expect(screen.getByLabelText("Access token")).toBeInTheDocument();
  });
});

describe("Settings RomM sync", () => {
  afterEach(cleanupSettingsTest);

  it("surfaces RomM sync metadata without inventing a schedule", async () => {
    renderSettings({
      config: {
        romm: {
          auto_sync: true,
          server_url: "https://romm.example",
        },
      },
      initialSection: "romm",
      rommConnectionStatus: "online",
      savedRommSession: true,
      syncGames: [
        { id: 1, name: "First Game" },
        { id: 2, name: "Second Game" },
      ],
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Sync Library" })
    );
    await expect(
      screen.findByText("Synced 2 games from RomM!")
    ).resolves.toBeInTheDocument();
    const metadata = await screen.findByTestId("romm-sync-metadata");
    expect(metadata).toHaveTextContent(
      /Last synced[\s\S]*2 games[\s\S]*Next scheduled sync/u
    );
    expect(screen.getByTestId("romm-last-synced-value")).not.toHaveTextContent(
      "Not reported"
    );
    expect(screen.getByTestId("romm-next-sync-value")).toHaveTextContent(
      "Automatic"
    );
  });
});

describe("Settings integrations", () => {
  afterEach(cleanupSettingsTest);

  it("loads the persisted RetroAchievements preference", async () => {
    renderSettings({
      config: { display: { retroachievements_enabled: true } },
      initialSection: "integrations",
    });

    const toggle = await screen.findByRole("switch", {
      name: "Enable RetroAchievements",
    });
    expect(toggle).toBeChecked();
    expect(screen.queryByText("Preview")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/tracking and achievement data are not shipped yet/u)
    ).not.toBeInTheDocument();
  });

  it("persists a changed preference and updates the local config", async () => {
    renderSettings({
      config: {
        display: {
          big_picture: true,
          retroachievements_enabled: false,
        },
      },
      initialSection: "integrations",
    });

    const toggle = await screen.findByRole("switch", {
      name: "Enable RetroAchievements",
    });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(getLastSaveConfigCall()?.[1]).toMatchObject({
        config: {
          display: {
            big_picture: true,
            retroachievements_enabled: true,
          },
        },
      });
      expect(toggle).toBeChecked();
    });
  });
});
