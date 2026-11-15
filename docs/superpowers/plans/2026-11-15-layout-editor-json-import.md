# Layout Editor JSON Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JSON import feature to the campus layout editor allowing users to load layout configurations by selecting an exported `CAMPUS_MAP.json` file or pasting JSON directly into a text area.

**Architecture:** A new modal `<dialog id="editor-import-dialog">` in `index.html` provides a file input button, a JSON text area (with drag-and-drop file support and Ctrl+Enter submission), validation feedback, and Apply/Cancel actions. When applied, `campusLayout.js` validates the JSON structure and writes it to browser storage under the active layout key, then the page reloads into `?editor=1`, where `mainCampus.js` auto-opens the layout editor with full scene fidelity.

**Tech Stack:** Native HTML5 (`<dialog>`, `<textarea>`, `<input type="file">`), CSS3, ES6 modules, Three.js 0.170.0, Node.js test runner (`node:test`).

**Spec:** [docs/superpowers/specs/2026-11-15-layout-editor-json-import-design.md](file:///e:/2/Desktop/Projects/01-Active/Stamford-3D/docs/superpowers/specs/2026-11-15-layout-editor-json-import-design.md)

## Global Constraints

- Keep both scenes runnable from repository root with a static HTTP server using ES modules and Three.js 0.170.0.
- Use standard `THREE.WebGLRenderer` (no WebGPU or TSL node shaders).
- Modern Three.js syntax (`SRGBColorSpace`, `three/addons/...`).
- Vanilla HTML5 + ES6 modules + CSS (no React or UI frameworks).
- All changes must pass `node --check` syntax checks and Vite production build (`npm run build`).

## Review Focus

1. **Malformed JSON in text area**: User enters invalid JSON syntax (e.g. missing brackets, trailing comma); expected behavior is an inline error message in `#editor-import-feedback` without page reload or throwing unhandled errors.
2. **Invalid map schema**: Valid JSON is provided, but it is an arbitrary JSON object (e.g. `{ "hello": "world" }`) without required campus/boundary structure; expected behavior is rejection with an informative validation error message.
3. **Empty or whitespace-only input**: User clicks Apply with an empty text area; expected behavior is prompting that JSON content is required.
4. **Local file selection & drag-and-drop**: User chooses or drops a `.json` file; expected behavior is loading the file text into the text area immediately and clearing any prior error message.
5. **Storage persistence & auto-reopen**: Valid layout is applied; expected behavior is writing to `localStorage` and `sessionStorage` under the active layout key and reloading with `?editor=1` so the layout editor opens automatically with the imported map.

---

### Task 1: Layout Validation and Persistence Functions

**Files:**
- Create: `tests/campusLayout.test.js`
- Modify: `src/campusLayout.js`

**Interfaces:**
- Produces:
  - `validateCampusLayout(data: unknown): { valid: boolean, error?: string, map?: object }`
  - `layoutKey(source: string): string`
  - `readCampusLayout(source: string): { map: object, save(): void, saveLayout(newMap: object): void }`

- [ ] **Step 1: Write the failing unit tests for layout validation and persistence**

Create `tests/campusLayout.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampusLayout, layoutKey } from '../src/campusLayout.js';

test('validateCampusLayout rejects non-object inputs', () => {
  assert.equal(validateCampusLayout(null).valid, false);
  assert.equal(validateCampusLayout('string').valid, false);
  assert.equal(validateCampusLayout([]).valid, false);
});

test('validateCampusLayout rejects objects missing boundary', () => {
  const result = validateCampusLayout({ campus: 'Test' });
  assert.equal(result.valid, false);
  assert.match(result.error, /boundary/i);
});

test('validateCampusLayout rejects invalid boundaries', () => {
  const badPoints = validateCampusLayout({ boundary: { points: [[0, 0], [1, 1]] } });
  assert.equal(badPoints.valid, false);
  assert.match(badPoints.error, /points/i);

  const missingExtents = validateCampusLayout({ boundary: { minX: 0 } });
  assert.equal(missingExtents.valid, false);
  assert.match(missingExtents.error, /boundary extent/i);
});

test('validateCampusLayout accepts valid boundary with rectangular extents or polygon points', () => {
  const rect = validateCampusLayout({
    boundary: { minX: -50, maxX: 50, minZ: -80, maxZ: 30 }
  });
  assert.equal(rect.valid, true);

  const poly = validateCampusLayout({
    boundary: { points: [[0, 0], [10, 0], [10, 10], [0, 10]] }
  });
  assert.equal(poly.valid, true);
});

test('layoutKey generates consistent hash key', () => {
  const key1 = layoutKey('test-source');
  const key2 = layoutKey('test-source');
  assert.equal(key1, key2);
  assert.match(key1, /^stamford-layout-v1-\d+$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/campusLayout.test.js`
Expected: FAIL with "validateCampusLayout is not a function"

- [ ] **Step 3: Implement `validateCampusLayout`, `layoutKey`, and `saveLayout` in `src/campusLayout.js`**

Implement `layoutKey(source)` and `validateCampusLayout(data)` in `src/campusLayout.js`, and update `readCampusLayout(source)` to expose `saveLayout(newMap)`:
```javascript
export function layoutKey(source) {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `stamford-layout-v1-${hash >>> 0}`;
}

export function validateCampusLayout(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Layout data must be a JSON object.' };
  }
  const { boundary } = data;
  if (!boundary || typeof boundary !== 'object') {
    return { valid: false, error: 'Layout is missing a valid "boundary" object.' };
  }
  if (Array.isArray(boundary.points)) {
    if (boundary.points.length < 3 || !boundary.points.every((pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))) {
      return { valid: false, error: 'Boundary points must contain at least 3 valid [x, z] coordinates.' };
    }
  } else {
    const hasBounds = ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(boundary[k]));
    if (!hasBounds) {
      return { valid: false, error: 'Boundary must include minX, maxX, minZ, maxZ or polygon points.' };
    }
  }
  return { valid: true, map: data };
}
```
In `readCampusLayout(source)`:
Use `layoutKey(source)`, and return `{ map, save, saveLayout(newMap) }` where `saveLayout(newMap)` writes `JSON.stringify(newMap)` to `localStorage` and `sessionStorage` under `key`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/campusLayout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/campusLayout.js tests/campusLayout.test.js
git commit -m "feat: add campus layout validation and layoutKey helper"
```

---

### Task 2: HTML UI and Styling for Import Modal Dialog

**Files:**
- Modify: `index.html:158-192`
- Modify: `styles.css:760-775`

**Interfaces:**
- Consumes: Dialog and button styles in `styles.css`
- Produces:
  - Button `#editor-import-json` inside `.editor-save`
  - Dialog `#editor-import-dialog` with form elements:
    - `#editor-import-file` (hidden file input)
    - `#editor-import-browse` (button to open file dialog)
    - `#editor-import-filename` (label displaying chosen file)
    - `#editor-import-text` (textarea for JSON input)
    - `#editor-import-feedback` (error display element)
    - `#editor-import-apply` (submit button)
    - `#editor-import-cancel` (cancel button)

- [ ] **Step 1: Add Import JSON button and `#editor-import-dialog` in `index.html`**

In `index.html`:
Add `<button type="button" id="editor-import-json">Import JSON</button>` into `.editor-save`.
Add `<dialog id="editor-import-dialog" class="editor-confirm" aria-labelledby="editor-import-title">` right next to `#editor-confirm`:
```html
    <dialog id="editor-import-dialog" class="editor-confirm editor-import-dialog" aria-labelledby="editor-import-title">
      <form method="dialog" id="editor-import-form">
        <h2 id="editor-import-title">Import campus layout</h2>
        <p class="editor-import-desc">Choose an exported <code>CAMPUS_MAP.json</code> file or paste JSON code below:</p>
        <div class="editor-import-file-row">
          <input type="file" id="editor-import-file" accept=".json,application/json" hidden>
          <button type="button" id="editor-import-browse">Choose JSON file…</button>
          <span id="editor-import-filename" class="editor-import-filename">No file selected</span>
        </div>
        <textarea id="editor-import-text" class="editor-import-text" rows="7" placeholder="Paste CAMPUS_MAP.json content here..."></textarea>
        <div id="editor-import-feedback" class="editor-feedback editor-import-error" role="status" hidden></div>
        <div class="editor-actions">
          <button type="button" id="editor-import-cancel">Cancel</button>
          <button type="button" id="editor-import-apply" class="editor-export">Apply layout</button>
        </div>
      </form>
    </dialog>
```

- [ ] **Step 2: Add CSS rules for the import dialog in `styles.css`**

Add styling to `styles.css`:
```css
.editor-import-dialog {
  width: min(440px, calc(100% - 32px));
}
.editor-import-desc {
  margin: 6px 0 10px;
  color: var(--muted);
  font-size: 12px;
}
.editor-import-desc code {
  color: var(--accent);
}
.editor-import-file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.editor-import-filename {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-import-text {
  width: 100%;
  box-sizing: border-box;
  background: #0b192e;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--fg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  padding: 8px;
  resize: vertical;
  min-height: 110px;
  max-height: 240px;
}
.editor-import-text:focus {
  outline: 1px solid var(--accent);
  border-color: var(--accent);
}
.editor-import-error {
  margin-top: 8px;
  color: #ffc1b9;
  background: #3b141188;
  border: 1px solid #ffc1b944;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
}
```
Update line 544 in `styles.css` to allow `#editor-import-dialog`:
`[data-editor="true"] .hud > :not(.layout-editor, .editor-deck, .editor-confirm, .editor-import-dialog) { display: none; }`

- [ ] **Step 3: Verify syntax and build**

Run: `node --check src/mainCampus.js` and `npm run build`
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: add import JSON modal dialog markup and styles"
```

---

### Task 3: Editor Import Controller Wiring and Main Campus Auto-Open

**Files:**
- Modify: `src/campusEditor.js`
- Modify: `src/mainCampus.js`

**Interfaces:**
- Consumes:
  - `validateCampusLayout` from `./campusLayout.js`
  - `onImportLayout` callback passed to `createCampusEditor` (or directly via `kit.saveLayout`)
- Produces:
  - Wired event handlers for:
    - `#editor-import-json` click (opens dialog, clears previous error and text)
    - `#editor-import-browse` click (triggers `#editor-import-file` click)
    - `#editor-import-file` change (reads `file.text()`, fills textarea, updates filename)
    - Drag & drop on `#editor-import-text` (reads dropped file text, fills textarea)
    - `#editor-import-apply` click and `Ctrl+Enter` / `Cmd+Enter` (validates, calls import callback, reloads with `?editor=1`)
    - `#editor-import-cancel` click and Escape (closes dialog)
  - `mainCampus.js` query string check: auto-opens editor when `?editor=1` or `editor` is present in URL.

- [ ] **Step 1: Write integration test for import controller logic**

Create `tests/campusImport.test.js`:
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampusLayout } from '../src/campusLayout.js';

test('import parser handles valid CAMPUS_MAP.json string', () => {
  const jsonString = JSON.stringify({
    campus: 'Stamford University Bangladesh',
    boundary: { minX: -48, maxX: 50, minZ: -86, maxZ: 32 }
  });
  const parsed = JSON.parse(jsonString);
  const result = validateCampusLayout(parsed);
  assert.equal(result.valid, true);
  assert.equal(result.map.campus, 'Stamford University Bangladesh');
});

test('import parser catches JSON syntax error', () => {
  assert.throws(() => {
    JSON.parse('{ invalid json }');
  }, /SyntaxError/);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/campusImport.test.js`
Expected: PASS

- [ ] **Step 3: Wire import events in `src/campusEditor.js`**

In `src/campusEditor.js`:
Accept an optional `onImport` callback or attach to `kit.saveLayout(map)`:
Connect all dialog buttons:
- `#editor-import-json`: opens `#editor-import-dialog`.
- `#editor-import-browse` / `#editor-import-file`: loads chosen file text.
- Drag & drop on `#editor-import-text`: handles `dragover` (preventDefault) and `drop` (reads `dataTransfer.files[0]`).
- `#editor-import-apply`:
  1. Trim textarea text. If empty, display error "Please paste JSON or choose a layout file."
  2. Parse with `try { JSON.parse(text) } catch (e) { display error "Invalid JSON: " + e.message }`.
  3. Validate with `validateCampusLayout(parsed)`. If invalid, display `result.error`.
  4. If valid, call `onImport(parsed)`.
- In `onImport(parsed)`: save to storage via `saveLayout(parsed)`, update URL with `?editor=1`, and reload (`window.location.href = ...`).

- [ ] **Step 4: Update `src/mainCampus.js` to support auto-opening editor**

In `src/mainCampus.js`:
Pass `saveLayout` (and new `save`) to `createCampusEditor`.
After `runtime.ready(...)`, check:
```javascript
  if (new URLSearchParams(location.search).has('editor')) {
    editor.toggle();
  }
```

- [ ] **Step 5: Run tests and verify syntax**

Run:
```powershell
Get-ChildItem src -Filter *.js | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed in $($_.Name)" }
}
node --test tests/*.test.js
npm run build
```
Expected: All tests pass, 0 syntax errors, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/campusEditor.js src/mainCampus.js tests/campusImport.test.js
git commit -m "feat: wire layout import controller and URL auto-open parameter"
```

---

### Task 4: Documentation and Smoke Verification

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `PROJECT_CONTEXT.md`

**Interfaces:**
- Updates documentation to reflect the new **Import JSON** button and dialog.

- [ ] **Step 1: Update README.md and PROJECT_CONTEXT.md**

Update layout editor instructions in `README.md` and `PROJECT_CONTEXT.md` to document:
- Export JSON, Copy JSON, and Import JSON.
- Mention importing via file selection (`CAMPUS_MAP.json`) or pasting JSON directly into the editor dialog.

- [ ] **Step 2: Update CHANGELOG.md**

Record the newly added feature under `## Unreleased` -> `### Added`:
- Added **Import JSON** dialog to the campus layout editor supporting both file selection and direct JSON pasting with validation and automatic editor re-entry.

- [ ] **Step 3: Verification check**

Run:
```powershell
node --test tests/*.test.js
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
python -m json.tool CAMPUS_MAP.json > $null
npm run build
```
Expected: All commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md PROJECT_CONTEXT.md
git commit -m "docs: document layout editor JSON import feature"
```
