export function scrubWeight(start, distance) {
  return Math.max(0, Math.round((start + Math.trunc(distance / 20) * 2.5) * 1000000) / 1000000);
}

export function bindWeightControl(root, readWeight, writeWeight) {
  let gesture = null, suppressClickUntil = 0;
  let wheelTarget = null, wheelDistance = 0, wheelTime = 0;
  const control = (event) => event.target.closest('[data-edit-weight]');
  const update = (button, value) => {
    if (value === readWeight(button)) return;
    writeWeight(button, value);
    button.querySelector('[data-weight-number]').textContent = value.toLocaleString('es-CO', { useGrouping: false, maximumFractionDigits: 10 });
    const format = (weight) => weight.toLocaleString('es-CO', { useGrouping: false, maximumFractionDigits: 10 });
    button.querySelector('[data-weight-previous]').textContent = value >= 2.5 ? format(value - 2.5) : '';
    button.querySelector('[data-weight-next]').textContent = format(value + 2.5);
    button.setAttribute('aria-valuenow', String(value));
    button.setAttribute('aria-valuetext', `${value} libras`);
  };
  root.addEventListener('pointerdown', (event) => {
    const button = control(event);
    if (!button || !event.isPrimary || event.button !== 0) return;
    gesture = { button, id: event.pointerId, y: event.clientY, start: readWeight(button), moved: false };
    button.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const distance = gesture.y - event.clientY;
    if (Math.abs(distance) > 6) gesture.moved = true;
    if (!gesture.moved) return;
    event.preventDefault();
    gesture.button.classList.add('scrubbing');
    update(gesture.button, scrubWeight(gesture.start, distance));
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
    const now = Date.now();
    if (wheelTarget !== button || now - wheelTime > 180) wheelDistance = 0;
    wheelTarget = button; wheelTime = now;
    const distance = -event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1);
    if (Math.sign(distance) !== Math.sign(wheelDistance)) wheelDistance = 0;
    wheelDistance += distance;
    const steps = Math.trunc(wheelDistance / 40);
    if (steps) { update(button, Math.max(0, readWeight(button) + steps * 2.5)); wheelDistance -= steps * 40; }
  }, { passive: false });
  root.addEventListener('keydown', (event) => {
    const button = control(event);
    if (!button || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    update(button, Math.max(0, readWeight(button) + (event.key === 'ArrowUp' ? 2.5 : -2.5)));
  });
}
