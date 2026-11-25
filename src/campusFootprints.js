export function westWingBounds({ width, depth, westWing }) {
  if (!westWing) return null;
  const wingWidth = width * westWing.widthRatio;
  const wingDepth = depth * westWing.depthRatio;
  return { width: wingWidth, depth: wingDepth, x: -(width + wingWidth) / 2, z: (wingDepth - depth) / 2 };
}

export function rearLinkBounds({ width, depth, rearLink }) {
  if (!rearLink) return null;
  const linkWidth = width * rearLink.widthRatio;
  const linkDepth = depth * rearLink.depthRatio;
  return { width: linkWidth, depth: linkDepth, x: (width - linkWidth) / 2, z: -(depth + linkDepth) / 2 };
}

export function academicWingBounds(building) {
  const { width, depth, academicWing } = building;
  if (!academicWing) return null;
  const wingWidth = depth * academicWing.widthRatio;
  const wingDepth = width * academicWing.depthRatio;
  const link = rearLinkBounds(building);
  const halfLength = (depth + wingWidth) / 2;
  return {
    ...academicWing, label: 'Academic wing', width: wingWidth, depth: wingDepth, floors: building.floors,
    ...(link
      ? { x: width / 2 - link.width + wingDepth / 2, z: -halfLength - link.depth, yaw: -90 }
      : { x: -(width + wingDepth) / 2, z: (wingWidth - depth) / 2, yaw: 90 })
  };
}

export function buildingOutline(building) {
  const x = building.width / 2;
  const z = building.depth / 2;
  const wing = westWingBounds(building);
  const link = rearLinkBounds(building);
  const academic = academicWingBounds(building);
  const corners = [[-x, -z]];
  if (link) {
    const left = x - link.width;
    const end = -z - link.depth;
    corners.push([left, -z]);
    if (academic) {
      const back = end - academic.width;
      corners.push([left, back], [left + academic.depth, back], [left + academic.depth, end]);
    } else corners.push([left, end]);
    if (!academic || academic.depth !== link.width) corners.push([x, end]);
  } else {
    corners.push([x, -z]);
  }
  corners.push([x, z], [-x, z]);
  if (academic && !link) {
    const end = -z + academic.width;
    if (end !== z) corners.push([-x, end]);
    corners.push([-x - academic.depth, end], [-x - academic.depth, -z]);
  } else if (wing) {
    corners.push([-x, -z + wing.depth], [-x - wing.width, -z + wing.depth], [-x - wing.width, -z]);
  }
  return corners;
}

export function worldOutline(points, { x, z, yaw = 0, scale = [1, 1, 1] }) {
  const a = yaw * Math.PI / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return points.map(([dx, dz]) => [x + dx * scale[0] * c + dz * scale[2] * s, z - dx * scale[0] * s + dz * scale[2] * c]);
}

export const surveyTreeId = (index) => `survey-tree-${index + 1}`;

export function touchesCollider(x, z, radius, collider) {
  const { minX, maxX, minZ, maxZ, oriented, group, local } = collider;
  if (x <= minX - radius || x >= maxX + radius || z <= minZ - radius || z >= maxZ + radius) return false;
  if (!oriented) return true;

  // Surveyed blocks can rotate. Test in their own orthogonal XZ axes after the bounds check.
  const e = group.matrixWorld.elements;
  const dx = x - e[12];
  const dz = z - e[14];
  const determinant = e[0] * e[10] - e[2] * e[8];
  if (Math.abs(determinant) < 1e-8) return false;
  const alongX = (dx * e[10] - dz * e[8]) / determinant;
  const alongZ = (dz * e[0] - dx * e[2]) / determinant;
  const offsetX = Math.max(0, Math.abs(alongX - local.x) - local.width / 2) * Math.hypot(e[0], e[2]);
  const offsetZ = Math.max(0, Math.abs(alongZ - local.z) - local.depth / 2) * Math.hypot(e[8], e[10]);
  return offsetX * offsetX + offsetZ * offsetZ <= radius * radius;
}

export function resolveColliderPush(x, z, radius, collider) {
  const { minX, maxX, minZ, maxZ, oriented, group, local } = collider;
  if (x <= minX - radius || x >= maxX + radius || z <= minZ - radius || z >= maxZ + radius) return null;

  if (!oriented) {
    const cx = Math.max(minX, Math.min(maxX, x));
    const cz = Math.max(minZ, Math.min(maxZ, z));
    const vx = x - cx;
    const vz = z - cz;
    if (vx !== 0 || vz !== 0) {
      const distSq = vx * vx + vz * vz;
      if (distSq >= radius * radius) return null;
      const dist = Math.sqrt(distSq);
      const overlap = radius - dist;
      return [(vx / dist) * overlap, (vz / dist) * overlap];
    }
    const penLeft = x - minX;
    const penRight = maxX - x;
    const penTop = z - minZ;
    const penBottom = maxZ - z;
    const minPen = Math.min(penLeft, penRight, penTop, penBottom);
    if (minPen === penLeft) return [-(penLeft + radius), 0];
    if (minPen === penRight) return [penRight + radius, 0];
    if (minPen === penTop) return [0, -(penTop + radius)];
    return [0, penBottom + radius];
  }

  const e = group.matrixWorld.elements;
  const dx = x - e[12];
  const dz = z - e[14];
  const det = e[0] * e[10] - e[2] * e[8];
  if (Math.abs(det) < 1e-8) return null;

  const alongX = (dx * e[10] - dz * e[8]) / det;
  const alongZ = (dz * e[0] - dx * e[2]) / det;
  const lx = alongX - local.x;
  const lz = alongZ - local.z;
  const hx = local.width / 2;
  const hz = local.depth / 2;
  const scaleX = Math.hypot(e[0], e[2]);
  const scaleZ = Math.hypot(e[8], e[10]);
  if (scaleX < 1e-8 || scaleZ < 1e-8) return null;

  const cx = Math.max(-hx, Math.min(hx, lx));
  const cz = Math.max(-hz, Math.min(hz, lz));
  const ox = (lx - cx) * scaleX;
  const oz = (lz - cz) * scaleZ;

  let dlx = 0;
  let dlz = 0;
  if (ox !== 0 || oz !== 0) {
    const distSq = ox * ox + oz * oz;
    if (distSq >= radius * radius) return null;
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    dlx = ((ox / dist) * overlap) / scaleX;
    dlz = ((oz / dist) * overlap) / scaleZ;
  } else {
    const penX = (hx - Math.abs(lx)) * scaleX;
    const penZ = (hz - Math.abs(lz)) * scaleZ;
    if (penX <= penZ) {
      dlx = ((lx >= 0 ? 1 : -1) * (penX + radius)) / scaleX;
    } else {
      dlz = ((lz >= 0 ? 1 : -1) * (penZ + radius)) / scaleZ;
    }
  }

  return [dlx * e[0] + dlz * e[8], dlx * e[2] + dlz * e[10]];
}
