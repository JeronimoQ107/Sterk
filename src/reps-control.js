export function scrubReps(start, distance) {
  return Math.max(0, Math.min(999, start + Math.round(distance / 20)));
}

export function bindRepsControl(root, read, write) {
  let gesture = null;
  let suppressClickUntil = 0;
  let wheelRemainder = 0;
  let wheelTarget = null;
  const control = (event) => event.target.closest('[data-edit-reps]');
  const draw = (button, value) => {
    button.querySelectorAll('[data-reps-offset]').forEach((row) => {
      const candidate = value + Number(row.dataset.repsOffset);
      row.textContent = candidate < 0 || candidate > 999 ? '' : String(candidate);
    });
    button.setAttribute('aria-valuenow', String(value));
    button.setAttribute('aria-valuetext', `${value} repeticiones`);
  };
  const update = (button, value) => {
    const next = Math.max(0, Math.min(999, value));
    if (next !== read(button)) write(button, next);
    draw(button, next);
  };
  root.addEventListener('pointerdown', (event) => {
    const button = control(event);
    if (!button || !event.isPrimary || event.button !== 0) return;
    gesture = { button, id: event.pointerId, y: event.clientY, start: read(button), moved: false };
    button.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const distance = gesture.y - event.clientY;
    if (Math.abs(distance) > 6) gesture.moved = true;
    if (!gesture.moved) return;
    event.preventDefault();
    gesture.button.classList.add('scrubbing');
    update(gesture.button, scrubReps(gesture.start, distance));
  });
  const end = (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.moved) suppressClickUntil = Date.now() + 500;
    gesture.button.classList.remove('scrubbing');
    gesture = null;
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('lostpointercapture', end);
  root.addEventListener('click', (event) => {
    if (control(event) && Date.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  root.addEventListener('wheel', (event) => {
    const button = control(event);
    if (!button || event.ctrlKey) return;
    event.preventDefault();
    if (wheelTarget !== button) { wheelTarget = button; wheelRemainder = 0; }
    wheelRemainder += -event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1);
    const steps = Math.trunc(wheelRemainder / 40);
    if (steps) { update(button, read(button) + steps); wheelRemainder -= steps * 40; }
  }, { passive: false });
  root.addEventListener('keydown', (event) => {
    const button = control(event);
    if (!button || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    update(button, read(button) + (event.key === 'ArrowUp' ? 1 : -1));
  });
}
