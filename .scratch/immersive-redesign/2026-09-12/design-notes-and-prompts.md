# Wingosy immersive mode concepts

Created 2026-09-12 using the built-in image_gen tool through the imagegen skill.

These are visual design mockups. The application has not been modified.

## Final screens

- [Library](immersive-library-concept.png)
- [Game details](immersive-details-concept.png)

## Design direction

Use a console selector down the left edge, an expansive selected-game backdrop, large titles, and a single cover strip. Keep the same shell when opening details so the user stays oriented. The cover strip gives way to Play, a short description, and a compact media gallery.

Wingosy's existing indigo accent becomes a consistent selection marker. Angular corner brackets and a thin focus outline identify the current control. Warm white type and opaque dark scrims keep content readable over artwork.

EmulationStation provides the platform-focused, controller-driven inspiration. The platform spine, editorial title treatment, and matching corner focus marks form this concept's particular visual identity. [ES-DE's official overview](https://es-de.org/) describes its controller support and theme flexibility; no particular theme was copied.

## Intended interaction

- In the library, left/right moves across covers; LB/RB changes platform. Open goes to details and Back returns to the same cover.
- On details, Play receives initial focus. Favorite and More are secondary actions; game management, including Delete, lives in More.
- Search, downloads, settings, and exit remain reachable through the header search and menu.
- Controller hints follow the active input device. Keyboard use should substitute keyboard labels rather than showing every input mapping simultaneously.
- Artwork can crossfade on selection. Respect reduced motion and retain a stable focus position.

## Content and fallback notes

- ActRaiser and the neighboring games come from the supplied library screenshot.
- The expanded storm backdrop and gameplay thumbnails were generated for this visual concept. The thumbnails are illustrative, not captured game screenshots.
- The library count and short promotional line are sample display content.
- In an implementation, use actual library metadata and available media. If no backdrop exists, derive a muted background from the cover. If no screenshots exist, omit the gallery instead of displaying a wall of empty placeholders.
- Keep the achievement setup state compact; do not show invented progress.
- Both generated outputs are 1672 × 941 pixels, approximately 16:9.
- Visually checked the generated pair for layout, legibility, focus, matching navigation, and clear Play hierarchy.

## Source screenshots

- `.scratch/screenshots/2026-09-11T21-23-49/immersive-library.png`
- `.scratch/screenshots/2026-09-11T21-23-49/immersive-details.png`

## Exact generation prompts

### Library generation

```text
Use case: ui-mockup
Asset type: high-fidelity fullscreen desktop / television game-launcher LIBRARY screen, a single flat 16:9 screenshot, ideally 2560x1440.
Primary request: Design a new modern immersive mode for Wingosy, inspired by EmulationStation's console-oriented browsing, platform identity, artwork, and controller navigation, with a distinctive Wingosy identity. This is a realistic implementable product interface. Redesign the supplied screenshots completely while retaining their actual game collection and indigo brand continuity.
Input images: Image 1 is the existing Wingosy library, a reference for game covers, available platforms, brand spelling and functionality only. Image 2 is existing game details, a reference for ActRaiser content only. Neither is an edit target; create a new composition.
Design direction: a quiet cinematic game collection with a distinctive narrow platform spine on the left, oversized editorial typography, selected-game artwork across the upper main stage, and one horizontal cover strip across its bottom. Midnight ink surfaces, warm off-white type, restrained luminous periwinkle/indigo focus accents derived from the references. Very subtle grain. No heavy neon. Generous space, sophisticated typography, strong focus hierarchy. Readable at television distance.
Layout: top slim navigation inside generous safe margins: Wingosy wordmark left, Library (active, simple thin indigo underline), Favorites, Recent across the top. Search icon and Menu label right. Left platform spine occupies about 19 percent of the screen under the wordmark; small label PLATFORMS, then All platforms, an enlarged selected SNES entry with tasteful simple SNES controller line art and full small subtitle Super Nintendo, then Nintendo Switch as an unselected entry. A slender periwinkle focus marker joins the selected SNES entry to the main canvas. The spine should feel like a dedicated console selector, not a desktop admin sidebar; no boxed button stacks.
Main selected-game stage: upper main area, show ActRaiser with large beautifully set white title ACTRAISER; above it small metadata SNES / 1990; below it Action / Simulation and a short line exactly: "Reclaim the world. Shape its future." Include a quiet Installed check near the metadata. To the right and across the backdrop use rich painterly box-art-inspired imagery from ActRaiser's purple storm clouds, lightning, dark mountains and distant golden celestial light. The art is cropped expansively and fades into opaque ink behind readable text. This is an illustrative backdrop concept, not a gameplay screenshot.
Lower main area: small label ALL GAMES and "01 / 12". A single aligned horizontal shelf of six portrait cover cards, use recognizable cover imagery from reference in this order: ActRaiser, ActRaiser 2, Aero Fighters, Aerobiz, Aerobiz Supersonic, Alien 3. Preserve artwork aspect ratio with tasteful cropping. ActRaiser is clearly selected via slightly larger scale, crisp thin periwinkle outline and two small angular focus brackets; other cards are slightly subdued. Titles below covers in readable white type, not overprinted on artwork. Shelf and metadata have breathing room. No second row or scrolling grid.
Bottom: unobtrusive integrated controller legend with small neutral gamepad glyphs: D-pad Navigate, A Open, Y Favorite, LB / RB Platform, Menu Options. One input family only, no keyboard/controller slash soup. Keep footer readable and sparse.
Constraints: one edge-to-edge fullscreen UI only; no device frame, room mockup, presentation board, annotations, watermark or extra screens. No cursor. No browser chrome. No marketing-site sections. No invented player stats, achievements or ratings. No giant rounded content container, no glass-card dashboard. All UI remains within safe margins. EmulationStation is inspiration, do not print its name or copy a specific existing theme. Wingosy must be spelled W i n g o s y. Make the interface feel calm, tactile, game-first, and distinctive.
```

### Library cleanup

```text
Use case: ui-mockup
Input image 1 is the edit target: the newly designed Wingosy library.
Make ONLY these two cleanup changes, preserving all other interface layout, typography, cover artwork, focus treatments and controls exactly:
1. Remove the giant ornate golden ActRaiser logo and gold medallion from the upper right background. Reconstruct that area as beautiful uninterrupted violet storm clouds and lightning, consistent with the surrounding ActRaiser-inspired scene. Keep the large white ACTRAISER title at left exactly as it is. There should be one hero title.
2. Remove the decorative slogan GAMES BRING WORLDS TOGETHER and the repeated Wingosy logo at the bottom right. Fill with the same dark footer surface. Keep the controller legend at bottom left exactly.
The result must still be one polished fullscreen 16:9 app UI screenshot with no new text, no other changes.
```

### Details generation

```text
Use case: ui-mockup
Asset type: a high-fidelity fullscreen 16:9 game DETAILS UI screenshot for the same Wingosy app as Image 1.
Primary request: Create the matching ActRaiser details screen for the newly redesigned immersive library. This must visibly be the next screen in exactly the same design system, with the same midnight palette, Wingosy wordmark, type, margins, left console spine, periwinkle accent and controller footer. Modern EmulationStation-like console experience, with a distinct calm editorial Wingosy identity.
Input images: Image 1 is the NEW Wingosy library visual style and layout reference. Image 2 is the OLD Wingosy game-details screenshot and is a factual content reference only; completely redesign its layout. Image 3 is the old library, a reference for the actual ActRaiser box art.
Composition: one edge-to-edge 16:9 app screen with the same header and the same 19-percent-wide left platform selector spine as Image 1. Keep Wingosy top left and the menu/search utilities top right. The top main navigation still has Library active, Favorites and Recent. Below the top navigation, introduce a discreet left-arrow Back to library line, then the same metadata SNES / 1990 and Installed check. Show a large white ACTRAISER title, using the same dramatic editorial type as Image 1. Under the title show Action / Simulation. To the right, allow expansive storm-cloud, lightning, mountains and stone monument artwork to breathe; maintain the same scene and palette as Image 1, elegantly cropped with a stronger dark left text scrim. No extra golden title/logo on the artwork.
Replace the cover browsing shelf with a purposeful game-details composition:
- Directly under the title/genre at main-left: large prominent periwinkle Play button with a white play triangle, thin bright focus border and the same angular corner focus brackets seen on the selected library cover. Next to it a quiet heart Favorite control, then a subtle ellipsis More control. Play is the ONE focused control and the clearest action on the screen.
- Lower main-left area: small label ABOUT THE GAME, then readable short body text exactly: "A blend of side-scrolling action and city-building simulation. Battle through dangerous lands, then guide the people who call them home." A restrained single-line trophy status below says "RetroAchievements is off" with a quiet "Set up" link. No big alert box, no trophy stats.
- Lower main-right area: small label MEDIA above three evenly spaced landscape 4:3 thumbnails, showing illustrative SNES-era 16-bit scenes for the concept (a forest side-scrolling sword battle, a top-down village, an ancient temple side-scrolling scene). These are mock representative media, not empty/loading rectangles. Keep them compact so the background still feels expansive. Include a quiet "View all" action next to MEDIA. Frame images simply, no zoom button over each, no oversized cards.
- Keep the footer anchored and sparse with the same linework and neutral gamepad style as Image 1; labels: D-pad Navigate, A Select, B Back, Y Favorite, Menu Options. No keyboard chord list. No slogan or repeated brand at the bottom.
Platform spine should retain All platforms, selected SNES / Super Nintendo and Nintendo Switch from Image 1 exactly.
Constraints: screenshot only, flat front-on, no device framing, room, presentation board, annotations, marketing copy, ratings, invented progress stats or watermark. No separate floating massive rounded panel. Do not add a Delete button beside Play; game-management actions belong in More. Sharp readable UI, comfortably spaced, television-readable text, safe margins and coherent visible focus. Preserve the library reference's design fidelity.
```

