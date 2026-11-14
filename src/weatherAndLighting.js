import * as THREE from 'three';
import { standard } from './buildingFactory.js';
import { batchStaticMeshes, box, cylinder, groupAt, rod, seededRandom } from './sceneKit.js';

const seasons = [
  { fog: 0.0062, leaves: ['#45663b', '#66834a', '#7d9654', '#547943'], haze: '#cbdad0' },
  { fog: 0.0105, leaves: ['#aa6134', '#bd8039', '#d6a254', '#986042'], haze: '#e2cbb2' },
  { fog: 0.027, leaves: ['#53634d', '#64725d', '#859075', '#596c5b'], haze: '#c7d5d7' }
];
const storageKey = 'stamford-campus-weather-v1';
const sunDirection = new THREE.Vector3(-0.58, 0.77, 0.51).normalize();

function createSky(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uNight: { value: 0 },
      uRain: { value: 0 },
      uHorizon: { value: new THREE.Color('#cbdad0') },
      uSun: { value: sunDirection }
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uNight;
      uniform float uRain;
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      varying vec3 vDirection;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      void main() {
        vec3 d = normalize(vDirection);
        float height = max(0.0,d.y);
        vec3 daySky = mix(vec3(.135,.39,.67), vec3(.29,.37,.44), uRain);
        vec3 nightSky = mix(vec3(.008,.019,.061),vec3(.025,.035,.06),uRain);
        vec3 color = mix(uHorizon, mix(daySky, nightSky, uNight), smoothstep(-.02,.72,height));
        vec2 cloudUV = d.xz / (0.23 + height) * 3.8;
        float clouds = noise(cloudUV) * .58 + noise(cloudUV * 2.3) * .28 + noise(cloudUV * 5.1) * .14;
        clouds = smoothstep(.44 - uRain*.15,.77,clouds) * smoothstep(.02,.19,height);
        color = mix(color, mix(vec3(.94,.93,.85), vec3(.065,.085,.13), uNight), clouds * (.60 + uRain*.26));
        float solar = max(0.0,dot(d,uSun));
        color += vec3(1.0,.69,.36) * (pow(solar,21.0)*.10+smoothstep(.99968,.99988,solar)*1.6) * (1.0-uNight) * (1.0-uRain*.93);
        vec2 starCell = d.xz / (0.3 + height) * 100.0;
        float stars = step(.991,hash(floor(starCell))) * (1.0-smoothstep(.05,.15,length(fract(starCell)-.5)));
        color += stars * vec3(.38,.48,.66) * uNight * (1.0-uRain) * smoothstep(.09,.32,height);
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthWrite: false, side: THREE.BackSide, fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(176, 36, 20), material);
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

function createRain(scene, renderer) {
  const count = 3600;
  const width = 33;
  const height = 24;
  const random = seededRandom(3129);
  const offsets = new Float32Array(count * 3);
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    offsets[index * 3] = (random() - 0.5) * width;
    offsets[index * 3 + 1] = random() * height;
    offsets[index * 3 + 2] = (random() - 0.5) * width;
    velocities[index] = 11 + random() * 13;
  }
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  const material = new THREE.ShaderMaterial({
    uniforms: { strength: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float pixelRatio;
      varying float vDistance;
      void main() {
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        vDistance = -eye.z;
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(62.0 * pixelRatio / max(vDistance,.1), 1.4, 21.0);
      }`,
    fragmentShader: `
      uniform float strength;
      varying float vDistance;
      void main() {
        vec2 p = gl_PointCoord - .5;
        float streak = 1.0-smoothstep(.014,.118,abs(p.x - p.y * .16));
        streak *= 1.0-smoothstep(.18,.49,abs(p.y));
        gl_FragColor = vec4(.57,.74,.81,streak * strength * .59 * (1.0-smoothstep(15.0,27.0,vDistance)));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false
  });
  const rain = new THREE.Points(geometry, material);
  rain.name = '3,600 downward-moving raindrops';
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  return (dt, position, strength) => {
    rain.visible = strength > 0.01;
    if (!rain.visible) return;
    material.uniforms.strength.value = strength;
    material.uniforms.pixelRatio.value = renderer.getPixelRatio();
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      offsets[offset] += dt * 0.8;
      offsets[offset + 1] -= velocities[index] * dt;
      if (offsets[offset] > width / 2) offsets[offset] -= width;
      if (offsets[offset + 1] < 0) offsets[offset + 1] += height;
      positions[offset] = position.x + offsets[offset];
      positions[offset + 1] = position.y - 2.6 + offsets[offset + 1];
      positions[offset + 2] = position.z + offsets[offset + 2];
    }
    attribute.needsUpdate = true;
  };
}

function createLamps(scene, kit) {
  const { materials } = kit;
  const lamps = groupAt(scene, 'Warm campus streetlamps', [0, 0, 0]);
  const bulb = standard('#f9e4bb', { emissive: '#ffc36e', emissiveIntensity: 0 });
  for (const [x, z, yaw] of [
    [3.95, 30.2, Math.PI], [-7.5, 14.4, 0], [18.1, 4.7, 0],
    [37.9, -13.5, Math.PI], [33.8, -37.7, 0], [14.6, -34.7, Math.PI],
    [-14.1, -47.3, 0], [12.9, -54.2, Math.PI], [3.0, -70.4, 0]
  ]) {
    const root = kit.prop(lamps, 'lamp', 'Streetlamp', x, z, yaw);
    cylinder(root, materials.steel, 0.105, 4.2, [0, 2.1, 0]);
    cylinder(root, materials.black, 0.182, 0.47, [0, 0.235, 0]);
    rod(root, materials.steel, [0, 3.94, 0], [0.66, 4.18, 0], 0.06);
    box(root, materials.steel, [0.38, 0.15, 0.29], [0.75, 4.13, 0]);
    box(root, bulb, [0.32, 0.061, 0.23], [0.75, 4.027, 0]);
    const light = new THREE.PointLight('#ffc482', 0, 18, 2);
    light.position.set(0.73, 3.89, 0);
    root.add(light);
  }
  batchStaticMeshes(lamps);
  return { bulb, group: lamps };
}

export function createWeather(runtime, kit) {
  const { scene, camera, renderer } = runtime;
  const { materials, foliage, windowMaterials } = kit;
  const sky = createSky(scene);
  const lamps = createLamps(scene, kit);
  const rain = createRain(scene, renderer);
  scene.fog = new THREE.FogExp2(seasons[0].haze, seasons[0].fog);
  scene.background = new THREE.Color(seasons[0].haze);

  const sun = new THREE.DirectionalLight('#fff0d3', 2.27);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -47, right: 47, top: 47, bottom: -47, near: 4, far: 175 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.00018;
  sun.shadow.intensity = 0.67;
  const hemisphere = new THREE.HemisphereLight('#e7f5ff', '#95846a', 1.65);
  const ambient = new THREE.AmbientLight('#f1f1dc', 0.23);
  scene.add(sun, sun.target, hemisphere, ambient);

  const state = { night: false, rain: false, season: 0 };
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved) {
      state.night = saved.night === true;
      state.rain = saved.rain === true;
      state.season = seasons[saved.season] ? saved.season : 0;
    }
  } catch {
    // The scene remains usable when session storage is disabled.
  }
  let night = Number(state.night);
  let wet = Number(state.rain);
  let hazeDensity = seasons[state.season].fog;
  const leafTargets = foliage.map((_, index) => new THREE.Color(seasons[state.season].leaves[index]));
  const hazeTarget = new THREE.Color(seasons[state.season].haze);
  const warmSun = new THREE.Color('#fff0d3');
  const moon = new THREE.Color('#a3bdff');
  const nightFog = new THREE.Color('#1c2f48');
  const overcast = new THREE.Color('#a6b8bf');
  const currentHaze = hazeTarget.clone();
  const ground = [materials.paving, materials.lane, materials.deck].map((material) => [material, material.color.clone()]);
  const anchor = new THREE.Vector3(Infinity, 0, Infinity);

  function applyPreferences() {
    const season = seasons[state.season];
    hazeTarget.set(season.haze);
    for (const [index, target] of leafTargets.entries()) target.set(season.leaves[index]);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Preferences are kept in memory for the current visit.
    }
  }
  applyPreferences();

  return {
    actions: {
      KeyN() { state.night = !state.night; applyPreferences(); },
      KeyR() { state.rain = !state.rain; applyPreferences(); },
      KeyV() { state.season = (state.season + 1) % seasons.length; applyPreferences(); }
    },
    update(dt, view = camera, overhead = false) {
      const blend = 1 - Math.exp(-dt * 2.75);
      night += (Number(state.night) - night) * blend;
      wet += (Number(state.rain) - wet) * blend;
      hazeDensity += (seasons[state.season].fog - hazeDensity) * blend;
      currentHaze.lerp(hazeTarget, blend);
      scene.fog.color.copy(currentHaze).lerp(overcast, wet * 0.75).lerp(nightFog, night * 0.96);
      scene.fog.density = overhead ? 0 : hazeDensity + wet * 0.008 + night * 0.003;
      scene.background.copy(scene.fog.color);
      sky.visible = !overhead;
      sky.position.copy(view.position);
      sky.material.uniforms.uNight.value = night;
      sky.material.uniforms.uRain.value = wet;
      sky.material.uniforms.uHorizon.value.copy(scene.fog.color);
      sun.intensity = THREE.MathUtils.lerp(2.27, 0.16, night) * (1 - wet * 0.76);
      sun.color.copy(warmSun).lerp(moon, night);
      hemisphere.intensity = THREE.MathUtils.lerp(1.62, 0.52, night);
      ambient.intensity = THREE.MathUtils.lerp(0.24, 0.14, night);
      for (const root of lamps.group.children) {
        root.traverse((object) => { if (object.isPointLight) object.intensity = night * 66; });
      }
      lamps.bulb.emissiveIntensity = night * 1.6;
      for (const material of windowMaterials) material.emissiveIntensity = night * 0.92;
      for (const [index, material] of foliage.entries()) material.color.lerp(leafTargets[index], blend);
      for (const [material, base] of ground) {
        material.roughness = THREE.MathUtils.lerp(0.94, 0.42, wet);
        material.clearcoat = THREE.MathUtils.lerp(0.03, 0.59, wet);
        material.specularIntensity = THREE.MathUtils.lerp(0.4, 0.83, wet);
        material.color.copy(base).multiplyScalar(1 - wet * 0.17);
      }
      const x = Math.round(camera.position.x / 6) * 6;
      const z = Math.round(camera.position.z / 6) * 6;
      if (anchor.x !== x || anchor.z !== z) {
        anchor.set(x, 0, z);
        sun.target.position.copy(anchor);
        sun.position.copy(anchor).addScaledVector(sunDirection, 73);
        renderer.shadowMap.needsUpdate = true;
      }
      rain(dt, view.position, overhead ? 0 : wet);
      return (1 - night * 0.89) * (1 - wet * 0.49);
    }
  };
}
