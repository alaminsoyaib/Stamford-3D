# Repository guide for coding assistants

Start with the [README](README.md) for the launch command and demo controls, then read [Project Context](PROJECT_CONTEXT.md) for the scene architecture and browser checklist. Consult the [changelog](CHANGELOG.md) for completed work. Use `git status --short` to identify local work before editing, and preserve changes already in progress.

## Project guardrails

- Keep both scenes runnable from the repository root with a static HTTP server. The HTML pages load Three.js through matching import maps and use browser-native ES modules.
- Use `CAMPUS_MAP.json` for shared campus geometry and navigation data. When editing layout, check the rendered scene, collision bounds, minimap, and checkpoint views together.
- Preserve exterior-only exploration, the 1.7 m land eye height, both portal routes, and the four demo checkpoints. Keep the documented graphics equations readable in source.
- For input and HUD changes, check both pointer lock and the touch or drag fallback. Keep controls, visible labels, and the README in sync.
- Keep repository notes in plain Markdown with relative links. Put lasting architectural decisions in Project Context and record completed behavior changes with their verification in the changelog. Keep implementation details anchored to the source files.

## Three.js rules and guidelines

- Always read the relevant `SKILL.md` inside `.agents/skills/` before writing Three.js code.
- Use standard `THREE.WebGLRenderer` (do NOT use `WebGPURenderer` or TSL node shaders).
- Use modern Three.js (r170–r186+) syntax:
  - Use `renderer.outputColorSpace = THREE.SRGBColorSpace` and `texture.colorSpace = THREE.SRGBColorSpace` (never use deprecated `outputEncoding`).
  - Import addons from `three/addons/...` (never use `three/examples/jsm/...`).
  - Use `THREE.InstancedMesh` for repeating campus windows, pillars, trees, and schooling fish to keep performance at 60 FPS.
- Ignore any unrelated UI/React/Figma plugins; this project is pure vanilla HTML5 + ES6 modules + Three.js.
