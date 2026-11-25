# Changelog

Record completed changes here, with verification when it helps a future handoff. Keep launch instructions in the [README](README.md) and architectural details in [Project Context](PROJECT_CONTEXT.md).

## Unreleased

### Added

- Extracted pure 3D collision and boundary-resolution physics into `src/campusCollision.js` with oriented bounding-box (OBB) depenetration in `src/campusFootprints.js`, plus unit tests in `tests/campusCollision.test.js`.
- Improved briefing controls loading UX on Campus and Ocean landing pages:
  - Replaced the disabled/grayed-out "Enter campus" and "Begin descent" buttons during scene initialization with the dedicated loading status text ("Building the campus scene…").
  - Hid the button while loading (`hidden` attribute, `[data-ready="false"] .briefing-buttons`, and `.primary:disabled { display: none; }`), preventing layout shifts that previously pushed the button upward while loading.
  - Aligned and centered the loading indicator within `.briefing-controls` with matching `min-height`, guaranteeing a seamless transition where the status text disappears and the ready button appears in its exact normal position without shifting.
  - Added unit test coverage in `tests/briefingControls.test.js`.

- Added an exit option to return to the start page from 3D exploration:
  - Added an **Exit to start** button (`#exit-briefing`) displayed prominently alongside the resume button whenever exploration is paused.
  - Added an **Exit** action button (`#exit-campus` / `#exit-ocean`, shortcut <kbd>X</kbd>) in the bottom HUD scene actions bar on both campus and deep sea views.
  - Added double-Escape shortcut behavior: pressing `Escape` while in flight pauses pointer lock, and pressing `Escape` while already paused exits exploration and returns directly to the start page.
  - Exiting pauses flight, silences audio, closes the layout editor if open, resets the view to checkpoint 1 (Main Gate & Front Garden), and reveals the start page hero artwork and title.
  - Added unit test in `tests/campusExit.test.js`.

- Added high-fidelity 2D transparent hero renders of the CSE building ([assets/campus-cse-hero.webp](assets/campus-cse-hero.webp), [assets/campus-cse-hero.png](assets/campus-cse-hero.png), and updated [assets/campus-diorama.webp](assets/campus-diorama.webp)) captured from the exact orthographic angle and lighting of the 3D model with PCF soft shadows, ACES filmic tone mapping, Stamford University Bangladesh fascia, and the ground sign monument.
- Replaced the landing page `<canvas id="campus-hero">` with an optimized `<img class="hero-art" id="campus-hero" src="./assets/campus-cse-hero.webp" fetchpriority="high">` in `index.html`, eliminating the initial blank delay and dynamic WebGL clone render so the CSE building displays instantaneously upon initial page load. Guarded `renderCampusHero` in `src/mainCampus.js` to run only when a canvas element is targeted.

- Added component name editing in the Layout Editor:
  - Added a dedicated "Component name" text input (`#editor-object-name`) in the inspector panel (`#editor-object-panel`), allowing users to inspect and rename any placed campus object (buildings, trees, facilities, doors, and portal).
  - Added a rename button (`✎`, `.editor-card-rename`) on every placement deck card along with double-click caption editing, opening a clean `#editor-rename-dialog` modal to rename objects directly while stored on the deck.
  - Updating a component name updates `entry.label`, `entry.root.name`, `entry.spec.label`, and the serialized entry in `map.buildings[id]`, `map.elements[id]`, or `map.pool`, updates the `<select id="editor-object">` option text, updates deck card captions, and auto-cascades to attached child doors.
  - Full undo/redo integration: renaming records undo/redo history steps, restoring previous names on Ctrl+Z and reapplying on Ctrl+Shift+Z.
  - Changes persist immediately to browser localStorage and are serialized into `CAMPUS_MAP.json` on Export JSON and Copy JSON.
  - Added unit test suite `tests/campusRename.test.js` and verified end-to-end in Chromium.
- Enhanced aerial drone audio profile in `src/campusDroneAudio.js`: added an aerodynamic prop-wash/motor body resonance oscillator (68–90 Hz triangle wave with 240 Hz low-pass filter), smoothed the low-pass filter cutoff from harsh 3,800–8,500 Hz down to a warm 1,750–3,250 Hz range with Q = 0.75 acoustic resonance, adjusted base playback rate to 0.94× with controlled spooling (up to ~1.18× instead of high-pitched 1.50×), and rebalanced output gain (0.17–0.32) for immersive, non-fatiguing flight.
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

- Refined Academic Wing geometry/mesh/railings and added Central Ground chain-link fence boundary, raised sitting curbs, ground entrance path, and banyan sitting bench:
  - Recessed `A-116` Students' Welfare bay inward beneath the 2nd-floor overhang, deepened the Medical Center alcove (`~2.15 m`) with the concrete handwash basin & blue bucket on the right inner wall (`-X`), `A-117` + fire extinguishers at the back, and `A-118` Medical Center frosted glass door & sign on the left inner wall (`+X`), and centered the Auditorium notice board cleanly between columns (`src/academicExterior.js`).
  - Aligned the projecting covered passage canopy flush with the `+X` corner (`xMax - canopyW / 2`), harmonized coral-rose ground plaster and weathered light galvanized corrugated steel roofs, added pink corner pilasters to the 3rd-floor open gallery, and replaced opaque black mesh backing on the canopy and 2nd-floor end bay with a semi-transparent diamond wire-mesh `CanvasTexture` over pale cream recessed interior sliding-window walls (`src/academicExterior.js`).
  - Tightened the 3rd-floor corrugated roof overhang, added continuous horizontal safety handrails around the 3rd-floor open gallery (`src/academicExterior.js`), and added the remaining black X-lattice safety railing along the exposed 2nd-floor `Academic frontage` roof edge (`src/academicStairs.js`).
  - Created `src/groundEnclosure.js` (wired into `src/zoneC_GroundPool.js` with live `lawn`, `courtSite`, and `shelter` transforms) so the galvanized chain-link wire mesh fence dynamically wraps the full scaled union of the lawn and sports court without slicing across custom-scaled courts; replaced zebra stripes and bench-top spheres with a clean weathered pale concrete/tiled sitting curb, open `3.6 m` blue-post ground entrance walkway (`ground-এ ঢোকার রাস্তা`) facing the adjacent Academic Wing (or Checkpoint 3), and small terracotta walkway pots; softened the banyan circular sitting bench in `src/buildingFactory.js` to weathered stone tiles.
  - Extended `tests/academicWing.test.js` covering Academic Wing refinements, stock ground enclosure clearances, and custom scaled/shifted lawn+court enclosure bounds. Verified with `node --check`, `python -m json.tool`, `node --test`, and `npm run build`.
- Redesigned the Academic Wing rear passage elevation, 3rd-floor open gallery, widened upper staircase, and projecting covered canopy (`src/academicExterior.js`, `src/academicStairs.js`, `src/buildingFactory.js`, `src/academicBuilding.js`):
  - Replaced the 3rd-floor generic blue exterior windows (`Setback upper floor`) with a recessed open veranda gallery featuring recessed interior classroom walls/doors/windows, projecting concrete ledge, steel stanchions & full-height security grille fence, 3 bracket-mounted AC outdoor units, and an overhanging sloped corrugated metal shed roof.
  - Expanded the upper exterior staircase (`Lower-roof-to-upper-landing flight`) across the full depth of the 1-storey roof strip, adding solid sloped soffits beneath the flights, a continuous front terrace handrail along the 1-storey `-Z` roof edge, and 2 white AC outdoor units tucked under the upper stair slope.
  - Replaced the 2nd-floor end bay's generic glazing with a diamond-grille sliding window, slotted concrete breeze-block parapet (`জালি`) + security grille/mesh balcony corridor wrapping onto `+X`, and 2 AC units.
  - Built the detailed `-Z` ground elevation: Auditorium colonnaded veranda (`AUDITORIUM`, `A-115`, notice board, hanging lights, stacked desks), `A-116` Students' Welfare white mural bay with rain awning and 3 stacked office signs, recessed pink Medical alcove (`A-117` + fire extinguishers + `A-118` glass door), `A-119` Student Service Wing collapsible gates, and screened `+X` corner with pedestal washbasin.
  - Added the projecting covered passage canopy at the `+X` ground-access end with 2 slim outer posts, open `1.7 m` walkway clearance, white ceiling soffit with centered recessed circular light, and 2nd-floor screened veranda extension overhead.
  - Added unit tests in `tests/academicWing.test.js` and updated docs (`PROJECT_CONTEXT.md`, `README.md`). Verified with `node --check`, `python -m json.tool`, `node --test`, and `npm run build`.
- Fixed underwater pool stair glitch and completed system-wide solid collision audit:
  - Added oriented 3D colliders for all 5 swimming pool steps and the steel pool ladder (`addPoolBasinColliders` in `src/zoneC_GroundPool.js`), eliminating hollow underwater entry beneath the pool stairs.
  - Upgraded `src/campusCollision.js` (`VERTICAL_FLUSH_EPS`, `poolMinAltitude`, `constrainXZ` hook in `resolveHorizontalMove`) and `src/mainCampus.js` so underwater pool movement runs substepped collision resolution inside the basin and outer rim descents clamp at `lipClearY` instead of clipping into the coping lip and vertical tile walls.
  - Added colliders for remaining campus geometry: Café umbrella canopies & expanded stools (`src/zoneC_GroundPool.js`), Academic exterior stair landing soffits & vertical support posts (`src/academicStairs.js`), wayfinding signs, planters, bench heights, and 1-storey recessed overhangs (`src/buildingFactory.js`), and the Gate-garden raised driveway barrier bollard + boom (`src/zoneA_GateGarden.js`).
  - Added 3D rock ellipsoid & seafloor wave collision for Deep Sea (`src/oceanCollision.js`, `src/mainUnderwater.js`), blocking drone entry into reef shelves, midwater basalt columns, and abyssal rock vents.
  - Added unit tests in `tests/solidCollisionAudit.test.js`. Verified with `node --check`, `python -m json.tool`, `node --test`, and `npm run build`.
- Fixed Layout Editor boundary snap-back and rebuilt the Central Ground Field Shelter:
  - Fixed editor snap-back and drag freezing (`src/campusBoundary.js`, `src/campusEditor.js`) when moving buildings or props near or outside `boundary.points` (such as overlapping perimeter buildings): added `distanceToLandEdge`, `nearestPointInsideLand`, and `resolveEditorLandPosition` so inward nudges/Inspector edits from outside are accepted without snapping back to `beforeEdit`, and dragging across angled boundary walls clamps smoothly onto the inside edge instead of freezing or reverting (while preserving strict `poolFits` checking for the pool and outside-drop rejection for deck placement).
  - Rebuilt the Field Shelter into `src/fieldShelter.js` (wired into `src/zoneC_GroundPool.js` for both surveyed and legacy layouts) to match the campus reference photograph: weathered concrete paving pad (`y = 0..0.10`), 6 round cerulean-teal tubular steel columns (`3 × 2`), perimeter eaves/rafters/end-braced guardrails, 12 individual curved bucket seats (2 bays of 3 per side) with grounded steel legs & floor skids anchored down to the concrete pad, and a 3D corrugated weathered brick-red/maroon tin hip roof (`চালের ছাউনি`) with ridge/hip caps and 3D colliders keeping the `1.7 m` eave clearance open.
  - Added unit tests in `tests/editorAndShelter.test.js` covering polygon/concave clamping, snap-back elimination, grounded seat bounds, and shelter colliders. Verified `node --check src/*.js`, `python -m json.tool CAMPUS_MAP.json`, `node --test tests/*.test.js`, and `npm run build`.
- Fixed 3D building clipping, over-wall drone flight, perimeter wall sticking, and layout editor bugs:
  - Fixed vertical roof descent in `src/mainCampus.js` (`resolveVerticalMove`) so drones land cleanly on building roofs and perimeter walls instead of bypassing colliders above `1.7 m` and dropping inside hollow buildings or wall strips.
  - Made all building, gate, canopy, shelter, bus, and monument colliders 3D altitude-aware (`[bottom, top]`) and oriented (`oriented = true`) by default across `src/buildingFactory.js`, `src/cseExterior.js`, `src/zoneA_GateGarden.js`, `src/zoneB_CSEAdmission.js`, `src/zoneC_GroundPool.js`, `src/gateRooms.js`, `src/campusBus.js`, and `src/cseMonument.js` — sealing overhanging upper floors on recessed buildings (Civil, Official, Academic wing), CSE roof fascia, entry/pool gate beams, and eaves.
  - Enabled altitude-aware perimeter wall flight (`wallTop`: `3.08 m` street, `2.67 m` side/rear) so drones fly freely over campus walls without depending on the gate while keeping outer world boundary clamping intact.
  - Replaced axis-only collision sliding with an iterative OBB/segment push-out solver and anti-tunneling guard (`resolveHorizontalMove`), preventing drones from getting trapped inside diagonal walls or corners; kept `bounds.walls = []` distinct from legacy polygons so deleted walls do not leave invisible barriers.
  - Fixed pool basin edge clamping and post-exit altitude enforcement, restored `ArrowLeft`/`ArrowRight` and `Shift+Q`/`Shift+E` campus strafe controls, reset altitude to `1.7 m` on `exitCampus()`, and prevented paused canvas clicks from triggering upward thrust (`src/sceneRuntime.js`).
  - Fixed `endPointer()` in `src/campusEditor.js` so dragging objects commits transforms, updates colliders/saves, records undo history, and supports deck drop-to-store; preserved street wall heights and collinear snapping when slicing walls.
- Shifted the Academic wing's upper exterior stair flight slightly to the left of the two-storey frontage wall (`src/academicStairs.js`, `src/buildingFactory.js`) so the treads, right stringer, railing, and support post clear the white roof trim overhang, while bridging the open upper landing deck flush to the roof coping. Verified syntax, unit tests, and stair-to-trim clearance in Node.
- Replaced the stair wrapping around the CSE wall with two exterior flights at the Academic wing. Checked the roof contacts, surveyed passage clearance, and stair rebuilds in Node.
- Removed the windows from the two Academic wing walls facing the one-storey roof. Verified both wall faces and the courtyard-side glazing in Node.
- Closed the ground-floor opening at the Official and Academic junction and aligned the trim and window rows. Verified the wall, floor bands, and collision bounds for both join configurations in Node.
- Lowered the marked strip of the Academic wing to one storey and merged the connected wings into one Official Building. Verified the three roof heights, combined footprint, migrated doors, transforms, resizing, deck storage, and duplication in Node.
- Joined the Official and Academic buildings and extended the third floor over the marked end of the Academic roof. The surveyed layout links the existing footprints, while matching older layouts join wall to wall. Verified the roof heights, collision clearance, and editor resizing in Node.
- Set the Official Building's third floor back over the marked rear section, with two floors at the front and west wing. Kept one editor object and the existing footprint. Verified floor heights, collision bounds, legacy layouts, and resizing in Node.
- Traced the garden's outer curb directly from the AutoCAD raster and remeasured the CSE, Civil, and Official footprints from the labeled block edges. The minimap and 3D garden share the corrected outline.
- Placed and sized CSE, Civil, and the L-shaped Official Building from their AutoCAD blocks. Traced the front garden and placed 47 surveyed trees. Rearranged overlapping facilities and updated the affected checkpoints and pool portal position.
- Traced the default campus perimeter and empty-layout preset from the supplied AutoCAD image. Added a survey preview for existing layouts and kept an opening at the main gate in the generated perimeter walls.
- Lowered the first CSE lattice row to align its upper band with the first-floor band on the Academic Building. Recreated the sloped tiled sign and founder's plaque from the courtyard photos, with the original lettering, crest, portrait, and inscription.
- Rebuilt the adjoining guard and guardian rooms with corrugated metal roofing, a measured 10 ft 3 in blue eave, recessed glazing, and an open guard shelter. Rebuilt the blue varsity bus at its measured 8 ft 11 in roofline with sliding windows, wheel arches, a folding passenger door, and the photographed crest. Moved the stock bus beside CSE and carried forward existing saved layouts.
- Rebuilt the CSE exterior with terracotta screens, white trim, the measured 60 ft 2 in roof edge, a roof sign mapped from the original photo, and a steel stair at the right-rear corner. Removed the front posters and replaced the ground-level doors and windows with a lattice row over a recessed base.
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

- Compared the garden trace and building outlines with the survey pixels. Checked the garden mesh, building footprint clearance, and older layout loading in Node.
- Compared the modeled footprints, garden, and tree markers with the survey image. Checked the Admin recess collision, minimap geometry, pool portal coordinates, checkpoints, and existing layout tests in Node.
- Checked the survey trace against the PNG, confirmed the stock buildings, walkways, and pool fit inside it, and verified the gate opening and saved-layout migration with Node tests.
- Compared the CSE and Academic Building first-floor bands in Chromium and checked the ground sign and plaque from the courtyard. Verified the monument's colliders, editor resizing and undo, saved-layout reload, and the campus landing preview. The Vite build and all 11 unit tests passed.
- Compared close-up Chromium views with the room and bus photos, checked roof heights, collision bounds, editor copies, minimap footprints, and all four checkpoint views, and loaded both scenes from the static server. The Vite build and all 11 unit tests passed, including migration of existing saved layouts.
- Checked the CSE front and rear views, recessed base, stair collision, minimap, checkpoint 2, and landing hero in Chromium. Verified floor-count changes, undo, JSON export, and saved layout reload. Both pages built with Vite and the unit suite passed.
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
