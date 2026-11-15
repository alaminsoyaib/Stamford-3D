const rotorRecording = new URL('../assets/drone-rotors.wav', import.meta.url);
const fallbackFrequency = 180;

export function createDroneAudio({ underwater = false } = {}) {
  let context, recordedRotor, fallbackRotor, volume, tone, stereo;
  let subWaterOsc, subWaterGain, subWaterFilter;
  let aeroBodyOsc, aeroBodyGain, aeroBodyFilter;
  let lastRate = underwater ? 0.72 : 0.94;
  let lastCutoff = underwater ? 360 : 1750;
  let lastPan = 0;
  let lastLevel = 0;
  let lastQ = underwater ? 1.65 : 0.75;
  let muted = false;
  let isUnderwater = Boolean(underwater);

  async function loadRecording(fallbackLevel) {
    const response = await fetch(rotorRecording);
    if (!response.ok) throw new Error('Drone recording could not be loaded.');
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    const fade = context.createGain();
    recordedRotor = context.createBufferSource();
    recordedRotor.buffer = buffer;
    recordedRotor.loop = true;
    recordedRotor.playbackRate.value = lastRate;
    fade.gain.value = 0;
    recordedRotor.connect(fade).connect(tone);
    const now = context.currentTime;
    recordedRotor.start(now);
    fade.gain.linearRampToValueAtTime(1, now + 0.14);
    fallbackLevel.gain.linearRampToValueAtTime(0, now + 0.14);
    fallbackRotor.stop(now + 0.15);
    fallbackRotor = null;
  }

  function start() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      volume = context.createGain();
      tone = context.createBiquadFilter();
      stereo = context.createStereoPanner();
      volume.gain.value = 0;
      tone.type = 'lowpass';
      tone.frequency.value = lastCutoff;
      tone.Q.value = lastQ;
      tone.connect(volume).connect(stereo).connect(context.destination);

      // Submerged thruster resonance
      subWaterOsc = context.createOscillator();
      subWaterGain = context.createGain();
      subWaterFilter = context.createBiquadFilter();
      subWaterOsc.type = 'triangle';
      subWaterOsc.frequency.value = 52;
      subWaterFilter.type = 'lowpass';
      subWaterFilter.frequency.value = 320;
      subWaterGain.gain.value = 0;
      subWaterOsc.connect(subWaterFilter).connect(subWaterGain).connect(volume);
      subWaterOsc.start();

      // Aerodynamic prop wash / motor body resonance (active in aerial flight)
      aeroBodyOsc = context.createOscillator();
      aeroBodyGain = context.createGain();
      aeroBodyFilter = context.createBiquadFilter();
      aeroBodyOsc.type = 'triangle';
      aeroBodyOsc.frequency.value = 74;
      aeroBodyFilter.type = 'lowpass';
      aeroBodyFilter.frequency.value = 240;
      aeroBodyGain.gain.value = 0;
      aeroBodyOsc.connect(aeroBodyFilter).connect(aeroBodyGain).connect(volume);
      aeroBodyOsc.start();

      // Keep audio available while the recording loads or if the asset cannot be decoded.
      const fallbackLevel = context.createGain();
      fallbackLevel.gain.value = 0.22;
      fallbackRotor = context.createOscillator();
      fallbackRotor.setPeriodicWave(context.createPeriodicWave(
        new Float32Array(8), Float32Array.of(0, 1, 0.68, 0.38, 0.25, 0.16, 0.12, 0.08)
      ));
      fallbackRotor.frequency.value = fallbackFrequency;
      fallbackRotor.connect(fallbackLevel).connect(tone);
      fallbackRotor.start();
      loadRecording(fallbackLevel).catch(() => {});
    }
    context.resume().catch(() => {});
  }

  function toggleMute() {
    muted = !muted;
    if (!muted) {
      start();
    } else if (context) {
      volume.gain.setTargetAtTime(lastLevel = 0, context.currentTime, 0.05);
      if (subWaterGain) subWaterGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
      if (aeroBodyGain) aeroBodyGain.gain.setTargetAtTime(0, context.currentTime, 0.05);
    }
    return muted;
  }

  function setUnderwater(value) {
    isUnderwater = Boolean(value);
  }

  function update(active, side = 0, forward = 0, vertical = 0, underwater = isUnderwater) {
    if (!context) return;
    isUnderwater = Boolean(underwater);
    // The velocity components are signed and normalized against the top speed on each axis.
    const travel = Math.min(1, Math.hypot(side, forward));
    const climb = Math.max(0, vertical);
    const load = Math.min(1, travel + climb * 0.65 + Math.abs(vertical) * 0.1);

    // Rate: underwater uses 0.72 base rate; aerial uses smooth 0.94 base rate with controlled spooling
    const rate = isUnderwater
      ? Math.round(100 * 0.72 * (1 + travel * 0.22 + forward * 0.08 + climb * 0.2 + Math.min(0, vertical) * 0.1)) / 100
      : Math.round(100 * 0.94 * (1 + travel * 0.14 + forward * 0.05 + climb * 0.12 + Math.min(0, vertical) * 0.06)) / 100;

    // Filter cutoff: underwater stays warm (280-540 Hz); aerial is warm and smooth (1750-3250 Hz, avoiding harsh 8kHz whine)
    const cutoff = isUnderwater
      ? Math.round(280 + travel * 180 + forward * 70 + Math.abs(vertical) * 90)
      : Math.round(1750 + travel * 950 + forward * 350 + vertical * 450);

    const qValue = isUnderwater ? 1.65 : 0.75;
    const pan = Math.round(side * 65) / 100;

    // Output level: well-balanced, non-fatiguing gain
    const level = (!muted && active)
      ? (isUnderwater
          ? Math.round(100 * (0.22 + load * 0.23)) / 100
          : Math.round(100 * (0.17 + load * 0.15)) / 100)
      : 0;

    const now = context.currentTime;
    if (rate !== lastRate) {
      const spool = rate > lastRate ? 0.15 : 0.24;
      recordedRotor?.playbackRate.setTargetAtTime(rate, now, spool);
      fallbackRotor?.frequency.setTargetAtTime(rate * fallbackFrequency, now, spool);
      subWaterOsc?.frequency.setTargetAtTime(46 + rate * 16, now, spool);
      aeroBodyOsc?.frequency.setTargetAtTime(68 + rate * 18, now, spool);
      lastRate = rate;
    }
    if (cutoff !== lastCutoff) tone.frequency.setTargetAtTime(lastCutoff = cutoff, now, 0.12);
    if (qValue !== lastQ) tone.Q.setTargetAtTime(lastQ = qValue, now, 0.12);
    if (pan !== lastPan) stereo.pan.setTargetAtTime(lastPan = pan, now, 0.09);
    if (level !== lastLevel) volume.gain.setTargetAtTime(lastLevel = level, now, active ? 0.14 : 0.045);
    if (subWaterGain) {
      const subLevel = (!muted && active && isUnderwater) ? (0.32 + load * 0.25) : 0;
      subWaterGain.gain.setTargetAtTime(subLevel, now, 0.12);
    }
    if (aeroBodyGain) {
      const aeroLevel = (!muted && active && !isUnderwater) ? (0.16 + load * 0.12) : 0;
      aeroBodyGain.gain.setTargetAtTime(aeroLevel, now, 0.12);
    }
  }

  const quiet = () => update(false);
  addEventListener('blur', quiet);
  addEventListener('pagehide', quiet);
  document.addEventListener('visibilitychange', () => { if (document.hidden) quiet(); });
  return {
    start,
    update,
    toggleMute,
    setUnderwater,
    get muted() { return muted; },
    get underwater() { return isUnderwater; }
  };
}
