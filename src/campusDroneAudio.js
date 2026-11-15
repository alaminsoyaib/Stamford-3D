const rotorRecording = new URL('../assets/drone-rotors.wav', import.meta.url);
const fallbackFrequency = 180;

export function createDroneAudio() {
  let context, recordedRotor, fallbackRotor, volume, tone, stereo;
  let lastRate = 1;
  let lastCutoff = 3800;
  let lastPan = 0;
  let lastLevel = 0;

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
      tone.Q.value = 0.35;
      tone.connect(volume).connect(stereo).connect(context.destination);

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

  function update(active, side = 0, forward = 0, vertical = 0) {
    if (!context) return;
    // The velocity components are signed and normalized against the top speed on each axis.
    const travel = Math.min(1, Math.hypot(side, forward));
    const climb = Math.max(0, vertical);
    const load = Math.min(1, travel + climb * 0.65 + Math.abs(vertical) * 0.1);
    const rate = Math.round(100 * (1 + travel * 0.25 + forward * 0.09 + climb * 0.24 + Math.min(0, vertical) * 0.11)) / 100;
    const cutoff = Math.round((3800 + travel * 2500 + forward * 1100 + vertical * 1100) / 50) * 50;
    const pan = Math.round(side * 65) / 100;
    const level = active ? Math.round(100 * (0.22 + load * 0.23)) / 100 : 0;
    const now = context.currentTime;
    if (rate !== lastRate) {
      const spool = rate > lastRate ? 0.15 : 0.24;
      recordedRotor?.playbackRate.setTargetAtTime(rate, now, spool);
      fallbackRotor?.frequency.setTargetAtTime(rate * fallbackFrequency, now, spool);
      lastRate = rate;
    }
    if (cutoff !== lastCutoff) tone.frequency.setTargetAtTime(lastCutoff = cutoff, now, 0.15);
    if (pan !== lastPan) stereo.pan.setTargetAtTime(lastPan = pan, now, 0.09);
    if (level !== lastLevel) volume.gain.setTargetAtTime(lastLevel = level, now, active ? 0.14 : 0.045);
  }

  const quiet = () => update(false);
  addEventListener('blur', quiet);
  addEventListener('pagehide', quiet);
  document.addEventListener('visibilitychange', () => { if (document.hidden) quiet(); });
  return { start, update };
}
