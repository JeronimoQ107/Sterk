// UI-03: los valores siguen al dedo: avanzar uno son 20 px y están separados 20 px. El campo se abre para mostrar
// el anterior y el siguiente (styles.css).
const ROW = 20;

export function scrubReps(start, distance) {
  return Math.max(0, Math.min(999, start + Math.round(distance / 20)));
}

export function bindRepsControl(root, read, write) {
  const animations = new Map();
  const control = (event) => event.target.closest('[data-edit-reps]');
  const draw = (button, anchor, position) => {
    const center = Math.round(position);
    button.querySelectorAll('[data-reps-offset]').forEach((row) => {
      const offset = Number(row.dataset.repsOffset);
      const value = anchor + center + offset;
      const relative = center + offset - position;
      const text = value < 0 || value > 999 ? '' : String(value);
      if (row.textContent !== text) row.textContent = text;
      row.style.transform = `translateY(${relative * ROW}px) scale(${Math.max(.58, 1 - Math.abs(relative) * .3)})`;
      row.style.opacity = String(Math.max(0, 1 - Math.abs(relative) * .57));
    });
  };
  const stopAnimation = (button) => {
    const frame = animations.get(button);
    if (frame !== undefined) cancelAnimationFrame(frame.id);
    animations.delete(button);
    return frame;
  };
  const animate = (button, anchor, from, to, done) => {
    const previous = stopAnimation(button);
    const finish = done || previous?.done;
    if (previous) from = previous.anchor + previous.position - anchor;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { draw(button, anchor, to); finish?.(); return; }
    const started = performance.now();
    const frame = (now) => {
      if (!button.isConnected) { animations.delete(button); return; }
      const t = Math.min(1, (now - started) / 160);
      const position = from + (to - from) * (1 - (1 - t) ** 3);
      draw(button, anchor, position);
      if (t < 1) animations.set(button, { id: requestAnimationFrame(frame), anchor, position, done: finish });
      else { animations.delete(button); finish?.(); }
    };
    draw(button, anchor, from);
    animations.set(button, { id: requestAnimationFrame(frame), anchor, position: from, done: finish });
  };
  const update = (button, value) => {
    const next = Math.max(0, Math.min(999, value));
    if (next !== read(button)) write(button, next);
    button.setAttribute('aria-valuenow', String(next));
    button.setAttribute('aria-valuetext', `${next} repeticiones`);
  };
  let gesture = null, suppressClickUntil = 0;
  let wheelTarget = null, wheelDistance = 0, wheelTime = 0;
  root.addEventListener('pointerdown', (event) => {
    const button = control(event);
    if (!button || !event.isPrimary || event.button !== 0) return;
    const resumed = Boolean(stopAnimation(button));
    gesture = { button, id: event.pointerId, y: event.clientY, start: read(button), moved: false, resumed };
    button.setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    // Si la pantalla cambió a mitad del gesto, el campo ya no existe: seguir escribiría en otro ejercicio.
    if (!gesture.button.isConnected) { gesture = null; return; }
    let distance = gesture.y - event.clientY;
    // Al reconocer el gesto se descuentan sus primeros 6 px para que el número no salte.
    if (!gesture.moved && Math.abs(distance) > 6) {
      gesture.moved = true;
      gesture.y -= Math.sign(distance) * 6;
      distance = gesture.y - event.clientY;
    }
    if (!gesture.moved) return;
    event.preventDefault();
    gesture.button.classList.add('scrubbing');
    gesture.position = Math.max(-gesture.start, Math.min(999 - gesture.start, distance / 20));
    update(gesture.button, scrubReps(gesture.start, distance));
    draw(gesture.button, gesture.start, gesture.position);
  });
  const end = (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.button.isConnected) { gesture = null; return; }
    const { button, start, position, moved, resumed } = gesture;
    gesture = null;
    // El campo sigue abierto hasta que el número queda centrado.
    const rest = () => button.classList.remove('scrubbing');
    if (moved) {
      suppressClickUntil = Date.now() + 500;
      animate(button, start, position, read(button) - start, rest);
    } else if (resumed) { draw(button, start, 0); rest(); }
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
      const before = read(button), after = Math.max(0, Math.min(999, before + steps));
      update(button, after); animate(button, before, 0, after - before);
      wheelDistance -= steps * 40;
    }
  }, { passive: false });
  root.addEventListener('keydown', (event) => {
    const button = control(event);
    if (!button || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const before = read(button), after = Math.max(0, Math.min(999, before + (event.key === 'ArrowUp' ? 1 : -1)));
    update(button, after); animate(button, before, 0, after - before);
  });
}
