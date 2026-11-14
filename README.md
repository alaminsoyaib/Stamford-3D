# Stamford Campus Atlas

Explore the exterior of Stamford University Bangladesh in first person, then follow the portal below its swimming pool into a three-layer ocean.

The campus landing page features the CSE building from the tour. Its preview reflects the building dimensions in the loaded layout.

## Run locally

From the repository root, start a static HTTP server.

```powershell
python -m http.server 8090 --bind 127.0.0.1
```

Open [the campus](http://127.0.0.1:8090/) in a WebGL 2 browser. Both pages import Three.js 0.170.0 from jsDelivr, so the browser needs an internet connection for the modules. The project has no build or package installation step.

## Live demo controls

Select **Enter campus** or **Begin descent** to switch from the illustrated landing screen to the live 3D view. Pause on campus to access the checkpoint buttons, **Layout editor**, and **Deep sea**. Underwater, **Return to campus** is available before starting or while paused. The keyboard shortcuts below also work during exploration.

| Key | Action |
| --- | --- |
| WASD or arrow keys | Walk or swim horizontally |
| Shift + WASD or arrow keys | Walk 65% faster on campus |
| Shift + Q / E | Strafe left / right at boosted speed on campus |
| Mouse | Look after selecting **Enter campus** or **Begin descent** |
| Esc | Release the pointer and pause |
| 1 | Main gate and front garden |
| 2 | CSE, Admission Wing, bus and the library route |
| 3 | Central ground, Academic Building and canteen |
| 4 | Pool edge facing the submerged ring |
| N | Toggle daylight and night |
| R | Toggle rain and wet paving |
| V | Cycle Summer, Autumn and Winter Fog |
| P | Cross directly into the ocean |
| E | Open or exit the campus layout editor |
| Space | Ascend in the ocean |
| Shift or C | Descend in the ocean |

At checkpoint 4, walk forward down the pool steps to cross the portal by proximity. The vertical return ring sits at `(8, -2, -3.3)` in the ocean and brings you back to the pool deck. Touch devices can drag to look and use on-screen movement controls.

## Edit the campus layout

Press **E** or select **Layout editor** to open the overhead view. Click a building or prop in the scene, or choose it from the **Object** list. Drag empty space to pan, scroll or pinch to zoom, and right-drag to orbit. **Frame selection** centers the selected object. **Tilt view** exposes the vertical scale handle at a steeper angle.

Choose **Move** (`G`), **Rotate** (`R`), or **Scale** (`S`), then drag the colored handles. For buildings, enter width and depth in metres or set the floor count directly. The vertical handle adds or removes whole floors. Each building keeps its floor height, and doors and windows keep their size as the façade is rebuilt. Other scalable props use percentages. Press Enter or leave a field to apply it. The arrow keys nudge by 1 m, or 5 m with Shift. `Q` and `T` rotate by 15°.

Drag **+ Tree** or **+ Building** onto campus ground, or select the item and click or tap the ground. For **+ Door**, target an exterior wall or the corresponding roof edge. The door stays on that wall when the building moves or resizes. Select it to adjust **Along wall (m)**. Press Esc once to cancel placement.

Select an object and press **Delete** or **Backspace** to remove it. Deleting a building also removes its attached doors. The pool and its portal are required for the underwater route.

Press **Ctrl+Z** to undo an editor change and **Ctrl+Shift+Z** to redo it. On macOS, use **Command** in place of **Ctrl**. The editor keeps the last 50 changes until the page reloads. Each drag, field edit, placement, or deletion counts as one change.

Edits apply to the current tour immediately and survive reloads in the same tab. **Export JSON** downloads `CAMPUS_MAP.json`. Replace the file at the repository root with that download to share the layout or use it in a new browser session. Building details such as doors and windows move with their building. The swimming pool carries its ground opening, portal position, and checkpoint 4, and the portal can also be selected and adjusted separately.

## Blueprint and graphics

`CAMPUS_MAP.json` records the footprints, façade palette, walkways, checkpoint poses and photo references. Coordinates are schematic estimates from the supplied walkthrough. The main gate is on the positive Z side of the campus and the pool is on the negative Z side. Campus eye height is 1.7 metres on land. The central lawn includes a marked court based on the ground photos.

The zone modules assemble exterior models from grouped meshes. Repeated static parts are instanced, and the building footprints, gate leaves, pillars and walls contribute to the XZ collision rectangles. The pool surface uses the sum of a sine wave and a cosine wave. The reef kelp uses a travelling sine wave with fixed roots. Fish follow circular orbits, face the orbit tangent, and swing their tails around articulated pivots. The ocean interpolates fog and light by depth, with a navigable range from 0 to 120 metres.

## Project handoff

To give any AI assistant the project background, ask it to read [AGENTS.md](AGENTS.md) and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before editing. The context includes the file map, scene rules, and browser smoke checklist. See [CHANGELOG.md](CHANGELOG.md) for completed changes and verification.
