# Changelog

Record completed changes here, with verification when it helps a future handoff. Keep launch instructions in the [README](README.md) and architectural details in [Project Context](PROJECT_CONTEXT.md).

## Unreleased

### Added

- Added `package.json` and `vite.config.js` configuring multi-page bundling (`index.html` and `underwater.html`) and local development via `npm run dev` (`127.0.0.1:8090`).
- Added live in-browser Layout Editor Mode toggled with `[E]`, supporting raycast landmark picking, `THREE.BoxHelper` visual selection highlights, arrow key translation (1m step, 5m with Shift), rotation (`Q`/`T` by 15°), real-time collider bounds synchronization, and one-click JSON clipboard export & map download.
- Preserved hierarchical static mesh batching across modular landmarks so buildings remain translated/rotated and picked as cohesive units.
- Registered the Varsity Bus in `CAMPUS_MAP.json` (`map.buildings.bus`) and synchronized walkthrough landmarks across Zone A, Zone B, and Zone C with the university's real photo sequence.
- Added a palette for placing trees, buildings, and wall-mounted exterior doors by dragging or by clicking and tapping. Placements persist in the tab and are included in the map export.
- Added Delete and Backspace in the campus editor. Removals update the scene, collisions, minimap, and JSON export.
- Added Ctrl+Z and Ctrl+Shift+Z to undo and redo layout edits, including transforms, placement, and deletion.
- Added a 65% campus walking-speed boost with Shift and WASD or the arrow keys. Shift+Q and Shift+E strafe left and right.

### Changed

- Replaced the campus landing illustration with a render of the existing CSE building, preserving its lattice façade, windows, doors, and university sign. The preview fits the current model dimensions and releases its rendering resources after capture.
- Removed branding and hid the minimap and depth meter across the campus and underwater views. Moved the bottom controls out of active exploration and kept them available on pause. Verified campus, pool, and underwater navigation on desktop and touch.
- Hid the minimap, bottom controls, and top-left branding on the campus landing screen. Verified that all three appear in exploration and while paused on desktop and touch.
- Redesigned the campus and ocean landing screens and live HUDs with original 3D-style dioramas, deep-blue gradients, and Bricolage Grotesque. Moved the campus map and ocean depth meter to the upper right and removed the persistent hints and weather row.
- Expanded the campus editor with an overhead camera, pan and zoom, draggable transform handles, precise inputs, and independent selection for buildings, paths, and props.
- Export now includes transforms for edited elements. The edited layout survives reload and portal travel in the same tab. Moving the pool updates the terrain opening, portal, and return checkpoint together.
- Kept individual objects available for editing and used spatial instancing for the walking view. Moved pool waves to the vertex shader, instanced fish schools, and skipped offscreen sea-life animation work.
- Replaced building stretch transforms with metre-based footprints and whole-floor resizing. The building factory preserves opening dimensions, refits façade details, and rebuilds colliders.

### Verification

- Verified the CSE hero on desktop and touch, including a saved floor-count edit, entry into the live scene, the layout editor, and a portal round trip. Checked transparent capture and responsive framing, and built both pages with Vite.
- Checked both landing screens and live HUDs in Chrome on desktop, tablet, and touch layouts from 320 px to 1905 px wide. Verified pointer lock, drag and touch movement, keyboard weather controls, editor entry, both portal buttons, and both physical portal crossings. Rebuilt both pages with Vite.
- Ran `npm i` and verified successful installation of `three` and `vite`.
- Built the production bundle with `npm run build` bundling both `index.html` and `underwater.html`.
- Executed Playwright browser tests over `http://127.0.0.1:8090`:
  - Verified zero WebGL and console errors.
  - Verified entering exploration, pressing `[E]` to toggle Layout Editor mode, raycast-selecting the CSE building, translating with `ArrowLeft`, rotating with `KeyT`, copying coordinates JSON, and closing with `[E]`.
  - Verified `underwater.html` scene loads with zero console or WebGL errors.
- Verified the overhead editor in desktop Chrome and an emulated touch viewport. Exercised canvas selection, dragging, numeric transforms, keyboard nudging, updated collision and minimap behavior, export and reload, and both portal crossings after moving the pool.
- Verified placement in desktop Chrome and on an emulated touch viewport. Measured unchanged window dimensions after resizing, checked floor additions and removals using the vertical handle, and reloaded the exported layout in an independent browser session.
- Verified both deletion shortcuts, text editing in the inspector, cleanup of attached doors, and deletion persistence after reload and JSON export.
- Verified single-step drag history, native text undo, redo clearing after a new edit, and replay of pool and door changes with matching scene state and export.
- Verified boosted letter and arrow movement with both Shift keys, the plain E editor shortcut, touch walking, editor nudges, and underwater descent.
