import * as THREE from 'three';
import { floor, sign, standard } from './buildingFactory.js';
import { batchStaticMeshes, box, canvasTexture, groupAt, part, unitPlane } from './sceneKit.js';

const muralMaterials = new Map();

function mural(parent, position, width, palette, title) {
  let material = muralMaterials.get(title);
  if (!material) {
    const texture = canvasTexture(640, 360, (context, w, h) => {
      context.fillStyle = palette[0];
      context.fillRect(0, 0, w, h);
      context.fillStyle = palette[1];
      context.beginPath();
      context.arc(w * 0.68, h * 0.42, h * 0.28, 0, Math.PI * 2);
      context.fill();
      for (let layer = 0; layer < 3; layer++) {
        context.beginPath();
        context.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          context.lineTo(x, h * (0.55 + layer * 0.125) + Math.sin(x * 0.01 + layer) * 28);
        }
        context.lineTo(w, h);
        context.fillStyle = palette[layer + 2];
        context.fill();
      }
      context.fillStyle = palette[4];
      context.font = 'bold 35px Georgia';
      context.fillText(title, 30, 73);
      context.lineWidth = 3;
      context.strokeStyle = palette[4];
      for (let bird = 0; bird < 4; bird++) {
        const x = 310 + bird * 56;
        const y = 71 - 19 * Math.cos(bird * 1.7);
        context.beginPath();
        context.moveTo(x - 9, y - 3);
        context.quadraticCurveTo(x - 4, y - 8, x, y);
        context.quadraticCurveTo(x + 4, y - 8, x + 9, y - 3);
        context.stroke();
      }
    });
    material = standard('#ffffff', { map: texture });
    muralMaterials.set(title, material);
  }
  const mesh = part(parent, unitPlane, material, position, [width, width * 0.5625, 1]);
  mesh.castShadow = false;
}

export function buildCSEAdmission(scene, kit) {
  const { map, materials: m } = kit;
  const zone = groupAt(scene, 'Zone B · CSE and Admission', [0, 0, 0]);
  kit.building(zone, 'cse', 'cse', {
    title: 'STAMFORD UNIVERSITY BANGLADESH', subtitle: 'DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING',
    signWidth: 21.7,
    doors: [
      { x: -6.9, title: 'Prayer Room', width: 1.47 },
      { x: 0.6, title: 'Main CSE Building', width: 2.49, signWidth: 3.21, glass: true }
    ],
    windows: [{ x: 5.75, width: 3.03 }, { x: -3.1, width: 2.73 }],
    details({ root, facade, placeX }) {
      const nameplate = groupAt(root, 'Garden elevation plaque', [placeX(4.9), 0.52, facade + 0.37]);
      box(nameplate, m.blue, [5.45, 0.16, 0.99], [0, -0.23, -0.13]).rotation.x = 0.26;
      const plaque = sign(nameplate, { title: 'STAMFORD', subtitle: 'UNIVERSITY BANGLADESH',
        position: [0, -0.096, -0.09], width: 5.33, height: 0.8, seal: true, serif: true });
      plaque.rotation.x = -1.1;
    }
  });

  kit.building(zone, 'official', 'official', {
    title: 'OFFICIAL BUILDING', subtitle: 'ADMISSION & CAMPUS SERVICES', signWidth: 7.05,
    doors: [
      { x: -4.8, title: 'Admission Office', subtitle: 'ADMISSIONS WELCOME CENTER', width: 2.8, signWidth: 3.92, glass: true },
      { x: 5.6, title: 'Academic Gate 01', width: 2.15, signWidth: 3.0, glass: true }
    ],
    windows: [{ x: -9.5, width: 2.1 }, { x: 0.13, width: 2.14 }, { x: 9.4, width: 2.3 }],
    details({ root, facade, fixtureX }) {
      box(root, m.blue, [4.54, 0.21, 1.21], [fixtureX(-4.8), 2.89, facade + 0.34]).rotation.x = 0.08;
    }
  });
  for (const px of [-7.7, -2.4]) kit.planter(zone, 9 + px, -0.87, 0.39, 44 + px);

  kit.building(zone, 'garage', 'garage', {
    awning: true, title: 'CAMPUS PARKING', minWidth: 5.15,
    details({ root, face, width }) {
      const bays = Math.max(1, Math.floor(width / 5.12));
      for (let bay = 0; bay < bays; bay++) {
        const px = (bay - (bays - 1) / 2) * (width - 0.64) / bays;
        box(root, m.steel, [4.65, 2.32, 0.09], [px, 1.18, face + 0.07]);
        for (let bar = 0; bar < 14; bar++) {
          box(root, m.black, [4.56, 0.038, 0.048], [px, 0.17 + bar * 0.153, face + 0.128]);
        }
      }
    }
  });
  const busSpec = map.buildings.bus ??= { label: 'Varsity Bus', x: 21.6, z: 8.9, yaw: -47, width: 2.89, depth: 8.5, floors: 1 };
  const bus = kit.layout.add('bus', kit.bus(zone, busSpec.x, busSpec.z, THREE.MathUtils.degToRad(busSpec.yaw)), busSpec);
  kit.refreshColliders(bus);
  const parkingSpec = (map.elements ??= {})['bus-parking'] ??= { x: busSpec.x, z: busSpec.z, yaw: busSpec.yaw };
  const parking = groupAt(zone, 'Varsity bus parking markings', [parkingSpec.x, 0, parkingSpec.z]);
  kit.layout.add('bus-parking', parking, parkingSpec, { surface: true });
  floor(parking, standard('#b9b69c'), 0, 0, 4.1, 9.3, 0.012);
  for (const px of [-1.87, 1.87]) floor(parking, m.white, px, 0, 0.1, 9.13, 0.016);
  for (const [x, z, s, type] of [
    [17.8, 3.8, 0.85, 'palm'], [28.6, 17.0, 0.89, 'shade'], [29.25, 5.9, 1.15, 'shade'],
    [-33.9, 7.2, 1.15, 'shade'], [-29.1, 11.3, 0.85, 'palm'], [25.7, -1.8, 0.96, 'palm']
  ]) kit.tree(zone, x, z, s, type, 920 + Math.round(x * 43 + z * 139));
  kit.direction(zone, { x: 28.7, z: 2.65, title: 'LIBRARIES ↗', subtitle: 'CSE  •  PHARMACY  •  LAW', width: 2.7 });
  batchStaticMeshes(zone);

  const corridor = groupAt(scene, 'Zone C · Libraries and Law Corridor', [0, 0, 0]);
  kit.building(corridor, 'lab', 'utility', {
    awning: true, doors: [{ x: -0.75, title: 'High Voltage Lab', width: 1.52, material: m.concrete }],
    windows: [{ x: 1.49, width: 1.22, shade: true }]
  });
  kit.building(corridor, 'washroom', 'utility', {
    awning: true, doors: [{ x: 0.95, title: 'Male Washroom', width: 1.3, signWidth: 1.84, material: m.steel }],
    details({ root, face, placeX }) {
      mural(root, [placeX(-1.28), 1.29, face + 0.063], 2.05,
        ['#dcb66e', '#e57e6b', '#8b9851', '#597342', '#294b50'], 'GROW');
    }
  });

  kit.building(corridor, 'cseLibrary', 'utility', {
    awning: true, title: 'CSE LIBRARY', subtitle: 'STAMFORD UNIVERSITY BANGLADESH', signWidth: 4.25,
    doors: [{ x: -3.71, title: 'Library Entrance', width: 1.78, signWidth: 2.35, glass: true }],
    windows: [{ x: 3.2, width: 1.8, height: 0.98, counter: true }],
    details({ root, face, fixtureX, placeX }) {
      sign(root, { title: 'Bag Counter', position: [fixtureX(3.2), 2.35, face + 0.082], width: 1.87, height: 0.3 });
      mural(root, [placeX(-0.24), 1.32, face + 0.063], 3.2,
        ['#e9cb83', '#c9604e', '#ecaa5d', '#41666d', '#283f43'], 'READ • LEARN');
    }
  });

  kit.building(corridor, 'law', 'utility', {
    title: 'LAW BUILDING', signWidth: 4.23, doors: [{ x: -0.9, title: 'Faculty of Law', width: 1.78, glass: true }],
    windows: [{ x: 2.43, width: 1.55 }]
  });
  kit.direction(corridor, { x: 37.8, z: -11.8, title: 'LAW BUILDING →', subtitle: 'SIDE CORRIDOR', width: 2.68 });

  kit.building(corridor, 'pharmacyLibrary', 'utility', {
    title: 'PHARMACY LIBRARY', subtitle: 'DEPARTMENT OF PHARMACY', signWidth: 4.88,
    doors: [{ x: 1.94, title: 'Pharmacy Library', width: 1.38, signWidth: 2.2, material: m.concrete }],
    windows: [{ x: -2.18, y: 2.26, width: 2.99, height: 0.39 }],
    details({ root, face, fixtureX }) {
      mural(root, [fixtureX(-2.18), 1.17, face + 0.072], 3.39,
        ['#c4d9cd', '#e47e73', '#8fb6af', '#d9a374', '#345e79'], 'STUDY');
    }
  });
  kit.direction(corridor, { x: 30.8, z: -41.7, title: 'CENTRAL GROUND ↖', subtitle: 'ACADEMIC BUILDING  •  POOL', width: 3.13 });
  for (const [x, z, s, type] of [
    [29.45, -8.0, 0.91, 'shade'], [29.5, -20.4, 0.72, 'palm'], [41.3, -40.5, 0.95, 'shade'], [47.9, -28.2, 1.03, 'shade']
  ]) kit.tree(corridor, x, z, s, type, 1130 + Math.round(x * 14 + z));
  for (const [x, z] of [[40.34, 3.4], [40.1, -8.65], [35.58, -34.5], [33.8, -35.8], [29.45, -23.3]]) {
    kit.planter(corridor, x, z, 0.31, x * 160 + z * 40);
  }
  kit.bench(corridor, 30.3, -5.22, Math.PI / 2);
  batchStaticMeshes(corridor);
}
