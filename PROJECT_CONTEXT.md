# Stamford Campus Atlas project context

This is an interactive computer graphics project for the Stamford University Bangladesh campus. The player explores campus exteriors, reaches the portal under the swimming pool, and descends through a procedural ocean before returning to the pool deck. The [README](README.md) covers launch and player controls. The [changelog](CHANGELOG.md) records completed work and verification.

## Runtime and source map

Serve the repository root over HTTP in a WebGL 2 browser. The two HTML entry points pin Three.js 0.170.0 and its addons through matching jsDelivr import maps. Source modules run directly in the browser and the scenes generate their geometry and textures at runtime.

| File | Responsibility |
| --- | --- |
| [index.html](index.html) | Campus entry, weather buttons, minimap, coordinates, checkpoint shortcuts |
| [underwater.html](underwater.html) | Ocean entry, depth meter, swim controls, campus return link |
| [styles.css](styles.css) | Shared HUD, scene themes, responsive layouts, transition overlay |
| [CAMPUS_MAP.json](CAMPUS_MAP.json) | Campus footprints, axes, palette, paths, zones, checkpoints, and numbered photo notes |
| [src/mainCampus.js](src/mainCampus.js) | Loads the map, builds terrain and perimeter, resolves walking collisions, handles checkpoints and entry into the pool portal |
| [src/buildingFactory.js](src/buildingFactory.js) | Procedural exterior walls, façade details, doors, windows, signs, planting, furniture, and collision rectangles |
| [src/zoneA_GateGarden.js](src/zoneA_GateGarden.js) | Zone A entry gate, guard and guardian rooms, and front garden |
| [src/zoneB_CSEAdmission.js](src/zoneB_CSEAdmission.js) | Zone B CSE and Official buildings, Admission Wing and bus, plus Zone C washroom, libraries, and Law corridor |
| [src/zoneC_GroundPool.js](src/zoneC_GroundPool.js) | Zone D central lawn and court, Academic and Civil exteriors, Medical Center, Student Welfare, canteen, pool, and pool portal |
| [src/weatherAndLighting.js](src/weatherAndLighting.js) | Day and night lighting, 3,600 moving rain particles, wet paving, and seasonal foliage and fog |
| [src/mainUnderwater.js](src/mainUnderwater.js) | Swimming, depth-based atmosphere, sea life and rock formations, and the return portal |
| [src/sceneKit.js](src/sceneKit.js) | Shared geometry, seeded randomness, canvas textures, instancing, and portal construction |
| [src/sceneRuntime.js](src/sceneRuntime.js) | Shared renderer and camera setup, pointer lock and drag, movement input, HUD helpers, and page transitions |

## Layout and navigation contracts

- Campus coordinates use metres. `+Y` is up, `+X` is schematic east, and `+Z` points toward the entry street. Ground is at `y = 0` and land eye height is `y = 1.7`. Distances and orientation are estimates based on the local numbered `CG_Sessional` photo walkthrough. Use the map's `photoNotes` for frame ranges and observed features.
- The tour goes from the gate and garden through CSE and Admission, past the bus and library corridor, then into the central ground and pool. The lawn includes a marked court from the references. The submerged ring is fictional.
- Campus obstacles use world-space XZ bounding boxes in the form `{ minX, maxX, minZ, maxZ }`. Walking checks a margin for the player radius and resolves each axis in small steps, so the player can slide along walls. Checkpoints are checked against the colliders at startup. HUD zone detection uses the first matching rectangle in `areas`, so keep specific areas ahead of larger overlapping areas.
- The pool opening, stair geometry, water height, and camera descent need to line up. A submerged camera within 2.2 m of the ring goes to `underwater.html`. The `P` shortcut uses the same transition. The return ring sits at `(8, -2, -3.3)` and returns to `index.html?arrival=pool`, which selects checkpoint 4.
- Ocean movement clamps camera Y from `-120` to `0`. The HUD layer changes at 30 m and 70 m. The fog and light profiles interpolate across 0, 25, 70, and 120 m, so the atmosphere can transition before the layer label changes.

## Graphics details to preserve

- Models use `THREE.Group` hierarchies and local transforms. The scene kit batches repeated static meshes and leaves articulated objects such as fish tails and portal marks available for animation.
- Pool wave height adds sine and cosine terms. Kelp uses a travelling sine wave with fixed roots. Fish follow `x = x₀ + R cos(ωt + φ)` and `z = z₀ + R sin(ωt + φ)`, face the tangent, and oscillate their tails. The source comments document the formulas for the graphics report.
- Campus weather preferences are scoped to the browser session. Test with a fresh session or reset the toggles before comparing the default view.

## Browser smoke checklist

Use the static server in the [README](README.md). Inspect the browser console for import, WebGL, or shader errors.

1. Load both entry points. Confirm the scene renders and the primary control becomes enabled.
2. On campus, test pointer lock, mouse look, movement, and `Esc`. Walk through the gate and into a building wall or perimeter wall to check that the camera stays outside the obstacle at `y = 1.7`.
3. Press `1` through `4` and compare the view, active checkpoint, zone label, and coordinates. Cycle `N`, `R`, and `V` and check the visible sky, lights, rain, wet ground, foliage, and fog.
4. From checkpoint 4, enter exploration and walk forward into the pool. Confirm the fade and ocean arrival. Swim through the surface return ring and confirm the campus loads at the pool deck. Try the campus `P` shortcut separately.
5. In the ocean, use `Space`, `Shift`, and `C` to check the depth limits, layer labels, and meter. Look for reef life in the shallow zone, fish and turtles in midwater, and glowing creatures in the abyss.
6. On a touch device or emulated touch viewport, check drag-to-look, directional buttons, ocean rise and sink controls, and pause.

For source-only checks in PowerShell, use a recent Node.js version and Python.

```powershell
Get-ChildItem src -Filter *.js | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed in $($_.Name)" }
}
python -m json.tool CAMPUS_MAP.json > $null
```
