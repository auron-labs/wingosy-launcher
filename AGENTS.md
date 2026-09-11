## Agent skills

### Issue tracker

Issues are tracked as local Markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses a single-context layout. See `docs/agents/domain.md`.

## Human Smoke-testing Planning

Instructions for human smoke-testing needs to be the bare-minimum to pass the ticket. Do not add on unneccessary constraints or steps just for the sake of it.

## Tauri UI testing

Use Tauri MCP as the primary automation path for Wingosy smoke tests. Connect its driver session to the running development app, and use the webview DOM, interaction, keyboard, screenshot, IPC, and window tools to exercise observable behaviour. Use native Computer Use only when a check cannot be covered through Tauri MCP.

Any new app route or view must also be added to `scripts/capture-screenshots.mjs` so screenshot coverage stays complete without duplicate captures.
