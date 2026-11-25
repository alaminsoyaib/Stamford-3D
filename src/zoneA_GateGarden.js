import * as THREE from 'three';
import { addLocalCollider, sign } from './buildingFactory.js';
import { surveyTreeId } from './campusFootprints.js';
import { buildGatePlatform } from './gatePlatform.js';
import { buildGatePlantingBed } from './gatePlantingBed.js';
import { createGateRoomModels } from './gateRooms.js';
import { batchStaticMeshes, box, cylinder, groupAt } from './sceneKit.js';

function buildSurveyCurb(lawn, rim, height, materials) {
  // Keep the outside face on the survey trace. Join the inside corners with mitres.
  const area = rim.reduce((sum, [x, z], i) => {
    const [nx, nz] = rim[(i + 1) % rim.length];
    return sum + x * nz - z * nx;
  }, 0);
  const winding = Math.sign(area) || 1;
  const normals = rim.map(([x, z], i) => {
    const [nx, nz] = rim[(i + 1) % rim.length];
    const length = Math.hypot(nx - x, nz - z) || 1;
    return [winding * (z - nz) / length, winding * (nx - x) / length];
  });
  const inside = rim.map(([x, z], i) => {
    const [px, pz] = normals[(i + rim.length - 1) % rim.length];
    const [nx, nz] = normals[i];
    const offset = 0.28 / Math.max(0.25, 1 + px * nx + pz * nz);
    return [x + (px + nx) * offset, z + (pz + nz) * offset];
  });
  const surfaces = [[], []];
  const vertex = ([x, z], y) => [x, y, z];
  for (const [i, a] of rim.entries()) {
    const next = (i + 1) % rim.length;
    const b = rim[next], c = inside[i], d = inside[next];
    const triangles = surfaces[Math.floor(i / 2) % 2];
    const quad = (p, q, r, s) => {
      if (winding > 0) triangles.push(...p, ...q, ...r, ...p, ...r, ...s);
      else triangles.push(...p, ...r, ...q, ...p, ...s, ...r);
    };
    quad(vertex(a, height), vertex(c, height), vertex(d, height), vertex(b, height));
    quad(vertex(a, 0), vertex(a, height), vertex(b, height), vertex(b, 0));
    quad(vertex(c, height), vertex(c, 0), vertex(d, 0), vertex(d, height));
  }
  for (const [i, positions] of surfaces.entries()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, i ? materials.white : materials.black);
    mesh.castShadow = mesh.receiveShadow = true;
    lawn.add(mesh);
  }
}

export function buildGateGarden(scene, kit) {
  const { map, materials: m, colliders } = kit;
  const zone = groupAt(scene, 'Zone A · Gate and Front Garden', [0, 0, 0]);
  const { x, z, opening, pillar, height } = map.gate;
  const gate = groupAt(zone, 'Main Campus Entry Gate', [x, 0, z]);
  const span = opening + pillar * 2;
  for (const side of [-1, 1]) {
    const px = side * (opening + pillar) / 2;
    box(gate, m.brick, [pillar, height - 0.61, 1.53], [px, (height - 0.61) / 2, 0]);
    box(gate, m.concrete, [pillar + 0.18, 0.32, 1.65], [px, 0.16, 0]);
    box(gate, m.concrete, [pillar + 0.29, 0.19, 1.73], [px, height - 0.64, 0]);
    addLocalCollider(colliders, gate, px, 0, pillar + 0.29, 1.73, true, height + 0.30, 0);
    sign(gate, {
      title: side < 0 ? 'WELCOME' : 'CAMPUS ENTRY', subtitle: side < 0 ? 'VISITOR ENTRANCE' : 'DHAKA 1217',
      position: [px, 1.82, 0.779], width: 0.93, height: 0.61,
      background: '#e2d8c3', ink: '#1c3651'
    });
    const wing = groupAt(gate, 'Open blue gate leaf', [side * (opening / 2 - 0.11), 0, -0.39], -side * 0.09);
    const depth = 3.56;
    box(wing, m.gate, [0.12, 1.73, depth], [0, 0.96, -depth / 2]);
    for (let rail = 0; rail <= 13; rail++) {
      const pz = -0.075 - rail * (depth - 0.15) / 13;
      box(wing, m.gate, [0.145, 2.87, 0.052], [0, 1.53, pz]);
    }
    box(wing, m.gate, [0.15, 0.13, depth], [0, 2.99, -depth / 2]);
    addLocalCollider(colliders, wing, 0, -depth / 2, 0.18, depth, true, 3.06, 0);
  }
  box(gate, m.concrete, [span + 0.21, 0.2, 1.42], [0, height - 1.04, 0]);
  box(gate, m.blue, [span + 0.12, 1.14, 1.13], [0, height - 0.38, 0]);
  box(gate, m.gate, [span + 0.39, 0.14, 1.32], [0, height + 0.23, 0]);
  addLocalCollider(colliders, gate, 0, 0, span + 0.39, 1.42, true, height + 0.30, height - 1.14);
  for (const side of [-1, 1]) sign(gate, {
    title: 'STAMFORD UNIVERSITY BANGLADESH',
    subtitle: '51 SIDDHESWARI ROAD   •   DHAKA 1217',
    position: [0, height - 0.38, side * 0.571], width: span + 0.03, height: 1.08,
    yaw: side > 0 ? 0 : Math.PI, background: map.palette.campusBlue, seal: true, serif: true
  });
  kit.layout.add('entry-gate', gate);
  kit.refreshColliders(gate);
  buildGatePlatform(zone, kit, gate);
  buildGatePlantingBed(zone, kit, gate);

  const rooms = createGateRoomModels(kit);
  kit.building(zone, 'guard', 'guard', rooms.guard);
  kit.building(zone, 'guardian', 'guard', rooms.guardian);
  for (const pz of [19.4, 23.8, 29.8]) kit.planter(zone, -10.28, pz, 0.37, 71 + pz);

  const garden = map.garden;
  const lawn = groupAt(zone, 'Front garden lawn and curb', [garden.x, 0, garden.z]);
  kit.layout.add('garden', lawn, garden, { surface: true });
  const rim = garden.points ?? Array.from({ length: 64 }, (_, i) => {
    const angle = i * Math.PI * 2 / 64;
    return [Math.cos(angle) * garden.radiusX, Math.sin(angle) * garden.radiusZ];
  });
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(rim.map(([x, z]) => new THREE.Vector2(x, -z))));
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    geometry.attributes.uv.setXY(i, positions.getX(i) / 4, positions.getY(i) / 4);
  }
  const disk = new THREE.Mesh(geometry, m.grass);
  disk.userData.grade = true;
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 0.037;
  disk.receiveShadow = true;
  lawn.add(disk);
  const curbHeight = 16 * 0.0254; // IMG_3141.JPG measures from paving to the top of the curb.
  if (garden.points) buildSurveyCurb(lawn, rim, curbHeight, m);
  else for (const [index, [x, z]] of rim.entries()) {
    const [nx, nz] = rim[(index + 1) % rim.length];
    const curb = box(lawn, index % 2 ? m.white : m.black,
      [Math.hypot(nx - x, nz - z) + 0.028, curbHeight, 0.28], [(x + nx) / 2, curbHeight / 2, (z + nz) / 2]);
    curb.rotation.y = -Math.atan2(nz - z, nx - x);
  }
  if (!map.surveyTrees) {
    kit.flowerBed(zone, 7.5, 16.7, 3.3, 400, 52);
    kit.flowerBed(zone, 10.6, 21.1, 1.98, 525, 35);
    kit.flowerBed(zone, 0.6, 18.4, 1.68, 536, 25);
    for (const [px, pz, size, type] of [
      [-8.3, 29.5, 1.03, 'palm'], [5.1, 26.7, 1.12, 'palm'],
      [-2.4, 11.8, 0.91, 'palm'], [3.5, 13.5, 0.88, 'palm'], [11.75, 13.2, 1.05, 'palm'],
      [15.1, 17.2, 0.77, 'shade'], [-19.2, 28.2, 1.27, 'shade'],
      [14.5, 26.3, 1.13, 'palm'], [17.9, 26.1, 0.91, 'shade']
    ]) kit.tree(zone, px, pz, size, type, Math.round(px * 113 + pz * 17));
    for (const [px, pz] of [[-1, 15.3], [1.5, 21.5], [4.8, 22.3], [12.3, 20], [14.4, 14.4], [8.4, 11.1]]) {
      kit.shrub(zone, px, pz, 0.84, px * 274 + pz * 63);
    }
    kit.bench(zone, 3.0, 21.16, Math.PI);
    kit.bench(zone, 8.7, 12.8);
    kit.bench(zone, 13.8, 19.9, -Math.PI / 2);
  }
  for (const [index, [tx, tz, radius, type = 'shade']] of (map.surveyTrees ?? []).entries()) {
    const nominalRadius = type === 'banyan' ? 5.8 : 3.5;
    kit.tree(zone, tx, tz, radius / nominalRadius, type, 2020 + index, surveyTreeId(index));
  }
  kit.direction(zone, { x: 3.2, z: 25.7, title: 'FRONT GARDEN', subtitle: 'CSE AHEAD  •  ADMISSION ↗', width: 2.9 });

  const barrier = kit.prop(zone, 'barrier', 'Raised driveway barrier', 3, 27.8);
  cylinder(barrier, m.black, 0.13, 0.87, [0, 0.435, 0]);
  addLocalCollider(colliders, barrier, 0, 0, 0.30, 0.30, true, 0.92, 0);
  const beam = groupAt(barrier, 'Striped barrier arm', [0, 0.83, 0]);
  beam.rotation.z = 1.24;
  for (let index = 0; index < 12; index++) {
    box(beam, index % 2 ? m.white : m.black, [0.36, 0.093, 0.078], [index * 0.36, 0, 0]);
  }
  const beamSpan = 4.14;
  const beamCos = Math.cos(1.24);
  const beamSin = Math.sin(1.24);
  for (let seg = 0; seg < 4; seg++) {
    const s0 = seg * (beamSpan / 4);
    const s1 = (seg + 1) * (beamSpan / 4);
    const segCenterX = ((s0 + s1) / 2) * beamCos;
    const segWidth = Math.max(0.24, (s1 - s0) * beamCos + 0.12);
    addLocalCollider(colliders, barrier, segCenterX, 0, segWidth, 0.14, true,
      0.83 + s1 * beamSin + 0.06, 0.83 + s0 * beamSin - 0.06);
  }
  batchStaticMeshes(zone);
}
