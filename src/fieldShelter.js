import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { box, canvasTexture, cylinder, groupAt, part, rod, seededRandom } from './sceneKit.js';

export const SHELTER_SPECS = {
  slab: { width: 5.9, height: 0.1, depth: 4.1 },
  roof: { width: 6.48, depth: 4.48, ridgeHalf: 1.0, eaveY: 2.18, ridgeY: 3.22, colliderBottom: 2.14, colliderTop: 3.28 },
  columnsX: [-2.52, 0, 2.52],
  columnsZ: [-1.58, 1.58],
  seatXs: [-2.02, -1.26, -0.5, 0.5, 1.26, 2.02],
  seatRowZ: 1.38
};

let cachedAssets = null;

function createWeatheredTinTexture() {
  if (typeof document === 'undefined') return null;
  const rng = seededRandom(8421);
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#a34747';
    ctx.fillRect(0, 0, w, h);

    // Subtle vertical sheet corrugation highlights & valleys across the 4-wave tile repeat.
    for (let x = 0; x < w; x++) {
      const wave = Math.sin((x / w) * Math.PI * 8);
      if (wave > 0) {
        ctx.fillStyle = `rgba(255, 224, 218, ${(wave * 0.16).toFixed(3)})`;
      } else {
        ctx.fillStyle = `rgba(52, 18, 22, ${(-wave * 0.2).toFixed(3)})`;
      }
      ctx.fillRect(x, 0, 1, h);
    }

    // Rain-run streaks and chalky sun-faded oxidation mottling visible in campus photo.
    for (let i = 0; i < 650; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const len = 14 + rng() * 68;
      const width = 1 + rng() * 3.5;
      ctx.fillStyle = rng() > 0.42
        ? `rgba(222, 198, 194, ${(0.04 + rng() * 0.14).toFixed(3)})`
        : `rgba(82, 30, 32, ${(0.04 + rng() * 0.12).toFixed(3)})`;
      ctx.fillRect(x, y, width, len);
    }

    // Horizontal sheet overlap seams and subtle rust flecks.
    for (const seamY of [h * 0.34, h * 0.68]) {
      ctx.fillStyle = 'rgba(54, 18, 20, 0.22)';
      ctx.fillRect(0, seamY, w, 2);
      ctx.fillStyle = 'rgba(225, 195, 190, 0.14)';
      ctx.fillRect(0, seamY + 2, w, 1.5);
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createWeatheredConcreteTexture() {
  if (typeof document === 'undefined') return null;
  const rng = seededRandom(5173);
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b4aea1';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = rng() > 0.5
        ? `rgba(242, 238, 228, ${(0.04 + rng() * 0.08).toFixed(3)})`
        : `rgba(76, 78, 62, ${(0.04 + rng() * 0.10).toFixed(3)})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 4, 1 + rng() * 4);
    }
    ctx.strokeStyle = 'rgba(72, 69, 62, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createSeatPanGeometry() {
  const w = 0.22;
  const d = 0.18;
  const r = 0.065;
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 6
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createBackrestGeometry() {
  const outerR = 0.238;
  const innerR = 0.214;
  const centerY = -0.02;
  const halfAngle = 0.94;
  const start = Math.PI / 2 - halfAngle;
  const end = Math.PI / 2 + halfAngle;

  const shape = new THREE.Shape();
  shape.absarc(0, centerY, outerR, start, end, false);
  shape.absarc(0, centerY, innerR, end, start, true);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.165,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 10
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createCorrugatedHipRoofGeometry() {
  const { width, depth, ridgeHalf, eaveY, ridgeY } = SHELTER_SPECS.roof;
  const rx = width / 2;
  const rz = depth / 2;
  const ribPitch = 0.144;
  const ribAmp = 0.019;
  const positions = [];
  const uvs = [];
  const indices = [];

  function addSlope(uCols, vRows, flipWinding, vertexFn) {
    const baseVertex = positions.length / 3;
    for (let row = 0; row <= vRows; row++) {
      const v = row / vRows;
      const taper = v < 0.08 ? v / 0.08 : 1;
      for (let col = 0; col <= uCols; col++) {
        const u = col / uCols;
        const [x, y, z, coord] = vertexFn(u, v, taper);
        positions.push(x, y, z);
        uvs.push(coord / (ribPitch * 4), v * 1.4);
      }
    }
    const stride = uCols + 1;
    for (let row = 0; row < vRows; row++) {
      for (let col = 0; col < uCols; col++) {
        const a = baseVertex + row * stride + col;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (flipWinding) {
          indices.push(a, c, b, b, c, d);
        } else {
          indices.push(a, b, c, b, d, c);
        }
      }
    }
  }

  // +Z slope (front): flipWinding = true for upward/outward normal
  addSlope(180, 10, true, (u, v, taper) => {
    const xHalf = ridgeHalf + (rx - ridgeHalf) * v;
    const x = (2 * u - 1) * xHalf;
    const z = v * rz;
    const wave = ribAmp * taper * Math.cos((x / ribPitch) * Math.PI * 2);
    return [x, ridgeY + (eaveY - ridgeY) * v + wave, z, x];
  });

  // -Z slope (back): flipWinding = false
  addSlope(180, 10, false, (u, v, taper) => {
    const xHalf = ridgeHalf + (rx - ridgeHalf) * v;
    const x = (2 * u - 1) * xHalf;
    const z = -v * rz;
    const wave = ribAmp * taper * Math.cos((x / ribPitch) * Math.PI * 2);
    return [x, ridgeY + (eaveY - ridgeY) * v + wave, z, x];
  });

  // +X slope (east): flipWinding = false
  addSlope(124, 10, false, (u, v, taper) => {
    const zHalf = Math.max(1e-4, rz * v);
    const z = (2 * u - 1) * zHalf;
    const x = ridgeHalf + (rx - ridgeHalf) * v;
    const wave = ribAmp * taper * Math.cos((z / ribPitch) * Math.PI * 2);
    return [x, ridgeY + (eaveY - ridgeY) * v + wave, z, z];
  });

  // -X slope (west): flipWinding = true
  addSlope(124, 10, true, (u, v, taper) => {
    const zHalf = Math.max(1e-4, rz * v);
    const z = (2 * u - 1) * zHalf;
    const x = -(ridgeHalf + (rx - ridgeHalf) * v);
    const wave = ribAmp * taper * Math.cos((z / ribPitch) * Math.PI * 2);
    return [x, ridgeY + (eaveY - ridgeY) * v + wave, z, z];
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFoldedCapGeometry(start, end, halfWidth, dropY) {
  const s = new THREE.Vector3(...start);
  const e = new THREE.Vector3(...end);
  const along = e.clone().sub(s);
  const side = new THREE.Vector3(-along.z, 0, along.x).normalize().multiplyScalar(halfWidth);

  const sL = [s.x - side.x, s.y - dropY, s.z - side.z];
  const sC = [s.x, s.y + 0.025, s.z];
  const sR = [s.x + side.x, s.y - dropY, s.z + side.z];
  const eL = [e.x - side.x, e.y - dropY, e.z - side.z];
  const eC = [e.x, e.y + 0.025, e.z];
  const eR = [e.x + side.x, e.y - dropY, e.z + side.z];

  const positions = [...sL, ...sC, ...sR, ...eL, ...eC, ...eR];
  const indices = [
    0, 3, 1, 1, 3, 4,
    1, 4, 2, 2, 4, 5
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function getShelterAssets() {
  if (cachedAssets) return cachedAssets;
  const tinMap = createWeatheredTinTexture();
  const slabMap = createWeatheredConcreteTexture();
  const { width, depth, ridgeHalf, eaveY, ridgeY } = SHELTER_SPECS.roof;
  const rx = width / 2;
  const rz = depth / 2;

  cachedAssets = {
    slabMaterial: standard('#aba598', { map: slabMap, roughness: 0.92 }),
    frameMaterial: standard('#1f7ba0', { roughness: 0.46, metalness: 0.30 }),
    seatMaterial: standard('#298cb3', { roughness: 0.40, metalness: 0.26 }),
    tinMaterial: standard(tinMap ? '#ffffff' : '#a34747', {
      map: tinMap,
      side: THREE.DoubleSide,
      roughness: 0.74,
      metalness: 0.22
    }),
    capMaterial: standard('#9f4544', {
      side: THREE.DoubleSide,
      roughness: 0.68,
      metalness: 0.24
    }),
    seatPanGeometry: createSeatPanGeometry(),
    backrestGeometry: createBackrestGeometry(),
    roofGeometry: createCorrugatedHipRoofGeometry(),
    ridgeCapGeometry: createFoldedCapGeometry([-ridgeHalf - 0.05, ridgeY + 0.02, 0], [ridgeHalf + 0.05, ridgeY + 0.02, 0], 0.13, 0.065),
    hipCaps: [
      createFoldedCapGeometry([ridgeHalf, ridgeY + 0.015, 0], [rx, eaveY + 0.02, rz], 0.115, 0.06),
      createFoldedCapGeometry([-ridgeHalf, ridgeY + 0.015, 0], [-rx, eaveY + 0.02, rz], 0.115, 0.06),
      createFoldedCapGeometry([ridgeHalf, ridgeY + 0.015, 0], [rx, eaveY + 0.02, -rz], 0.115, 0.06),
      createFoldedCapGeometry([-ridgeHalf, ridgeY + 0.015, 0], [-rx, eaveY + 0.02, -rz], 0.115, 0.06)
    ]
  };
  return cachedAssets;
}

export function buildFieldShelter(shelter, kit) {
  const assets = getShelterAssets();
  const { slab, roof, columnsX, columnsZ, seatXs, seatRowZ } = SHELTER_SPECS;
  const padTop = slab.height;
  const eavePipeY = 2.24;
  const backRailY = 0.85;
  const seatRailY = 0.43;
  const lowRailY = 0.17;

  // Grounded concrete paving pad
  box(shelter, assets.slabMaterial, [slab.width, slab.height, slab.depth], [0, padTop / 2, 0]);

  // 6 round tubular steel columns (2 bays × 3 posts per side) with baseplates
  for (const cx of columnsX) {
    for (const cz of columnsZ) {
      box(shelter, assets.frameMaterial, [0.15, 0.024, 0.15], [cx, padTop + 0.012, cz]);
      cylinder(shelter, assets.frameMaterial, 0.044, eavePipeY + 0.02 - padTop, [cx, (padTop + eavePipeY + 0.02) / 2, cz]);
      addLocalCollider(kit.colliders, shelter, cx, cz, 0.14, 0.14, true, eavePipeY + 0.02, 0);
    }
    // Transverse tie beam across the top
    rod(shelter, assets.frameMaterial, [cx, eavePipeY, columnsZ[0]], [cx, eavePipeY, columnsZ[1]], 0.032);
  }

  // Long eave header pipes, ridge beam, hip rafters, and slope purlins
  for (const cz of columnsZ) {
    rod(shelter, assets.frameMaterial, [columnsX[0], eavePipeY, cz], [columnsX[2], eavePipeY, cz], 0.036);
  }
  rod(shelter, assets.frameMaterial, [-roof.ridgeHalf, roof.ridgeY - 0.06, 0], [roof.ridgeHalf, roof.ridgeY - 0.06, 0], 0.034);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      rod(shelter, assets.frameMaterial, [sx * columnsX[2], eavePipeY, sz * columnsZ[1]], [sx * roof.ridgeHalf, roof.ridgeY - 0.06, 0], 0.03);
    }
  }
  for (const sz of [-1, 1]) {
    rod(shelter, assets.frameMaterial, [0, eavePipeY, sz * columnsZ[1]], [0, roof.ridgeY - 0.06, 0], 0.026);
    rod(shelter, assets.frameMaterial, [-1.8, 2.68, sz * 0.84], [1.8, 2.68, sz * 0.84], 0.022);
  }

  // Long-side guard/seat rails & short-end return braces leaving a clear 1.92 m central entry opening
  for (const side of [-1, 1]) {
    const outerZ = side * columnsZ[1];
    const innerZ = side * (seatRowZ - 0.2);
    rod(shelter, assets.frameMaterial, [columnsX[0], backRailY, outerZ], [columnsX[2], backRailY, outerZ], 0.028);
    rod(shelter, assets.frameMaterial, [columnsX[0], seatRailY, outerZ], [columnsX[2], seatRailY, outerZ], 0.024);
    rod(shelter, assets.frameMaterial, [columnsX[0], lowRailY, outerZ], [columnsX[2], lowRailY, outerZ], 0.024);
    rod(shelter, assets.frameMaterial, [columnsX[0], seatRailY, innerZ], [columnsX[2], seatRailY, innerZ], 0.022);

    for (const cx of columnsX) {
      rod(shelter, assets.frameMaterial, [cx, padTop, innerZ], [cx, seatRailY, innerZ], 0.02);
      rod(shelter, assets.frameMaterial, [cx, seatRailY, innerZ], [cx, seatRailY, outerZ], 0.02);
      rod(shelter, assets.frameMaterial, [cx, lowRailY, innerZ], [cx, lowRailY, outerZ], 0.018);
    }

    for (const endX of [columnsX[0], columnsX[2]]) {
      const returnEndZ = side * 0.96;
      rod(shelter, assets.frameMaterial, [endX, padTop, returnEndZ], [endX, backRailY, returnEndZ], 0.025);
      rod(shelter, assets.frameMaterial, [endX, backRailY, outerZ], [endX, backRailY, returnEndZ], 0.025);
      rod(shelter, assets.frameMaterial, [endX, seatRailY, outerZ], [endX, seatRailY, returnEndZ], 0.022);
      rod(shelter, assets.frameMaterial, [endX, lowRailY, outerZ], [endX, lowRailY, returnEndZ], 0.022);
      rod(shelter, assets.frameMaterial, [endX, lowRailY, outerZ], [endX, backRailY, returnEndZ], 0.018);
    }

    addLocalCollider(kit.colliders, shelter, 0, side * seatRowZ, 5.12, 0.56, true, 0.92, 0);
  }

  // 12 individual curved bucket seats (6 per long side = 2 bays × 3 seats, grounded on the concrete slab)
  for (const side of [-1, 1]) {
    const yaw = side > 0 ? Math.PI : 0;
    for (const sx of seatXs) {
      const seat = groupAt(shelter, 'Shelter bucket seat', [sx, 0, side * seatRowZ], yaw);
      part(seat, assets.seatPanGeometry, assets.seatMaterial, [0, seatRailY + 0.008, 0]);
      part(seat, assets.backrestGeometry, assets.seatMaterial, [0, 0.65, 0]);

      // Backrest support struts connecting seat underframe to the top rail at y = 0.85
      for (const lx of [-0.14, 0.14]) {
        rod(seat, assets.frameMaterial, [lx, seatRailY, -0.20], [lx, backRailY, -0.20], 0.016);
      }

      // 4 grounded splayed steel legs reaching padTop (y = 0.10) + horizontal floor skids + cross tie
      for (const lx of [-0.16, 0.16]) {
        rod(seat, assets.frameMaterial, [lx, seatRailY, -0.14], [lx * 1.1, padTop, -0.17], 0.016);
        rod(seat, assets.frameMaterial, [lx, seatRailY, 0.14], [lx * 1.1, padTop, 0.17], 0.016);
        rod(seat, assets.frameMaterial, [lx * 1.1, padTop + 0.014, -0.17], [lx * 1.1, padTop + 0.014, 0.17], 0.013);
      }
      rod(seat, assets.frameMaterial, [-0.17, 0.24, 0], [0.17, 0.24, 0], 0.013);
    }
  }

  // Weathered red/maroon corrugated tin hip roof + folded sheet-metal ridge and hip caps
  part(shelter, assets.roofGeometry, assets.tinMaterial, [0, 0, 0]);
  part(shelter, assets.ridgeCapGeometry, assets.capMaterial, [0, 0, 0]);
  for (const hipCapGeometry of assets.hipCaps) {
    part(shelter, hipCapGeometry, assets.capMaterial, [0, 0, 0]);
  }
  addLocalCollider(kit.colliders, shelter, 0, 0, roof.width, roof.depth, true, roof.colliderTop, roof.colliderBottom);
  return shelter;
}
