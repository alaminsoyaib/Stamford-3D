import * as THREE from 'three';
import { buildAcOutdoorUnit } from './academicExterior.js';
import { addLocalCollider, standard } from './buildingFactory.js';
import { box, canvasTexture, groupAt, rod } from './sceneKit.js';

const railHeight = 0.94;
const landingDepth = 1.43;
const treadDepth = 0.263;
let steel;

function stairRail(group, material, x, start, end) {
  const [y, z] = start;
  const [topY, topZ] = end;
  const lowerRail = 0.16;
  rod(group, material, [x, y + railHeight, z], [x, topY + railHeight, topZ], 0.031);
  rod(group, material, [x, y + lowerRail, z], [x, topY + lowerRail, topZ], 0.021);
  const bays = Math.max(1, Math.round(Math.abs(topZ - z) / 0.48));
  for (let bay = 0; bay <= bays; bay++) {
    const py = THREE.MathUtils.lerp(y, topY, bay / bays);
    const pz = THREE.MathUtils.lerp(z, topZ, bay / bays);
    rod(group, material, [x, py, pz], [x, py + railHeight, pz], 0.023);
    if (bay === bays) continue;
    const qy = THREE.MathUtils.lerp(y, topY, (bay + 1) / bays);
    const qz = THREE.MathUtils.lerp(z, topZ, (bay + 1) / bays);
    rod(group, material, [x, py + lowerRail, pz], [x, qy + railHeight - 0.065, qz], 0.012);
    rod(group, material, [x, py + railHeight - 0.065, pz], [x, qy + lowerRail, qz], 0.012);
  }
}

function steelMaterials() {
  let treadMap = null;
  if (typeof document !== 'undefined') {
    treadMap = canvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = '#69594d';
      ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 12; column++) {
          ctx.save();
          ctx.translate((column + 0.5) * w / 12, (row + 0.5) * h / 8);
          ctx.rotate((row + column) % 2 ? 0.65 : -0.65);
          ctx.fillStyle = '#4b3f35';
          ctx.fillRect(-3.5, -0.6, 7, 2.4);
          ctx.fillStyle = '#9b8f82';
          ctx.fillRect(-3.5, -1.1, 6, 0.9);
          ctx.restore();
        }
      }
    });
    treadMap.wrapS = THREE.RepeatWrapping;
    treadMap.repeat.x = 4;
  }
  return {
    metal: standard('#393532', { metalness: 0.48, roughness: 0.69 }),
    soffit: standard('#3e2d24', { roughness: 0.85, metalness: 0.16 }),
    treads: standard(treadMap ? '#ffffff' : '#69594d', { map: treadMap, metalness: 0.34, roughness: 0.71 }),
    nosing: standard('#a69a89', { metalness: 0.43 })
  };
}

export function buildAcademicStairs(kit, {
  root, width, depth, endWidth, lowerDepth, lowerRoofY, upperLandingY, roofOverhang,
  trimOverhang = Math.max(roofOverhang, 0.2), opensToUpperRoof, sideApproach
}) {
  const stairWidth = Math.min(1.91, lowerDepth - 0.18);
  if (stairWidth < 0.8) return;
  const { metal, soffit, treads, nosing } = steel ??= steelMaterials();
  const halfWidth = stairWidth / 2;
  const stairs = groupAt(root, 'Academic wing exterior stairs', [0, 0, 0]);
  const rearRoofEdge = -depth / 2 - roofOverhang;
  const lowerSteps = Math.ceil(lowerRoofY / 0.18);
  const lowerRun = lowerSteps * treadDepth;

  // The surveyed placement has a narrow passage behind the wing. Run the flight along it.
  const cornerX = -width / 2 + 0.65;
  const lowerFoot = sideApproach
    ? [cornerX + landingDepth + lowerRun, 0, rearRoofEdge - halfWidth]
    : [-width / 2 + halfWidth + 0.1, 0, rearRoofEdge - landingDepth - lowerRun];
  const lower = flight('Ground-to-lower-roof flight', lowerFoot, sideApproach ? Math.PI / 2 : Math.PI,
    lowerRoofY, lowerRun, lowerSteps, stairWidth);
  box(lower, kit.materials.concrete, [stairWidth + 0.16, 0.1, 0.65], [0, 0.05, 0.33]);
  landing(lower, 'Lower roof landing', lowerRoofY, lowerRun, sideApproach ? -1 : 0, sideApproach, 0, stairWidth);

  const upperRise = upperLandingY - lowerRoofY;
  const upperSteps = Math.ceil(upperRise / 0.18);
  const upperRun = Math.min(upperSteps * treadDepth, width - endWidth - landingDepth - 0.8);
  if (upperRun <= 0) return;
  const innerCornerX = width / 2 - endWidth;
  // Expand the upper flight across the full depth of the 1-storey roof strip while clearing the 2-storey roof trim.
  const upperWallOffset = Math.min(
    Math.max(roofOverhang, trimOverhang) + 0.16,
    Math.max(roofOverhang, lowerDepth - stairWidth)
  );
  const upperWidth = Math.max(stairWidth, lowerDepth - upperWallOffset - 0.14);
  const upperZ = Math.min(
    lowerDepth - depth / 2 - upperWallOffset - upperWidth / 2,
    -depth / 2 + 0.08 + upperWidth / 2
  );
  const upperFootX = innerCornerX - landingDepth - upperRun;
  const upper = flight('Lower-roof-to-upper-landing flight',
    [upperFootX, lowerRoofY, upperZ], -Math.PI / 2, upperRise, upperRun, upperSteps, upperWidth);
  const landingBridge = opensToUpperRoof ? Math.max(0, lowerDepth - depth / 2 - roofOverhang - (upperZ + upperWidth / 2)) : 0;
  landing(upper, 'Upper roof landing', upperRise, upperRun, opensToUpperRoof ? 1 : 0, false, landingBridge, upperWidth);

  // Continuous front terrace handrail along the exposed -Z eave of the 1-storey roof from lower stairs to upper stair foot
  const railStartX = sideApproach ? cornerX - 0.02 : -width / 2 + stairWidth + 0.05;
  const railEndX = upperFootX - 0.04;
  if (railEndX - railStartX > 0.6) {
    const terraceRailZ = -depth / 2 + 0.08;
    const terraceRail = groupAt(stairs, '1-storey roof edge railing', [0, lowerRoofY, terraceRailZ], -Math.PI / 2);
    stairRail(terraceRail, metal, 0, [0, -railStartX], [0, -railEndX]);
    addLocalCollider(kit.colliders, stairs, (railStartX + railEndX) / 2, terraceRailZ, railEndX - railStartX, 0.14,
      true, lowerRoofY + railHeight, lowerRoofY);
  }

  // Continuous safety railing along the exposed -Z front edge of the 2-storey frontage roof
  if (opensToUpperRoof) {
    const upperEdgeStartX = -width / 2 + 0.12;
    const upperEdgeEndX = innerCornerX - landingDepth - 0.12;
    if (upperEdgeEndX - upperEdgeStartX > 0.8) {
      const upperRailZ = lowerDepth - depth / 2 + 0.08;
      const upperEdgeRail = groupAt(stairs, '2-storey roof edge railing', [0, upperLandingY, upperRailZ], -Math.PI / 2);
      stairRail(upperEdgeRail, metal, 0, [0, -upperEdgeStartX], [0, -upperEdgeEndX]);
      addLocalCollider(kit.colliders, stairs, (upperEdgeStartX + upperEdgeEndX) / 2, upperRailZ, upperEdgeEndX - upperEdgeStartX, 0.14,
        true, upperLandingY + railHeight, upperLandingY);
    }
  }

  // Two white AC outdoor compressor units tucked under the upper staircase against the 2nd-floor pink wall
  if (upperRun > 2.4) {
    const acX = innerCornerX - 0.62;
    buildAcOutdoorUnit(stairs, [acX, lowerRoofY + 0.18, -depth / 2 + 0.42], Math.PI);
    buildAcOutdoorUnit(stairs, [acX, lowerRoofY + 0.18, -depth / 2 + 1.46], Math.PI);
  }

  function flight(name, foot, yaw, height, run, steps, fWidth = stairWidth) {
    const group = groupAt(stairs, name, foot, yaw);
    const fHalf = fWidth / 2;
    const rise = height / steps;
    const stride = run / steps;
    for (let index = 0; index < steps; index++) {
      const z = -(index + 0.5) * stride;
      const y = (index + 1) * rise;
      box(group, treads, [fWidth, rise, stride], [0, y - rise / 2, z]);
      box(group, nosing, [fWidth, 0.023, 0.041], [0, y - 0.012, z + stride / 2 - 0.005]);
    }
    // Sloped solid underside soffit framing the stairwell beneath the steps
    const slopeLength = Math.hypot(run, height);
    const soffitPanel = box(group, soffit, [fWidth - 0.04, 0.08, slopeLength], [0, height / 2 - 0.06, -run / 2]);
    soffitPanel.rotation.x = Math.atan2(height, run);
    for (const x of [-fHalf, fHalf]) {
      rod(group, metal, [x, 0, 0], [x, height - 0.14, -run], 0.073);
      stairRail(group, metal, x, [0, 0], [height, -run]);
    }
    // Follow the slope in four short collision rectangles.
    const segmentLength = run / 4;
    for (let index = 0; index < 4; index++) {
      const top = height * (index + 1) / 4 + railHeight;
      addLocalCollider(kit.colliders, group, 0, -(index + 0.5) * segmentLength, fWidth, segmentLength, true, top);
    }
    return group;
  }

  function landing(group, name, height, run, openSide, endGuard, bridge = 0, lWidth = stairWidth) {
    const deck = groupAt(group, name, [0, height, -run - landingDepth / 2]);
    const lHalf = lWidth / 2;
    const deckWidth = lWidth + bridge;
    const deckX = openSide * bridge / 2;
    box(deck, treads, [deckWidth, 0.145, landingDepth], [deckX, -0.0725, 0]);
    for (const side of [-1, 1]) {
      const x = side * lHalf;
      if (side !== openSide) stairRail(deck, metal, x, [0, landingDepth / 2], [0, -landingDepth / 2]);
      rod(deck, metal, [x, -height, -landingDepth / 2], [x, -0.1, -landingDepth / 2], 0.057);
      addLocalCollider(kit.colliders, deck, x, -landingDepth / 2, 0.16, 0.16, true, 0, -height);
    }
    if (endGuard) {
      const edge = groupAt(deck, 'Landing end rail', [0, 0, -landingDepth / 2], Math.PI / 2);
      stairRail(edge, metal, 0, [0, lHalf], [0, -lHalf]);
    }
    addLocalCollider(kit.colliders, deck, deckX, 0, deckWidth, landingDepth, true, railHeight, -0.15);
  }
}
