# Design: Layout Editor Placement Deck Categorization & Boundary Wall Slicing

## Intent & The Why

In the campus layout editor, managing campus assets and the perimeter boundary needs greater clarity and flexibility:
1. **Placement Deck Organization**: Stored campus assets (buildings, trees, props, facilities, doors) are currently flattened into an unstructured horizontal list. Users need clear categories (Buildings, Trees, Facilities, Doors, and All) with the editor defaulting to categorical browsing.
2. **Duplicate Stacking Precision**: When duplicating buildings, multiple copies were previously grouped together even after their dimensions or floor counts were changed. Only strictly identical buildings should share a card with a quantity badge; modified or non-identical buildings must appear as separate entries.
3. **Boundary Wall Slicing & Openings**: The automatic perimeter wall encircles the entire campus boundary, but real-world campuses require specific openings (most critically at the main entry gate). Users need the ability to slice the boundary wall at arbitrary points and delete unwanted segments, creating openings for walking and visuals while preserving the rest of the perimeter wall.

---

## Goals, Non-Goals, and Anti-Goals

### Goals
- **Deck Categorization**:
  - Provide category tabs/pills above the placement deck: **Buildings**, **Trees & Greenery**, **Campus Facilities**, **Doors**, and **All**.
  - Default view is categorical (starts on **Buildings** or first non-empty category).
  - Search filtering respects the active category (or searches everything when in "All").
  - Each tab indicates stored item counts.
- **Strict Identical Duplicate Stacking**:
  - Buildings only stack together into one card with a quantity count (`×N`) if they share the exact same template/style, width, depth, and floor count.
  - Non-identical or resized buildings are displayed as distinct cards with their specific dimensions labeled.
- **Perimeter Wall Slicing & Segment Deletion**:
  - Add a **Slice wall** tool (`C`) in the editor toolbar.
  - Hovering over a perimeter wall displays a slice marker tracking the cursor along the wall line.
  - Clicking on a wall slices it into two independent segments at that point.
  - Sliced segments can be selected, highlighted in 3D, and deleted via the `Delete` key or inspector button.
  - Walking collision is automatically updated so players can walk through deleted wall sections (such as the main gate).
  - Full Undo / Redo support for wall slicing and deletion.
  - Sliced wall segments persist across sessions and export cleanly in `CAMPUS_MAP.json`.
  - A "Reset walls" option to restore continuous perimeter walls if desired.

### Non-Goals
- Freehand arbitrary spline curve wall building through the middle of the campus (the boundary perimeter wall is preserved and sliced at desired points).
- Altering the underlying terrain land boundary polygon `boundary.points` (the ground and grass stay intact; only the wall on top is sliced/opened).

### Anti-Goals
- Do not collapse buildings with different floor counts or dimensions into a single deck card.
- Do not leave invisible collision barriers at deleted wall openings.
- Do not break backward compatibility with existing layouts that do not specify custom wall segments.

---

## Constraints
- Vanilla HTML5 + ES6 modules + Three.js (r170). No external UI frameworks or npm packages.
- Must run directly with a static HTTP server (`python -m http.server 8090`).
- Use standard `THREE.WebGLRenderer` and standard Three.js materials/meshes.
- Preserve 60 FPS performance by keeping static meshes instanced or batched where appropriate.
- Both desktop (mouse/keyboard) and touch interactions must work cleanly.

---

## Approaches Considered

### Wall Modification Approaches
1. **Approach 1: Interactive 3D "Slice Wall" Tool (Selected)**
   - Hover and click directly on the 3D perimeter wall to cut it at exact points, then select and delete unwanted segments.
   - *Why selected*: Most intuitive, visual, and direct. Allows natural creation of the gate opening by making two cuts and pressing Delete on the middle segment.
2. **Approach 2: 2D Land Boundary Panel Edge Editing**
   - Configure openings by typing numbers or dragging 2D handles along the outline in the boundary panel.
   - *Why rejected*: Indirect and disconnected from the 3D scene view where the gate and surroundings are visible.

### Deck Categorization Approaches
1. **Approach 1: Segmented Pill/Tab Category Switcher (Selected)**
   - Clean category navigation bar atop the deck tray with count badges, defaulting to "Buildings", with "All" option available.
   - *Why selected*: Compact, fast, mobile-friendly, and directly matches the user's requirement: "normally it will be categorical, with an All category where everything will be grouped together".
2. **Approach 2: Multi-row Vertical Accordions**
   - Stacking sections vertically inside the deck tray.
   - *Why rejected*: Consumes too much vertical screen space on the layout editor viewport.

---

## Detailed Specifications & Architectural Decisions

### 1. Placement Deck Categorization & UI
- **Categories**:
  - `buildings`: All building structures (`entry.building` or `entry.spec.type === 'building'`).
  - `trees`: All trees and planting elements (`entry.spec.type === 'tree'`).
  - `facilities`: Ground surfaces, pool, bus, court, parking (`entry.id === 'pool'`, `'bus'`, `'garden'`, `'ground'`, etc.).
  - `doors`: Exterior doors attached to buildings (`entry.buildingId`).
  - `all`: All stored items combined.
- **UI Elements**:
  - Added in `index.html` above `#editor-deck-list`:
    `<nav class="editor-deck-categories" role="tablist">` containing category buttons with count badges.
  - Active category persisted in editor session state; defaults to `buildings` (or first category with items if `buildings` is empty).
- **Search Integration**:
  - When searching in `#editor-deck-search`, filtering applies within the active category, or across all categories if `all` is active.

### 2. Strict Identical Duplicate Stacking
- **Identity Key Formula**:
  - For buildings:
    `key = `building:${template}:${width}:${depth}:${floors}:${modelStyle}``
  - For trees:
    `key = `tree:${seed}:${scale}``
  - For props:
    `key = `prop:${template}:${scaleX}:${scaleY}:${scaleZ}``
  - For doors:
    `key = `door:${buildingId}:${wall}``
- **Deck Rendering**:
  - If multiple entries share the exact identity key, they are grouped into a single card with badge `×N`.
  - The card caption includes the building label and dimension info if there are variations in the layout (e.g. `CSE Building (20 × 12 m · 4 fl)`).
  - Clicking/dragging deploys one instance from the stack.

### 3. Perimeter Wall Initialization & Slicing
- **Initialization**:
  - For the default rectangular campus (without custom `boundary.points`), the existing 5 segments (`North`, `West`, `East`, `Street west`, `Street east`) are converted into standard `boundary.walls` segments so the gate opening remains open at startup.
  - When a custom boundary polygon (`boundary.points`) is loaded or applied, its segments initialize to the polygon edges.
- **Slice Interaction**:
  - Toolbar button `#editor-slice-wall` (shortcut `C`) activates Slice Wall mode.
  - In Slice Wall mode:
    - Raycasting against perimeter wall meshes projects onto the wall centerline `P = closestOnEdge(hit.x, hit.z, seg.a, seg.b)`.
    - A visible slice cursor (cyan vertical cut marker) shows the cut position and snaps to grid if snap is enabled.
    - Clicking on a wall segment `S` between `A` and `B` splits it into `[A, P]` and `[P, B]`.
    - The cut immediately selects the newly created segment under the cursor so the user can easily cut twice and hit `Delete`.
    - Pressing `Escape` or clicking any selection tool returns to standard mode.
- **Selection & Deletion**:
  - Wall segments are selectable in both Slice mode and standard Selection mode.
  - When a wall segment is selected:
    - The `TransformControls` gizmo is detached.
    - The segment is highlighted with a gold/cyan edge highlight.
    - The inspector displays: "Boundary wall segment (${length.toFixed(1)} m)" and a "Delete wall segment" button.
    - Pressing `Delete` or `Backspace` deletes the segment.
- **Player Collision & Walking Containment**:
  - Active wall segments in `boundary.walls` act as wall obstacles (capsule distance checks within `wallThickness/2 + playerRadius`).
  - At deleted segments (such as the main gate), no wall obstacle exists, allowing free passage.
  - Outside containment uses the campus bounds plus street margin (so the player can walk through the gate onto the street at Checkpoint 1, but cannot walk infinitely off into the void).
- **Undo / Redo & Reapplying Boundary**:
  - All wall slicing, deletion, and reset actions record undo entries.
  - When the user modifies and applies a new land outline in the "Land boundary" panel (`commitBoundary`), walls re-initialize to the new outline edges with an undo step recorded.
- **Reset Walls**:
  - A "Reset perimeter walls" button in the inspector / boundary panel restores all perimeter edges if needed.

---

## What's Left to the Builder
- CSS styling for category tabs and the slice cursor consistent with the existing Stamford-3D design system.
- Snapping radius (0.5 m) for corner and grid snapping during slice preview.
