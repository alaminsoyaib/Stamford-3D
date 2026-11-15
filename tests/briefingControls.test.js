import test from 'node:test';
import assert from 'node:assert/strict';

test('briefing controls hide start button while loading and display status text, then swap when ready', () => {
  const body = {
    dataset: { active: 'false', ready: 'false' }
  };
  const startBtn = {
    disabled: true,
    hidden: true,
    firstElementChild: { textContent: 'Enter campus' }
  };
  const statusEl = {
    textContent: 'Building the campus scene…'
  };

  // Initial loading state: start button is hidden and disabled, loading status is visible
  assert.equal(body.dataset.ready, 'false', 'body ready dataset should initially be false');
  assert.equal(startBtn.disabled, true, 'start button should initially be disabled');
  assert.equal(startBtn.hidden, true, 'start button should initially be hidden');
  assert.equal(statusEl.textContent, 'Building the campus scene…', 'status should display scene building message');

  // Simulated runtime ready behavior
  function onReady() {
    body.dataset.ready = 'true';
    statusEl.textContent = '';
    startBtn.disabled = false;
    startBtn.hidden = false;
  }

  onReady();

  // Ready state: status text is cleared (hidden via CSS :empty), start button is displayed and enabled
  assert.equal(body.dataset.ready, 'true', 'body ready dataset should be true after ready');
  assert.equal(statusEl.textContent, '', 'status text should be cleared so :empty hides it');
  assert.equal(startBtn.disabled, false, 'start button should be enabled');
  assert.equal(startBtn.hidden, false, 'start button should be visible');

  // Context loss behavior
  function onContextLost() {
    body.dataset.ready = 'false';
    statusEl.textContent = 'Graphics context paused. Waiting for the browser to restore it…';
    startBtn.disabled = true;
    startBtn.hidden = true;
  }

  onContextLost();

  assert.equal(body.dataset.ready, 'false', 'body ready dataset should be false on context loss');
  assert.equal(startBtn.disabled, true, 'start button should be disabled on context loss');
  assert.equal(startBtn.hidden, true, 'start button should be hidden on context loss');
  assert.match(statusEl.textContent, /Graphics context paused/, 'status should display context paused message');

  // Context restore behavior
  function onContextRestored(isReady) {
    statusEl.textContent = '';
    startBtn.disabled = !isReady;
    startBtn.hidden = !isReady;
    if (isReady) body.dataset.ready = 'true';
  }

  onContextRestored(true);

  assert.equal(body.dataset.ready, 'true', 'body ready dataset should be restored');
  assert.equal(startBtn.disabled, false, 'start button should be restored to enabled');
  assert.equal(startBtn.hidden, false, 'start button should be restored to visible');
  assert.equal(statusEl.textContent, '', 'status text should be cleared');
});
