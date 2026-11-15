export function createDroneAudio() {
  let context, rotor, blade, volume, stereo;
  let lastPitch, lastPan, lastLevel;

  function start() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      rotor = context.createOscillator();
      blade = context.createOscillator();
      const bladeLevel = context.createGain();
      volume = context.createGain();
      stereo = context.createStereoPanner();
      rotor.type = 'triangle';
      rotor.frequency.value = 72;
      blade.frequency.value = 144;
      bladeLevel.gain.value = 0.28;
      volume.gain.value = 0;
      rotor.connect(volume);
      blade.connect(bladeLevel).connect(volume);
      volume.connect(stereo).connect(context.destination);
      rotor.start();
      blade.start();
    }
    context.resume().catch(() => {});
  }

  function update(active, x = 0, forward = 0, climb = 0, boost = false) {
    if (!context) return;
    const moving = Boolean(x || forward || climb);
    const pitch = 72 + Math.abs(x) * 9 + forward * 7 + climb * 15 + (boost && moving ? 25 : 0);
    const pan = x * 0.7;
    const level = active ? moving ? 0.056 : 0.031 : 0;
    if (pitch === lastPitch && pan === lastPan && level === lastLevel) return;
    lastPitch = pitch;
    lastPan = pan;
    lastLevel = level;
    const now = context.currentTime;
    rotor.frequency.setTargetAtTime(pitch, now, 0.08);
    blade.frequency.setTargetAtTime(pitch * 2.04, now, 0.08);
    stereo.pan.setTargetAtTime(pan, now, 0.08);
    volume.gain.setTargetAtTime(level, now, 0.06);
  }

  const quiet = () => update(false);
  addEventListener('blur', quiet);
  addEventListener('pagehide', quiet);
  document.addEventListener('visibilitychange', () => { if (document.hidden) quiet(); });
  return { start, update };
}
