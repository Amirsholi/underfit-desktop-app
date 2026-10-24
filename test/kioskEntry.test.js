const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('kiosk confirms without event delay and distinguishes denied/unknown/connection states', async () => {
  const elements = new Map();
  function get(id) {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', className: '', handlers: {}, focus() {},
      addEventListener(name, fn) { this.handlers[name] = fn; } });
    return elements.get(id);
  }
  let response = { allowed: true, daysRemaining: 20, user: { nombre: 'Socio de prueba' } };
  let calls = 0;
  const sounds = [];
  let timerId = 0;
  const timers = new Map();
  function runTimer(delay) {
    const match = [...timers].find(([, timer]) => timer.delay === delay);
    assert.ok(match, `Expected a ${delay}ms timer`);
    timers.delete(match[0]);
    match[1].fn();
  }
  const window = { addEventListener() {}, KioskAudio:{create:()=>({stop(){},configure(){},setMuted(){},play:kind=>sounds.push(kind)})}, UnderRunningEvent: { init: async () => ({ destroy() {} }) }, api: {
    onEnfocarInput() {}, onTeclaPadIngreso() {}, onEventoActualizado() {},
    async validarYRegistrarIngreso() { calls++; if (response instanceof Error) throw response; return response; },
  } };
  const document = { getElementById: get, addEventListener() {}, body: { classList: { add() {}, remove() {} } } };
  const html = fs.readFileSync(path.join(__dirname, '../user.html'), 'utf8');
  vm.runInNewContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1], { window, document,
    setTimeout(fn, delay) { timers.set(++timerId, {fn, delay}); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  await window.onload();
  async function enter() {
    get('ci-usuario').value = '12345678';
    get('btn-ingresar').handlers.click();
    await new Promise(resolve => setImmediate(resolve));
  }
  await enter();
  assert.equal(calls, 1);
  assert.deepEqual(sounds,['success']);
  assert.equal(get('feedback-panel').className, 'feedback-panel feedback-success is-visible');
  assert.equal(get('ci-usuario').value, '');
  assert.equal(get('feedback-title').textContent, 'Puede ingresar');
  assert.equal(get('feedback-text').textContent, '20 días restantes');
  runTimer(1600);
  assert.equal(get('feedback-panel').className, 'feedback-panel feedback-success');
  assert.equal(get('feedback-text').textContent, '20 días restantes', 'Text survives the fade');
  runTimer(400);
  assert.equal(get('feedback-title').textContent, '');
  response = { allowed: true, daysRemaining: 1, user: { nombre: 'Prueba' } };
  await enter();
  assert.equal(get('feedback-text').textContent, '1 día restante');
  runTimer(1600);
  response = { allowed: true, daysRemaining: 0, user: { nombre: 'Prueba' } };
  await enter();
  assert.equal(get('feedback-text').textContent, 'Vence hoy');
  assert.equal([...timers.values()].some(timer => timer.delay === 400), false, 'New feedback cancels old fade cleanup');
  response = { allowed: false, daysRemaining: -10 };
  await enter();
  assert.equal(get('feedback-title').textContent, 'Membresía vencida');
  assert.equal(sounds.at(-1),'expired');
  assert.doesNotMatch(get('feedback-text').textContent, /-10/);
  response = { reason: 'not_found' };
  await enter();
  assert.equal(get('feedback-title').textContent, 'No encontramos tu documento');
  response = new Error('offline');
  await enter();
  assert.match(get('feedback-text').textContent, /No se confirmó/);
  assert.equal(get('btn-ingresar').disabled, false);
  assert.equal(sounds.length,4, 'Unknown documents and connection errors do not play membership cues');
  get('ci-usuario').value = '987';
  get('ci-usuario').handlers.input();
  runTimer(400);
  assert.equal(get('ci-usuario').value, '987', 'Fade must not erase the next document');
  response = {allowed: true};
  await enter();
  assert.equal(get('feedback-title').textContent, 'Puede ingresar');
  assert.equal(get('feedback-text').textContent, '');
});
