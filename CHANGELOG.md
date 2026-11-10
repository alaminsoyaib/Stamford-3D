# Changelog

Record completed changes here, with verification when it helps a future handoff. Keep launch instructions in the [README](README.md) and architectural details in [Project Context](PROJECT_CONTEXT.md).

## Unreleased

### Added

- Added `package.json` and `vite.config.js` configuring multi-page bundling (`index.html` and `underwater.html`) and local development via `npm run dev` (`127.0.0.1:8090`).
- Added live in-browser Layout Editor Mode toggled with `[E]`, supporting raycast landmark picking, `THREE.BoxHelper` visual selection highlights, arrow key translation (1m step, 5m with Shift), rotation (`Q`/`T` by 15°), real-time collider bounds synchronization, and one-click JSON clipboard export & map download.
- Preserved hierarchical static mesh batching across modular landmarks so buildings remain translated/rotated and picked as cohesive units.
- Registered the Varsity Bus in `CAMPUS_MAP.json` (`map.buildings.bus`) and synchronized walkthrough landmarks across Zone A, Zone B, and Zone C with the university's real photo sequence.

### Verification

- Ran `npm i` and verified successful installation of `three` and `vite`.
- Built the production bundle with `npm run build` bundling both `index.html` and `underwater.html`.
- Executed Playwright browser tests over `http://127.0.0.1:8090`:
  - Verified zero WebGL and console errors.
  - Verified entering exploration, pressing `[E]` to toggle Layout Editor mode, raycast-selecting the CSE building, translating with `ArrowLeft`, rotating with `KeyT`, copying coordinates JSON, and closing with `[E]`.
  - Verified `underwater.html` scene loads with zero console or WebGL errors.
