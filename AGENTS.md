# Repository guide for coding assistants

Start with the [README](README.md) for the launch command and demo controls, then read [Project Context](PROJECT_CONTEXT.md) for the scene architecture and browser checklist. Consult the [changelog](CHANGELOG.md) for completed work. Use `git status --short` to identify local work before editing, and preserve changes already in progress.

## Project guardrails

- Keep both scenes runnable from the repository root with a static HTTP server. The HTML pages load Three.js through matching import maps and use browser-native ES modules.
- Use `CAMPUS_MAP.json` for shared campus geometry and navigation data. When editing layout, check the rendered scene, collision bounds, minimap, and checkpoint views together.
- Preserve exterior-only exploration, the 1.7 m land eye height, both portal routes, and the four demo checkpoints. Keep the documented graphics equations readable in source.
- For input and HUD changes, check both pointer lock and the touch or drag fallback. Keep controls, visible labels, and the README in sync.
- Keep repository notes in plain Markdown with relative links. Put lasting architectural decisions in Project Context and record completed behavior changes with their verification in the changelog. Keep implementation details anchored to the source files.
