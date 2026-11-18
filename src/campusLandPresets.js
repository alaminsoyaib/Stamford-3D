import { landArea, landCorners } from './campusBoundary.js';

// Outside edge of the left master-plan sheet in stamford-shape-boundary.png.
const surveyPixels = [
  [661.5, 809], [1124.1, 754.2], [1363.2, 1512.7], [1243.5, 1574.8],
  [1191.9, 1495.3], [654, 1618.8], [654, 1629], [560.5, 1629], [560.5, 1370.4], [464.5, 1370.4]
];
const [frontRight, frontLeft] = surveyPixels.slice(4, 6);
const frontX = frontRight[0] - frontLeft[0];
const frontZ = frontRight[1] - frontLeft[1];
const frontage = Math.hypot(frontX, frontZ);
const frontAngle = Math.atan2(frontZ, frontX);
const surveyArea = landArea(surveyPixels);
const stockScale = 0.155;

function placeSurvey(gate, scale, gateFraction) {
  // Align the uninterrupted front edge to the gate and keep a uniform scale.
  const yaw = (gate.yaw ?? 0) * Math.PI / 180;
  const angle = frontAngle + yaw;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const gateOffset = frontage * gateFraction;
  return surveyPixels.map(([x, z]) => {
    const dx = x - frontLeft[0];
    const dz = z - frontLeft[1];
    return [
      Number((gate.x + scale * (dx * cos + dz * sin - gateOffset * Math.cos(yaw))).toFixed(4)),
      Number((gate.z + scale * (-dx * sin + dz * cos + gateOffset * Math.sin(yaw))).toFixed(4))
    ];
  });
}

export const stamfordLandOutline = placeSurvey({ x: -3, z: 32 }, stockScale, 0.5);

export function fitStamfordSurvey(boundary, gate, score) {
  const initialScale = Math.sqrt(landArea(landCorners(boundary)) / surveyArea) || stockScale;
  const preferredAnchors = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8, 0.15, 0.85, 0.1, 0.9];
  let best = placeSurvey(gate, initialScale, 0.5);
  let bestScore = -Infinity;
  for (const factor of [1, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4]) {
    // A small angle allowance can clear nearby buildings while keeping the gate on the frontage.
    for (const offset of [0, -1.5, 1.5, -3, 3]) {
      const alignment = { ...gate, yaw: (gate.yaw ?? 0) + offset };
      for (const anchor of preferredAnchors) {
        const points = placeSurvey(alignment, initialScale * factor, anchor);
        const rank = score({ points });
        if (rank === Infinity) return points;
        if (rank > bestScore) {
          best = points;
          bestScore = rank;
        }
      }
    }
  }
  return best;
}
