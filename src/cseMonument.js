import * as THREE from 'three';
import { addLocalCollider, sign, standard } from './buildingFactory.js';
import { box, canvasTexture, cylinder, groupAt, part, seededRandom, unitPlane } from './sceneKit.js';

const signWidth = 6.9;
const signDepth = 1.66;
const signFrontY = 0.29;
const signBackY = 0.96;
const plaqueWidth = 1.29;
const plaqueX = signWidth / 2 + plaqueWidth / 2 + 0.29;
const leafGeometry = new THREE.BufferGeometry();
leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0, 0, 0, -0.46, 0.43, 0.02, 0, 0.58, 0.23, 0.46, 0.43, 0.02, 0, 1, 0.52
], 3));
leafGeometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 2, 4, 3]);
leafGeometry.computeVertexNormals();
const flowerGeometry = new THREE.IcosahedronGeometry(1, 0);

function ceramic(columns, rows, color, grout) {
  const rng = seededRandom(1910);
  const tile = 72;
  const map = canvasTexture(columns * tile, rows * tile, (ctx, w, h) => {
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
        ctx.fillStyle = `rgba(38, 45, 54, ${rng() * 0.09})`;
        ctx.fillRect(x + 2, y + 2, tile - 3, tile - 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x + 1, y + 1, tile - 2, 1);
      }
    }
  });
  return standard('#ffffff', { map, roughness: 0.54 });
}

function makeWedge() {
  // Draw the side elevation and extrude it across the frontage.
  const section = new THREE.Shape();
  section.moveTo(-signDepth / 2, 0);
  section.lineTo(signDepth / 2, 0);
  section.lineTo(signDepth / 2, signBackY);
  section.lineTo(-signDepth / 2, signFrontY);
  section.closePath();
  return new THREE.ExtrudeGeometry(section, { depth: signWidth, bevelEnabled: false })
    .rotateY(Math.PI / 2).translate(-signWidth / 2, 0, 0);
}

function buildGroundSign(root, colliders, materials, wedge) {
  const base = groupAt(root, 'Sloped Stamford University sign', [0, 0, 0]);
  part(base, wedge, materials.concrete, [0, 0, 0]);
  box(base, materials.ochre, [signWidth, signFrontY, 0.052], [0, signFrontY / 2, signDepth / 2 - 0.005]);

  const rise = signBackY - signFrontY;
  const faceDepth = Math.hypot(signDepth, rise);
  const face = groupAt(base, 'Blue ceramic sign face', [0, (signFrontY + signBackY) / 2, 0]);
  face.rotation.x = Math.atan2(rise, signDepth) - Math.PI / 2;
  box(face, materials.cobalt, [signWidth + 0.04, faceDepth + 0.04, 0.048], [0, 0, 0]);
  part(face, unitPlane, materials.skyTiles, [0, 0, 0.025], [signWidth - 0.25, faceDepth - 0.15, 1]);
  if (materials.lettering) {
    const artwork = part(face, unitPlane, materials.lettering, [0, 0, 0.039], [signWidth, faceDepth, 1]);
    artwork.castShadow = false;
  } else {
    sign(face, { title: 'Stamford University', position: [0, 0, 0.039], width: signWidth - 0.34,
      height: faceDepth - 0.22, background: '#93cbe7', ink: '#514c49', serif: true });
  }

  const railZ = -signDepth / 2 - 0.12;
  box(base, materials.iron, [signWidth - 0.65, 0.063, 0.052], [0, 1.39, railZ]);
  for (let i = 0; i <= 10; i++) {
    box(base, materials.iron, [0.044, 0.58, 0.05], [(i / 10 - 0.5) * (signWidth - 0.72), 1.12, railZ]);
  }
  addLocalCollider(colliders, base, 0, 0, signWidth, signDepth + 0.12, true, 1.45, 0);
}

function buildMemorial(root, colliders, materials) {
  const plaque = groupAt(root, 'Founder memorial plaque', [plaqueX, 0, -0.16]);
  box(plaque, materials.concrete, [plaqueWidth + 0.08, 0.09, 0.51], [0, 0.045, 0]);
  box(plaque, materials.cobalt, [plaqueWidth, 0.28, 0.44], [0, 0.20, 0]);
  box(plaque, materials.ivory, [plaqueWidth, 1.18, 0.38], [0, 0.93, -0.012]);
  box(plaque, materials.ivoryCap, [plaqueWidth + 0.08, 0.13, 0.47], [0, 1.585, 0]);
  part(plaque, unitPlane, materials.blackTiles, [0, 0.93, 0.182], [0.91, 1.18, 1]);
  if (materials.portrait) {
    part(plaque, unitPlane, materials.portrait, [0, 0.93, 0.191], [0.745, 0.965, 1]);
  } else {
    sign(plaque, { title: 'Prof. Dr. M. A. Hannan Feroz', subtitle: 'Founder, President & Founder VC',
      position: [0, 0.93, 0.191], width: 0.745, height: 0.965, background: '#e1d9c6', ink: '#242627', serif: true });
  }
  for (const x of [-0.418, 0.418]) {
    for (const y of [0.5, 1.36]) {
      cylinder(plaque, materials.pin, 0.014, 0.015, [x, y, 0.194]).rotation.x = Math.PI / 2;
    }
  }
  addLocalCollider(colliders, plaque, 0, 0, plaqueWidth + 0.08, 0.51, true, 1.66, 0);
}

function buildPlanting(root, materials) {
  const left = -signWidth / 2 - 0.37;
  const right = plaqueX + 1.05;
  const bedWidth = right - left;
  const center = (left + right) / 2;
  box(root, materials.soil, [bedWidth, 0.078, 2.53], [center, 0.039, 0.18]);
  box(root, materials.curb, [bedWidth + 0.13, 0.135, 0.13], [center, 0.0675, 1.47]);
  for (const x of [left, right]) {
    box(root, materials.curb, [0.13, 0.135, 2.45], [x, 0.0675, 0.235]);
  }

  const rng = seededRandom(1011);
  const hedgeCount = 300;
  const broadLeafCount = 30;
  const leaves = new THREE.InstancedMesh(leafGeometry, materials.leaves, hedgeCount * 5 + broadLeafCount);
  const blossoms = new THREE.InstancedMesh(flowerGeometry, materials.blossoms, Math.ceil(hedgeCount / 6));
  const pose = new THREE.Object3D();
  const green = new THREE.Color();
  let blade = 0;
  let bloom = 0;
  function addLeaf(x, y, z, width, height, tilt, yellow) {
    pose.position.set(x, y, z);
    pose.rotation.set(tilt, rng() * Math.PI * 2, (rng() - 0.5) * 0.57, 'YXZ');
    pose.scale.set(width, height, height * 0.75);
    pose.updateMatrix();
    leaves.setMatrixAt(blade, pose.matrix);
    const hue = yellow ? 0.151 + rng() * 0.04 : 0.22 + rng() * 0.07;
    const shade = yellow ? 0.38 + rng() * 0.16 : 0.24 + rng() * 0.23;
    green.setHSL(hue, 0.24 + rng() * 0.29, shade, THREE.SRGBColorSpace);
    leaves.setColorAt(blade++, green);
  }
  for (let i = 0; i < hedgeCount; i++) {
    const x = left + (i + rng()) * bedWidth / hedgeCount;
    const yellow = x > plaqueX - 0.18 || x < left + 0.47;
    const z = (yellow ? 0.58 : 0.87) + rng() * (yellow ? 0.74 : 0.48);
    const height = yellow ? 0.16 + rng() * 0.14 : 0.20 + rng() * 0.25;
    for (let shoot = 0; shoot < 5; shoot++) {
      addLeaf(x + (rng() - 0.5) * 0.16, 0.07, z, 0.032 + rng() * 0.029, height, rng() * 0.62, yellow);
    }
    if (i % 6 === 0 && !yellow) {
      pose.position.set(x, height + 0.055, z);
      pose.scale.set(0.026, 0.015, 0.023);
      pose.updateMatrix();
      blossoms.setMatrixAt(bloom++, pose.matrix);
    }
  }
  for (let i = 0; i < broadLeafCount; i++) {
    const x = plaqueX + 0.73 + (rng() - 0.5) * 0.37;
    addLeaf(x, 0.074 + rng() * 0.15, -0.8 + rng() * 0.22, 0.12 + rng() * 0.09, 0.68 + rng() * 1.05, rng() * 0.45, false);
  }
  leaves.receiveShadow = true;
  blossoms.count = bloom;
  root.add(leaves, blossoms);
}

export async function createCseMonument(kit) {
  const loader = new THREE.TextureLoader();
  const [lettering, portrait] = await Promise.all([
    new URL('../assets/cse-ground-sign-lettering.webp', import.meta.url),
    new URL('../assets/cse-founder-plaque.webp', import.meta.url)
  ].map(async (url) => {
    const photo = await loader.loadAsync(url.href).catch(() => null);
    if (photo) {
      photo.colorSpace = THREE.SRGBColorSpace;
      photo.anisotropy = 8;
    }
    return photo;
  }));
  const materials = {
    concrete: standard('#958671'),
    ochre: standard('#c6a448'),
    cobalt: ceramic(12, 1, '#213e85', '#45547a'),
    skyTiles: ceramic(22, 6, '#92caea', '#729aa9'),
    ivory: ceramic(6, 5, '#eee5d8', '#b8ab97'),
    ivoryCap: ceramic(8, 1, '#eee5d8', '#b8ab97'),
    blackTiles: ceramic(6, 5, '#1f2020', '#4b4541'),
    iron: standard('#4b3835', { metalness: 0.34 }),
    pin: standard('#b9b1a0', { metalness: 0.52, roughness: 0.45 }),
    lettering: lettering && standard('#ffffff', { map: lettering, alphaTest: 0.25, roughness: 0.5 }),
    portrait: portrait && standard('#ffffff', { map: portrait, roughness: 0.58 }),
    soil: kit.materials.soil,
    curb: standard('#8d8277'),
    leaves: standard('#ffffff', { side: THREE.DoubleSide }),
    blossoms: standard('#7463a8')
  };
  const wedge = makeWedge();
  return ({ root, width, facade }) => {
    const monument = groupAt(root, 'CSE garden monument', [-width * 0.043, 0, facade + 1.32]);
    monument.scale.setScalar(Math.min(1, width / 20));
    buildGroundSign(monument, kit.colliders, materials, wedge);
    buildMemorial(monument, kit.colliders, materials);
    buildPlanting(monument, materials);
  };
}
