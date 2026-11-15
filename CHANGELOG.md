# Changelog

Record completed changes here, with verification when it helps a future handoff. Keep launch instructions in the [README](README.md) and architectural details in [Project Context](PROJECT_CONTEXT.md).

## Unreleased

### Added

- Added the curved black-and-white planting bed beside the gate, planted with a palm, two other trees, and terracotta pots. It is editable as one facility and appears on the minimap.

- Modeled the measured tiled platform and its planters on the inside right of the campus gate. The platform appears on the minimap and can be moved or stored in the layout editor.
- Converted the application to permanent drone flight mode: removed walking mode and the `F` toggle button so the user is always in flight mode from initial entry.
- Standardized Deep Sea (`underwater.html`) controls to exactly match campus drone mode: `WASD` for horizontal movement, `↑` or Left-Click to ascend, `↓` or Right-Click to descend, and `Shift` for boost speed (neither `Space` nor `C` are used for climb, eliminating control discrepancy).
- Added dynamic underwater drone mode across both campus swimming pool and Deep Sea (`underwater.html`): transitioning into water engages an acoustic profile with low-pass hydrophone filtering (280–540 Hz), high resonance (Q = 1.65), and a 52 Hz sub-water thruster purr at 0.72× pitch rate.
- Added canvas pointer lock requests on click and pointerdown in `sceneRuntime.js`, fixing the issue where mouse look in Deep Sea did not rotate the camera due to unengaged pointer lock.
- Added swimming pool immersion for campus drone mode: allows descending below 1.7 m eye height down to `-2.55 m` (pool basin floor) when over the pool, confines horizontal movement within pool basin walls below ground level, updates HUD to show underwater drone depth, and triggers portal dive when reaching the submerged ring.
- Added mouse altitude controls in drone mode: Left-click ascends and Right-click descends (just like the Up and Down arrow keys), with context-menu prevention and automatic altitude clamping between 1.7 m and 80 m (and down to `-2.55 m` in the pool).
- Added `M` shortcut and HUD action button to toggle drone audio mute/unmute with smooth gain transitions and screen announcements.
- Added unit tests for drone audio mute/unmute behavior and underwater mode transitions in `tests/campusDroneAudio.test.js`.

### Changed

- Increased deep sea swimming and climb speeds: horizontal swim speed increased to 8.5 m/s (15.7 m/s boosted with Shift, an 85% boost) and vertical climb speed increased to 11.0 m/s (20.3 m/s boosted).
- Significantly increased campus movement speeds across both walking/flight and sprint: base speed increased from 5.15 m/s to 9.0 m/s (~75% faster), sprint boost increased to 1.9× (17.1 m/s, over 100% faster), and vertical climb speed increased from 7 m/s to 12 m/s.
- Added an upper-right development readout for live camera X, Y, and Z on campus and underwater. Verified campus pointer lock, checkpoint changes, pause and editor visibility, and touch descent at 320 px in Chromium. The Vite production build keeps the readout hidden.
- Added a first-person campus drone mode with WASD, Shift boost, altitude controls, and synthesized directional rotor audio.

- Added placement deck category filter tabs (**Buildings**, **Trees**, **Facilities**, **Doors**, and **All**) with dynamic badge counts, organizing stored campus items into distinct categories with an "All" overview and immediate filtering.
- Added duplicate building stacking on the placement deck: multiple identical building duplicates collapse into a single card displaying a count badge (`×N`), while resized or altered buildings automatically generate distinct cards labeled with their exact dimensions and floor counts.
- Added interactive perimeter wall slicing and deletion: users can toggle wall slice mode (`C` or the **Slice wall** button), slice any boundary wall segment at any chosen point along its length, select individual wall pieces with 3D highlight wireframes, and delete unwanted sections (e.g. at the main gate) via the delete button or `Delete`/`Backspace` key. Sliced and deleted walls instantly synchronize 3D perimeter geometry, player walking collision bounds, and minimap rendering, with full undo/redo and persistence.

- Added an **Import JSON** modal dialog to the layout editor supporting local file picking (`.json`) and direct JSON pasting with structure validation, keyboard shortcut submission (`Ctrl+Enter`), drag-and-drop, and automatic layout reload into editor mode.

- Added uniform boundary scaling and counted deck stacks for matching items. Each drag or deletion uses one piece from the stack.

- Added automatic perimeter walls for the Stamford preset and custom land outlines. Applying, undoing, or reloading an outline rebuilds its walls.

- Added direct object dragging with grid snapping, a searchable placement deck, building and prop duplication, and an undoable **Clear to deck** action. Stored buildings retain their doors, and the pool retains its portal.
- Added a land boundary tool for drawing and reshaping a polygon. The applied outline drives terrain, placement, walking, and the minimap. Browser saves and JSON export include the outline and deck.
- Added an empty Stamford campus preset traced from the supplied Google Maps measurement. Loading it applies the outline and puts placed pieces in the deck as one undoable action.
- Added `package.json` and `vite.config.js` configuring multi-page bundling (`index.html` and `underwater.html`) and local development via `npm run dev` (`127.0.0.1:8090`).
- Added live in-browser Layout Editor Mode toggled with `[E]`, supporting raycast landmark picking, `THREE.BoxHelper` visual selection highlights, arrow key translation (1m step, 5m with Shift), rotation (`Q`/`T` by 15°), real-time collider bounds synchronization, and one-click JSON clipboard export & map download.
- Preserved hierarchical static mesh batching across modular landmarks so buildings remain translated/rotated and picked as cohesive units.
- Registered the Varsity Bus in `CAMPUS_MAP.json` (`map.buildings.bus`) and synchronized walkthrough landmarks across Zone A, Zone B, and Zone C with the university's real photo sequence.
- Added a palette for placing trees, buildings, and wall-mounted exterior doors by dragging or by clicking and tapping. Placements persist in the tab and are included in the map export.
- Added Delete and Backspace in the campus editor. Removals update the scene, collisions, minimap, and JSON export.
- Added Ctrl+Z and Ctrl+Shift+Z to undo and redo layout edits, including transforms, placement, and deletion.
- Added a 65% campus walking-speed boost with Shift and WASD or the arrow keys. Shift+Q and Shift+E strafe left and right.

### Changed

- Replaced the drone hum with a locally bundled quadcopter recording. Actual speed and direction now drive rotor playback rate, loudness, tone, and stereo position.

- Expanded the campus placement deck across the viewport and added previews rendered from the campus models. Card dragging now uses mouse, pen, or touch input, with a floating image and the snapped footprint.
- Added bi-directional scene switching with keyboard shortcut `P` (and `O` on campus, `C` on ocean landing) between Stamford Campus and Deep Sea: switching while roaming seamlessly loads the destination scene directly in active roaming mode; switching while on the landing briefing view (with the enter button) loads the destination scene on its matching landing view.
- Streamlined the campus HUD location badge: removed redundant zone code text (e.g., "ZONE D") to create a compact, single-row height badge, and added a vector SVG map pinpoint/location icon to the left of the area name.
- Replaced the campus landing illustration with a render of the existing CSE building, preserving its lattice façade, windows, doors, and university sign. The preview fits the current model dimensions and releases its rendering resources after capture.
- Removed branding and hid the minimap and depth meter across the campus and underwater views. Moved the bottom controls out of active exploration and kept them available on pause. Verified campus, pool, and underwater navigation on desktop and touch.
- Hid the minimap, bottom controls, and top-left branding on the campus landing screen. Verified that all three appear in exploration and while paused on desktop and touch.
- Redesigned the campus and ocean landing screens and live HUDs with original 3D-style dioramas, deep-blue gradients, and Bricolage Grotesque. Moved the campus map and ocean depth meter to the upper right and removed the persistent hints and weather row.
- Expanded the campus editor with an overhead camera, pan and zoom, draggable transform handles, precise inputs, and independent selection for buildings, paths, and props.
- Export now includes transforms for edited elements. The edited layout survives reload and portal travel in the same tab. Moving the pool updates the terrain opening, portal, and return checkpoint together.
- Kept individual objects available for editing and used spatial instancing for the walking view. Moved pool waves to the vertex shader, instanced fish schools, and skipped offscreen sea-life animation work.
- Replaced building stretch transforms with metre-based footprints and whole-floor resizing. The building factory preserves opening dimensions, refits façade details, and rebuilds colliders.

### Verification

- Checked the entry planting bed from the marked viewpoint in a saved layout. Verified gate passage, collision, Facilities deck storage, undo, minimap updates, and JSON export and reload in Chromium. The build and nine unit tests passed.

- Checked the measured platform in the stock layout and a saved layout with a rotated gate. Verified walking collision, gate passage, minimap, Facilities deck storage, undo, JSON export, and reload in Chromium. The Vite build and nine unit tests passed.

- Verified the recorded rotor loop, forward and boosted playback rates, reverse and altitude cues, stereo panning, pause fade, touch ascent, and the synthesized fallback in Chromium. Both pages built with Vite.

- Checked drone pointer lock, altitude limits, left and right audio panning, return to walking, and touch ascent in Chromium. Both scenes built with Vite.

- Verified deck category tabs and badge counts across Buildings (15), Trees (64), Facilities (44), Doors (0), and All (123) in headless Chromium, verifying real-time filtering, badge counts, and empty category handling.
- Verified duplicate building stacking by exact dimension key (`${width}x${depth}-${floors}fl`), showing count multiplier badges on identical items and distinct cards on resized items.
- Verified boundary wall slicing, segment selection, 3D highlight rendering, segment deletion, collision clearance, and persistence in browser tests and syntax checks.

- Verified layout import and schema validation unit tests in Node.js, syntax checks on all source modules, production build with Vite, and valid JSON structure.

- Checked 150% boundary scaling, undo and redo, duplicate tree stacking, single-piece placement and deletion, and reload in Chromium. Both pages built with Vite.

- Checked automatic wall updates on preset load, undo, redo, and page reload in Chromium. Both pages built with Vite.

- Verified preset loading on desktop and touch, one-step undo and redo, placement limits, JSON export and reload, and both physical portal crossings after placing the pool on the new outline.
- Checked the tray on desktop and narrow screens. Verified model thumbnails, on-demand rendering, mouse and touch placement, horizontal swiping, undo, and desktop pointer lock. Both pages built with Vite.
- Verified both physical portal crossings, desktop pointer lock on entry, and the touch portal buttons after combining the portal shortcuts with the campus editor changes. Automatic arrivals use drag-to-look.
- Verified bi-directional `P` key shortcut transitions via browser tests: switching from Campus landing view loads Deep Sea landing view; pressing `P` again returns to Campus landing view; clicking "Enter campus" and pressing `P` while roaming smoothly transitions directly to active roaming view in Deep Sea (`?roam=1`); pressing `P` while roaming underwater returns directly to active roaming view at the Swimming Pool (`?arrival=pool&roam=1`).

- Verified in-browser live UI at `http://127.0.0.1:8090/index.html?arrival=pool`: confirmed the top-left location badge renders with compact vertical height (~34.6px), contains no "ZONE D" text, and displays the crisp SVG map pin icon immediately to the left of "Central Ground".

- Verified direct mouse dragging, deck drag and drop, touch placement, bulk undo and redo, and confirmed deletion. Tested attached doors and model copies through browser reload and JSON export in a fresh session. Checked corner dragging, concave boundaries, rejection of crossed edges, and walking limits. Verified both physical portal crossings and built both pages with Vite.
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
