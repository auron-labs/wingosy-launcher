# UI/UX Audit

Reviewed all 18 screenshots in `.scratch/screenshots-2026-08-25/`. All captures are 2560 x 1392 desktop views, so this audit cannot assess small-window behavior, responsiveness, keyboard/controller focus, hover tooltips, or screen-reader semantics.

## Priority Issues

### High

1. **A diagnostic overlay is visible throughout the product.** Every screenshot shows `FPS N/A | GPU ... | CPU ... | LAT N/A` across the top-right, competing with page controls and exposing meaningless `N/A` values. It makes the launcher look like a debug build and is especially distracting on sparse screens. Hide it by default outside an explicitly enabled diagnostics mode.
   - Evidence: all screenshots, especially `wingosy-launcher_qy63LOqPNY.png` and `wingosy-launcher_VFJa4rFNVO.png`.

2. **BIOS status signals contradict one another.** The BIOS page reports `147/147 downloaded`, while Nintendo Switch reports `2 of 3 downloaded` and still receives a green `Ready` badge. Users cannot tell whether setup is complete or whether a required file is missing. Define one readiness rule, distinguish required from optional files, and make the aggregate count agree with each platform state.
   - Evidence: `wingosy-launcher_Q12182yRYY.png`, `wingosy-launcher_ZdKRMsCYLC.png`.

3. **Emulator health uses misleading success styling.** RetroArch is marked `Unverified` but appears inside the same green, checked card treatment as verified installations. Green checks imply that an emulator is ready to launch even when validation has not succeeded. Use distinct `Installed`, `Verified`, `Needs attention`, and failure states rather than one success treatment.
   - Evidence: `wingosy-launcher_hok9NTNBha.png`, `wingosy-launcher_Lyf8FOKGUn.png`, `wingosy-launcher_YUkmixNaFj.png`.

4. **The widescreen layout wastes most of the available canvas while cramping complex forms.** Settings content is constrained to a narrow centered region with very large unused areas. The Emulators page then squeezes long names and controls into two narrow columns, truncating a selected value such as `RetroArch (pcsx rear...)`. Let settings use more of the window, set readable column minimums, and stack columns before values become ambiguous.
   - Evidence: all Settings screenshots; truncation is clearest in `wingosy-launcher_hok9NTNBha.png` and `wingosy-launcher_YUkmixNaFj.png`.

### Medium

5. **Library tiles omit game titles.** The grid relies almost entirely on cover recognition. Cover art can be unfamiliar, stylized, localized, or illegible, leaving no dependable way to identify a game without opening or hovering it. Show a persistent title or provide a compact/list view that does.
   - Evidence: `wingosy-launcher_sJQC1Ds0tU.jpg`, `wingosy-launcher_Zxm0YsUzhg.jpg`.

6. **Missing artwork looks like an empty or broken tile.** At least one library item renders as a nearly black card with only a tiny platform badge. There is no visible title, placeholder illustration, or recovery cue. Use a deliberate fallback containing the game title and platform.
   - Evidence: bottom-right visible tile in `wingosy-launcher_sJQC1Ds0tU.jpg`.

7. **The Downloads empty state explains the dead end but does not help users leave it.** It says to start a download from a game details page or cloud library tile, yet offers no action to browse cloud games or return to the library. Add a direct primary action such as `Browse cloud games`; reduce the otherwise excessive empty space.
   - Evidence: `wingosy-launcher_qy63LOqPNY.png`, partially obscured duplicate `wingosy-launcher_qSr4V4MBbx.png`.

8. **Settings expose implementation detail instead of user decisions.** Examples include GitHub release mechanics, tag-name rules, `latest.json`, “real round trip,” emulator certification language, raw filesystem paths, and platform/core terminology. This increases cognitive load and makes important actions harder to scan. Lead with the user consequence, move implementation detail into expandable help, and use plain-language status summaries.
   - Evidence: `wingosy-launcher_KE3B6NYQUR.png`, `wingosy-launcher_SN6rjxOwZY.png`, `wingosy-launcher_URs2dNyPOI.png`.

9. **The game detail hierarchy includes empty and contradictory-looking sections.** `Screenshots` reserves a blank region with no empty-state explanation. Achievements shows six locked placeholder cards and an active-looking `View all` action while reporting `0/0` and saying RetroAchievements is disabled. Hide unavailable sections, or replace them with one clear setup action and explanation.
   - Evidence: `wingosy-launcher_XC1NnhLzCX.png`, `wingosy-launcher_39gcx3t4XE.png`.

10. **Global navigation remains prominent when it is not relevant to the current task.** Settings combines the full library/platform sidebar, a `Back` control, and a second settings sidebar. The persistent platform list consumes attention and width without helping users change settings. Collapse or suppress the platform section in Settings, or make Settings a clearly separate shell.
    - Evidence: every Settings screenshot.

11. **Several important controls are too cryptic without text.** The floating green cloud indicator in Settings has no visible label; game actions use heart and kebab icons; emulator cards present small play, folder, overflow, and chevron controls in a dense row. Their purpose and state are not self-evident, and the small targets are risky for touch or controller use. Add persistent labels for status and high-value actions, and enlarge interaction targets.
    - Evidence: `wingosy-launcher_39gcx3t4XE.png`, `wingosy-launcher_7UpYdqhsr4.png`, `wingosy-launcher_hok9NTNBha.png`, `wingosy-launcher_Lyf8FOKGUn.png`.

12. **Secondary text and disabled states are difficult to read.** Muted paths, helper text, inactive controls, and `Reset to Default` sit close to the dark card backgrounds. The low contrast is most visible in dense settings panels and makes disabled controls hard to distinguish from unavailable or broken ones. Increase contrast and use more than opacity alone to communicate state.
    - Evidence: `wingosy-launcher_7W3nhkUH0k.png`, `wingosy-launcher_VFJa4rFNVO.png`, `wingosy-launcher_URs2dNyPOI.png`.

### Low

13. **Platform defaults are repetitive and weakly summarized.** A long list of identically labeled `Emulator` fields makes it difficult to spot configured, automatic, and missing defaults. Add a concise readiness summary and visually flag only platforms needing a decision.
    - Evidence: `wingosy-launcher_hok9NTNBha.png`, `wingosy-launcher_YUkmixNaFj.png`.

14. **The sidebar platform list is dense and visually noisy.** Counts, mixed icon styles, wrapped names, a narrow scrollbar, and more than a screen of platforms compete with primary navigation. Consider search/filtering or a collapsed platform section, and align counts independently from wrapped labels.
    - Evidence: all screenshots.

15. **The General page buries support actions in a large beta disclaimer.** `Open Logs Folder`, `Report a Problem`, and the certification ledger are valuable, but the surrounding paragraph is difficult to scan. Break the beta status into short labeled facts and make `Report a Problem` the clear primary action.
    - Evidence: `wingosy-launcher_SN6rjxOwZY.png`.

## Screenshot Quality Note

`wingosy-launcher_qSr4V4MBbx.png` is substantially obscured by another application's video window. This is a capture artifact rather than a launcher defect, but that screenshot should be retaken before it is used for regression review or documentation.

## Suggested Fix Order

1. Remove or gate the diagnostic overlay.
2. Make BIOS and emulator readiness states truthful and consistent.
3. Improve Settings width, hierarchy, and navigation focus.
4. Add persistent game identification and missing-art fallbacks.
5. Replace dead-end and unavailable sections with clear actions.
6. Audit contrast, control labels, and target sizes in the running app.
