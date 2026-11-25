export const OCEAN_DRONE_RADIUS = 0.45;
export const SEAFLOOR_Y = -121.55;

export function seafloorHeightAt(x, z) {
  const localY = -z;
  const elevation = Math.sin(x * 0.19) * Math.cos(localY * 0.24) + 0.34 * Math.sin((x + localY) * 0.53);
  return SEAFLOOR_Y + elevation * 0.49;
}

export function addEllipsoidCollider(colliders, [x, y, z], [sx, sy, sz], yaw = 0, radius = OCEAN_DRONE_RADIUS) {
  const rx = sx * 0.9 + radius;
  const ry = sy * 0.9 + radius;
  const rz = sz * 0.9 + radius;
  const record = {
    x, y, z, rx, ry, rz,
    maxR: Math.max(rx, ry, rz),
    cosY: Math.cos(yaw),
    sinY: Math.sin(yaw)
  };
  colliders.push(record);
  return record;
}

function ellipsoidEval(px, py, pz, c) {
  const dx = px - c.x;
  const dy = py - c.y;
  const dz = pz - c.z;
  if (Math.abs(dx) >= c.maxR || Math.abs(dy) >= c.ry || Math.abs(dz) >= c.maxR) return null;
  const lx = dx * c.cosY - dz * c.sinY;
  const lz = dx * c.sinY + dz * c.cosY;
  const nx = lx / c.rx;
  const ny = dy / c.ry;
  const nz = lz / c.rz;
  const q = nx * nx + ny * ny + nz * nz;
  if (q >= 1) return null;
  return { q, nx, ny, nz, lx, dy, lz };
}

export function insideOceanCollider(px, py, pz, colliders) {
  for (const c of colliders) {
    const evalResult = ellipsoidEval(px, py, pz, c);
    if (evalResult && evalResult.q < 1 - 1e-4) return true;
  }
  return false;
}

export function resolveOceanMove(position, dx, dy, dz, colliders, {
  limit = 55,
  maxDepth = 120,
  radius = OCEAN_DRONE_RADIUS
} = {}) {
  const dist = Math.hypot(dx, dy, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.25));
  const stepX = dx / steps;
  const stepY = dy / steps;
  const stepZ = dz / steps;

  for (let step = 0; step < steps; step++) {
    let px = position.x + stepX;
    let py = position.y + stepY;
    let pz = position.z + stepZ;

    for (let pass = 0; pass < 4; pass++) {
      let pushed = false;
      for (const c of colliders) {
        const hit = ellipsoidEval(px, py, pz, c);
        if (!hit) continue;
        const { q, lx, dy: ldy, lz } = hit;
        if (q < 1e-10) {
          py = c.y + c.ry;
          pushed = true;
          continue;
        }
        const scale = 1 / Math.sqrt(q) + 1e-4;
        const nLx = lx * scale;
        const nDz = lz * scale;
        px = c.x + (nLx * c.cosY + nDz * c.sinY);
        py = c.y + ldy * scale;
        pz = c.z + (-nLx * c.sinY + nDz * c.cosY);
        pushed = true;
      }
      if (!pushed) break;
    }

    px = Math.max(-limit, Math.min(limit, px));
    pz = Math.max(-limit, Math.min(limit, pz));
    const minY = Math.max(-maxDepth, seafloorHeightAt(px, pz) + radius);
    py = Math.max(minY, Math.min(0, py));

    position.x = px;
    position.y = py;
    position.z = pz;
  }
}
