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

export function distanceToLandEdge(points, x, z) {
  const [ex, ez] = nearestLandEdge(points, x, z);
  return Math.hypot(x - ex, z - ez);
}

export function nearestPointInsideLand(boundary, x, z, inset = 0.05) {
  const includeStreet = !boundary.points;
  if (insideLand(boundary, x, z, 0, includeStreet)) return [x, z];
  const round4 = (v) => Number(v.toFixed(4));
  if (!boundary.points) {
    const { minX, maxX, minZ, maxZ, streetZ } = boundary;
    const clampedMaxZ = includeStreet ? streetZ : maxZ;
    const loX = minX + inset;
    const hiX = maxX - inset;
    const loZ = minZ + inset;
    const hiZ = clampedMaxZ - inset;
    return [
      round4(loX <= hiX ? Math.min(hiX, Math.max(loX, x)) : (minX + maxX) / 2),
      round4(loZ <= hiZ ? Math.min(hiZ, Math.max(loZ, z)) : (minZ + clampedMaxZ) / 2)
    ];
  }

  const pts = boundary.points;
  let bestIdx = 0;
  let bestEx = pts[0][0];
  let bestEz = pts[0][1];
  let bestDistSq = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [cx, cz] = closestOnEdge(x, z, pts[i], pts[(i + 1) % pts.length]);
    const dSq = (x - cx) ** 2 + (z - cz) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
      bestEx = cx;
      bestEz = cz;
    }
  }

  const edgeNormals = (idx) => {
    const a = pts[idx];
    const b = pts[(idx + 1) % pts.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    return [
      [-dz / len, dx / len],
      [dz / len, -dx / len]
    ];
  };

  const dirs = [];
  const addDir = (dx, dz) => {
    const len = Math.hypot(dx, dz);
    if (len > epsilon) dirs.push([dx / len, dz / len]);
  };

  const curNormals = edgeNormals(bestIdx);
  for (const [nx, nz] of curNormals) addDir(nx, nz);
  addDir(bestEx - x, bestEz - z);

  const prevIdx = (bestIdx - 1 + pts.length) % pts.length;
  const nextIdx = (bestIdx + 1) % pts.length;
  const prevNormals = edgeNormals(prevIdx);
  const nextNormals = edgeNormals(nextIdx);
  for (const [nx, nz] of prevNormals) addDir(nx, nz);
  for (const [nx, nz] of nextNormals) addDir(nx, nz);
  for (const [n1x, n1z] of curNormals) {
    for (const [n2x, n2z] of [...prevNormals, ...nextNormals]) {
      addDir(n1x + n2x, n1z + n2z);
    }
  }

  let bestInside = null;
  let bestCandidateDistSq = Infinity;
  for (const step of [inset, 0.01, 0.25, 0.5]) {
    for (const [dx, dz] of dirs) {
      const cx = round4(bestEx + dx * step);
      const cz = round4(bestEz + dz * step);
      if (insideLand(boundary, cx, cz)) {
        const distSq = (cx - x) ** 2 + (cz - z) ** 2;
        if (distSq < bestCandidateDistSq) {
          bestCandidateDistSq = distSq;
          bestInside = [cx, cz];
        }
      }
    }
    if (bestInside) return bestInside;
  }
  return [round4(bestEx), round4(bestEz)];
}

export function resolveEditorLandPosition(boundary, prevX, prevZ, nextX, nextZ, inset = 0.05) {
  const includeStreet = !boundary.points;
  if (insideLand(boundary, nextX, nextZ, 0, includeStreet)) {
    return { x: nextX, z: nextZ, clamped: false };
  }
  if (boundary.points && !insideLand(boundary, prevX, prevZ)) {
    const prevDist = distanceToLandEdge(boundary.points, prevX, prevZ);
    const nextDist = distanceToLandEdge(boundary.points, nextX, nextZ);
    if (nextDist < prevDist - 1e-4) {
      return { x: nextX, z: nextZ, clamped: false };
    }
  }
  const [x, z] = nearestPointInsideLand(boundary, nextX, nextZ, inset);
  return { x, z, clamped: true };
}

export function campusGatePose(map) {
  return { ...map.gate, ...map.elements?.['entry-gate'] };
}

export function perimeterWalls(map) {
  const { points, minX, maxX, minZ, maxZ } = map.boundary;
  const gate = campusGatePose(map);
  const halfOpening = (gate.opening / 2 + 0.56) * (gate.scale?.[0] ?? 1);
  if (!points) {
    return [
      { id: 'wall-north', a: [minX, minZ], b: [maxX, minZ] },
      { id: 'wall-east', a: [maxX, minZ], b: [maxX, maxZ] },
      { id: 'wall-street-east', a: [gate.x + halfOpening, maxZ], b: [maxX, maxZ] },
      { id: 'wall-street-west', a: [minX, maxZ], b: [gate.x - halfOpening, maxZ] },
      { id: 'wall-west', a: [minX, maxZ], b: [minX, minZ] }
    ];
  }

  const walls = points.map((a, index) => ({ id: `wall-${index + 1}`, a, b: points[(index + 1) % points.length] }));
  const yaw = (gate.yaw ?? 0) * Math.PI / 180;
  let gateEdge;
  for (const [index, { a, b }] of walls.entries()) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length <= halfOpening * 2) continue;
    const dx = (b[0] - a[0]) / length;
    const dz = (b[1] - a[1]) / length;
    if (Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) < 0.985) continue;
    const center = closestOnEdge(gate.x, gate.z, a, b);
    const gap = Math.hypot(center[0] - gate.x, center[1] - gate.z);
    if (gap > 0.75 || (gateEdge && gap >= gateEdge.gap)) continue;
    if ([a, b].some((end) => Math.hypot(center[0] - end[0], center[1] - end[1]) <= halfOpening + 0.1)) continue;
    gateEdge = { index, center, gap, dx, dz };
  }
  if (gateEdge) {
    const { index, center: [x, z], dx, dz } = gateEdge;
    const { a, b } = walls[index];
    walls.splice(index, 1,
      { id: 'wall-street-a', a, b: [x - dx * halfOpening, z - dz * halfOpening] },
      { id: 'wall-street-b', a: [x + dx * halfOpening, z + dz * halfOpening], b });
  }
  return walls;
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
