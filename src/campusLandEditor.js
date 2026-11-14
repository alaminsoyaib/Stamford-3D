import * as THREE from 'three';
import { closestOnEdge, landArea, landCorners, landExtent, validLandOutline } from './campusBoundary.js';
import { rounded } from './campusLayout.js';

export function createLandEditor(scene, panel, map, { input, commit, message, onMode }) {
  const form = panel.querySelector('#editor-land');
  const toggle = panel.querySelector('#editor-land-toggle');
  const size = panel.querySelector('#editor-land-size');
  const count = panel.querySelector('#editor-land-corners');
  const coordinateX = panel.querySelector('#editor-land-x');
  const coordinateZ = panel.querySelector('#editor-land-z');
  const remove = panel.querySelector('#editor-land-remove');
  const apply = panel.querySelector('#editor-land-apply');
  const instructions = panel.querySelector('#editor-land-help');
  const grid = new THREE.GridHelper(1, 2, 0x4a7091, 0x415c73);
  const border = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
    color: 0x84bcf7, depthTest: false, fog: false, toneMapped: false
  }));
  const markers = new THREE.Points(border.geometry, new THREE.PointsMaterial({
    color: 0xb7dbff, size: 12, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false
  }));
  const cursor = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), new THREE.PointsMaterial({
    color: 0xffffff, size: 16, sizeAttenuation: false, depthTest: false, fog: false, toneMapped: false
  }));
  const world = new THREE.Vector3();
  let points = null;
  let corner = -1;
  let visible = false;
  let valid = true;
  let gridSpacing;

  grid.material.transparent = true;
  grid.material.opacity = 0.29;
  grid.material.depthWrite = false;
  grid.material.fog = false;
  grid.material.toneMapped = false;
  // Keep the grid above campus grade and below buildings and the boundary handles.
  grid.position.y = 0.065;
  grid.renderOrder = 1;
  border.renderOrder = 980;
  markers.renderOrder = 981;
  cursor.renderOrder = 982;
  scene.add(grid, border, markers, cursor);

  function updateGrid() {
    const { minX, maxX, minZ, maxZ } = landExtent(points?.length ? { points } : map.boundary);
    const spacing = input() || 5;
    const extent = Math.max(160, maxX - minX + 48, maxZ - minZ + 48);
    const gridStep = spacing * Math.max(1, Math.ceil(extent / spacing / 100));
    const divisions = Math.ceil(extent / gridStep / 2) * 2;
    const span = divisions * gridStep;
    if (gridSpacing !== divisions) {
      const helper = new THREE.GridHelper(1, divisions, 0x4a7091, 0x415c73);
      grid.geometry.dispose();
      grid.geometry = helper.geometry;
      helper.material.dispose();
      gridSpacing = divisions;
    }
    grid.scale.set(span, 1, span);
    grid.position.x = Math.round((minX + maxX) / 2 / spacing) * spacing;
    grid.position.z = Math.round((minZ + maxZ) / 2 / spacing) * spacing;
  }

  function refresh() {
    const outline = points ?? landCorners(map.boundary);
    const vertices = outline.map(([x, z]) => new THREE.Vector3(x, 0.13, z));
    border.geometry.dispose();
    border.geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    markers.geometry = border.geometry;
    valid = points === null || validLandOutline(points);
    border.material.color.set(valid ? 0x84bcf7 : 0xf58f87);
    const current = points?.[corner];
    if (current) cursor.position.set(current[0], 0.14, current[1]);
    grid.visible = border.visible = visible;
    markers.visible = visible && points !== null;
    cursor.visible = markers.visible && Boolean(current);
    size.value = `${Math.round(landArea(outline)).toLocaleString()} m²`;
    count.value = points ? `${points.length} corners` : '';
    instructions.textContent = valid ? 'Drag a corner or click to add one.'
      : points.length < 3 ? 'Place at least three corners.' : 'Use an outline with area and no crossing edges.';
    apply.disabled = !valid;
    remove.disabled = !points || points.length <= 3 || corner < 0;
    coordinateX.disabled = coordinateZ.disabled = !current;
    coordinateX.value = current?.[0] ?? '';
    coordinateZ.value = current?.[1] ?? '';
    updateGrid();
  }

  function begin(redraw = false) {
    points = redraw ? [] : structuredClone(landCorners(map.boundary));
    corner = -1;
    form.hidden = false;
    panel.querySelector('#editor-object-panel').hidden = true;
    toggle.setAttribute('aria-pressed', 'true');
    refresh();
    onMode(true);
  }

  function end() {
    points = null;
    corner = -1;
    form.hidden = true;
    panel.querySelector('#editor-object-panel').hidden = false;
    toggle.setAttribute('aria-pressed', 'false');
    refresh();
    onMode(false);
  }

  function save() {
    if (!valid) {
      message('Draw at least three corners without crossing edges.');
      return;
    }
    if (JSON.stringify(points) === JSON.stringify(landCorners(map.boundary))) {
      end();
      return;
    }
    if (commit({ ...map.boundary, points: structuredClone(points) })) end();
  }

  function worldToPixel(point, camera, rect) {
    world.set(point[0], 0.13, point[1]).project(camera);
    return [(world.x + 1) * rect.width / 2, (1 - world.y) * rect.height / 2];
  }

  function findCorner(event, camera, rect) {
    const radius = event.pointerType === 'touch' ? 22 : 13;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = radius;
    let result = -1;
    for (const [index, point] of points.entries()) {
      const [px, py] = worldToPixel(point, camera, rect);
      const distance = Math.hypot(px - x, py - y);
      if (distance < best) {
        best = distance;
        result = index;
      }
    }
    return result;
  }

  function add(point, camera, rect) {
    const [x, z] = point;
    let next = points.length;
    let best = 20;
    if (points.length >= 3) {
      const [px, py] = worldToPixel(point, camera, rect);
      for (const [index, a] of points.entries()) {
        const b = points[(index + 1) % points.length];
        const aPixel = worldToPixel(a, camera, rect);
        const bPixel = worldToPixel(b, camera, rect);
        const [edgeX, edgeY] = closestOnEdge(px, py, aPixel, bPixel);
        const distance = Math.hypot(px - edgeX, py - edgeY);
        if (distance < best) {
          best = distance;
          next = index + 1;
        }
      }
    }
    points.splice(next, 0, [rounded(x), rounded(z)]);
    corner = next;
    refresh();
  }

  function move(point) {
    if (corner < 0) return;
    points[corner] = point.map(rounded);
    refresh();
  }

  function deleteCorner() {
    if (remove.disabled) return;
    points.splice(corner, 1);
    corner = -1;
    refresh();
  }

  toggle.addEventListener('click', () => { if (points) end(); else begin(); });
  form.querySelector('#editor-land-redraw').addEventListener('click', () => begin(true));
  form.querySelector('#editor-land-cancel').addEventListener('click', end);
  apply.addEventListener('click', save);
  remove.addEventListener('click', deleteCorner);
  for (const field of [coordinateX, coordinateZ]) {
    field.addEventListener('change', () => {
      const point = [coordinateX.valueAsNumber, coordinateZ.valueAsNumber];
      if (point.every(Number.isFinite)) move(point);
      else refresh();
    });
  }

  refresh();
  return {
    get active() { return points !== null; },
    end, refresh, findCorner, add, move, deleteCorner,
    getCorner(index) { return points[index].slice(); },
    select(index) { corner = index; refresh(); },
    setVisible(value) {
      visible = value;
      refresh();
    }
  };
}
