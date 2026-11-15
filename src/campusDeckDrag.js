export function createDeckDrag(deck, canvas, { canPick, pick, preview, finish }) {
  const cards = new WeakMap();
  const ghost = document.createElement('div');
  ghost.className = 'editor-deck-ghost';
  ghost.hidden = true;
  ghost.setAttribute('aria-hidden', 'true');
  document.body.append(ghost);
  let gesture = null;
  let suppressClick = null;
  let frame = 0;
  let dropFrame = 0;

  function pointOnMap(point) {
    return document.elementFromPoint(point.clientX, point.clientY) === canvas ? point : null;
  }

  function paint() {
    frame = 0;
    const { point } = gesture;
    const onMap = pointOnMap(point);
    ghost.style.transform = `translate3d(${point.clientX}px, ${point.clientY}px, 0) translate(-50%, calc(-100% - 14px))`;
    ghost.classList.toggle('is-invalid', !preview(onMap));
  }

  function lift() {
    const { button, getPlacement } = gesture;
    gesture.dragging = true;
    pick(getPlacement(), true);
    const thumbnail = button.querySelector('canvas');
    if (thumbnail) {
      const image = thumbnail.cloneNode();
      image.getContext('2d').drawImage(thumbnail, 0, 0);
      ghost.replaceChildren(image);
    } else {
      ghost.textContent = button.title || button.textContent;
    }
    ghost.hidden = false;
    button.classList.add('is-lifted');
    deck.classList.add('is-dragging');
  }

  function release(point = null) {
    if (!gesture) return false;
    const { button, id, dragging } = gesture;
    gesture = null;
    if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    if (!dragging) return true;
    suppressClick = button;
    cancelAnimationFrame(frame);
    frame = 0;
    ghost.hidden = true;
    ghost.replaceChildren();
    button.classList.remove('is-lifted');
    deck.classList.remove('is-dragging');
    const target = point && pointOnMap(point);
    if (target?.pointerType === 'touch') {
      // Keep the source card attached until the browser dispatches touchend.
      dropFrame = requestAnimationFrame(() => {
        dropFrame = 0;
        finish(target);
      });
    } else finish(target);
    return true;
  }

  function cancel() {
    if (!dropFrame) return release();
    cancelAnimationFrame(dropFrame);
    dropFrame = 0;
    finish(null);
    return true;
  }

  deck.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button');
    const getPlacement = cards.get(button);
    if (!getPlacement || button.disabled || !event.isPrimary || event.button !== 0 || gesture || dropFrame || !canPick()) return;
    suppressClick = null;
    gesture = {
      button, getPlacement, id: event.pointerId, x: event.clientX, y: event.clientY,
      point: null, dragging: false
    };
    button.setPointerCapture(event.pointerId);
  });

  deck.addEventListener('pointermove', (event) => {
    if (event.pointerId !== gesture?.id) return;
    if (!gesture.dragging) {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      // Horizontal touch motion stays with the browser's scrolling gesture.
      if (Math.hypot(dx, dy) < 6 || (event.pointerType === 'touch' && Math.abs(dx) >= Math.abs(dy))) return;
      lift();
    }
    gesture.point = { clientX: event.clientX, clientY: event.clientY };
    if (!frame) frame = requestAnimationFrame(paint);
  });

  deck.addEventListener('pointerup', (event) => {
    if (event.pointerId !== gesture?.id) return;
    release(event);
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    deck.addEventListener(type, (event) => {
      if (event.pointerId === gesture?.id) release();
    });
  }
  addEventListener('blur', cancel);

  deck.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const getPlacement = cards.get(button);
    if (!getPlacement || button.disabled || !canPick()) return;
    if (button === suppressClick && event.detail > 0) {
      suppressClick = null;
      event.preventDefault();
      return;
    }
    pick(getPlacement(), false);
  });

  return {
    bind(button, getPlacement) { cards.set(button, getPlacement); },
    cancel,
    get busy() { return gesture !== null || dropFrame !== 0; },
    get dragging() { return Boolean(gesture?.dragging || dropFrame); }
  };
}
