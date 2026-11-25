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
| WASD or arrow keys | Fly or swim horizontally on campus and in deep sea |
| Shift + WASD or arrow keys | Sprint / boost speed on campus and in deep sea |
| Shift + Q / E | Strafe left / right at boosted speed on campus |
| Mouse look | Look after selecting **Enter campus** or **Begin descent** (clicking canvas engages pointer lock) |
| ↑ / Left-click | Ascend altitude on campus drone and in deep sea |
| ↓ / Right-click | Descend altitude on campus drone and in deep sea |
| Esc | Release the pointer and pause (press again while paused to return to start page) |
| X | Exit exploration and return to the start page |
| 1 | Main gate and front garden |
| 2 | CSE, Admission Wing, bus and the library route |
| 3 | Central ground, Academic Building and canteen |
| 4 | Pool edge facing the submerged ring |
| N | Toggle daylight and night |
| R | Toggle rain and wet paving |
| V | Cycle Summer, Autumn and Winter Fog |
| P | Switch directly between campus and deep sea (preserves roaming or landing view) |
| E | Open or exit the campus layout editor |
| M | Toggle drone sound mute and unmute |

At checkpoint 4, fly forward into the pool steps to dive into underwater drone mode or cross the portal by proximity. The vertical return ring sits at `(8, -2, -3.3)` in the ocean and brings you back to the pool deck. After an automatic arrival, click to engage pointer lock and look around. Touch devices can use on-screen movement controls.

The application operates permanently in drone flight mode—there is no walking mode or mode switching. Use **WASD** (or **←** / **→** and **Shift + Q / E**) to fly or swim, **↑** or **Left-click** to climb, **↓** or **Right-click** to descend (between **1.7 m and 80 m** on land), and hold **Shift** to boost speed. Drones collide with building walls, roofs, overhangs, gate headers, pool stairs, and campus fixtures, and can fly freely over perimeter walls once above wall height up to the outer campus boundary. When descending into water (either the campus swimming pool down to `-2.55 m` — colliding solidly with pool walls, steps, and ladder — or the deep ocean with rock/seafloor collision), the vehicle transitions into an **underwater drone** with muffled hydrophone resonance, deep sub-water thruster frequencies, and 3D swimming mobility. Releasing the altitude keys or mouse buttons holds that level. Press **M** or select **Sound** while paused to mute or unmute the drone audio. Touch controls include **Rise**, **Sink**, and **Boost**.

For development screenshots, the exploration HUD shows the camera’s **X**, **Y**, and **Z** in world metres near the upper right. The readout stays visible on pause and updates as you walk, fly, swim, or jump to a checkpoint. It is available with the local static server and Vite development server, and hidden in the Vite production build.

## Edit the campus layout

Press **E** or select **Layout editor** to open the overhead view. Click a building or prop to select it, or choose it from the **Object** list. Drag an object directly to move it (dragging past the perimeter clamps cleanly inside the land boundary rather than snapping back). Drag empty space to pan, scroll or pinch to zoom, and right-drag to orbit. **Snap to grid** controls placement and dragging. **Frame selection** centers the selected object and **Tilt view** exposes the vertical scale handle.

1. Select **Clear to deck** to start with an empty grid. The full-width tray shows previews of stored buildings, trees, paths, and equipment. Scroll or swipe along the tray, or use **Find stored objects** to filter it.
2. To use the AutoCAD survey outline with a saved layout, open **Land boundary**, select **Preview survey outline**, then select **Apply boundary**. The preview fits the shape to the placed gate and checks the pool and building footprints. **Load empty Stamford campus** uses the default survey outline and moves placed pieces into the deck in one undoable step. To draw your own outline, drag or add corners, enter their coordinates, or select **Draw new**. Store or move the pool if the draft crosses it.
3. The preset and any applied custom outline get automatic perimeter walls. Drag a card onto the grid with a mouse or by pulling upward on touch. The footprint shows where it will land. You can also select a card and then click or tap a spot. Drag placed objects onto the deck, press **Delete** or **Backspace**, or select **Store** to put them away again.
4. Select a building or prop and choose **Duplicate** or press **Ctrl+D**, then choose where to place the copy. It starts with the selected object's dimensions and model. Edit the **Component name** field in the inspector to rename any selected building, facility, tree, or door. You can also rename items stored on the placement deck by selecting the pencil icon (**✎**) on a deck card or double-clicking its caption. Use the **×** on a deck card and confirm to remove that object from the saved layout.

Choose **Move** (`G`), **Rotate** (`R`), or **Scale** (`S`), then drag the colored handles. For buildings, enter width and depth in metres or set the floor count directly. The vertical handle adds or removes whole floors. Each building keeps its floor height, and doors and windows keep their size as the façade is rebuilt. Other scalable props use percentages. Press Enter or leave a field to apply it. The arrow keys nudge by 1 m, or 5 m with Shift. `Q` and `T` rotate by 15°.

The Official Building and Academic wing form one building in the layout editor. The rear strip of the Academic wing is one floor high, the adjacent frontage is two floors, and the adjoining end reaches the Official Building’s third floor. Two exterior stair flights connect the ground, the lower roof, and the upper level. The two walls facing the lower roof are solid plaster. Width and depth refer to the main block, and the floor count shows the tallest section.

In **Land boundary**, enter a percentage and select **Scale outline**, then **Apply boundary**. For example, 150% increases each dimension by half around the outline’s center. Buildings and other pieces stay where you placed them.

Matching stored pieces share a card with a quantity badge. Dragging a card out or deleting from it acts on one piece at a time.

Drag **+ Tree** or **+ Building** onto campus ground, or select the item and click or tap the ground. For **+ Door**, target an exterior wall or the corresponding roof edge. The door stays on that wall when the building moves or resizes. Select it to adjust **Along wall (m)**. Press Esc once to cancel placement.

Stored buildings carry their attached doors. An individually stored door can be placed again once its building is on the map. The swimming pool can be stored and placed with its portal. Place it to use checkpoint **4** or the physical portal.

Use **Undo** and **Redo**, or press **Ctrl+Z** and **Ctrl+Shift+Z**. On macOS, use **Command** in place of **Ctrl**. The editor keeps the last 50 changes until the page reloads. Clearing the map and applying a boundary each count as one change.

Edits apply to the current tour and save in this browser. **Export JSON** downloads `CAMPUS_MAP.json` with the current placements, outline, and deck, while **Copy JSON** copies the map to your clipboard. Select **Import JSON** to load a layout by pointing to a saved `CAMPUS_MAP.json` file or pasting JSON code directly into the text box and applying it (or pressing `Ctrl+Enter`). Replace the file at the repository root with that download to share the layout. Building model changes in the zone modules appear at the saved positions when the page reloads. Copies of campus buildings use the same model, with their own positions and dimensions.

## Blueprint and graphics

`CAMPUS_MAP.json` records the footprints, façade palette, walkways, checkpoint poses and photo references. The default perimeter, CSE, Civil, Official, front garden, and 47 tree markers follow the AutoCAD survey image at the same scene scale. The garden mesh and minimap share the traced outer curb. The drawing labels CSE as A Academic, Civil as B Academic, and Official as A Admin. Layouts with custom placements stay available in browser saves. To load the full surveyed arrangement, import the repository's default `CAMPUS_MAP.json` in the editor. Campus eye height is 1.7 metres on land.

The zone modules assemble exterior models from grouped meshes. Repeated static parts are instanced, and the building footprints, gate leaves, pillars and walls contribute to the XZ collision rectangles. The pool surface uses the sum of a sine wave and a cosine wave. The reef kelp uses a travelling sine wave with fixed roots. Fish follow circular orbits, face the orbit tangent, and swing their tails around articulated pivots. The ocean interpolates fog and light by depth, with a navigable range from 0 to 120 metres.

## Project handoff

To give any AI assistant the project background, ask it to read [AGENTS.md](AGENTS.md) and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before editing. The context includes the file map, scene rules, and browser smoke checklist. See [CHANGELOG.md](CHANGELOG.md) for completed changes and verification.
