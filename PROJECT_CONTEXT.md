# Stamford Campus Atlas project context

This is an interactive computer graphics project for the Stamford University Bangladesh campus. The player explores campus exteriors, reaches the portal under the swimming pool, and descends through a procedural ocean before returning to the pool deck. The [README](README.md) covers launch and player controls. The [changelog](CHANGELOG.md) records completed work and verification.

## Runtime and source map

Serve the repository root over HTTP in a WebGL 2 browser. The two HTML entry points pin Three.js 0.170.0 and its addons through matching jsDelivr import maps. Source modules run directly in the browser and the scenes generate their geometry and textures at runtime.

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Campus entry, minimap, coordinates, checkpoint shortcuts, editor entry |
| [underwater.html](underwater.html) | Ocean entry, depth meter, swim controls, campus return link |
| [styles.css](styles.css) | Shared landing screens, blue scene themes, responsive HUD, portal transition |
| [assets/](assets/) | Underwater landing artwork, original campus concept artwork, and locally hosted Bricolage Grotesque |
| [CAMPUS_MAP.json](CAMPUS_MAP.json) | Campus footprints, axes, palette, paths, zones, checkpoints, and numbered photo notes |
| [src/mainCampus.js](src/mainCampus.js) | Loads the map, builds terrain and perimeter, resolves walking collisions, handles checkpoints and entry into the pool portal |
| [src/campusHero.js](src/campusHero.js) | Renders the actual CSE building into a transparent 2D canvas for the landing page |
| [src/campusEditor.js](src/campusEditor.js) | Overhead camera, orbit and transform controls, object picking, inspector, and JSON export |
| [src/campusLayout.js](src/campusLayout.js) | Layout registration, session persistence, transform serialization, and the movable pool opening |
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
- The tour goes from the gate and garden through CSE and Admission, past the bus and library corridor, then into the central ground and pool. The lawn includes a marked court from the references. The submerged ring is fictional.
- Campus obstacles use world-space XZ bounding boxes in the form `{ minX, maxX, minZ, maxZ }`. Walking checks a margin for the player radius and resolves each axis in small steps, so the player can slide along walls. Editing updates colliders and a blocked checkpoint uses a nearby clear position. HUD zone detection uses the first matching rectangle in `areas`, so keep specific areas ahead of larger overlapping areas.
- The pool opening, stair geometry, water height, and camera descent need to line up. A submerged camera within 2.2 m of the ring goes to `underwater.html`. The `P` shortcut uses the same transition. The return ring sits at `(8, -2, -3.3)` and returns to `index.html?arrival=pool`, which selects checkpoint 4.
- Ocean movement clamps camera Y from `-120` to `0`. The HUD layer changes at 30 m and 70 m. The fog and light profiles interpolate across 0, 25, 70, and 120 m, so the atmosphere can transition before the layer label changes.
- Buildings store `width` and `depth` in metres, integer `floors`, and `yaw` in degrees. The factory keeps its floor and fixture dimensions, refits the façade, and rebuilds the colliders and instance batches when the shape changes. Legacy building `scale` multipliers convert to physical dimensions and a rounded floor count when loaded. Other site records still use scale multipliers.
- New buildings use `type: "building"` under `buildings`. New trees and exterior doors use typed records under `elements`, alongside transform overrides for existing props. A placed door stores its parent building ID, wall side, and normalized wall offset. The pool keeps its world-space ring position and a separate portal transform. Edits are saved in the current browser tab against the loaded source map.
- Deleting a placed object removes its record. For objects generated by the campus zones, `removedObjects` stores their IDs so the scene and minimap omit them on reload. Deleting a building also removes its attached door records.
- Undo and redo store committed transforms and object additions or removals in memory. Pool transforms capture the portal, checkpoint, and zone together. Replaying an edit updates the scene and saves the current layout for reload and export.

## Graphics details to preserve

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
9. Drag an object and undo and redo it. Delete a building with an attached door, then undo to restore both. Make a new edit after undoing and check that redo clears.

For source-only checks in PowerShell, use a recent Node.js version and Python.

```powershell
Get-ChildItem src -Filter *.js | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed in $($_.Name)" }
}
python -m json.tool CAMPUS_MAP.json > $null
```
