export function westWingBounds({ width, depth, westWing }) {
  if (!westWing) return null;
  const wingWidth = width * westWing.widthRatio;
  const wingDepth = depth * westWing.depthRatio;
  return { width: wingWidth, depth: wingDepth, x: -(width + wingWidth) / 2, z: (wingDepth - depth) / 2 };
}

export function buildingOutline(building) {
  const x = building.width / 2;
  const z = building.depth / 2;
  const corners = [[-x, -z], [x, -z], [x, z], [-x, z]];
  const wing = westWingBounds(building);
  if (wing) {
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
  const alongX = (dx * e[10] - dz * e[8]) / determinant;
  const alongZ = (dz * e[0] - dx * e[2]) / determinant;
  const offsetX = Math.max(0, Math.abs(alongX - local.x) - local.width / 2) * Math.hypot(e[0], e[2]);
  const offsetZ = Math.max(0, Math.abs(alongZ - local.z) - local.depth / 2) * Math.hypot(e[8], e[10]);
  return offsetX * offsetX + offsetZ * offsetZ <= radius * radius;
}
