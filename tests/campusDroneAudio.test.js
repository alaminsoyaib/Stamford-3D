import test from 'node:test';
import assert from 'node:assert/strict';

test('createDroneAudio mute toggling and level clamping', async () => {
  // Mock AudioContext and window for Node environment
  class MockGainNode {
    constructor() {
      this.gain = {
        value: 1,
        setTargetAtTime: (val) => { this.gain.value = val; },
        linearRampToValueAtTime: (val) => { this.gain.value = val; }
      };
    }
    connect(dest) { return dest; }
  }

  class MockBiquadFilter {
    constructor() {
      this.frequency = { value: 3800, setTargetAtTime: (val) => { this.frequency.value = val; } };
      this.Q = { value: 0.35 };
    }
    connect(dest) { return dest; }
  }

  class MockStereoPanner {
    constructor() {
      this.pan = { value: 0, setTargetAtTime: (val) => { this.pan.value = val; } };
    }
    connect(dest) { return dest; }
  }

  class MockOscillator {
    constructor() {
      this.frequency = { value: 180, setTargetAtTime: (val) => { this.frequency.value = val; } };
    }
    setPeriodicWave() {}
    connect(dest) { return dest; }
    start() {}
    stop() {}
  }

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
    }
    createGain() { return new MockGainNode(); }
    createBiquadFilter() { return new MockBiquadFilter(); }
    createStereoPanner() { return new MockStereoPanner(); }
    createOscillator() { return new MockOscillator(); }
    createPeriodicWave() { return {}; }
    async resume() {}
  }

  globalThis.window = { AudioContext: MockAudioContext };
  globalThis.addEventListener = () => {};
  globalThis.document = { addEventListener: () => {} };

  const { createDroneAudio } = await import('../src/campusDroneAudio.js');
  const droneAudio = createDroneAudio();

  assert.equal(droneAudio.muted, false, 'Should be unmuted by default');

  droneAudio.start();
  droneAudio.update(true, 0, 1, 0); // Active movement

  const mutedState = droneAudio.toggleMute();
  assert.equal(mutedState, true, 'toggleMute should return true when muted');
  assert.equal(droneAudio.muted, true, 'droneAudio.muted should be true');

  droneAudio.update(true, 0, 1, 0);
  // Level should be muted

  const unmutedState = droneAudio.toggleMute();
  assert.equal(unmutedState, false, 'toggleMute should return false when unmuted');
  assert.equal(droneAudio.muted, false, 'droneAudio.muted should be false');
});
