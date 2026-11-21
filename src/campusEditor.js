import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { maxBuildingFloors, maxBuildingSpan } from './buildingFactory.js';
import { limitScale, rounded, validateCampusLayout } from './campusLayout.js';
import { campusGatePose, closestOnEdge, fitsLand, insideLand, landExtent, perimeterWalls } from './campusBoundary.js';
import { createDeckDrag } from './campusDeckDrag.js';
import { createDeckPreviews } from './campusDeckPreviews.js';
import { createLandEditor } from './campusLandEditor.js';
import { fitStamfordSurvey, stamfordLandOutline } from './campusLandPresets.js';
import { buildingOutline } from './campusFootprints.js';

const modes = { KeyG: 'translate', KeyR: 'rotate', KeyS: 'scale' };
const nudges = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['z', -1], ArrowDown: ['z', 1] };
const historyLimit = 50;
const placeTips = {
  tree: 'Click or tap the ground to plant a tree.',
  building: 'Click or tap the ground to place a building.',
  door: 'Click or drop near the edge of a building to attach a door to that wall.'
};

export function createCampusEditor(runtime, kit, onEdit, onToggle, onLayoutChange, onImportLayout) {
  const { renderer, scene } = runtime;
  const canvas = renderer.domElement;
  const panel = document.getElementById('layout-editor');
  const deck = document.getElementById('editor-deck');
  const deckList = document.getElementById('editor-deck-list');
  const deckCount = document.getElementById('editor-deck-count');
  const deckSearch = document.getElementById('editor-deck-search');
  const clearButton = document.getElementById('editor-clear');
  const storeButton = document.getElementById('editor-store');
  const duplicateButton = document.getElementById('editor-duplicate');
  const undoButton = document.getElementById('editor-undo');
  const redoButton = document.getElementById('editor-redo');
  const grid = document.getElementById('editor-grid');
  const confirm = document.getElementById('editor-confirm');
  const confirmDescription = document.getElementById('editor-confirm-description');
  const importDialog = document.getElementById('editor-import-dialog');
  const importButton = document.getElementById('editor-import-json');
  const importFile = document.getElementById('editor-import-file');
  const importBrowse = document.getElementById('editor-import-browse');
  const importFilename = document.getElementById('editor-import-filename');
  const importText = document.getElementById('editor-import-text');
  const importFeedback = document.getElementById('editor-import-feedback');
  const importApply = document.getElementById('editor-import-apply');
  const importCancel = document.getElementById('editor-import-cancel');
  const picker = document.getElementById('editor-object');
  const nameControl = panel.querySelector('.editor-name-control');
  const nameInput = document.getElementById('editor-object-name');
  const renameDialog = document.getElementById('editor-rename-dialog');
  const renameForm = document.getElementById('editor-rename-form');
  const renameInput = document.getElementById('editor-rename-input');
  const renameCancel = document.getElementById('editor-rename-cancel');
  let pendingRename = null;
  const sliceButton = panel.querySelector('#editor-slice');
  const wallFields = panel.querySelector('#editor-wall-fields');
  const wallLength = panel.querySelector('#editor-wall-length');
  const wallDelete = panel.querySelector('#editor-wall-delete');
  const wallReset = panel.querySelector('#editor-wall-reset');
  const deckCategories = document.getElementById('editor-deck-categories');
  const categoryButtons = [...(deckCategories?.querySelectorAll('[data-deck-category]') ?? [])];
  const fields = [...panel.querySelectorAll('[data-transform]')];
  const sizeLabels = [...panel.querySelectorAll('[data-size-label]')];
  const tools = [...panel.querySelectorAll('[data-editor-mode]')];
  const feedback = document.getElementById('editor-feedback');
  const { objects: entries, captureTransform, restoreTransform } = kit.layout;
  const { parked } = kit;
  const undo = [];
  const redo = [];
  const palette = [...deck.querySelectorAll('[data-place]')];
  const sizeDetail = document.getElementById('editor-size-detail');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 650);
  const gizmo = new TransformControls(camera, canvas);
  const orbit = new OrbitControls(camera, canvas);
  const outline = new THREE.Box3Helper(new THREE.Box3(), 0xe7fcaf);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const previous = new THREE.Matrix4();
  const size = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const groundPoint = new THREE.Vector3();
  const localPoint = new THREE.Vector3();
  const footprint = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5),
    new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5)
  ]), new THREE.LineBasicMaterial({ color: 0x9fd9ff, depthTest: false, fog: false, toneMapped: false }));
  footprint.renderOrder = 999;
  footprint.visible = false;
  const resizeHandle = new THREE.Object3D();
  let selected = null;
  let active = false;
  let pointer = null;
  let width;
  let height;
  let timer;
  let placement = null;
  let previewSize = null;
  let pendingDelete = null;
  let dimensions;
  let resizeQueued = false;
  let lastResize = 0;
  let beforeEdit = null;
  let activeDeckCategory = 'buildings';
  let sliceMode = false;
  let selectedWall = null;

  const sliceMarker = new THREE.Group();
  const markerBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false })
  );
  markerBar.position.y = 1.4;
  const markerCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })
  );
  markerCap.position.y = 2.8;
  sliceMarker.add(markerBar, markerCap);
  sliceMarker.visible = false;
  sliceMarker.renderOrder = 999;
  scene.add(sliceMarker);

  const wallHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2.5, 0.48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, depthTest: false })
  );
  wallHighlight.visible = false;
  wallHighlight.renderOrder = 998;
  scene.add(wallHighlight);
  const land = createLandEditor(scene, panel, kit.map, {
    input: () => Number(grid.value), commit: commitBoundary, survey: surveyDraft, message,
    onMode(value) {
      if (value) {
        setPlacement();
        select(null);
        document.body.dataset.land = 'true';
      } else delete document.body.dataset.land;
      mode(gizmo.getMode());
    }
  });
  const previews = createDeckPreviews(deckList);
  const deckDrag = createDeckDrag(deck, canvas, {
    canPick: () => active && !gizmo.dragging && !pointer?.captured && !confirm.open,
    pick(next, dragging) {
      previews.pause(dragging);
      const same = placement?.kind === next.kind && placement.type === next.type && placement.entry === next.entry;
      setPlacement(same && !dragging ? null : next);
    },
    preview(point) {
      if (point) return showPlacement(point);
      footprint.visible = false;
      return false;
    },
    finish(point) {
      try {
        if (point) place(point);
        if (placement) setPlacement(null, Boolean(point));
      } finally {
        previews.pause(false);
      }
    }
  });
  new ResizeObserver(() => {
    panel.style.setProperty('--editor-deck-height', `${deck.offsetHeight}px`);
  }).observe(deck);

  outline.material.depthTest = false;
  outline.material.fog = false;
  outline.renderOrder = 1000;
  outline.visible = false;
  scene.add(outline, gizmo.getHelper(), resizeHandle, footprint);
  gizmo.enabled = orbit.enabled = false;
  gizmo.setSize(0.93);
  gizmo.setSpace('world');
  orbit.mouseButtons.LEFT = THREE.MOUSE.PAN;
  orbit.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  orbit.touches.ONE = THREE.TOUCH.PAN;
  orbit.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  orbit.maxPolarAngle = Math.PI / 3;
  orbit.minZoom = 0.3;
  orbit.maxZoom = 18;
  orbit.zoomToCursor = true;

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const aspect = width / Math.max(1, height);
    const compact = width <= 620;
    const usableWidth = Math.max(width * 0.5, width - (compact ? 24 : 350));
    const top = compact ? Math.min(panel.getBoundingClientRect().bottom + 12, height * 0.38) : 24;
    const deckHeight = Math.max(compact ? 125 : 106, deck.getBoundingClientRect().height + 24);
    const bottom = height - Math.min(deckHeight, height * 0.32);
    const usableHeight = Math.max(height * 0.28, bottom - top);
    const { minX, maxX, minZ, streetZ } = landExtent(kit.map.boundary);
    const half = Math.max(18, (streetZ - minZ) * 0.55 * height / usableHeight, (maxX - minX) * 0.55 * height / usableWidth);
    Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    const offsetX = compact ? 0 : (width - usableWidth) / 2;
    camera.setViewOffset(width, height, offsetX, (height - top - bottom) / 2, width, height);
  }

  function fit() {
    const { minX, maxX, minZ, streetZ } = landExtent(kit.map.boundary);
    orbit.target.set((minX + maxX) / 2, 0, (minZ + streetZ) / 2);
    const span = Math.max(maxX - minX, streetZ - minZ);
    const heightAboveGround = Math.max(120, span * 1.24);
    camera.position.copy(orbit.target).add(new THREE.Vector3(0, heightAboveGround, heightAboveGround * 0.14));
    camera.far = Math.max(650, heightAboveGround * 3);
    resize();
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    orbit.update();
  }

  function updateFields() {
    const building = selected?.building;
    const door = selected?.buildingId;
    const spec = selected?.spec;
    for (const element of sizeLabels) {
      const axis = element.dataset.sizeLabel;
      const label = { x: 'Width', y: 'Height', z: 'Depth' }[axis];
      element.textContent = building ? axis === 'y' ? 'Floors' : `${label} (m)` : `${label} (%)`;
    }
    for (const input of fields) {
      const [kind, axis] = input.dataset.transform.split('.');
      input.closest('label').hidden = door ? kind !== 'door' : kind === 'door' || (axis === 'y' && kind === 'position' && !selected?.elevation);
      input.disabled = !selected || (door && kind !== 'door') || (kind === 'position' && axis === 'y' && !selected.elevation)
        || (kind === 'scale' && axis === 'y' && selected.surface);
      if (kind === 'scale') {
        input.min = building ? axis === 'y' ? 1 : 2.6 : 10;
        input.max = building ? axis === 'y' ? maxBuildingFloors : maxBuildingSpan : 2000;
        input.step = building && axis === 'y' ? 1 : 'any';
      }
      if (!selected || (door && kind !== 'door')) input.value = '';
      else if (kind === 'door') input.value = door ? rounded(selected.offset) : '';
      else if (kind === 'yaw') input.value = rounded(THREE.MathUtils.radToDeg(selected.root.rotation.y));
      else if (kind === 'scale' && building) input.value = spec[{ x: 'width', y: 'floors', z: 'depth' }[axis]];
      else if (kind === 'scale') input.value = rounded(selected.root.scale[axis] / selected.baseScale[axis] * 100);
      else input.value = door ? '' : rounded(selected.root.position[axis]);
    }
    sizeDetail.hidden = !building && !door;
    sizeDetail.value = building ? `${rounded(building.story * spec.floors)} m wall height · ${building.story} m per floor`
      : door ? `Attached to the ${spec.wall.replace(/^academic-/, 'Academic wing’s ')} wall` : '';
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = selected?.label ?? '';
    }
  }

  function mode(value) {
    gizmo.setMode(value);
    gizmo.showX = gizmo.showZ = value !== 'rotate';
    gizmo.showY = value === 'rotate' || (value === 'scale' && !selected?.surface)
      || (value === 'translate' && Boolean(selected?.elevation));
    if (!selected || selected.buildingId || placement || land.active) gizmo.detach();
    else if (selected.building && value === 'scale') {
      selected.root.getWorldPosition(resizeHandle.position);
      selected.root.getWorldQuaternion(resizeHandle.quaternion);
      resizeHandle.scale.setScalar(1);
      resizeHandle.updateMatrixWorld();
      gizmo.attach(resizeHandle);
    } else {
      gizmo.attach(selected.root);
    }
    for (const button of tools) button.setAttribute('aria-pressed', String(button.dataset.editorMode === value));
  }

  function select(entry) {
    if (entry) selectWall(null);
    selected = entry;
    picker.value = entry?.id ?? '';
    panel.querySelector('#editor-object-panel').dataset.selected = String(Boolean(entry || selectedWall));
    outline.visible = Boolean(entry);
    document.getElementById('editor-focus').disabled = !entry;
    if (nameInput) {
      nameInput.value = entry?.label ?? '';
      nameInput.disabled = !entry;
    }
    if (nameControl) nameControl.hidden = !entry;
    const fieldset = document.getElementById('editor-fields');
    fieldset.disabled = fieldset.hidden = !entry;
    storeButton.disabled = !entry || entry.id === 'pool-portal';
    duplicateButton.disabled = !kit.canDuplicate(entry);
    for (const button of tools) button.disabled = !entry || Boolean(entry.buildingId);
    if (entry) {
      outline.box = entry.bounds;
      mode(gizmo.getMode());
    } else {
      gizmo.detach();
    }
    updateFields();
  }

  function selectWall(seg) {
    selectedWall = seg;
    if (seg) {
      select(null);
      gizmo.detach();
      const [x1, z1] = seg.a;
      const [x2, z2] = seg.b;
      const len = Math.hypot(x2 - x1, z2 - z1);
      wallHighlight.position.set((x1 + x2) / 2, 1.25, (z1 + z2) / 2);
      wallHighlight.rotation.y = Math.atan2(z1 - z2, x2 - x1);
      wallHighlight.scale.set(len + 0.1, 1, 1);
      wallHighlight.visible = true;
      if (wallFields) wallFields.hidden = false;
      if (wallLength) wallLength.textContent = `Length: ${len.toFixed(1)} m · From [${seg.a.map(rounded).join(', ')}] to [${seg.b.map(rounded).join(', ')}]`;
      panel.querySelector('#editor-object-panel').dataset.selected = 'true';
      picker.value = '';
      if (nameControl) nameControl.hidden = true;
      if (nameInput) nameInput.disabled = true;
    } else {
      wallHighlight.visible = false;
      if (wallFields) wallFields.hidden = true;
      if (!selected) panel.querySelector('#editor-object-panel').dataset.selected = 'false';
    }
  }

  function pickWall(event) {
    pointRay(event);
    if (kit.perimeter) {
      const hits = ray.intersectObjects(kit.perimeter.children, true);
      for (const hit of hits) {
        let node = hit.object;
        while (node && !node.userData.wallSegment) node = node.parent;
        if (node?.userData.wallSegment) {
          return { hit, segment: node.userData.wallSegment };
        }
      }
    }
    if (landPoint(event) && kit.map.boundary.walls) {
      for (const seg of kit.map.boundary.walls) {
        const [cx, cz] = closestOnEdge(groundPoint.x, groundPoint.z, seg.a, seg.b);
        if (Math.hypot(groundPoint.x - cx, groundPoint.z - cz) < 1.2) {
          return { hit: { point: new THREE.Vector3(cx, 0, cz) }, segment: seg };
        }
      }
    }
    return null;
  }

  function sliceWallSegment(segment, cutPoint) {
    const walls = kit.map.boundary.walls ??= (kit.map.boundary.points
      ? kit.map.boundary.points.map(([x, z], i) => ({
          id: `wall-${i + 1}`,
          a: [x, z],
          b: kit.map.boundary.points[(i + 1) % kit.map.boundary.points.length]
        }))
      : []);
    const index = walls.findIndex((s) => s.id === segment.id);
    if (index === -1) return;
    const seg1 = { id: `wall-${Date.now()}-1`, a: [...segment.a], b: [...cutPoint] };
    const seg2 = { id: `wall-${Date.now()}-2`, a: [...cutPoint], b: [...segment.b] };
    walls.splice(index, 1, seg1, seg2);
    kit.syncPerimeter?.();
    selectWall(seg2);
    record({
      undo: () => {
        const idx1 = walls.findIndex((s) => s.id === seg1.id);
        if (idx1 !== -1) walls.splice(idx1, 2, segment);
        kit.syncPerimeter?.();
        selectWall(null);
      },
      redo: () => {
        const idx = walls.findIndex((s) => s.id === segment.id);
        if (idx !== -1) walls.splice(idx, 1, seg1, seg2);
        kit.syncPerimeter?.();
        selectWall(seg2);
      }
    });
    onLayoutChange();
    message(`Sliced wall at (${cutPoint[0]}, ${cutPoint[1]}). Press Delete to remove selected segment.`);
  }

  function deleteSelectedWall() {
    if (!selectedWall || !kit.map.boundary.walls) return;
    const segment = selectedWall;
    const walls = kit.map.boundary.walls;
    const index = walls.findIndex((s) => s.id === segment.id);
    if (index === -1) return;
    walls.splice(index, 1);
    kit.syncPerimeter?.();
    selectWall(null);
    record({
      undo: () => {
        walls.splice(index, 0, segment);
        kit.syncPerimeter?.();
        selectWall(segment);
      },
      redo: () => {
        const idx = walls.findIndex((s) => s.id === segment.id);
        if (idx !== -1) walls.splice(idx, 1);
        kit.syncPerimeter?.();
        selectWall(null);
      }
    });
    onLayoutChange();
    message('Wall segment deleted.');
  }

  function resetPerimeterWalls() {
    const previousWalls = kit.map.boundary.walls ? structuredClone(kit.map.boundary.walls) : null;
    const walls = perimeterWalls(kit.map);
    function apply(replacement) {
      if (replacement) kit.map.boundary.walls = structuredClone(replacement);
      else delete kit.map.boundary.walls;
      kit.syncPerimeter?.();
    }
    apply(walls);
    selectWall(null);
    record({
      undo: () => apply(previousWalls),
      redo: () => apply(walls)
    });
    onLayoutChange();
    message('Perimeter walls reset to boundary outline.');
  }

  function setSliceMode(value) {
    sliceMode = Boolean(value);
    if (sliceButton) sliceButton.setAttribute('aria-pressed', String(sliceMode));
    if (sliceMode) {
      document.body.dataset.editorSlice = 'true';
      select(null);
      selectWall(null);
      gizmo.detach();
      setPlacement(null);
      message('Click along any boundary wall to slice it into segments.');
    } else {
      delete document.body.dataset.editorSlice;
      sliceMarker.visible = false;
    }
  }

  function refreshEntry(entry) {
    if (!entry) return;
    if (!entry.option) {
      const option = document.createElement('option');
      option.value = entry.id;
      picker.append(option);
      entry.option = option;
    }
    const { x, z } = entry.root.getWorldPosition(aim);
    entry.option.textContent = `${entry.label} · ${rounded(x)}, ${rounded(z)}`;
    entry.meshes = [];
    entry.root.traverse((mesh) => {
      if (!mesh.isMesh || mesh.userData.skipPick) return;
      let owner = mesh.parent;
      while (owner && !owner.userData.layoutId) owner = owner.parent;
      if (owner === entry.root) entry.meshes.push(mesh);
    });
    entry.bounds.setFromObject(entry.root);
  }

  function refreshBuilding(entry) {
    refreshEntry(entry);
    for (const child of entries.values()) if (child.buildingId === entry.id) refreshEntry(child);
  }

  for (const entry of [...entries.values()].sort((a, b) => a.label.localeCompare(b.label))) refreshEntry(entry);

  function remember() {
    selected.root.updateWorldMatrix(true, false);
    previous.copy(selected.root.matrixWorld);
  }

  function record(change) {
    undo.push(change);
    if (undo.length > historyLimit) undo.shift();
    redo.length = 0;
    updateHistory();
  }

  function updateHistory() {
    undoButton.disabled = !undo.length;
    redoButton.disabled = !redo.length;
  }

  function renameEntry(entry, newLabel) {
    if (!entry) return;
    const clean = newLabel.trim();
    if (!clean || clean === entry.label) return;
    const prevLabel = entry.label;

    function apply(label, oldLabel) {
      entry.label = label;
      entry.root.name = label;
      if (!entry.spec) {
        entry.spec = (kit.map.elements ??= {})[entry.id] ??= {};
      }
      entry.spec.label = label;
      if (entry.spec.copyLabel) entry.spec.copyLabel = label;
      if (kit.map.buildings?.[entry.id]) kit.map.buildings[entry.id].label = label;
      else if (kit.map.elements?.[entry.id]) kit.map.elements[entry.id].label = label;
      else if (entry.id === 'pool' && kit.map.pool) kit.map.pool.label = label;

      if (entry.building) {
        for (const child of entries.values()) {
          if (child.buildingId === entry.id && child.label.includes(oldLabel)) {
            child.label = child.label.replace(oldLabel, label);
            child.root.name = child.label;
            if (child.spec) {
              child.spec.label = child.label;
              if (child.spec.copyLabel) child.spec.copyLabel = child.label;
            }
            if (kit.map.elements?.[child.id]) kit.map.elements[child.id].label = child.label;
            refreshEntry(child);
          }
        }
        for (const record of parked.values()) {
          const child = record.entry;
          if (child.buildingId === entry.id && child.label.includes(oldLabel)) {
            child.label = child.label.replace(oldLabel, label);
            child.root.name = child.label;
            if (child.spec) {
              child.spec.label = child.label;
              if (child.spec.copyLabel) child.spec.copyLabel = child.label;
            }
            if (kit.map.elements?.[child.id]) kit.map.elements[child.id].label = child.label;
          }
        }
      }

      if (entries.has(entry.id)) {
        refreshEntry(entry);
      }
      refreshDeck();
      if (selected === entry && nameInput) nameInput.value = label;
      finishLayoutChange();
    }

    apply(clean, prevLabel);
    record({
      undo: () => apply(prevLabel, clean),
      redo: () => apply(clean, prevLabel)
    });
    message(`Renamed to "${clean}".`);
  }

  function beginTransform() {
    remember();
    beforeEdit = captureTransform(selected);
  }

  function applyTransform(entry, state) {
    restoreTransform(entry, state);
    if (entry.building) {
      const { width, depth, floors } = entry.spec;
      entry.building.resize(width, depth, floors);
    }
    if (entry.buildingId) kit.rebuildDoors(entry.buildingId);
    else kit.refreshColliders(entry.root);
    refreshAffected(entry);
    if (entry.id === 'pool') refreshEntry(entries.get('pool-portal'));
    select(entry);
  }

  function commitTransform(entry, before) {
    if (!before) return;
    const after = captureTransform(entry);
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    record({
      undo: () => applyTransform(entry, before),
      redo: () => applyTransform(entry, after)
    });
  }

  function changed(commit = true) {
    if (!selected) return;
    if (!selected.buildingId) limitScale(selected);
    if (commit && kit.map.boundary.points && beforeEdit && !selected.buildingId) {
      const { x, z } = selected.root.position;
      const isPool = selected.id === 'pool';
      const valid = isPool ? poolFits(kit.map.boundary, x, z, selected.root) : insideLand(kit.map.boundary, x, z);
      if (!valid && (isPool || beforeEdit.pose[0] !== x || beforeEdit.pose[2] !== z)) {
        applyTransform(selected, beforeEdit);
        beforeEdit = null;
        onLayoutChange();
        message(isPool ? 'Keep the pool and its steps inside the boundary.' : 'Choose a spot inside the land boundary.');
        return;
      }
    }
    const root = selected.root;
    root.updateWorldMatrix(true, false);
    onEdit(selected, previous, commit);
    previous.copy(root.matrixWorld);
    refreshAffected(selected);
    updateFields();
    if (commit) {
      commitTransform(selected, beforeEdit);
      beforeEdit = null;
    }
  }

  gizmo.addEventListener('dragging-changed', ({ value }) => {
    orbit.enabled = active && !value;
    if (value) beginTransform();
    if (selected?.building && gizmo.getMode() === 'scale') {
      if (value) {
        const { width, depth, floors } = selected.spec;
        dimensions = { width, depth, floors };
      } else {
        resizeFromHandle(true);
      }
    } else if (!value) changed();
  });
  gizmo.addEventListener('objectChange', () => {
    if (dimensions) resizeQueued = true;
    else changed(false);
  });

  function resizeFromHandle(commit) {
    if (!dimensions) return;
    const { x, y, z } = resizeHandle.scale;
    const snap = (metres, factor) => factor === 1 ? metres : Math.round(metres * factor * 4) / 4;
    if (selected.building.resize(snap(dimensions.width, x), snap(dimensions.depth, z), dimensions.floors * y) || commit) {
      remember();
      changed(commit);
    }
    resizeQueued = false;
    if (commit) {
      dimensions = null;
      resizeHandle.scale.setScalar(1);
    }
  }

  function pointRay(event) {
    const rect = canvas.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    camera.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
  }

  function snap(value) {
    const size = Number(grid.value);
    return rounded(size ? Math.round(value / size) * size : value);
  }

  function landPoint(event) {
    pointRay(event);
    return ray.ray.intersectPlane(ground, groundPoint);
  }

  function wallPlacement(host) {
    let closest;
    let distance = Infinity;
    for (const entry of host ? [host] : entries.values()) {
      if (!entry.building) continue;
      entry.root.worldToLocal(localPoint.copy(groundPoint));
      const { width, depth, academicWing } = entry.spec;
      const { min, max } = entry.bounds;
      const outside = academicWing
        ? groundPoint.x < min.x - 2 || groundPoint.x > max.x + 2 || groundPoint.z < min.z - 2 || groundPoint.z > max.z + 2
        : Math.abs(localPoint.x) > width / 2 + 2 || Math.abs(localPoint.z) > depth / 2 + 2;
      if (outside) continue;
      for (const wall of entry.building.wallSurfaces) {
        const dx = localPoint.x - wall.x;
        const dz = localPoint.z - wall.z;
        const along = dx * Math.cos(wall.angle) - dz * Math.sin(wall.angle);
        const normal = dx * Math.sin(wall.angle) + dz * Math.cos(wall.angle);
        const separation = Math.hypot(normal, Math.max(0, Math.abs(along) - wall.span / 2));
        if (separation < distance) {
          distance = separation;
          closest = { entry, wall, offset: THREE.MathUtils.clamp(along * 2 / wall.span, -1, 1) };
        }
      }
    }
    return closest;
  }

  function pick(event) {
    pointRay(event);
    let closest = Infinity;
    let hit;
    for (const entry of entries.values()) {
      if (!ray.ray.intersectsBox(entry.bounds)) continue;
      const [intersection] = ray.intersectObjects(entry.meshes, false);
      if (intersection && intersection.distance < closest) {
        closest = intersection.distance;
        hit = entry;
      }
    }
    return hit;
  }

  function placementTarget(event) {
    if (!landPoint(event)) return null;
    if (placement.type === 'door' || placement.entry?.buildingId) {
      const hit = pick(event);
      const host = hit?.building ? hit : entries.get(hit?.buildingId);
      const originalHost = placement.entry && entries.get(placement.entry.buildingId);
      if (placement.entry && (!originalHost || (host && host !== originalHost))) return null;
      if (host) {
        // Use the visible wall or roof hit even when the ground ray lands beyond the building.
        const [contact] = ray.intersectObjects(hit.meshes, false);
        if (contact) groundPoint.copy(contact.point);
      }
      const wall = wallPlacement(originalHost ?? host);
      return wall && { ...wall, valid: kit.fitsDoor(wall) };
    }
    const position = { x: snap(groundPoint.x), z: snap(groundPoint.z) };
    const entry = placement.entry;
    const valid = entry?.id === 'pool' ? poolFits(kit.map.boundary, position.x, position.z)
      : insideLand(kit.map.boundary, position.x, position.z);
    return { position, valid };
  }

  function poolFits(boundary, x, z, root) {
    const { width, depth, yaw = 0, scale = [1, 1, 1] } = kit.map.pool;
    const angle = root?.rotation.y ?? THREE.MathUtils.degToRad(yaw);
    const halfWidth = width * (root?.scale.x ?? scale[0]) / 2;
    const halfDepth = depth * (root?.scale.z ?? scale[2]) / 2;
    return fitsLand(boundary, [[-halfWidth, -halfDepth], [halfWidth, -halfDepth],
      [halfWidth, halfDepth + 1], [-halfWidth, halfDepth + 1]].map(([dx, dz]) => [
      x + dx * Math.cos(angle) + dz * Math.sin(angle),
      z - dx * Math.sin(angle) + dz * Math.cos(angle)
    ]));
  }

  function showPlacement(event) {
    if (!active || !placement) return false;
    const target = placementTarget(event);
    footprint.visible = Boolean(target);
    if (!target) return false;
    if (target.wall) {
      const { entry, wall, offset } = target;
      const along = THREE.MathUtils.clamp(offset * wall.span / 2, -wall.span / 2 + 0.9, wall.span / 2 - 0.9);
      footprint.position.set(wall.x + along * Math.cos(wall.angle), 0.15, wall.z - along * Math.sin(wall.angle));
      entry.root.localToWorld(footprint.position);
      footprint.rotation.y = entry.root.rotation.y + wall.angle;
      footprint.scale.set(1.75, 1, 0.7);
    } else {
      const { position } = target;
      footprint.position.set(position.x, 0.15, position.z);
      footprint.rotation.y = previewSize.yaw;
      footprint.scale.set(previewSize.width, 1, previewSize.depth);
    }
    footprint.material.color.set(target.valid === false ? 0xf58f87 : 0x9fd9ff);
    return target.valid !== false;
  }

  function setPlacement(next = null, keepFeedback = false) {
    placement = next;
    footprint.visible = false;
    if (next) {
      if (land.active) land.end();
      const { entry, type } = next;
      if (entry && (entry.building || entry.id === 'pool')) {
        previewSize = {
          width: entry.spec.width * entry.root.scale.x,
          depth: entry.spec.depth * entry.root.scale.z,
          yaw: entry.root.rotation.y
        };
      } else {
        const span = entry && entry.bounds.getSize(size);
        previewSize = { width: span?.x || (type === 'building' ? 10 : 3),
          depth: span?.z || (type === 'building' ? 8 : 3), yaw: 0 };
      }
      document.body.dataset.placement = next.kind;
    } else {
      previewSize = null;
      delete document.body.dataset.placement;
    }
    for (const button of palette) button.setAttribute('aria-pressed', String(button.dataset.place === next?.type));
    for (const button of deckList.querySelectorAll('[data-stored]')) {
      button.setAttribute('aria-pressed', String(next?.kind === 'stored' && next.entry.id === button.dataset.stored));
    }
    mode(gizmo.getMode());
    if (next) {
      const instruction = next.kind === 'new' ? placeTips[next.type]
        : next.entry.buildingId ? 'Choose a wall of the original building.' : `Choose a spot for ${next.entry.label}.`;
      message(instruction);
    } else if (!keepFeedback) feedback.hidden = true;
  }

  function place(event) {
    const target = placementTarget(event);
    if (!target || target.valid === false) {
      if (target?.wall) message('This wall has no room for another door.');
      else if (placement.type === 'door' || placement.entry?.buildingId) message('Choose an exterior wall on the map.');
      else if (placement.entry?.id === 'pool') message('Keep the pool and its steps inside the boundary.');
      else message('Choose a spot inside the land boundary.');
      return;
    }
    if (placement.kind === 'stored') {
      placeStored(parked.get(placement.entry.id), target);
      return;
    }
    const host = target.entry;
    const before = host && captureTransform(host);
    const entry = placement.kind === 'copy' ? kit.duplicate(scene, placement.entry, target.position)
      : kit.place(scene, placement.type, target.position, target);
    if (!entry) {
      message('This wall has no room for another door.');
      return;
    }
    refreshAffected(entry);
    setPlacement();
    select(entry);
    canvas.focus({ preventScroll: true });
    recordPresence(entry, true, null, before, host && captureTransform(host), 'discarded');
    finishLayoutChange();
    message(`${entry.label} placed.`);
  }

  for (const button of palette) deckDrag.bind(button, () => ({ kind: 'new', type: button.dataset.place }));
  canvas.addEventListener('pointerleave', () => { if (!pointer?.dragging) footprint.visible = false; });
  deckList.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)
      || deckList.scrollWidth <= deckList.clientWidth || deckDrag.dragging) return;
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? deckList.clientWidth : 1;
    deckList.scrollLeft += event.deltaY * scale;
  }, { passive: false });
  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function overDeck(event) {
    const rect = deck.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  }

  function startPointer(event) {
    if (!active || event.button !== 0 || gizmo.dragging || event.altKey) return;
    if (deckDrag.busy) {
      consume(event);
      return;
    }
    if (sliceMode) {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, captured: false };
      return;
    }
    if (!event.isPrimary) {
      if (pointer?.captured) consume(event);
      else pointer = null;
      return;
    }
    if (pointer) return;
    const pending = { id: event.pointerId, x: event.clientX, y: event.clientY, captured: false };
    if (!placement && !land.active && gizmo.object) {
      pointRay(event);
      gizmo.getHelper().updateMatrixWorld(true);
      gizmo.pointerHover({ x: ndc.x, y: ndc.y, button: 0 });
      if (gizmo.axis) return;
    }
    const hit = !placement && !land.active && pick(event);
    if (land.active) {
      camera.updateMatrixWorld();
      pending.corner = land.findCorner(event, camera, canvas.getBoundingClientRect());
      if (pending.corner >= 0) {
        pending.originalCorner = land.getCorner(pending.corner);
        land.select(pending.corner);
      }
    }
    if (hit) {
      select(hit);
      if (!hit.buildingId && landPoint(event)) {
        pending.entry = hit;
        pending.offsetX = hit.root.position.x - groundPoint.x;
        pending.offsetZ = hit.root.position.z - groundPoint.z;
      }
    }
    if (placement || pending.corner >= 0 || pending.entry) {
      pending.captured = true;
      canvas.setPointerCapture(event.pointerId);
      orbit.enabled = gizmo.enabled = false;
      consume(event);
    }
    pointer = pending;
  }

  function movePointer(event) {
    showPlacement(event);
    if (sliceMode) {
      const hitData = pickWall(event);
      if (hitData) {
        const { hit, segment } = hitData;
        const [cx, cz] = closestOnEdge(hit.point.x, hit.point.z, segment.a, segment.b);
        sliceMarker.position.set(snap(cx), 0, snap(cz));
        sliceMarker.visible = true;
      } else {
        sliceMarker.visible = false;
      }
    }
    if (event.pointerId !== pointer?.id || !pointer.captured) return;
    consume(event);
    if (!pointer.dragging && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 5) return;
    if (pointer.corner >= 0 && landPoint(event)) {
      pointer.dragging = true;
      land.move([snap(groundPoint.x), snap(groundPoint.z)]);
    }
    if (!pointer.entry || !landPoint(event)) return;
    if (!pointer.dragging) {
      beginTransform();
      pointer.dragging = true;
      document.body.dataset.editorDrag = 'true';
    }
    deck.classList.toggle('drop-target', overDeck(event));
    const x = snap(groundPoint.x + pointer.offsetX);
    const z = snap(groundPoint.z + pointer.offsetZ);
    const boundary = kit.map.boundary;
    if (!insideLand(boundary, x, z, 0, !boundary.points) || overDeck(event)
      || (pointer.entry.id === 'pool' && !poolFits(boundary, x, z))) return;
    if (pointer.entry.root.position.x === x && pointer.entry.root.position.z === z) return;
    pointer.entry.root.position.x = x;
    pointer.entry.root.position.z = z;
    changed(false);
  }

  function endPointer(event, cancelled = false) {
    const current = pointer;
    if (!current || event.pointerId !== current.id) return;
    pointer = null;
    const moved = Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5;
    if (current.captured) {
      if (canvas.hasPointerCapture?.(current.id)) canvas.releasePointerCapture(current.id);
      orbit.enabled = gizmo.enabled = active;
      if (event.type !== 'lostpointercapture') consume(event);
    }
    delete document.body.dataset.editorDrag;
    deck.classList.remove('drop-target');
    if (cancelled || moved) return;
    if (sliceMode) {
      const hitData = pickWall(event);
      if (hitData) {
        const { hit, segment } = hitData;
        const [cx, cz] = closestOnEdge(hit.point.x, hit.point.z, segment.a, segment.b);
        const cutPoint = [rounded(snap(cx)), rounded(snap(cz))];
        const distA = Math.hypot(cutPoint[0] - segment.a[0], cutPoint[1] - segment.a[1]);
        const distB = Math.hypot(cutPoint[0] - segment.b[0], cutPoint[1] - segment.b[1]);
        if (distA > 0.3 && distB > 0.3) {
          sliceWallSegment(segment, cutPoint);
        } else {
          message('Click further away from wall corners to slice.');
        }
      }
      return;
    }
    if (current.entry && current.dragging) {
      const over = !cancelled && overDeck(event);
      if (cancelled || over) {
        applyTransform(current.entry, beforeEdit);
        beforeEdit = null;
        if (over) storeSelection();
        else finishLayoutChange();
      } else changed();
      return;
    }
    if (cancelled) {
      if (current.originalCorner) land.move(current.originalCorner);
      return;
    }
    if (moved) return;
    if (placement) place(event);
    else if (land.active && current.corner < 0 && landPoint(event)) {
      land.add([snap(groundPoint.x), snap(groundPoint.z)], camera, canvas.getBoundingClientRect());
    } else if (!land.active && !current.entry) {
      const wallHit = pickWall(event);
      if (wallHit) {
        selectWall(wallHit.segment);
      } else {
        select(pick(event));
      }
    }
    if (!land.active && !placement) canvas.focus({ preventScroll: true });
  }

  canvas.addEventListener('pointerdown', startPointer, { capture: true });
  canvas.addEventListener('pointermove', movePointer, { capture: true });
  canvas.addEventListener('pointerup', (event) => endPointer(event), { capture: true });
  canvas.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === pointer?.id && pointer.captured) endPointer(event, true);
  });
  canvas.addEventListener('pointercancel', (event) => {
    endPointer(event, true);
    if (gizmo.dragging) gizmo.pointerUp(null);
  });

  function toggle() {
    deckDrag.cancel();
    if (gizmo.dragging) gizmo.pointerUp(null);
    if (pointer?.captured) endPointer({ pointerId: pointer.id, type: 'lostpointercapture' }, true);
    active = !active;
    document.body.dataset.editor = String(active);
    runtime.setView(active ? camera : null);
    panel.hidden = deck.hidden = !active;
    gizmo.enabled = orbit.enabled = active;
    pointer = null;
    land.setVisible(active);
    if (active) {
      refreshDeck();
      fit();
      canvas.focus({ preventScroll: true });
    } else {
      previews.reset();
      setPlacement();
      land.end();
      select(null);
      selectWall(null);
      setSliceMode(false);
      document.body.dataset.briefing = 'compact';
      document.querySelector('[data-action="KeyE"]').focus({ preventScroll: true });
      if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('editor')) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('editor');
        window.history.replaceState(null, '', cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : ''));
      }
    }
    onToggle(active);
  }

  function message(text) {
    feedback.textContent = text;
    feedback.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { feedback.hidden = true; }, 4800);
  }

  function refreshAffected(entry) {
    const host = entries.get(entry.buildingId);
    if (host) refreshBuilding(host);
    else if (entry.building) refreshBuilding(entry);
    else refreshEntry(entry);
    if (entry.id === 'pool') refreshEntry(entries.get('pool-portal'));
  }

  function removeOptions({ items }) {
    for (const item of items) {
      item.option?.remove();
      item.option = null;
    }
  }

  function finishLayoutChange() {
    refreshDeck();
    land.refresh();
    onLayoutChange();
  }

  function recordCategory(entry) {
    if (entry.buildingId) return 'doors';
    const id = entry.id || '';
    const label = (entry.label || '').toLowerCase();
    if (entry.spec?.type === 'tree' || id.startsWith('added-tree') || id.startsWith('tree:') || /\b(tree|trees|palm|plant|flower|shrub|banyan)\b/i.test(label)) {
      return 'trees';
    }
    if (entry.building || entry.spec?.type === 'building' || id.startsWith('added-building') || kit.map.buildings?.[entry.id]) {
      return 'buildings';
    }
    return 'facilities';
  }

  function deckModel(entry) {
    const template = entry.spec?.template;
    const source = template ? entries.get(template) ?? parked.get(template)?.entry : entry;
    const id = template ?? entry.id;
    const label = source?.spec?.copyLabel ?? source?.label ?? entry.spec?.copyLabel ?? entry.label;
    if (entry.buildingId) {
      const host = entries.get(entry.buildingId) ?? parked.get(entry.buildingId)?.entry;
      return [`door:${entry.buildingId}`, host ? `Door · ${host.label}` : 'Door'];
    }
    if (entry.building || entry.spec?.type === 'building' || kit.map.buildings?.[entry.id]) {
      const width = Number((entry.spec?.width ?? 10).toFixed(1));
      const depth = Number((entry.spec?.depth ?? 8).toFixed(1));
      const floors = entry.spec?.floors ?? 1;
      const baseId = template ?? (entry.spec?.type === 'building' ? 'building' : id.split(':')[0]);
      const dimKey = `${width}x${depth}-${floors}fl`;
      const dimLabel = `${label} (${width}×${depth} m · ${floors} fl)`;
      return [`building:${baseId}:${dimKey}:${label}`, dimLabel];
    }
    if (!template && (entry.spec?.type === 'tree' || entry.id.startsWith('added-tree')) && entry.label === 'Tree') return ['added-tree', 'Tree'];
    return [`${id.split(':')[0]}:${label}`, label];
  }

  function refreshDeck() {
    if (deckDrag.busy) deckDrag.cancel();
    const list = [...parked.values()].sort((a, b) => a.entry.label.localeCompare(b.entry.label));
    const query = deckSearch.value.trim().toLocaleLowerCase();

    const categoryCounts = {
      buildings: 0,
      trees: 0,
      facilities: 0,
      doors: 0,
      all: list.length
    };
    for (const record of list) {
      const cat = recordCategory(record.entry);
      if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
    }
    for (const [cat, count] of Object.entries(categoryCounts)) {
      const badge = deck.querySelector(`[data-category-count="${cat}"]`);
      if (badge) badge.textContent = String(count);
    }
    if (deckCategories) deckCategories.hidden = !list.length;

    const filteredCategoryList = activeDeckCategory === 'all'
      ? list
      : list.filter((r) => recordCategory(r.entry) === activeDeckCategory);

    const stacks = new Map();
    for (const record of filteredCategoryList) {
      const [key, label] = deckModel(record.entry);
      if (!stacks.has(key)) stacks.set(key, { label, records: [] });
      stacks.get(key).records.push(record);
    }
    const matches = [...stacks.values()].filter(({ label, records }) =>
      label.toLocaleLowerCase().includes(query)
        || records.some(({ entry }) => entry.label.toLocaleLowerCase().includes(query)));
    const scroll = deckList.scrollLeft;
    previews.reset();
    const cards = document.createDocumentFragment();
    for (const { label, records } of matches) {
      const record = records.find(({ entry }) => entry === placement?.entry)
        ?? records.find(kit.canRestore) ?? records[0];
      const { entry } = record;
      const card = document.createElement('div');
      card.className = 'editor-card';
      const placeButton = document.createElement('button');
      placeButton.type = 'button';
      placeButton.className = 'editor-place-card';
      const tile = document.createElement('span');
      tile.className = 'editor-card-preview';
      const caption = document.createElement('span');
      caption.className = 'editor-card-caption';
      caption.textContent = records.length > 1 ? label : entry.label;
      caption.title = 'Double-click to rename';
      caption.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        openRenameDialog(entry);
      });
      placeButton.append(tile, caption);
      if (records.length > 1) {
        const quantity = document.createElement('span');
        quantity.className = 'editor-stack-count';
        quantity.textContent = `×${records.length}`;
        quantity.setAttribute('aria-hidden', 'true');
        placeButton.append(quantity);
      }
      placeButton.title = entry.label;
      if (!entry.buildingId) {
        const { x, z } = entry.root.position;
        placeButton.title += ` · ${rounded(x)}, ${rounded(z)} m`;
      }
      placeButton.setAttribute('aria-label', `Place ${entry.label}${records.length > 1 ? `, ${records.length} in stack` : ''}`);
      placeButton.setAttribute('aria-pressed', String(placement?.kind === 'stored' && placement.entry === entry));
      placeButton.dataset.stored = entry.id;
      placeButton.disabled = !kit.canRestore(record);
      if (placeButton.disabled) placeButton.title = 'Place its building first';
      deckDrag.bind(placeButton, () => ({ kind: 'stored', entry }));
      previews.add(tile, entry);
      card.append(placeButton);
      if (entry.id !== 'pool') {
        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'editor-card-rename';
        renameButton.textContent = '✎';
        renameButton.title = 'Rename component';
        renameButton.setAttribute('aria-label', `Rename ${entry.label}`);
        renameButton.addEventListener('click', (event) => {
          event.stopPropagation();
          openRenameDialog(entry);
        });
        card.append(renameButton);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'editor-card-delete';
        removeButton.textContent = '×';
        removeButton.title = 'Delete from deck';
        removeButton.setAttribute('aria-label', `Delete ${entry.label} from deck`);
        removeButton.addEventListener('click', () => {
          pendingDelete = record;
          confirmDescription.textContent = `${entry.label}${entry.building ? ' and its attached doors' : ''} will be removed from the saved layout.`;
          confirm.returnValue = 'cancel';
          confirm.showModal();
        });
        card.append(removeButton);
      }
      cards.append(card);
    }
    if (list.length && !matches.length) {
      const noResults = document.createElement('p');
      noResults.textContent = query ? 'No matching stored objects.' : 'No stored objects in this category.';
      cards.append(noResults);
    }
    deckCount.value = String(list.length);
    deckList.replaceChildren(cards);
    deckList.hidden = !list.length;
    deckSearch.hidden = !list.length;
    if (!list.length) deckSearch.value = '';
    deckList.scrollLeft = scroll;
    clearButton.disabled = ![...entries.values()].some((entry) => !entry.buildingId && entry.id !== 'pool-portal');
  }

  function recordPresence(entry, placed, removal, beforeHost, afterHost, state = 'deck') {
    function apply(present, hostState) {
      if (present) {
        removal.restore();
      }
      else {
        removal = kit.takeOffMap(entry, state);
        removeOptions(removal);
      }
      if (hostState) applyTransform(entries.get(entry.buildingId), hostState);
      else if (present) refreshAffected(entry);
      select(present ? entry : null);
    }
    record({
      undo: () => apply(!placed, beforeHost),
      redo: () => apply(placed, afterHost)
    });
  }

  function stepHistory(forward) {
    if (gizmo.dragging || pointer?.captured || deckDrag.busy || confirm.open) return;
    const source = forward ? redo : undo;
    const destination = forward ? undo : redo;
    const change = source.pop();
    if (!change) {
      message(forward ? 'Nothing to redo.' : 'Nothing to undo.');
      return;
    }
    setPlacement();
    land.end();
    change[forward ? 'redo' : 'undo']();
    destination.push(change);
    updateHistory();
    finishLayoutChange();
    if (change.fit) fit();
    message(forward ? 'Redid the last edit.' : 'Undid the last edit.');
  }

  function storeSelection() {
    if (!selected || selected.id === 'pool-portal') {
      message('Store the pool to move its portal to the deck.');
      return;
    }
    const entry = selected;
    setPlacement();
    const host = entries.get(entry.buildingId);
    const before = host && captureTransform(host);
    const removed = kit.takeOffMap(entry);
    select(null);
    removeOptions(removed);
    if (host) refreshBuilding(host);
    recordPresence(entry, false, removed, before, host && captureTransform(host));
    finishLayoutChange();
    message(`Stored ${entry.label}.`);
  }

  function duplicateSelection() {
    if (kit.canDuplicate(selected)) setPlacement({ kind: 'copy', entry: selected });
  }

  function placeStored(stored, target) {
    if (!stored || !kit.canRestore(stored)) return;
    const { entry } = stored;
    const host = target.entry;
    const beforeHost = host && captureTransform(host);
    const doorPose = entry.buildingId && captureTransform(entry);
    stored.restore();
    const beforePose = doorPose || captureTransform(entry);
    refreshAffected(entry);
    setPlacement();
    select(entry);
    canvas.focus({ preventScroll: true });
    remember();
    if (host) kit.mountDoor(entry, target);
    else {
      entry.root.position.x = target.position.x;
      entry.root.position.z = target.position.z;
    }
    changed(false);
    const afterPose = captureTransform(entry);
    const afterHost = host && captureTransform(host);
    let removal = stored;
    record({
      undo() {
        applyTransform(entry, beforePose);
        removal = kit.takeOffMap(entry);
        removeOptions(removal);
        if (host) applyTransform(host, beforeHost);
        select(null);
      },
      redo() {
        removal.restore();
        if (host) applyTransform(host, afterHost);
        applyTransform(entry, afterPose);
      }
    });
    finishLayoutChange();
    message(`${entry.label} placed.`);
  }

  function clearToDeck(points) {
    if (gizmo.dragging || pointer?.captured || deckDrag.busy) return;
    const previous = kit.map.boundary;
    const boundary = points ? { ...previous, points: structuredClone(points) } : previous;
    if (points) boundary.walls = perimeterWalls({ ...kit.map, boundary });
    setPlacement();
    if (points) land.end();
    let removals;
    function clear() {
      removals = [];
      for (const entry of [...entries.values()]) {
        if (entry.buildingId || entry.id === 'pool-portal') continue;
        const removal = kit.takeOffMap(entry);
        removals.push(removal);
        removeOptions(removal);
      }
      kit.map.boundary = boundary;
      select(null);
    }
    clear();
    if (removals.length || boundary !== previous) {
      deckSearch.value = '';
      record({
        undo() {
          kit.map.boundary = previous;
          for (const removal of removals) removal.restore();
          for (const entry of entries.values()) refreshEntry(entry);
        },
        redo: clear,
        fit: boundary !== previous
      });
      finishLayoutChange();
    }
    fit();
    if (points) canvas.focus({ preventScroll: true });
    message(points ? 'Empty Stamford campus loaded.' : `Stored ${removals.length} objects.`);
  }

  function surveyDraft() {
    const pool = entries.get('pool');
    const local = new THREE.Vector3();
    const buildings = [...entries.values()].filter((entry) => entry.building).map(({ root, spec }) =>
      buildingOutline(spec).map(([x, z]) => {
        root.localToWorld(local.set(x, 0, z));
        return [local.x, local.z];
      }));
    function score(boundary) {
      if (pool && !poolFits(boundary, pool.root.position.x, pool.root.position.z, pool.root)) return -1;
      const contained = buildings.filter((footprint) => fitsLand(boundary, footprint)).length;
      return contained === buildings.length ? Infinity : contained;
    }
    const points = fitStamfordSurvey(kit.map.boundary, campusGatePose(kit.map), score);
    const contained = score({ points });
    if (contained < 0) message('The survey outline crosses the pool. Move the pool or adjust the draft before applying.');
    else if (Number.isFinite(contained)) message(`${buildings.length - contained} building footprints extend past the survey outline.`);
    else message('Survey outline ready to apply.');
    return points;
  }

  function commitBoundary(boundary) {
    const pool = entries.get('pool');
    if (pool && !poolFits(boundary, pool.root.position.x, pool.root.position.z)) {
      message('Store or move the pool before drawing a boundary through it.');
      return false;
    }
    const previous = kit.map.boundary;
    kit.map.boundary = boundary;
    boundary.walls = perimeterWalls(kit.map);
    kit.syncPerimeter?.();
    record({
      undo() { kit.map.boundary = previous; kit.syncPerimeter?.(); resize(); },
      redo() { kit.map.boundary = boundary; kit.syncPerimeter?.(); resize(); }
    });
    onLayoutChange();
    resize();
    message('Land boundary applied.');
    return true;
  }

  function download() {
    const blob = new Blob([JSON.stringify(kit.map, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'CAMPUS_MAP.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('CAMPUS_MAP.json downloaded.');
  }

  document.getElementById('editor-close').addEventListener('click', toggle);
  clearButton.addEventListener('click', () => clearToDeck());
  document.getElementById('editor-land-preset').addEventListener('click', () => clearToDeck(stamfordLandOutline));
  storeButton.addEventListener('click', storeSelection);
  duplicateButton.addEventListener('click', duplicateSelection);
  undoButton.addEventListener('click', () => stepHistory(false));
  redoButton.addEventListener('click', () => stepHistory(true));
  grid.addEventListener('change', () => land.refresh());
  for (const button of categoryButtons) {
    button.addEventListener('click', () => {
      activeDeckCategory = button.dataset.deckCategory;
      for (const btn of categoryButtons) {
        const isMatch = btn.dataset.deckCategory === activeDeckCategory;
        btn.setAttribute('aria-selected', String(isMatch));
        btn.classList.toggle('is-active', isMatch);
      }
      refreshDeck();
    });
  }
  if (sliceButton) sliceButton.addEventListener('click', () => setSliceMode(!sliceMode));
  if (wallDelete) wallDelete.addEventListener('click', deleteSelectedWall);
  if (wallReset) wallReset.addEventListener('click', resetPerimeterWalls);
  deckSearch.addEventListener('input', () => {
    deckList.scrollLeft = 0;
    refreshDeck();
  });
  confirm.addEventListener('close', () => {
    const stored = pendingDelete;
    pendingDelete = null;
    if (confirm.returnValue !== 'delete' || !stored || !parked.has(stored.entry.id)) return;
    setPlacement();
    const id = stored.entry.id;
    let removals;
    function removeStored() {
      removals = [...parked.values()].filter(({ entry }) => entry.id === id || entry.buildingId === id);
      for (const removal of removals) kit.removeFromDeck(removal);
    }
    removeStored();
    record({
      undo() {
        for (const removal of removals) removal.setState('deck');
      },
      redo: removeStored
    });
    finishLayoutChange();
    canvas.focus({ preventScroll: true });
    message(`Deleted ${stored.entry.label} from the deck.`);
  });

  function openRenameDialog(entry) {
    if (!entry || !renameDialog) return;
    pendingRename = entry;
    if (renameInput) renameInput.value = entry.label;
    renameDialog.showModal();
    renameInput?.select();
  }

  if (renameForm) {
    renameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const target = pendingRename;
      pendingRename = null;
      renameDialog.close();
      if (!target) return;
      const newLabel = renameInput ? renameInput.value.trim() : '';
      if (newLabel && newLabel !== target.label) {
        renameEntry(target, newLabel);
      }
    });
  }

  if (renameCancel) {
    renameCancel.addEventListener('click', () => {
      pendingRename = null;
      renameDialog.close();
    });
  }

  renameDialog?.addEventListener('close', () => {
    pendingRename = null;
  });

  document.getElementById('editor-fit').addEventListener('click', fit);
  document.getElementById('editor-tilt').addEventListener('click', () => {
    const overhead = orbit.getPolarAngle() < 0.5;
    const radius = camera.position.distanceTo(orbit.target);
    camera.position.set(0, overhead ? 0.75 : 0.95, overhead ? 0.66 : 0.32).setLength(radius).add(orbit.target);
    orbit.update();
  });
  document.getElementById('editor-focus').addEventListener('click', () => {
    if (!selected) return;
    selected.bounds.getSize(size);
    selected.bounds.getCenter(aim);
    camera.position.add(aim.sub(orbit.target));
    orbit.target.add(aim);
    camera.zoom = THREE.MathUtils.clamp((camera.top - camera.bottom) / Math.max(9, size.length() * 2), 0.5, 11);
    camera.updateProjectionMatrix();
    orbit.update();
  });
  document.getElementById('editor-download-json').addEventListener('click', download);
  document.getElementById('editor-copy-json').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(kit.map, null, 2) + '\n');
      message('Map JSON copied.');
    } catch {
      message('Clipboard unavailable. Use Export JSON to save the map.');
    }
  });

  function showImportError(msg) {
    if (!importFeedback) return;
    importFeedback.textContent = msg;
    importFeedback.hidden = false;
  }

  function clearImportError() {
    if (!importFeedback) return;
    importFeedback.textContent = '';
    importFeedback.hidden = true;
  }

  function openImportDialog() {
    clearImportError();
    if (importFilename) importFilename.textContent = 'No file selected';
    if (importText) importText.value = '';
    if (importFile) importFile.value = '';
    if (importDialog) {
      importDialog.showModal();
      importText?.focus();
    }
  }

  function closeImportDialog() {
    if (importDialog?.open) importDialog.close();
    canvas.focus({ preventScroll: true });
  }

  function handleFileSelected(file) {
    if (!file) return;
    if (importFilename) importFilename.textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      if (importText) {
        importText.value = String(reader.result ?? '');
        clearImportError();
        importText.focus();
      }
    };
    reader.onerror = () => {
      showImportError('Failed to read the selected file.');
    };
    reader.readAsText(file);
  }

  function applyImport() {
    const raw = importText?.value.trim() ?? '';
    if (!raw) {
      showImportError('Please choose a JSON file or paste JSON code.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      showImportError(`Invalid JSON format: ${e.message}`);
      return;
    }
    const check = validateCampusLayout(parsed);
    if (!check.valid) {
      showImportError(check.error || 'Invalid campus layout schema.');
      return;
    }

    try {
      const doImport = onImportLayout ?? kit.saveLayout;
      if (typeof doImport === 'function') {
        doImport(parsed);
      }
      closeImportDialog();
      const url = new URL(window.location.href);
      url.searchParams.set('editor', '1');
      window.location.href = url.toString();
    } catch (err) {
      showImportError(`Failed to save layout: ${err.message}`);
    }
  }

  if (importButton && importDialog) {
    importButton.addEventListener('click', openImportDialog);
    importBrowse?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', () => {
      if (importFile.files?.[0]) handleFileSelected(importFile.files[0]);
    });
    importText?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    importText?.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileSelected(file);
    });
    importText?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        applyImport();
      }
    });
    importApply?.addEventListener('click', applyImport);
    importCancel?.addEventListener('click', closeImportDialog);
    importDialog.addEventListener('cancel', () => {
      canvas.focus({ preventScroll: true });
    });
  }
  picker.addEventListener('change', () => {
    setPlacement();
    select(entries.get(picker.value));
    canvas.focus({ preventScroll: true });
  });
  for (const button of tools) button.addEventListener('click', () => mode(button.dataset.editorMode));
  for (const input of fields) {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
    });
    input.addEventListener('change', () => {
      if (!selected || input.disabled || !Number.isFinite(input.valueAsNumber)) return;
      const value = input.valueAsNumber;
      const [kind, axis] = input.dataset.transform.split('.');
      beginTransform();
      if (kind === 'door') {
        kit.moveDoor(selected, value);
      } else if (kind === 'scale' && selected.building) {
        const { width, depth, floors } = selected.spec;
        selected.building.resize(axis === 'x' ? value : width, axis === 'z' ? value : depth, axis === 'y' ? value : floors);
      } else if (kind === 'yaw') selected.root.rotation.y = THREE.MathUtils.degToRad(value % 360);
      else if (kind === 'scale') selected.root.scale[axis] = selected.baseScale[axis] * value / 100;
      else selected.root.position[axis] = value;
      changed();
    });
    input.addEventListener('blur', updateFields);
  }

  if (nameInput) {
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        nameInput.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (selected) nameInput.value = selected.label;
        nameInput.blur();
      }
    });
    nameInput.addEventListener('change', () => {
      if (!selected) return;
      const clean = nameInput.value.trim();
      if (!clean) {
        nameInput.value = selected.label;
        return;
      }
      if (clean !== selected.label) {
        renameEntry(selected, clean);
      }
    });
  }

  addEventListener('keydown', (event) => {
    if (!active || event.defaultPrevented || event.altKey || confirm.open || importDialog?.open || renameDialog?.open) return;
    const editingText = event.target.matches?.('input, select, textarea') || event.target.isContentEditable;
    if (event.ctrlKey || event.metaKey) {
      if (editingText || !['KeyZ', 'KeyD'].includes(event.code)) return;
      event.preventDefault();
      if (event.repeat || gizmo.dragging || pointer?.captured) return;
      if (event.code === 'KeyZ') stepHistory(event.shiftKey);
      else duplicateSelection();
      return;
    }
    if (event.code === 'KeyC' && !editingText && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setSliceMode(!sliceMode);
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      if (deckDrag.cancel()) return;
      if (sliceMode) {
        setSliceMode(false);
        return;
      }
      if (selectedWall) {
        selectWall(null);
        return;
      }
      if (pointer?.captured) endPointer({ pointerId: pointer.id, type: 'lostpointercapture' }, true);
      else if (placement) setPlacement();
      else if (land.active) land.end();
      else toggle();
      return;
    }
    if (selectedWall && !editingText && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      if (!event.repeat) deleteSelectedWall();
      return;
    }
    if (land.active && !editingText && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      if (!event.repeat) land.deleteCorner();
      return;
    }
    if (editingText || !selected || placement || gizmo.dragging) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!event.repeat) storeSelection();
      return;
    }
    if (selected.buildingId) return;
    const transform = modes[event.code];
    const nudge = nudges[event.code];
    if (transform) mode(transform);
    else if (nudge || event.code === 'KeyQ' || event.code === 'KeyT') {
      beginTransform();
      if (nudge) selected.root.position[nudge[0]] += nudge[1] * (event.shiftKey ? 5 : 1);
      else selected.root.rotation.y += THREE.MathUtils.degToRad(event.code === 'KeyQ' ? -15 : 15);
      changed();
    } else return;
    event.preventDefault();
  });

  select(null);
  return {
    toggle,
    get active() { return active; },
    update() {
      if (!active) return;
      if (width !== canvas.clientWidth || height !== canvas.clientHeight) resize();
      orbit.update();
      if (resizeQueued && performance.now() - lastResize >= 75) {
        resizeFromHandle(false);
        lastResize = performance.now();
      }
    },
    refresh(id) {
      refreshEntry(entries.get(id));
    },
    rename(id, newLabel) {
      const entry = entries.get(id) ?? parked.get(id)?.entry;
      if (entry) renameEntry(entry, newLabel);
    }
  };
}
