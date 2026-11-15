# Layout Editor JSON Import Design

## Intent & Why
Currently, the campus layout editor provides **Export JSON** (downloading `CAMPUS_MAP.json`) and **Copy JSON** (copying the layout JSON to clipboard), but lacks a way to import JSON back into the editor. Adding an import feature allows users to load exported layouts, paste modified map JSON directly into a text area, or select a `CAMPUS_MAP.json` file from their local file system to test and apply changes immediately.

## Scope & User Experience
This is a small, focused feature adding an import dialog to the layout editor.

1. **Editor UI Trigger**:
   - In `index.html` within `<div class="editor-actions editor-save">`, add `<button type="button" id="editor-import-json">Import JSON</button>`.
   - Clicking this opens `<dialog id="editor-import-dialog" class="editor-confirm">`.

2. **Dialog Structure & Controls**:
   - Title: "Import campus layout"
   - Instruction / Subtitle: "Choose an exported CAMPUS_MAP.json file or paste layout JSON below:"
   - File Picker: `<input type="file" id="editor-import-file" accept=".json,application/json" hidden>` and `<button type="button" id="editor-import-browse">Choose JSON file…</button>` with a small label indicating the selected filename.
   - Text Area: `<textarea id="editor-import-text" rows="8" placeholder="Paste CAMPUS_MAP.json text here..."></textarea>`.
   - Drag & Drop: Dragging and dropping a `.json` file onto the textarea loads its text directly into the textarea.
   - Feedback message: `<p id="editor-import-feedback" class="editor-feedback" hidden></p>` to display schema/syntax validation errors.
   - Dialog Actions:
     - `<button type="button" id="editor-import-apply" class="editor-export">Apply layout</button>`
     - `<button type="button" id="editor-import-cancel">Cancel</button>`
   - Keyboard: Pressing `Ctrl+Enter` (or `Cmd+Enter`) in the textarea triggers "Apply layout". Pressing `Escape` cancels and closes the dialog.

3. **Validation**:
   - Parses the JSON string safely.
   - Verifies the parsed data is an object containing expected campus layout properties:
     - Must contain a valid `boundary` object with either `minX`, `maxX`, `minZ`, `maxZ` or `points`.
     - Must contain either `campus`, `elements`, `buildings`, or `stops`.
   - If invalid or malformed JSON, shows a clear error message in `#editor-import-feedback` and keeps the dialog open.

4. **Persistence & Scene Refresh**:
   - On valid import, writes the parsed map into both `localStorage` and `sessionStorage` under the active layout key (`stamford-layout-v1-<hash>`).
   - Sets a URL query parameter `?editor=1` and reloads the page (`window.location.href = ...` or `window.location.search = '?editor=1'`).
   - On campus page boot, `mainCampus.js` inspects `new URLSearchParams(location.search).has('editor')` and automatically invokes `editor.toggle()`, immediately presenting the updated 3D scene inside the layout editor.

5. **Approaches Considered**:
   - *Clipboard-only reading (`navigator.clipboard.readText()`)*: Rejected as sole mechanism because modern browser security often denies unprompted clipboard read access, and users explicitly requested the ability to choose an exported file or paste code.
   - *In-memory live scene mutation without reload*: Rejected because `mainCampus.js` compiles static instanced batches, colliders, terrain opening clipping shaders, and perimeter walls during initialization. Reloading with storage persistence ensures 100% fidelity without memory leaks or desynchronized state.
