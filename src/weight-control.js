export function scrubWeight(start, distance) {
  return Math.max(0, Math.round((start + Math.round(distance / 20) * 2.5) * 1000000) / 1000000);
}

export function bindWeightControl(root, readWeight, writeWeight) {
  const format = (value) => value.toLocaleString('es-CO', { useGrouping: false, maximumFractionDigits: 10 });
  const animations = new Map();
  const draw = (button, anchor, position) => {
    if (anchor + position * 2.5 <= 0) { anchor = 0; position = 0; }
    const center = Math.round(position);
    button.querySelectorAll('[data-weight-offset]').forEach((row) => {
      const offset = Number(row.dataset.weightOffset);
      const value = Math.round((anchor + (center + offset) * 2.5) * 1000000) / 1000000;
      const relative = center + offset - position;
      row.textContent = value < 0 ? '' : format(value);
      row.style.transform = `translateY(${relative * 16}px) scale(${Math.max(.58, 1 - Math.abs(relative) * .3)})`;
      row.style.opacity = String(Math.max(0, 1 - Math.abs(relative) * .57));
    });
  };
  const stopAnimation = (button) => {
    const frame = animations.get(button);
    if (frame !== undefined) cancelAnimationFrame(frame.id);
    animations.delete(button);
    return frame;
  };
  const animate = (button, anchor, from, to) => {
    const previous = stopAnimation(button);
    if (previous) from = (previous.anchor + previous.position * 2.5 - anchor) / 2.5;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { draw(button, anchor, to); return; }
    const started = performance.now();
    const frame = (now) => {
      if (!button.isConnected) { animations.delete(button); return; }
      const t = Math.min(1, (now - started) / 160);
      const position = from + (to - from) * (1 - (1 - t) ** 3);
      draw(button, anchor, position);
      if (t < 1) animations.set(button, { id: requestAnimationFrame(frame), anchor, position });
      else animations.delete(button);
    };
    draw(button, anchor, from);
    animations.set(button, { id: requestAnimationFrame(frame), anchor, position: from });
  };
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
    stopAnimation(button);
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
    gesture.position = Math.max(-gesture.start / 2.5, distance / 20);
    update(gesture.button, scrubWeight(gesture.start, distance));
    draw(gesture.button, gesture.start, gesture.position);
  });
  const end = (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.moved) suppressClickUntil = Date.now() + 500;
    if (gesture.moved) animate(gesture.button, gesture.start, gesture.position, (readWeight(gesture.button) - gesture.start) / 2.5);
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
    if (steps) {
      const before = readWeight(button), after = Math.max(0, before + steps * 2.5);
      update(button, after); animate(button, before, 0, (after - before) / 2.5);
      wheelDistance -= steps * 40;
    }
  }, { passive: false });
  root.addEventListener('keydown', (event) => {
    const button = control(event);
    if (!button || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const before = readWeight(button), after = Math.max(0, before + (event.key === 'ArrowUp' ? 2.5 : -2.5));
    update(button, after); animate(button, before, 0, (after - before) / 2.5);
  });
}
