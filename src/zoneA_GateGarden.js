import * as THREE from 'three';
import { addLocalCollider, sign } from './buildingFactory.js';
import { batchStaticMeshes, box, cylinder, groupAt } from './sceneKit.js';

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
    addLocalCollider(colliders, gate, px, 0, pillar + 0.18, 1.65);
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
    addLocalCollider(colliders, wing, 0, -depth / 2, 0.15, depth);
  }
  box(gate, m.concrete, [span + 0.21, 0.2, 1.42], [0, height - 1.04, 0]);
  box(gate, m.blue, [span + 0.12, 1.14, 1.13], [0, height - 0.38, 0]);
  box(gate, m.gate, [span + 0.39, 0.14, 1.32], [0, height + 0.23, 0]);
  for (const side of [-1, 1]) sign(gate, {
    title: 'STAMFORD UNIVERSITY BANGLADESH',
    subtitle: '51 SIDDHESWARI ROAD   •   DHAKA 1217',
    position: [0, height - 0.38, side * 0.571], width: span + 0.03, height: 1.08,
    yaw: side > 0 ? 0 : Math.PI, background: map.palette.campusBlue, seal: true, serif: true
  });
  kit.layout.add('entry-gate', gate);
  kit.refreshColliders(gate);

  kit.building(zone, 'guard', 'guard', {
    awning: true,
    doors: [{ x: -1.35, title: 'Guard Room', width: 1.06, height: 1.94 }],
    windows: [{ x: 0.83, width: 1.68, height: 1.12 }]
  });
  kit.building(zone, 'guardian', 'guard', {
    awning: true,
    doors: [{ x: 1.24, title: 'Guardian Room', width: 1.05, height: 1.94, signWidth: 1.74 }],
    windows: [{ x: -0.84, width: 1.73, height: 1.12 }]
  });
  for (const pz of [19.4, 23.8, 29.8]) kit.planter(zone, -10.28, pz, 0.37, 71 + pz);

  const garden = map.garden;
  const lawn = groupAt(zone, 'Front garden lawn and curb', [garden.x, 0, garden.z]);
  kit.layout.add('garden', lawn, garden, { surface: true });
  const disk = new THREE.Mesh(new THREE.CircleGeometry(1, 72), m.grass);
  disk.userData.grade = true;
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 0.037;
  disk.scale.set(garden.radiusX, garden.radiusZ, 1);
  disk.receiveShadow = true;
  lawn.add(disk);
  for (let index = 0; index < 64; index++) {
    const angle = (index + 0.5) * Math.PI * 2 / 64;
    const dx = -Math.sin(angle) * garden.radiusX;
    const dz = Math.cos(angle) * garden.radiusZ;
    const px = Math.cos(angle) * garden.radiusX;
    const pz = Math.sin(angle) * garden.radiusZ;
    const curb = box(lawn, index % 2 ? m.white : m.black,
      [Math.hypot(dx, dz) * Math.PI / 32 + 0.025, 0.2, 0.28], [px, 0.108, pz]);
    curb.rotation.y = -Math.atan2(dz, dx);
  }
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
  kit.direction(zone, { x: 3.2, z: 25.7, title: 'FRONT GARDEN', subtitle: 'CSE AHEAD  •  ADMISSION ↗', width: 2.9 });

  const barrier = kit.prop(zone, 'barrier', 'Raised driveway barrier', 3, 27.8);
  cylinder(barrier, m.black, 0.13, 0.87, [0, 0.435, 0]);
  const beam = groupAt(barrier, 'Striped barrier arm', [0, 0.83, 0]);
  beam.rotation.z = 1.24;
  for (let index = 0; index < 12; index++) {
    box(beam, index % 2 ? m.white : m.black, [0.36, 0.093, 0.078], [index * 0.36, 0, 0]);
  }
  batchStaticMeshes(zone);
}
