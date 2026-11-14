import * as THREE from 'three';
import { box } from './sceneKit.js';

// Render the same model used by the tour once, then keep only a lightweight 2D image.
export function renderCampusHero(source, canvas) {
  const scene = new THREE.Scene();
  const building = source.clone(true);
  building.position.set(0, 0, 0);
  building.rotation.set(0, 0, 0);
  building.updateMatrix();
  scene.add(building);

  const bounds = new THREE.Box3().setFromObject(building);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const baseMaterial = new THREE.MeshStandardMaterial({ color: '#263e59', roughness: 0.85 });
  const pavingMaterial = new THREE.MeshStandardMaterial({ color: '#c8c5ba', roughness: 0.95 });
  const base = box(scene, baseMaterial, [size.x + 3.8, 0.6, size.z + 4.5],
    [center.x, bounds.min.y - 0.36, center.z + 0.45]);
  box(scene, pavingMaterial, [size.x + 3.5, 0.12, size.z + 4.2],
    [center.x, bounds.min.y - 0.04, center.z + 0.45]);

  scene.add(new THREE.HemisphereLight('#d6e8ff', '#69758b', 2.1));
  const sun = new THREE.DirectionalLight('#fff1d8', 3.2);
  sun.position.set(-25, 38, 32);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const extent = Math.max(size.x, size.y, size.z) + 8;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.right = sun.shadow.camera.top = extent;
  sun.shadow.camera.far = extent * 5;
  sun.position.copy(center).add(new THREE.Vector3(-0.6, 1, 0.85).multiplyScalar(extent));
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#8ebaff', 1.1);
  rim.position.set(20, 15, -20);
  scene.add(rim);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, extent * 10);
  camera.position.copy(center).add(new THREE.Vector3(-0.35, 0.18, 1).normalize().multiplyScalar(extent * 3));
  camera.lookAt(center);
  camera.updateMatrixWorld();

  // Fit all eight bounding-box corners in camera space, including the presentation base.
  bounds.expandByObject(base);
  const viewBounds = bounds.clone().applyMatrix4(camera.matrixWorldInverse);
  const aspect = canvas.width / canvas.height;
  const halfHeight = Math.max(
    (viewBounds.max.y - viewBounds.min.y) / 2,
    (viewBounds.max.x - viewBounds.min.x) / (2 * aspect)
  ) * 1.055;
  const viewCenter = viewBounds.getCenter(new THREE.Vector3());
  camera.left = viewCenter.x - halfHeight * aspect;
  camera.right = viewCenter.x + halfHeight * aspect;
  camera.top = viewCenter.y + halfHeight;
  camera.bottom = viewCenter.y - halfHeight;
  camera.updateProjectionMatrix();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(canvas.width, canvas.height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.render(scene, camera);
    canvas.getContext('2d').drawImage(renderer.domElement, 0, 0);
  } finally {
    // Geometry and materials on the clone belong to the campus. Only its instance buffers are private.
    building.traverse((object) => {
      if (object.isInstancedMesh) object.dispose();
    });
    baseMaterial.dispose();
    pavingMaterial.dispose();
    sun.shadow.map?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
