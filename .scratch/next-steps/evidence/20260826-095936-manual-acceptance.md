# Wingosy manual acceptance — 20260826-095936

- **Windows:** 
- **Wingosy:** dev
- **Commit:** af3ce2af10f37bb76b20ca54c66e3f590de77f56
- **Tester:** Aaron
- **Safety:** No credentials, tokens, user data, ROM names, or personal paths belong in this report.

## Ticket 02 — Pair → Sync → Finish → restart → BIOS

- **Result:** PASS
- **Notes:** 

- first startup had a flash of white with no content
- sign in worked perfectly
- clicking sync library on the front page just re-directs you to the romm settings page
- all games synced successfully
- console continuously says "fetching 25 platforms from romm"
- i downloaded missing bios, and it only downloaded half, had to click again to finish
- all bios files seemed to have correctly installed to my pc
- retroarch downloaded and then just sat there for a minute, it then started downloading again in a loop. we need better ui/ux so the user knows what's happening.
- we really need more debug logging throughout the entire app, i want to know everything that's happening when in debug mode. do we need a better logger? better hooks?
- mame download worked fine, retroarch kept running in a loop until it finalled succeeded after maybe the 10th try where it said retroarch was installed externally
- after running library sync, the "syncing library" alert stayed on the settings page
- see logs

## Ticket 02 — Local-only setup creates a valid default configuration

- **Result:** FAIL
- **Evidence:** see ./ticket-02-local-only-evidence

## Ticket 03 — Pair, refresh, BIOS, sync, token storage, and disconnect

- **Result:** PASS
- **Notes:** None recorded
- **Evidence:** None recorded

## Ticket 04 — Desktop first render, next/previous/last page, and filter reset

- **Result:** FAIL
- **Notes:** None recorded

- filtering and search work in desktop mode, albeit the animations need some work. filtering just instantly changes with no debounce or transitions.
- search worked, changing platform worked
- immersive mode worked, navigation worked, selection worked. no way to select which platform, no way to search.

## Ticket 04 — Immersive incremental loading and stable focus

- **Result:** PASS
- **Notes:**
- Navigation worked, browsing worked, next page worked
- next page transition is rough, it just appears with no loading indicator or motion effects
- images may be slow to load in, may need to cache by a deterministic key

## Ticket 07 — Logs folder, report route, safe report, owner, response expectation, and cohort gate

- **Result:** SKIP
- **Notes:** report a problem button does not need testing since its a link. theres no beta release notes, so we dont need that either. i dont know what you mean by draft a sample?
- **Evidence:** None recorded

## Ticket 09 — Primary XInput navigation, bounded deadzone, keyboard fallback, and reconnect

- **Result:** FAIL
- **Notes:** 
- navigation worked, controller connect/disconnect works, keyboard works
- hitting B just exits immersive mode, and it's not so easy to get back into it
- once on a game page, you can't do anything with the controller in immersive mode
- i didn't test going into a game with a controller

## Ticket 09 — Second standard pad, active-pad handoff, and unsupported-pad boundary

- **Result:** SKIP
- **Notes:** i dont have a second controller for testing
- **Evidence:** None recorded
