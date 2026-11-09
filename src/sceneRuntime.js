import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const moveCodes = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyC'
]);
const svgNS = 'http://www.w3.org/2000/svg';

export function createRuntime({ fov, far, shadows = false, resumeLabel }) {
  const canvas = document.getElementById('world');
  const start = document.getElementById('start');
  const notice = document.getElementById('notice');
  const status = document.getElementById('load-state');
  const coarse = matchMedia('(pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const keys = new Set();
  const heldButtons = new Map();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const buttons = [...document.querySelectorAll('[data-action]')];
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (error) {
    throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or open this page in a WebGL 2 browser.', { cause: error });
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.06, far);
  const controls = new PointerLockControls(camera, canvas);
  controls.minPolarAngle = 0.035;
  controls.maxPolarAngle = Math.PI - 0.035;
  controls.pointerSpeed = 0.77;
  let active = false;
  let ready = false;
  let awaitingLock = false;
  let dragPointer = null;
  let dragX = 0;
  let dragY = 0;
  let leaving = false;
  let lostContext = false;
  let noticeTimer;
  let actions = {};

  function announce(message) {
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 3600);
  }

  function resize() {
    const width = canvas.clientWidth || innerWidth;
    const height = canvas.clientHeight || innerHeight;
    camera.aspect = width / Math.max(1, height);
    const portraitFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(Math.PI / 6) / camera.aspect));
    camera.fov = THREE.MathUtils.clamp(portraitFov, fov, 112);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.65));
    renderer.setSize(width, height, false);
  }
  addEventListener('resize', resize);
  resize();

  function clearMovement() {
    keys.clear();
    heldButtons.clear();
    dragPointer = null;
  }

  function activate(mode) {
    if (leaving || lostContext) return;
    awaitingLock = false;
    active = true;
    document.body.dataset.active = 'true';
    document.body.dataset.mode = mode;
    document.body.dataset.briefing = 'compact';
    start.firstElementChild.textContent = resumeLabel;
    canvas.focus({ preventScroll: true });
  }

  function pause() {
    const wasActive = active;
    awaitingLock = false;
    active = false;
    clearMovement();
    document.body.dataset.active = 'false';
    delete document.body.dataset.mode;
    if (document.pointerLockElement === canvas) controls.unlock();
    if (wasActive && !leaving) start.focus({ preventScroll: true });
  }

  function useDrag() {
    if (!awaitingLock) return;
    activate('drag');
    announce('Drag to look around. Use the movement controls to explore.');
  }

  start.addEventListener('click', () => {
    if (!ready || leaving || lostContext) return;
    awaitingLock = true;
    if (coarse.matches || !canvas.requestPointerLock) {
      useDrag();
      return;
    }
    try {
      canvas.requestPointerLock()?.catch(useDrag);
    } catch {
      useDrag();
    }
  });
  controls.addEventListener('lock', () => activate('lock'));
  controls.addEventListener('unlock', () => {
    if (document.body.dataset.mode === 'lock') pause();
  });
  document.addEventListener('pointerlockerror', useDrag);
  document.getElementById('pause').addEventListener('click', pause);

  canvas.addEventListener('pointerdown', (event) => {
    if (!active || document.body.dataset.mode !== 'drag' || dragPointer !== null || event.button !== 0) return;
    dragPointer = event.pointerId;
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== dragPointer) return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= (event.clientX - dragX) * 0.004;
    euler.x = THREE.MathUtils.clamp(euler.x - (event.clientY - dragY) * 0.004, -1.535, 1.535);
    dragX = event.clientX;
    dragY = event.clientY;
    camera.quaternion.setFromEuler(euler);
  });
  canvas.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === dragPointer) dragPointer = null;
  });

  for (const button of document.querySelectorAll('[data-move]')) {
    button.addEventListener('pointerdown', (event) => {
      if (!active) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      heldButtons.set(event.pointerId, button.dataset.move);
    });
    button.addEventListener('lostpointercapture', (event) => heldButtons.delete(event.pointerId));
  }

  function runAction(code) {
    if (ready && !leaving && !lostContext) actions[code]?.();
  }
  for (const button of buttons) button.addEventListener('click', () => runAction(button.dataset.action));
  addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const code = event.code.replace(/^Numpad([1-4])$/, 'Digit$1');
    if (active && code === 'Escape') {
      pause();
      return;
    }
    if (active && moveCodes.has(code)) {
      keys.add(code);
      event.preventDefault();
    }
    if (!event.repeat) runAction(code);
  });
  addEventListener('keyup', (event) => keys.delete(event.code));
  addEventListener('blur', clearMovement);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearMovement();
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lostContext = true;
    pause();
    status.textContent = 'Graphics context paused. Waiting for the browser to restore it…';
    start.disabled = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lostContext = false;
    renderer.shadowMap.needsUpdate = shadows;
    status.textContent = '';
    start.disabled = !ready;
  });
  addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    leaving = false;
    delete document.body.dataset.transit;
  });

  return {
    camera, scene, renderer, controls, announce,
    get active() { return active; },
    get leaving() { return leaving; },
    down(...codes) {
      for (const code of codes) {
        if (keys.has(code)) return true;
        for (const held of heldButtons.values()) if (held === code) return true;
      }
      return false;
    },
    ready(keyActions = {}) {
      actions = keyActions;
      ready = true;
      document.body.dataset.ready = 'true';
      status.textContent = '';
      start.disabled = false;
      for (const button of buttons) button.disabled = !Object.hasOwn(actions, button.dataset.action);
    },
    travel(navigate) {
      if (leaving) return;
      leaving = true;
      pause();
      document.body.dataset.transit = 'true';
      setTimeout(navigate, reducedMotion.matches ? 50 : 630);
    },
    loop(frame) {
      let previous = performance.now();
      let time = 0;
      renderer.setAnimationLoop((now) => {
        const dt = Math.min(Math.max((now - previous) / 1000, 0), 0.08);
        previous = now;
        if (lostContext) return;
        time += dt;
        frame(dt, time);
        renderer.render(scene, camera);
      });
    }
  };
}

export function movementAxes(runtime) {
  const x = Number(runtime.down('KeyD', 'ArrowRight')) - Number(runtime.down('KeyA', 'ArrowLeft'));
  const z = Number(runtime.down('KeyW', 'ArrowUp')) - Number(runtime.down('KeyS', 'ArrowDown'));
  return [x, z];
}

export function updateCoordinates(position) {
  for (const axis of ['x', 'y', 'z']) {
    const value = Math.abs(position[axis]) < 0.05 ? 0 : position[axis];
    document.getElementById(`coord-${axis}`).value = value.toFixed(1);
  }
}

export function setLocation(code, name) {
  document.querySelector('#zone-code span').textContent = code;
  document.getElementById('zone-name').textContent = name;
}

export function setProximity(message) {
  document.getElementById('proximity').hidden = !message;
  document.getElementById('proximity-text').textContent = message;
}

export function makeMinimap(map) {
  const svg = document.getElementById('minimap');
  const { minX, maxX, minZ, maxZ, streetZ } = map.boundary;
  svg.setAttribute('viewBox', `${minX - 7} ${minZ - 4} ${maxX - minX + 14} ${streetZ - minZ + 8}`);
  function shape(tag, cssClass, attributes, parent = svg) {
    const element = document.createElementNS(svgNS, tag);
    element.setAttribute('class', cssClass);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    parent.append(element);
    return element;
  }
  function rect(cssClass, { x, z, width, depth, yaw = 0 }) {
    return shape('rect', cssClass, {
      x: x - width / 2, y: z - depth / 2, width, height: depth, rx: 0.6,
      transform: `rotate(${-yaw} ${x} ${z})`
    });
  }
  shape('path', 'outline', {
    d: `M${map.gate.x - 6},${maxZ} H${minX} V${minZ} H${maxX} V${maxZ} H${map.gate.x + 6}`
  });
  for (const walkway of map.walkways) rect('walkway', walkway);
  rect('green', map.ground);
  const garden = map.garden;
  shape('ellipse', 'green', { cx: garden.x, cy: garden.z, rx: garden.radiusX, ry: garden.radiusZ });
  for (const building of Object.values(map.buildings)) rect('footprint', building);
  rect('water', map.pool);
  const stops = map.stops.map(({ key, position: [x, , z] }) => {
    const marker = shape('g', '', { transform: `translate(${x - 5} ${z})` });
    shape('circle', 'checkpoint-dot', { r: 3.45 }, marker);
    shape('text', 'checkpoint-text', { x: 0, y: 0 }, marker).textContent = key;
    return [key, marker];
  });
  const player = shape('path', 'player', { d: 'M0,-3.9 L2.8,2.9 L0,1.7 L-2.8,2.9 Z' });
  return (position, heading, activeStop) => {
    player.setAttribute('transform', `translate(${position.x} ${position.z}) rotate(${heading})`);
    for (const [key, marker] of stops) marker.dataset.current = String(key === activeStop);
  };
}
