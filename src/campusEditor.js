import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { maxBuildingFloors, maxBuildingSpan } from './buildingFactory.js';
import { limitScale, rounded } from './campusLayout.js';

const modes = { KeyG: 'translate', KeyR: 'rotate', KeyS: 'scale' };
const nudges = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['z', -1], ArrowDown: ['z', 1] };
const historyLimit = 50;
const placeTips = {
  tree: 'Click or tap the ground to plant a tree.',
  building: 'Click or tap the ground to place a building.',
  door: 'Click or drop near the edge of a building to attach a door to that wall.'
};

export function createCampusEditor(runtime, kit, onEdit, onToggle, onLayoutChange) {
  const { renderer, scene } = runtime;
  const canvas = renderer.domElement;
  const panel = document.getElementById('layout-editor');
  const picker = document.getElementById('editor-object');
  const fields = [...panel.querySelectorAll('[data-transform]')];
  const sizeLabels = [...panel.querySelectorAll('[data-size-label]')];
  const tools = [...panel.querySelectorAll('[data-editor-mode]')];
  const feedback = document.getElementById('editor-feedback');
  const { objects: entries, captureTransform, restoreTransform } = kit.layout;
  const undo = [];
  const redo = [];
  const palette = [...panel.querySelectorAll('[data-place]')];
  const placementStatus = document.getElementById('editor-placement');
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
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 32), new THREE.MeshBasicMaterial({
    color: 0xe7fcaf, side: THREE.DoubleSide, depthTest: false
  }));
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 999;
  marker.visible = false;
  const resizeHandle = new THREE.Object3D();
  let selected = null;
  let active = false;
  let pointer = null;
  let width;
  let height;
  let timer;
  let placement = null;
  let paletteDrag = false;
  let dimensions;
  let resizeQueued = false;
  let lastResize = 0;
  let beforeEdit = null;

  outline.material.depthTest = false;
  outline.material.fog = false;
  outline.renderOrder = 1000;
  outline.visible = false;
  scene.add(outline, gizmo.getHelper(), resizeHandle, marker);
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
    const half = Math.max(77, 68 / aspect);
    Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    if (width <= 620) camera.setViewOffset(width, height, 0, height * 0.2, width, height);
    else camera.clearViewOffset();
  }

  function fit() {
    const { minX, maxX, minZ, streetZ } = kit.map.boundary;
    orbit.target.set((minX + maxX) / 2, 0, (minZ + streetZ) / 2);
    camera.position.copy(orbit.target).add(new THREE.Vector3(0, 162, 55));
    camera.zoom = 1;
    resize();
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
      : door ? `Attached to the ${spec.wall} wall` : '';
  }

  function mode(value) {
    gizmo.setMode(value);
    gizmo.showX = gizmo.showZ = value !== 'rotate';
    gizmo.showY = value === 'rotate' || (value === 'scale' && !selected?.surface)
      || (value === 'translate' && Boolean(selected?.elevation));
    if (!selected || selected.buildingId || placement) gizmo.detach();
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
    selected = entry;
    picker.value = entry?.id ?? '';
    outline.visible = Boolean(entry);
    document.getElementById('editor-focus').disabled = !entry;
    document.getElementById('editor-fields').disabled = !entry;
    for (const button of tools) button.disabled = !entry || Boolean(entry.buildingId);
    if (entry) {
      outline.box = entry.bounds;
      mode(gizmo.getMode());
    } else {
      gizmo.detach();
    }
    updateFields();
  }

  function refreshEntry(entry) {
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
    if (commit && beforeEdit && JSON.stringify(beforeEdit) === JSON.stringify(captureTransform(selected))) {
      beforeEdit = null;
      updateFields();
      return;
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

  function wallPlacement(host) {
    let closest;
    let distance = Infinity;
    for (const entry of host ? [host] : entries.values()) {
      if (!entry.building) continue;
      entry.root.worldToLocal(localPoint.copy(groundPoint));
      const { width, depth } = entry.spec;
      if (Math.abs(localPoint.x) > width / 2 + 2 || Math.abs(localPoint.z) > depth / 2 + 2) continue;
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
    pointRay(event);
    if (!ray.ray.intersectPlane(ground, groundPoint)) return null;
    if (placement === 'door') {
      const hit = pick(event);
      const host = hit?.building ? hit : entries.get(hit?.buildingId);
      if (host) {
        // Use the visible wall or roof hit even when the ground ray lands beyond the building.
        const [contact] = ray.intersectObjects(hit.meshes, false);
        if (contact) groundPoint.copy(contact.point);
      }
      return wallPlacement(host);
    }
    const { minX, maxX, minZ, maxZ } = kit.map.boundary;
    return groundPoint.x >= minX && groundPoint.x <= maxX && groundPoint.z >= minZ && groundPoint.z <= maxZ;
  }

  function showPlacement(event) {
    if (!active || !placement) return;
    const target = placementTarget(event);
    marker.visible = Boolean(target);
    if (!target) return;
    if (placement === 'door') {
      const { entry, wall, offset } = target;
      const along = THREE.MathUtils.clamp(offset * wall.span / 2, -wall.span / 2 + 0.9, wall.span / 2 - 0.9);
      marker.position.set(wall.x + along * Math.cos(wall.angle), 0.06, wall.z - along * Math.sin(wall.angle));
      entry.root.localToWorld(marker.position);
      marker.scale.setScalar(0.8);
    } else {
      marker.position.set(groundPoint.x, 0.06, groundPoint.z);
      marker.scale.setScalar(placement === 'building' ? 3 : 1);
    }
  }

  function setPlacement(type = null) {
    placement = type;
    marker.visible = false;
    if (type) document.body.dataset.placement = type;
    else delete document.body.dataset.placement;
    for (const button of palette) button.setAttribute('aria-pressed', String(button.dataset.place === type));
    placementStatus.hidden = !type;
    placementStatus.textContent = type ? placeTips[type] : '';
    mode(gizmo.getMode());
  }

  function place(event) {
    const target = placementTarget(event);
    if (!target) {
      message(placement === 'door' ? 'Choose an exterior wall or a building roof edge.' : 'Choose ground inside the campus boundary.');
      return;
    }
    const host = target.entry;
    const before = host && captureTransform(host);
    const entry = kit.place(scene, placement, { x: rounded(groundPoint.x), z: rounded(groundPoint.z) }, target);
    if (!entry) {
      message('This wall has no room for another door.');
      return;
    }
    refreshAffected(entry);
    setPlacement();
    select(entry);
    remember();
    changed();
    recordPresence(entry, true, null, before, host && captureTransform(host));
    message(`${entry.label} placed.`);
  }

  for (const button of palette) {
    button.addEventListener('click', () => {
      if (!gizmo.dragging) setPlacement(placement === button.dataset.place ? null : button.dataset.place);
    });
    button.addEventListener('dragstart', (event) => {
      if (gizmo.dragging) {
        event.preventDefault();
        return;
      }
      paletteDrag = true;
      setPlacement(button.dataset.place);
      event.dataTransfer.setData('text/plain', placement);
      event.dataTransfer.effectAllowed = 'copy';
    });
    button.addEventListener('dragend', () => {
      paletteDrag = false;
      setPlacement();
    });
  }
  canvas.addEventListener('dragover', (event) => {
    if (!active || !paletteDrag || !placement) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    showPlacement(event);
  });
  canvas.addEventListener('drop', (event) => {
    if (!active || !paletteDrag || !placement) return;
    event.preventDefault();
    place(event);
  });
  canvas.addEventListener('pointermove', showPlacement);
  canvas.addEventListener('pointerleave', () => { marker.visible = false; });
  canvas.addEventListener('dragleave', () => { marker.visible = false; });
  canvas.addEventListener('pointerdown', (event) => {
    if (!active || !event.isPrimary || event.button !== 0 || gizmo.dragging) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    pointer = null;
    if (!active || distance > 5) return;
    if (placement) place(event);
    else select(pick(event));
  }, { capture: true });
  canvas.addEventListener('pointercancel', () => {
    pointer = null;
    if (gizmo.dragging) gizmo.pointerUp(null);
  });
  function toggle() {
    if (gizmo.dragging) gizmo.pointerUp(null);
    active = !active;
    document.body.dataset.editor = String(active);
    runtime.setView(active ? camera : null);
    panel.hidden = !active;
    gizmo.enabled = orbit.enabled = active;
    pointer = null;
    if (active) {
      fit();
      canvas.focus({ preventScroll: true });
    } else {
      setPlacement();
      select(null);
      document.querySelector('[data-action="KeyE"]').focus({ preventScroll: true });
    }
    onToggle(active);
  }

  function message(text) {
    feedback.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => { feedback.textContent = ''; }, 4800);
  }

  function refreshAffected(entry) {
    if (entry.buildingId) refreshBuilding(entries.get(entry.buildingId));
    else if (entry.building) refreshBuilding(entry);
    else refreshEntry(entry);
  }

  function removeOptions({ items }) {
    for (const item of items) {
      item.option.remove();
      item.option = null;
    }
  }

  function recordPresence(entry, placed, removal, beforeHost, afterHost) {
    function apply(present, hostState) {
      if (present) removal.restore();
      else {
        removal = kit.remove(entry);
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
    const source = forward ? redo : undo;
    const destination = forward ? undo : redo;
    const change = source.pop();
    if (!change) {
      message(forward ? 'Nothing to redo.' : 'Nothing to undo.');
      return;
    }
    setPlacement();
    change[forward ? 'redo' : 'undo']();
    destination.push(change);
    onLayoutChange();
    message(forward ? 'Redid the last edit.' : 'Undid the last edit.');
  }

  function deleteSelection() {
    const entry = selected;
    const host = entries.get(entry.buildingId);
    const before = host && captureTransform(host);
    const removed = kit.remove(entry);
    if (!removed) {
      message('The pool and its portal are required for the underwater route.');
      return;
    }
    select(null);
    removeOptions(removed);
    if (host) refreshBuilding(host);
    recordPresence(entry, false, removed, before, host && captureTransform(host));
    onLayoutChange();
    message(`Removed ${entry.label}.`);
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

  addEventListener('keydown', (event) => {
    if (!active || event.defaultPrevented || event.altKey) return;
    const editingText = event.target.matches?.('input, select, textarea') || event.target.isContentEditable;
    if (event.ctrlKey || event.metaKey) {
      if (event.code !== 'KeyZ' || editingText) return;
      event.preventDefault();
      if (!event.repeat && !gizmo.dragging) stepHistory(event.shiftKey);
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      if (placement) setPlacement();
      else toggle();
      return;
    }
    if (editingText || !selected || placement || gizmo.dragging) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!event.repeat) deleteSelection();
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
    }
  };
}
