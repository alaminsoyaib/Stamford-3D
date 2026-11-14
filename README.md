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

Select **Enter campus** or **Begin descent** to switch from the illustrated landing screen to the live 3D view. Pause on campus to access the checkpoint buttons, **Layout editor**, and **Deep sea**. Underwater, **Campus** is available before starting or while paused. The keyboard shortcuts below also work during exploration.

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
| P | Switch directly between campus and deep sea (preserves roaming or landing view) |
| E | Open or exit the campus layout editor |
| Space | Ascend in the ocean |
| Shift or C | Descend in the ocean |

At checkpoint 4, walk forward down the pool steps to cross the portal by proximity. The vertical return ring sits at `(8, -2, -3.3)` in the ocean and brings you back to the pool deck. After an automatic arrival, drag to look. On desktop, pause and resume to re-enable pointer lock. Touch devices can use on-screen movement controls.

## Edit the campus layout

Press **E** or select **Layout editor** to open the overhead view. Click a building or prop to select it, or choose it from the **Object** list. Drag an object directly to move it. Drag empty space to pan, scroll or pinch to zoom, and right-drag to orbit. **Snap to grid** controls placement and dragging. **Frame selection** centers the selected object and **Tilt view** exposes the vertical scale handle.

1. Select **Clear to deck** to start with an empty grid. The placement deck holds the existing buildings, trees, paths, and equipment. Use **Find stored objects** to filter the cards.
2. Open **Land boundary** to drag or add corners. Choose **Draw new** to click through the outline from scratch, then select **Apply boundary**. You can also enter coordinates for a selected corner. Store the pool first if the new boundary crosses it.
3. Drag cards onto the grid, or click a card and then click or tap its new location. Drag placed objects onto the deck, press **Delete** or **Backspace**, or select **Store** to put them away again.
4. Select a building or prop and choose **Duplicate** or press **Ctrl+D**, then choose where to place the copy. It starts with the selected object's dimensions and model. Use **Delete** on a deck card and confirm to remove that object from the saved layout.

Choose **Move** (`G`), **Rotate** (`R`), or **Scale** (`S`), then drag the colored handles. For buildings, enter width and depth in metres or set the floor count directly. The vertical handle adds or removes whole floors. Each building keeps its floor height, and doors and windows keep their size as the façade is rebuilt. Other scalable props use percentages. Press Enter or leave a field to apply it. The arrow keys nudge by 1 m, or 5 m with Shift. `Q` and `T` rotate by 15°.

Drag **+ Tree** or **+ Building** onto campus ground, or select the item and click or tap the ground. For **+ Door**, target an exterior wall or the corresponding roof edge. The door stays on that wall when the building moves or resizes. Select it to adjust **Along wall (m)**. Press Esc once to cancel placement.

Stored buildings carry their attached doors. An individually stored door can be placed again once its building is on the map. The swimming pool can be stored and placed with its portal. Place it to use checkpoint **4** or the physical portal.

Use **Undo** and **Redo**, or press **Ctrl+Z** and **Ctrl+Shift+Z**. On macOS, use **Command** in place of **Ctrl**. The editor keeps the last 50 changes until the page reloads. Clearing the map and applying a boundary each count as one change.

Edits apply to the current tour and save in this browser. **Export JSON** downloads `CAMPUS_MAP.json` with the current placements, outline, and deck. Replace the file at the repository root with that download to share the layout. Building model changes in the zone modules appear at the saved positions when the page reloads. Copies of campus buildings use the same model, with their own positions and dimensions.

## Blueprint and graphics

`CAMPUS_MAP.json` records the footprints, façade palette, walkways, checkpoint poses and photo references. Coordinates are schematic estimates from the supplied walkthrough. The main gate is on the positive Z side of the campus and the pool is on the negative Z side. Campus eye height is 1.7 metres on land. The central lawn includes a marked court based on the ground photos.

The zone modules assemble exterior models from grouped meshes. Repeated static parts are instanced, and the building footprints, gate leaves, pillars and walls contribute to the XZ collision rectangles. The pool surface uses the sum of a sine wave and a cosine wave. The reef kelp uses a travelling sine wave with fixed roots. Fish follow circular orbits, face the orbit tangent, and swing their tails around articulated pivots. The ocean interpolates fog and light by depth, with a navigable range from 0 to 120 metres.

## Project handoff

To give any AI assistant the project background, ask it to read [AGENTS.md](AGENTS.md) and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before editing. The context includes the file map, scene rules, and browser smoke checklist. See [CHANGELOG.md](CHANGELOG.md) for completed changes and verification.
