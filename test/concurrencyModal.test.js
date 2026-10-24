const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('Concurrencia opens over the current page, filters gym entries and restores focus', async () => {
  const listeners = new Map();
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      style: {}, value: '', textContent: '', children: [],
      addEventListener() {}, querySelector: selector => element(`${id}:${selector}`),
      closest: selector => element(`${id}:${selector}`),
      replaceChildren(...children) { this.children = children; },
      querySelectorAll: () => [], appendChild(child) { this.children.push(child); },
      focus() { document.activeElement = this; },
    });
    return elements.get(id);
  };
  const document = {
    activeElement: element('home-button'), body: { appendChild() {} },
    getElementById: element, createElement: () => ({ innerHTML: '' }),
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  const window = { api: { obtenerUsuarios: async () => [], obtenerIngresos: async () => [
    { id: 1, nombre: 'Adrián Prueba', ci: '1234', localId: 1, hora: '09:30' },
    { id: 2, nombre: 'Alumno clase', claseId: 12, localId: 2 },
  ] } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../adminRecords.js'), 'utf8'), { window, document, console, Date });
  const controller = window.createAdminRecordsController({ shared: {} });
  controller.init();
  listeners.get('admin-records:show')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(element('modal-concurrencia').style.display, 'flex');
  assert.equal(document.activeElement, element('records-search'));
  assert.equal(element('records-entry-count').textContent, '1');
  assert.equal(element('records-entry-status').textContent, '1 ingreso');
  assert.match(element('records-entry-body').children[0].innerHTML, /Adrián Prueba/);
  listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
  assert.equal(element('modal-concurrencia').style.display, 'none');
  assert.equal(document.activeElement, element('home-button'));
});

test('home shortcut uses the shared modal without a duplicate records page', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /data-admin-section="records"[^\n]*<span>Concurrencia<\/span>/);
  assert.match(html, /id="modal-concurrencia"[^>]*role="dialog"/);
  assert.doesNotMatch(html, /data-admin-view="records"/);
  assert.equal((html.match(/id="records-entry-body"/g) || []).length, 1);
});
