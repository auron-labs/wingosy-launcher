/**
 * E2E: Immersive mode shell (ImmersiveModeApp / ImmersiveLibrary).
 */

import { ensureMainApp, goToSettings, ensureDesktopMode } from "./helpers.js";

async function waitForDesktopLibraryNav() {
  await browser.waitUntil(
    async () => {
      const lib = await $('[data-testid="immersive-library"]');
      const stillImmersive = await lib.isDisplayed().catch(() => false);
      if (stillImmersive) return false;
      const allGames = await $('*=All Games');
      return await allGames.isDisplayed().catch(() => false);
    },
    {
      timeout: 20000,
      interval: 400,
      timeoutMsg: "Expected to return to desktop with All Games in sidebar",
    }
  );
}

describe("Immersive mode", () => {
  beforeEach(async () => {
    await ensureMainApp();
    await ensureDesktopMode();
  });

  it("enters Immersive mode from Settings and exits to desktop", async () => {
    await goToSettings();

    const row = await $('[data-testid="immersive-mode-row"]');
    await expect(row).toBeDisplayed({ timeout: 10000 });
    await row.scrollIntoView();
    const toggle = await row.$('input[type="checkbox"]');
    await expect(toggle).toExist();

    if (await toggle.isSelected()) {
      await toggle.click();
      await browser.pause(2000);
    }
    await toggle.click();

    await browser.pause(2500);

    const library = await $('[data-testid="immersive-library"]');
    await expect(library).toBeDisplayed({ timeout: 15000 });

    const caption = await $('*=Immersive mode');
    await expect(caption).toBeDisplayed();

    const exitBtn = await $('[data-testid="immersive-exit-to-desktop"]');
    await expect(exitBtn).toBeDisplayed();
    await exitBtn.click();
    await waitForDesktopLibraryNav().catch(async () => {
      await ensureDesktopMode();
      await waitForDesktopLibraryNav();
    });

    const allGames = await $('*=All Games');
    await expect(allGames).toBeDisplayed({ timeout: 15000 });
  });
});