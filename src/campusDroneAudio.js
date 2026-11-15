const rotorRecording = new URL('../assets/drone-rotors.wav', import.meta.url);
const fallbackFrequency = 180;

export function createDroneAudio({ underwater = false } = {}) {
  let context, recordedRotor, fallbackRotor, volume, tone, stereo;
  let subWaterOsc, subWaterGain, subWaterFilter;
  let lastRate = 1;
  let lastCutoff = underwater ? 360 : 3800;
  let lastPan = 0;
  let lastLevel = 0;
  let lastQ = underwater ? 1.65 : 0.35;
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

      // Keep audio available while the recording loads or if the asset cannot be decoded.
      const fallbackLevel = context.createGain();
      fallbackLevel.gain.value = 0.26;
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
    const baseRate = isUnderwater ? 0.72 : 1;
    const rate = Math.round(100 * baseRate * (1 + travel * 0.22 + forward * 0.08 + climb * 0.2 + Math.min(0, vertical) * 0.1)) / 100;
    const cutoff = isUnderwater
      ? Math.round(280 + travel * 180 + forward * 70 + Math.abs(vertical) * 90)
      : Math.round((3800 + travel * 2500 + forward * 1100 + vertical * 1100) / 50) * 50;
    const qValue = isUnderwater ? 1.65 : 0.35;
    const pan = Math.round(side * 65) / 100;
    const level = (!muted && active) ? Math.round(100 * (0.22 + load * 0.23)) / 100 : 0;
    const now = context.currentTime;
    if (rate !== lastRate) {
      const spool = rate > lastRate ? 0.15 : 0.24;
      recordedRotor?.playbackRate.setTargetAtTime(rate, now, spool);
      fallbackRotor?.frequency.setTargetAtTime(rate * fallbackFrequency, now, spool);
      subWaterOsc?.frequency.setTargetAtTime(46 + rate * 16, now, spool);
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
