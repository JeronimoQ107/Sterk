import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRepsControl, scrubReps } from '../src/reps-control.js';

function setup() {
  const listeners = {}, values = [];
  let reps = 10;
  const rows = [-2, -1, 0, 1, 2].map((offset) => ({ dataset: { repsOffset: String(offset) }, textContent: '' }));
  const attributes = {};
  const button = { closest: () => button, setPointerCapture() {}, classList: { add() {}, remove() {} }, querySelectorAll: () => rows, setAttribute: (key, value) => { attributes[key] = value; } };
  bindRepsControl({ addEventListener: (type, handler) => { listeners[type] = handler; } }, () => reps, (_, value) => { reps = value; values.push(value); });
  const send = (type, overrides = {}) => {
    const event = { target: button, pointerId: 1, isPrimary: true, button: 0, clientY: 100, deltaY: 0, deltaMode: 0, key: '', preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...overrides };
    listeners[type](event); return event;
  };
  return { send, rows, attributes, values, reps: () => reps };
}

test('vertical drag adjusts repetitions and suppresses the tap after dragging', () => {
  const control = setup();
  control.send('pointerdown');
  control.send('pointermove', { clientY: 60 });
  control.send('pointerup', { clientY: 60 });
  assert.equal(control.reps(), 12);
  assert.equal(control.rows[2].textContent, '12');
  assert.equal(control.attributes['aria-valuenow'], '12');
  assert.equal(control.send('click').stopped, true);
});

test('a tap leaves the value unchanged, while keyboard and wheel can adjust it', () => {
  const control = setup();
  control.send('pointerdown');
  control.send('pointermove', { clientY: 97 });
  control.send('pointerup', { clientY: 97 });
  assert.equal(control.reps(), 10);
  assert.equal(control.send('click').stopped, undefined);
  control.send('keydown', { key: 'ArrowUp' });
  control.send('wheel', { deltaY: 80 });
  assert.equal(control.reps(), 9);
  assert.equal(scrubReps(0, -100), 0);
  assert.equal(scrubReps(998, 100), 999);
});
