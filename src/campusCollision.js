import { closestOnEdge, insideLand, landExtent } from './campusBoundary.js';
import { resolveColliderPush, touchesCollider } from './campusFootprints.js';

export const PLAYER_RADIUS = 0.36;
export const WALL_HALF_THICKNESS = 0.30;
export const STREET_WALL_HEIGHT = 3.08;
export const PERIMETER_WALL_HEIGHT = 2.67;
export const OUTER_MARGIN_X = 35;
export const OUTER_MARGIN_MIN_Z = 35;
export const OUTER_MARGIN_MAX_Z = 40;

export function wallTop(seg, radius = PLAYER_RADIUS) {
  return (seg.id?.includes('street') ? STREET_WALL_HEIGHT : PERIMETER_WALL_HEIGHT) + radius;
}

export function outerWorldBounds(bounds, radius = PLAYER_RADIUS) {
  const { minX, maxX, minZ, maxZ, streetZ } = landExtent(bounds);
  return {
    minX: minX - OUTER_MARGIN_X + radius,
    maxX: maxX + OUTER_MARGIN_X - radius,
    minZ: minZ - OUTER_MARGIN_MIN_Z + radius,
    maxZ: (streetZ || maxZ) + OUTER_MARGIN_MAX_Z - radius
  };
}

export function obstacleVerticalSpan(obstacle, getRawTop, radius = PLAYER_RADIUS) {
  const rawTop = getRawTop(obstacle);
  let rawBottom = 0;
  if (obstacle.local?.bottom !== undefined) {
    const e = obstacle.group.matrixWorld.elements;
    rawBottom = e[13] + obstacle.local.bottom * e[5];
  }
  return {
    rawBottom,
    rawTop,
    bottom: rawBottom > 0 ? rawBottom - radius : -Infinity,
    top: rawTop + radius
  };
}

export function activeCollidersAtY(y, colliders, getRawTop, radius = PLAYER_RADIUS) {
  return colliders.filter((obs) => {
    const span = obstacleVerticalSpan(obs, getRawTop, radius);
    return y > span.bottom && y < span.top;
  });
}

export function blockedAt(x, z, y, colliders, bounds, getRawTop, radius = PLAYER_RADIUS) {
  const outer = outerWorldBounds(bounds, radius);
  const eps = 1e-4;
  if (x < outer.minX - eps || x > outer.maxX + eps || z < outer.minZ - eps || z > outer.maxZ + eps) return true;

  const testRadius = Math.max(0.01, radius - eps);
  if (Array.isArray(bounds.walls)) {
    const wallClearance = testRadius + WALL_HALF_THICKNESS;
    const wallClearanceSq = wallClearance * wallClearance;
    for (const seg of bounds.walls) {
      if (y >= wallTop(seg, radius)) continue;
      const [edgeX, edgeZ] = closestOnEdge(x, z, seg.a, seg.b);
      const distSq = (edgeX - x) ** 2 + (edgeZ - z) ** 2;
      if (distSq < wallClearanceSq) return true;
    }
  } else if (y < PERIMETER_WALL_HEIGHT + radius) {
    const wallInset = bounds.points ? 0.32 : 0;
    if (!insideLand(bounds, x, z, testRadius + wallInset, true)) return true;
  }

  for (const obs of colliders) {
    const span = obstacleVerticalSpan(obs, getRawTop, radius);
    if (y > span.bottom && y < span.top && touchesCollider(x, z, testRadius, obs)) return true;
  }
  return false;
}

export function resolveVerticalMove(x, z, currentY, desiredY, colliders, bounds, getRawTop, radius = PLAYER_RADIUS) {
  let nextY = desiredY;
  if (nextY < currentY) {
    if (Array.isArray(bounds.walls)) {
      const wallClearance = radius + WALL_HALF_THICKNESS;
      const wallClearanceSq = wallClearance * wallClearance;
      for (const seg of bounds.walls) {
        const [edgeX, edgeZ] = closestOnEdge(x, z, seg.a, seg.b);
        if ((edgeX - x) ** 2 + (edgeZ - z) ** 2 < wallClearanceSq) {
          const top = wallTop(seg, radius);
          if (nextY < top) nextY = Math.max(nextY, Math.min(currentY, top));
        }
      }
    }
    for (const obs of colliders) {
      if (!touchesCollider(x, z, radius, obs)) continue;
      const span = obstacleVerticalSpan(obs, getRawTop, radius);
      if (currentY > span.bottom && nextY < span.top) {
        nextY = Math.max(nextY, Math.min(currentY, span.top));
      }
    }
  } else if (nextY > currentY) {
    for (const obs of colliders) {
      if (!touchesCollider(x, z, radius, obs)) continue;
      const span = obstacleVerticalSpan(obs, getRawTop, radius);
      if (span.rawBottom > 0 && currentY < span.top && nextY > span.bottom) {
        nextY = Math.min(nextY, Math.max(currentY, span.bottom));
      }
    }
  }
  return nextY;
}

function orient2D(ax, az, bx, bz, cx, cz) {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

function segmentsCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const eps = 1e-9;
  const d1 = orient2D(ax, az, bx, bz, cx, cz);
  const d2 = orient2D(ax, az, bx, bz, dx, dz);
  const d3 = orient2D(cx, cz, dx, dz, ax, az);
  const d4 = orient2D(cx, cz, dx, dz, bx, bz);
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps))
    && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

export function resolveHorizontalMove(position, dx, dz, colliders, bounds, getRawTop, radius = PLAYER_RADIUS) {
  const activeObs = activeCollidersAtY(position.y, colliders, getRawTop, radius);
  const hasWallsArray = Array.isArray(bounds.walls);
  const activeWalls = hasWallsArray
    ? bounds.walls.filter((seg) => position.y < wallTop(seg, radius))
    : null;
  const outer = outerWorldBounds(bounds, radius);
  const wallClearance = radius + WALL_HALF_THICKNESS;
  const wallClearanceSq = wallClearance * wallClearance;
  const shrunkWallClearance = Math.max(0.05, wallClearance - 0.04);
  const shrunkWallClearanceSq = shrunkWallClearance * shrunkWallClearance;
  const shrunkRadius = Math.max(0.05, radius - 0.04);

  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.14));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  function deepOverlap(px, pz) {
    if (activeWalls) {
      for (const seg of activeWalls) {
        const [cx, cz] = closestOnEdge(px, pz, seg.a, seg.b);
        if ((px - cx) ** 2 + (pz - cz) ** 2 < shrunkWallClearanceSq) return true;
      }
    }
    for (const obs of activeObs) {
      if (touchesCollider(px, pz, shrunkRadius, obs)) return true;
    }
    return false;
  }

  for (let step = 0; step < steps; step++) {
    const prevX = position.x;
    const prevZ = position.z;

    if (activeWalls === null) {
      if (stepX && !blockedAt(position.x + stepX, position.z, position.y, colliders, bounds, getRawTop, radius)) {
        position.x += stepX;
      }
      if (stepZ && !blockedAt(position.x, position.z + stepZ, position.y, colliders, bounds, getRawTop, radius)) {
        position.z += stepZ;
      }
      continue;
    }

    let nx = prevX + stepX;
    let nz = prevZ + stepZ;

    for (let pass = 0; pass < 4; pass++) {
      let moved = 0;
      for (const seg of activeWalls) {
        const [cx, cz] = closestOnEdge(nx, nz, seg.a, seg.b);
        const vx = nx - cx;
        const vz = nz - cz;
        const distSq = vx * vx + vz * vz;
        if (distSq < wallClearanceSq) {
          let pushX = 0;
          let pushZ = 0;
          if (distSq > 1e-10) {
            const dist = Math.sqrt(distSq);
            const scale = (wallClearance - dist) / dist;
            pushX = vx * scale;
            pushZ = vz * scale;
          } else {
            const segDx = seg.b[0] - seg.a[0];
            const segDz = seg.b[1] - seg.a[1];
            const segLen = Math.hypot(segDx, segDz);
            if (segLen > 1e-8) {
              let perpX = -segDz / segLen;
              let perpZ = segDx / segLen;
              if (perpX * (prevX - cx) + perpZ * (prevZ - cz) < 0) {
                perpX = -perpX;
                perpZ = -perpZ;
              }
              pushX = perpX * wallClearance;
              pushZ = perpZ * wallClearance;
            }
          }
          nx += pushX;
          nz += pushZ;
          moved += Math.hypot(pushX, pushZ);
        }
      }

      for (const obs of activeObs) {
        const push = resolveColliderPush(nx, nz, radius, obs);
        if (push) {
          nx += push[0];
          nz += push[1];
          moved += Math.hypot(push[0], push[1]);
        }
      }

      nx = Math.max(outer.minX, Math.min(outer.maxX, nx));
      nz = Math.max(outer.minZ, Math.min(outer.maxZ, nz));
      if (moved < 1e-5) break;
    }

    let crossedWall = false;
    for (const seg of activeWalls) {
      if (segmentsCross(prevX, prevZ, nx, nz, seg.a[0], seg.a[1], seg.b[0], seg.b[1])) {
        crossedWall = true;
        break;
      }
    }

    if (crossedWall || (!deepOverlap(prevX, prevZ) && deepOverlap(nx, nz))) {
      nx = prevX;
      nz = prevZ;
    }

    position.x = nx;
    position.z = nz;
  }
}
