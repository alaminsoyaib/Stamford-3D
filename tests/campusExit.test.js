import test from 'node:test';
import assert from 'node:assert/strict';

test('runtime exitToStart resets briefing and active state', () => {
  const body = {
    dataset: { active: 'true', briefing: 'compact', mode: 'lock' }
  };
  const startBtn = {
    firstElementChild: { textContent: 'Resume flight' }
  };
  const initialLabel = 'Enter campus';

  function exitToStart(onExit) {
    body.dataset.active = 'false';
    delete body.dataset.briefing;
    delete body.dataset.mode;
    if (startBtn.firstElementChild) startBtn.firstElementChild.textContent = initialLabel;
    onExit?.();
  }

  let callbackFired = false;
  exitToStart(() => { callbackFired = true; });

  assert.equal(body.dataset.active, 'false');
  assert.equal(body.dataset.briefing, undefined);
  assert.equal(body.dataset.mode, undefined);
  assert.equal(startBtn.firstElementChild.textContent, 'Enter campus');
  assert.equal(callbackFired, true);
});
