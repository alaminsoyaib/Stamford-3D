# Stamford Campus Atlas project context

This is an interactive computer graphics project for the Stamford University Bangladesh campus. The player explores campus exteriors, reaches the portal under the swimming pool, and descends through a procedural ocean before returning to the pool deck. The [README](README.md) covers launch and player controls. The [changelog](CHANGELOG.md) records completed work and verification.

## Runtime and source map

Serve the repository root over HTTP in a WebGL 2 browser. The two HTML entry points pin Three.js 0.170.0 and its addons through matching jsDelivr import maps. Source modules run directly in the browser and the scenes generate their geometry and textures at runtime.

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Campus entry, minimap, coordinates, checkpoint shortcuts, editor entry |
| [src/campusDroneAudio.js](src/campusDroneAudio.js) | Rotor loop playback, pitch and stereo cues, and synthesized fallback for campus flight |
| [underwater.html](underwater.html) | Ocean entry, depth meter, swim controls, campus return link |
| [styles.css](styles.css) | Shared landing screens, blue scene themes, responsive HUD, portal transition |
| [assets/](assets/) | Underwater landing artwork, original campus concept artwork, and locally hosted Bricolage Grotesque |
| [CAMPUS_MAP.json](CAMPUS_MAP.json) | Campus footprints, axes, palette, paths, zones, checkpoints, and numbered photo notes |
| [src/mainCampus.js](src/mainCampus.js) | Loads the map, builds terrain and perimeter, resolves walking collisions, handles checkpoints and entry into the pool portal |
| [src/campusHero.js](src/campusHero.js) | Renders the actual CSE building into a transparent 2D canvas for the landing page |
| [src/campusEditor.js](src/campusEditor.js) | Overhead camera, direct dragging, transform controls, placement deck, undo, and JSON export/import |
| [src/campusDeckDrag.js](src/campusDeckDrag.js) | Card dragging with pointer capture and a preview near the pointer |
| [src/campusDeckPreviews.js](src/campusDeckPreviews.js) | Cached thumbnails rendered from the stored scene objects |
| [src/campusLandEditor.js](src/campusLandEditor.js) | Grid and boundary overlays, corner editing, and outline drafts |
| [src/campusLandPresets.js](src/campusLandPresets.js) | Traced university outline for an empty campus layout |
| [src/campusBoundary.js](src/campusBoundary.js) | Polygon validation, land area, and point and footprint checks |
| [src/campusLayout.js](src/campusLayout.js) | Layout registration, browser persistence, transform serialization, and the movable pool opening |
| [src/buildingFactory.js](src/buildingFactory.js) | Procedural exterior walls, façade details, doors, windows, signs, planting, furniture, and collision rectangles |
| [src/zoneA_GateGarden.js](src/zoneA_GateGarden.js) | Zone A entry gate, guard and guardian rooms, and front garden |
| [src/zoneB_CSEAdmission.js](src/zoneB_CSEAdmission.js) | Zone B CSE and Official buildings, Admission Wing and bus, plus Zone C washroom, libraries, and Law corridor |
| [src/zoneC_GroundPool.js](src/zoneC_GroundPool.js) | Zone D central lawn and court, Academic and Civil exteriors, Medical Center, Student Welfare, canteen, pool, and pool portal |
| [src/weatherAndLighting.js](src/weatherAndLighting.js) | Day and night lighting, 3,600 moving rain particles, wet paving, and seasonal foliage and fog |
| [src/mainUnderwater.js](src/mainUnderwater.js) | Swimming, depth-based atmosphere, sea life and rock formations, and the return portal |
| [src/sceneKit.js](src/sceneKit.js) | Shared geometry, seeded randomness, canvas textures, instancing, and portal construction |
| [src/sceneRuntime.js](src/sceneRuntime.js) | Shared renderer and camera setup, pointer lock and drag, movement input, HUD helpers, and page transitions |

## Landing artwork

The campus hero clones the CSE group built by the campus factory, including its sign, windows, doors, and current dimensions. It normalizes the building's position and yaw for a three-quarter view on a small presentation base. A temporary WebGL renderer paints the model once into a 2D canvas and then releases its GPU resources. Capture happens before walking-view batching hides the source meshes and before layout removals. Portal returns skip this preview. The factory's shared geometry and materials stay owned by the campus.

The built-in image generation tool produced the underwater artwork and the earlier campus concept below. Those images were cropped and encoded as transparent WebP. The current campus landing page uses the rendered CSE model.

<details>
<summary>Hero artwork prompts</summary>

- [Campus diorama](assets/campus-diorama.webp) — Transparent-background 3D hero asset for an interactive virtual tour of Stamford University Bangladesh. Make a single wide isolated architectural diorama in a premium editorial architectural visualization style, front three-quarter view from slightly above, a brick-red 5-story academic block with a disciplined white rectangular window grid at center, shorter cream and terracotta wings, blue entry gate, palms, garden paths and a glimpse of cyan swimming pool, all on one thin beveled dark navy stone base. Evening blue studio lighting with warm window highlights, clear geometric forms and crisply separated silhouette. The tall central roof should occupy the upper middle and buildings must stay visible at thumbnail size. Center the entire object in frame with small clear margins. The background outside the diorama is genuine alpha transparency, including all corners; no horizon, no large floating cast shadow, no text, no logos, no typography, no interface. Wide landscape composition.
- [Ocean diorama](assets/ocean-diorama.webp) — Transparent-background 3D hero asset for an interactive deep-sea portal tour. Make a single wide isolated underwater diorama in a premium editorial 3D visualization style, front three-quarter view from slightly above. A large upright circular sapphire-blue portal with a brilliant cyan luminous inner ring stands at center, in a rugged ocean-floor basin made of navy basalt slabs and rocks. Use small bright soft corals, sparse sea grass, and two small floating translucent jellyfish framing the sides. Crisp detailed materials, volumetric blue lighting confined close to the subject, reflective highlights, deep navy rocks still visibly defined, pale cyan and a restrained lilac accent. The upright ring should occupy the upper middle. Center the entire object in frame with small clear margins. The background outside the diorama is genuine alpha transparency, including all corners; no horizon, no rectangular backdrop, no letters, no labels, no interface. Wide landscape composition.

</details>

## Layout and navigation contracts

- The initial view uses a diorama over the live canvas. After exploration starts, a checkpoint is selected, or the player returns to the pool, the compact briefing exposes the scene and provides a resume button when paused. The minimap and depth meter remain hidden while their values update. The bottom controls are available on pause, and the ocean return link is also available on its landing screen. Weather keys update scene preferences directly.
- Campus coordinates use metres. `+Y` is up, `+X` is schematic east, and `+Z` points toward the entry street. Ground is at `y = 0` and land eye height is `y = 1.7`. Distances and orientation are estimates based on the local numbered `CG_Sessional` photo walkthrough. Use the map's `photoNotes` for frame ranges and observed features.
- The shared scene runtime enables the camera coordinate HUD in development. Both scenes display world-space metres to one decimal place in the compact exploration view, including while paused. The Vite production build leaves the readout hidden.
- A custom `boundary.points` is an ordered list of `[x, z]` corners. It defines the visible campus terrain, editor placement limits, walking limits, minimap outline, and camera fit. The four original rectangular bounds and `streetZ` supply the default street layout and initial wall templates.
- Boundary walls are stored as discrete linear segments in `boundary.walls` (`[{ id, label, a: [x, z], b: [x, z] }]`). Slicing divides a segment at any point into subsegments; individual segments can be selected and deleted (for instance, carving an opening at the university gate). Both default and custom boundaries build their 3D walls and walking capsule collision from `boundary.walls`, keeping physical meshes, obstacle boundaries, and minimaps in lockstep.
- The placement deck groups stored items into categorical tabs (**Buildings**, **Trees**, **Facilities**, **Doors**, and an **All** overview) with dynamic badges. Identical duplicate buildings share a single card with a `×N` multiplier; edited or resized duplicates branch into distinct cards labeled with footprint dimensions and floor count.
- The empty Stamford campus preset traces ten corners from the supplied Google Maps measurement screenshot, including the southwest notch. The trace uses the reported 8,998.36 m² for scale and is centered on the existing campus bounds in local metres. The resulting perimeter is approximately 399.4 m compared with 399.24 m on the screenshot. The preset lives outside the stock map so adding it preserves the storage key for earlier layouts. Loading it commits the boundary and stores placed objects together in one history entry.
- The tour goes from the gate and garden through CSE and Admission, past the bus and library corridor, then into the central ground and pool. The lawn includes a marked court from the references. The submerged ring is fictional.
- Campus obstacles use world-space XZ bounding boxes in the form `{ minX, maxX, minZ, maxZ }`. Walking checks a margin for the player radius and resolves each axis in small steps, so the player can slide along walls. Editing updates colliders and a blocked checkpoint uses a nearby clear position. HUD zone detection uses the first matching rectangle in `areas`, so keep specific areas ahead of larger overlapping areas.
- The pool opening, stair geometry, water height, and camera descent need to line up. A submerged camera within 2.2 m of the ring goes to `underwater.html`. The `P` shortcut uses the same transition. The return ring sits at `(8, -2, -3.3)` and returns to `index.html?arrival=pool`, which selects checkpoint 4 if the pool is placed. Storing the pool also stores its portal and closes the terrain opening.
- Ocean movement clamps camera Y from `-120` to `0`. The HUD layer changes at 30 m and 70 m. The fog and light profiles interpolate across 0, 25, 70, and 120 m, so the atmosphere can transition before the layer label changes.
- Buildings store `width` and `depth` in metres, integer `floors`, and `yaw` in degrees. The factory keeps its floor and fixture dimensions, refits the façade, and rebuilds the colliders and instance batches when the shape changes. Legacy building `scale` multipliers convert to physical dimensions and a rounded floor count when loaded. Other site records still use scale multipliers.
- New buildings use `type: "building"` under `buildings`. A duplicate campus building sets `template` to its original model ID and keeps its own dimensions and placement. Changes to the zone model appear on reload in each copy. Trees, prop copies, and exterior doors use typed records under `elements`, alongside transform overrides for existing props. A placed door stores its parent building ID, wall side, and normalized wall offset.
- The `deck` array stores IDs while keeping the object records. Stored entries are detached from the scene and excluded from picking, colliders, and the minimap. Buildings carry their mounted doors, and the pool carries the separately editable portal. Permanently deleted built-in objects use `removedObjects`. Deleting added pieces removes their records. The editor saves the layout against the source map in browser storage.
- The deck captures nearby cards on demand into 2D canvases with one small WebGL renderer. Cached previews follow the stored model's shape and scale. Pointer drags pause captures and use the same snap, land, and wall checks as click placement.
- Deck stacks group related models in the editor. Each placement and deletion still uses a single stored record and the saved deck retains individual IDs. Boundary scaling updates the draft corners uniformly around the bounds center and uses the same apply and undo path as corner edits.
- Undo and redo hold committed transforms, placement and deck operations, and land boundary edits in memory. Pool transforms capture the portal, checkpoint, and zone together. Replaying an edit updates the scene and saves the current layout for reload and export. Layout import validates JSON structure from file selection or direct text paste and reloads into the editor.

## Graphics details to preserve

- Drone mode is enabled by default upon entering campus and uses the campus camera and mouse look. Its altitude spans the walking eye height (1.7 m) to 80 m. Left-click ascends and right-click descends, identical to the ↑ and ↓ arrow keys. Pressing F toggles between drone and walking modes. Horizontal collision reuses the campus footprints with height checks so the drone can clear roofs and blocks descent into them. Movement speeds run at 9.0 m/s base and 17.1 m/s boosted sprint (1.9×). The audio receives camera-relative displacement after collision and altitude checks, normalized by flight speed. Pressing M toggles rotor audio mute/unmute with persistent gain ramping. Playback rate, gain, filter cutoff, and pan change smoothly, and the rotor fades while exploration is paused.
- [assets/drone-rotors.wav](assets/drone-rotors.wav) is a 3.55-second mono loop cut from a Phantom 4 Pro hover recording. The source was downmixed, high-pass filtered, normalized, and crossfaded at the loop seam. [UAS Drone Hover 01.wav by DCPoke, CC0](https://freesound.org/people/DCPoke/sounds/387985/)

- Models use `THREE.Group` hierarchies and local transforms. The editor keeps transformable groups separate. The walking view combines repeated geometry into spatial instance batches and rebuilds them after an edit. Fish use animated instance matrices with conservative school bounds. Offscreen kelp, schools, and jellyfish geometry skip animation work.
- Pool wave height adds sine and cosine terms. Kelp uses a travelling sine wave with fixed roots. Fish follow `x = x₀ + R cos(ωt + φ)` and `z = z₀ + R sin(ωt + φ)`, face the tangent, and oscillate their tails. The source comments document the formulas for the graphics report.
- Campus weather preferences are scoped to the browser session. Test with a fresh session or reset the toggles before comparing the default view.

## Browser smoke checklist

Use the static server in the [README](README.md). Inspect the browser console for import, WebGL, or shader errors.

1. Load both entry points. On desktop and a narrow touch viewport, check that the landing art, heading, primary control, and upper-right instrument fit. Enter the scene and pause to check that the canvas remains visible in the compact briefing.
2. On campus, test pointer lock, mouse look, movement, and `Esc`. Hold Shift with WASD or the arrows to boost walking speed, or use Shift+Q and Shift+E to strafe. Plain E opens the editor. Walk through the gate and into a building wall or perimeter wall to check that the camera stays outside the obstacle at `y = 1.7`.
3. Press `1` through `4` and compare the view, active checkpoint, zone label, and coordinates. Cycle `N`, `R`, and `V` and check the visible sky, lights, rain, wet ground, foliage, and fog.
4. From checkpoint 4, enter exploration and walk forward into the pool. Confirm the fade and ocean arrival. Swim through the surface return ring and confirm the campus loads at the pool deck. Try the campus `P` shortcut separately.
5. In the ocean, use `Space`, `Shift`, and `C` to check the depth limits, layer labels, and meter. Look for reef life in the shallow zone, fish and turtles in midwater, and glowing creatures in the abyss.
6. On a touch device or emulated touch viewport, check drag-to-look, directional buttons, ocean rise and sink controls, and pause.
7. Open the editor from the walk view. Pick an object, drag a handle, and edit yaw and size in the inspector. Move a building and a tree independently, then check the minimap, collisions, and the downloaded JSON in a fresh session. Move or rotate the pool and repeat both portal crossings from checkpoint 4.
8. Drop a tree and a building from the palette, then attach a door to the building. Increase and decrease the floor count and change the footprint. Check that the opening dimensions stay fixed and the added door follows its wall after export and reload.
9. Drag a piece onto the deck and check its model preview. Scroll the tray, then drag a card back onto the map with mouse or touch. Test dropping outside the land and over the inspector. Duplicate a building with an attached door and check the copy after a reload. Confirm deletion of a stored piece, then undo it. Clear the map and undo once to restore all the pieces.
10. Load the empty Stamford campus preset. Check that the outline includes the notch and that one undo restores the previous boundary and placed objects. Redo and place a piece from the deck. Draw a concave outline to check custom editing. Check that outside placement is rejected and that walking stops at the outline. Restore the pool and try the portal shortcuts. Export the map and reload it in a fresh browser to check the layout and deck.

For source-only checks in PowerShell, use a recent Node.js version and Python.

```powershell
Get-ChildItem src -Filter *.js | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed in $($_.Name)" }
}
python -m json.tool CAMPUS_MAP.json > $null
```
