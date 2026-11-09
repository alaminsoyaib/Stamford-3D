# Changelog

Record completed changes here, with verification when it helps a future handoff. Keep launch instructions in the [README](README.md) and architectural details in [Project Context](PROJECT_CONTEXT.md).

## Unreleased

### Added

- Built the first-person campus tour from the numbered photo walkthrough, with exterior collisions, four checkpoints, a minimap, and weather controls.
- Built the two-way pool portal and the three-layer procedural ocean, with a depth meter and swimming from the surface to 120 m.
- Added portable contributor and AI handoff notes, a browser smoke checklist, and Git ignore rules for local and generated files.

### Verification

- The initial implementation passed Chrome checks for pointer lock and mouse look, checkpoint and weather hotkeys, building and perimeter collisions, both physical portal crossings, the `P` shortcut, the full depth range, and emulated touch drag and movement.
