import test from 'node:test';
import assert from 'node:assert/strict';
import { bindWeightControl, scrubWeight } from '../src/weight-control.js';

function setup() {
  const frames = new Map(); let frameId = 0;
  globalThis.requestAnimationFrame = (fn) => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const listeners = {}, writes = [];
  let weight = 25;
  const number = { textContent: '' }, attributes = {};
  const previous = { textContent: '' }, next = { textContent: '' };
  const rows = [{}, previous, number, next, {}].map((row, index) => Object.assign(row, { dataset: { weightOffset: String(index - 2) }, style: {} }));
  const button = { isConnected: true, closest: () => button, setPointerCapture() {}, classList: { add() {}, remove() {} }, querySelectorAll: () => rows, querySelector: (selector) => selector === '[data-weight-previous]' ? previous : selector === '[data-weight-next]' ? next : number, setAttribute: (name, value) => { attributes[name] = value; } };
  bindWeightControl({ addEventListener: (name, fn) => { listeners[name] = fn; } }, () => weight, (_, value) => { weight = value; writes.push(value); });
  const send = (name, extra = {}) => {
    const event = { target: button, pointerId: 1, isPrimary: true, button: 0, clientY: 100, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    listeners[name](event); return event;
  };
  return { send, writes, attributes, number, previous, next, rows, frames, weight: () => weight };
}
test('dragging upward changes weight in 2.5 lb steps without opening manual entry', () => {
  const t = setup();
  t.send('pointerdown'); t.send('pointermove', { clientY: 59 }); t.send('pointerup', { clientY: 59 });
  assert.equal(t.weight(), 30); assert.equal(t.number.textContent, '30');
  assert.equal(t.previous.textContent, '27,5'); assert.equal(t.next.textContent, '32,5');
  assert.equal(t.attributes['aria-valuenow'], '30');
  assert.equal(t.send('click').stopped, true);
});
test('one tap opens normally; small finger movement does not change the weight', () => {
  const t = setup();
  t.send('pointerdown'); t.send('pointermove', { clientY: 97 }); t.send('pointerup');
  assert.equal(t.weight(), 25); assert.equal(t.send('click').stopped, undefined);
});
test('wheel and keyboard adjust weight while keeping the page still; zoom is untouched', () => {
  const t = setup();
  assert.equal(t.send('wheel', { deltaY: -40, deltaMode: 0 }).prevented, true);
  assert.equal(t.weight(), 27.5);
  t.send('keydown', { key: 'ArrowDown' }); assert.equal(t.weight(), 25);
  assert.equal(t.send('wheel', { deltaY: -40, deltaMode: 0, ctrlKey: true }).prevented, undefined);
  assert.equal(t.weight(), 25);
});
test('a cancelled drag preserves its latest persisted value and never creates negative weights', () => {
  const t = setup();
  t.send('pointerdown'); t.send('pointermove', { clientY: 800 }); t.send('pointercancel');
  assert.equal(t.weight(), 0); assert.deepEqual(t.writes, [0]);
  assert.equal(t.previous.textContent, ''); assert.equal(t.next.textContent, '2,5');
  t.send('pointermove', { clientY: 0 }); assert.equal(t.weight(), 0);
  assert.equal(scrubWeight(26.25, 20), 28.75);
});

test('sub-step movement displaces the visible numbers and releasing animates into the center', () => {
  const t = setup();
  t.send('pointerdown'); t.send('pointermove', { clientY: 92 });
  assert.equal(t.weight(), 25);
  assert.match(t.number.style.transform, /translateY\(-6.4px\)/);
  t.send('pointerup'); assert.equal(t.frames.size, 1);
  const callback = [...t.frames.values()][0]; callback(performance.now() + 200);
  assert.match(t.number.style.transform, /translateY\(0px\)/);
});

test('a new wheel event continues from the displayed position during animation', () => {
  const t = setup();
  t.send('wheel', { deltaY: -40, deltaMode: 0 });
  const before = t.number.style.transform;
  t.send('wheel', { deltaY: -40, deltaMode: 0 });
  assert.equal(t.number.style.transform, before);
  assert.equal(t.weight(), 30);
  assert.equal(t.frames.size, 1);
});
