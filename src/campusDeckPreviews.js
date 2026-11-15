import * as THREE from 'three';

const width = 256;
const height = 164;

function createPreviewRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0, 0);

  const scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffedcf, 2.8);
  key.position.set(-4, 7, 6);
  const fill = new THREE.DirectionalLight(0xb4d4ff, 1.15);
  fill.position.set(5, 4, -4);
  scene.add(key, fill, new THREE.HemisphereLight(0xe4eeff, 0x9b9eab, 1.8));

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1);
  const bounds = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const groundMaterials = new Map();

  return {
    capture(source) {
      const model = source.clone(true);
      model.position.set(0, 0, 0);
      model.rotation.y = 0;
      model.updateMatrix();
      model.traverse((part) => {
        if (part.isLight) part.visible = false;
        if (!part.isMesh) return;
        part.visible = true;
        // The terrain's pool cutout uses world coordinates. Leave it out of isolated previews.
        if (part.userData.grade && part.material?.isMaterial
          && part.material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
          const original = part.material;
          if (!groundMaterials.has(original)) groundMaterials.set(original, original.clone());
          part.material = groundMaterials.get(original);
        }
      });
      scene.add(model);
      try {
        bounds.setFromObject(model);
        if (bounds.isEmpty()) return null;
        bounds.getCenter(center);
        bounds.getSize(size);
        const extent = Math.max(size.x, size.y, size.z, 0.1);
        const elevation = size.y < extent * 0.28 ? 1.6 : 0.72;
        direction.set(-0.55, elevation, 1).normalize();
        camera.position.copy(center).addScaledVector(direction, extent * 2.5);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        bounds.applyMatrix4(camera.matrixWorldInverse);
        bounds.getSize(size);
        bounds.getCenter(center);
        const aspect = width / height;
        const halfHeight = Math.max(size.y, size.x / aspect) * 0.55;
        const halfWidth = halfHeight * aspect;
        Object.assign(camera, {
          left: center.x - halfWidth, right: center.x + halfWidth,
          bottom: center.y - halfHeight, top: center.y + halfHeight,
          far: extent * 5
        });
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);

        const image = document.createElement('canvas');
        image.width = width;
        image.height = height;
        image.setAttribute('aria-hidden', 'true');
        image.getContext('2d').drawImage(renderer.domElement, 0, 0);
        return image;
      } finally {
        model.removeFromParent();
        model.traverse((part) => { if (part.isInstancedMesh) part.dispose(); });
      }
    },
    dispose() {
      for (const material of groundMaterials.values()) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}

export function createDeckPreviews(list) {
  const cache = new WeakMap();
  const entries = new WeakMap();
  const visible = new Set();
  let renderer;
  let frame = 0;
  let paused = false;
  let failed = false;

  const observer = new IntersectionObserver((changes) => {
    for (const change of changes) {
      if (!list.contains(change.target)) continue;
      if (change.isIntersecting) visible.add(change.target);
      else visible.delete(change.target);
    }
    schedule();
  }, { root: list, rootMargin: '0px 96px' });

  function schedule() {
    if (!frame && !paused && !failed && visible.size) frame = requestAnimationFrame(paint);
  }

  function paint() {
    frame = 0;
    if (paused || !visible.size) return;
    const tile = visible.values().next().value;
    visible.delete(tile);
    observer.unobserve(tile);
    if (list.contains(tile)) {
      const entry = entries.get(tile);
      try {
        renderer ??= createPreviewRenderer();
        const image = renderer.capture(entry.root);
        if (image) {
          cache.set(entry, {
            image, root: entry.root, shape: entry.building?.shape, scale: entry.root.scale.clone()
          });
          tile.append(image);
        }
      } catch (error) {
        failed = true;
        console.warn('Campus deck previews could not render.', error);
      }
    }
    schedule();
  }

  function reset() {
    observer.disconnect();
    visible.clear();
    cancelAnimationFrame(frame);
    frame = 0;
  }

  addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    reset();
    renderer?.dispose();
  });

  return {
    add(tile, entry) {
      const cached = cache.get(entry);
      if (cached?.root === entry.root && cached.shape === entry.building?.shape && cached.scale.equals(entry.root.scale)) {
        tile.append(cached.image);
      } else {
        entries.set(tile, entry);
        observer.observe(tile);
      }
    },
    reset,
    pause(value) {
      paused = value;
      schedule();
    }
  };
}
