# Stamford Campus Atlas

Explore the exterior of Stamford University Bangladesh in first person, then follow the portal below its swimming pool into a three-layer ocean.

## Run locally

From the repository root, start a static HTTP server.

```powershell
python -m http.server 8090 --bind 127.0.0.1
```

Open [the campus](http://127.0.0.1:8090/) in a WebGL 2 browser. Both pages import Three.js 0.170.0 from jsDelivr, so the browser needs an internet connection for the modules. The project has no build or package installation step.

## Live demo controls

| Key | Action |
| --- | --- |
| WASD or arrow keys | Walk or swim horizontally |
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
| Space | Ascend in the ocean |
| Shift or C | Descend in the ocean |

At checkpoint 4, walk forward down the pool steps to cross the portal by proximity. The vertical return ring sits at `(8, -2, -3.3)` in the ocean and brings you back to the pool deck. Touch devices can drag to look and use on-screen movement controls.

## Blueprint and graphics

`CAMPUS_MAP.json` records the footprints, façade palette, walkways, checkpoint poses and photo references. Coordinates are schematic estimates from the supplied walkthrough. The main gate is on the positive Z side of the campus and the pool is on the negative Z side. Campus eye height is 1.7 metres on land. The central lawn includes a marked court based on the ground photos.

The zone modules assemble exterior models from grouped meshes. Repeated static parts are instanced, and the building footprints, gate leaves, pillars and walls contribute to the XZ collision rectangles. The pool surface uses the sum of a sine wave and a cosine wave. The reef kelp uses a travelling sine wave with fixed roots. Fish follow circular orbits, face the orbit tangent, and swing their tails around articulated pivots. The ocean interpolates fog and light by depth, with a navigable range from 0 to 120 metres.

## Project handoff

To give any AI assistant the project background, ask it to read [AGENTS.md](AGENTS.md) and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) before editing. The context includes the file map, scene rules, and browser smoke checklist. See [CHANGELOG.md](CHANGELOG.md) for completed changes and verification.
