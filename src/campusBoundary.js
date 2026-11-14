const epsilon = 0.000001;

export function landCorners({ points, minX, maxX, minZ, maxZ }) {
  return points ?? [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
}

export function landExtent(boundary) {
  if (!boundary.points) return boundary;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of boundary.points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, streetZ: maxZ };
}

export function closestOnEdge(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = dx * dx + dz * dz;
  const along = length ? ((x - a[0]) * dx + (z - a[1]) * dz) / length : 0;
  const t = Math.min(1, Math.max(0, along));
  return [a[0] + t * dx, a[1] + t * dz];
}

export function nearestLandEdge(points, x, z) {
  let nearest;
  let best = Infinity;
  for (let index = 0; index < points.length; index++) {
    const point = closestOnEdge(x, z, points[index], points[(index + 1) % points.length]);
    const distance = (x - point[0]) ** 2 + (z - point[1]) ** 2;
    if (distance < best) {
      nearest = point;
      best = distance;
    }
  }
  return nearest;
}

export function insideLand(boundary, x, z, inset = 0, includeStreet = false) {
  const { points, minX, maxX, minZ, maxZ, streetZ } = boundary;
  if (!points) {
    return x >= minX + inset && x <= maxX - inset
      && z >= minZ + inset && z <= (includeStreet ? streetZ : maxZ) - inset;
  }

  let inside = false;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const [edgeX, edgeZ] = closestOnEdge(x, z, a, b);
    const distanceSquared = (edgeX - x) ** 2 + (edgeZ - z) ** 2;
    if (distanceSquared < epsilon ** 2) return inset === 0;
    if (distanceSquared < inset * inset) return false;
    if ((a[1] > z) !== (b[1] > z) && x < a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1])) {
      inside = !inside;
    }
  }
  return inside;
}

export function fitsLand(boundary, footprint) {
  if (!footprint.every(([x, z]) => insideLand(boundary, x, z))) return false;
  if (!boundary.points) return true;
  for (const [index, a] of footprint.entries()) {
    const b = footprint[(index + 1) % footprint.length];
    for (const [edge, c] of boundary.points.entries()) {
      const d = boundary.points[(edge + 1) % boundary.points.length];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    }
  }
  return true;
}

export function landArea(points) {
  let twiceArea = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(twiceArea) / 2;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function touchesSegment(a, b, p, turn) {
  return Math.abs(turn) < epsilon
    && p[0] >= Math.min(a[0], b[0]) - epsilon && p[0] <= Math.max(a[0], b[0]) + epsilon
    && p[1] >= Math.min(a[1], b[1]) - epsilon && p[1] <= Math.max(a[1], b[1]) + epsilon;
}

function intersects(a, b, c, d) {
  const p = cross(a, b, c);
  const q = cross(a, b, d);
  const r = cross(c, d, a);
  const s = cross(c, d, b);
  return (p * q < 0 && r * s < 0) || touchesSegment(a, b, c, p) || touchesSegment(a, b, d, q)
    || touchesSegment(c, d, a, r) || touchesSegment(c, d, b, s);
}

export function validLandOutline(points) {
  if (points.length < 3 || points.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))
    || landArea(points) < 1) return false;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const c = points[(index + 2) % points.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < epsilon || touchesSegment(a, b, c, cross(a, b, c))
      || touchesSegment(b, c, a, cross(b, c, a))) return false;
    for (let other = index + 2; other < points.length; other++) {
      if (index === 0 && other === points.length - 1) continue;
      if (intersects(a, b, points[other], points[(other + 1) % points.length])) return false;
    }
  }
  return true;
}
