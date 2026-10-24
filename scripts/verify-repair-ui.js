const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal', 'repair-ui-20261018');
app.setPath('userData', path.join(root, 'profile'));
app.whenReady().then(async () => {
  fs.mkdirSync(root, { recursive: true });
  const source = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('<head>', '<head><base href="file:///C:/GymApp/">');
  const html = path.join(root, 'view.html'); fs.writeFileSync(html, source);
  const win = new BrowserWindow({ width: 1366, height: 900, show: false });
  await win.loadFile(html);
  await win.webContents.executeJavaScript(fs.readFileSync('adminProducts.js', 'utf8') + '\n;void 0;');
  await win.webContents.executeJavaScript(`(async () => {
    const check = (ok, text) => { if (!ok) throw Error(text); };
    const wait = () => new Promise(resolve => setTimeout(resolve, 100));
    const products = [
      { id: 1, nombre: 'Agua 1 L', precio: 75, activo: true, availableLocal1: true, availableLocal2: true },
      { id: 2, nombre: 'Yogurt', precio: 130, activo: true, availableLocal1: true, availableLocal2: false },
    ];
    window.api = {
      obtenerProductos: async () => products.map(x => ({ ...x })),
      obtenerStockLocales: async () => products.map(x => ({ productoId: x.id, local1: +x.availableLocal1, local2: +x.availableLocal2, asignadoLocal2: +x.availableLocal2 })),
      obtenerVentasProductos: async () => [], obtenerTotalVentasProductos: async () => 0,
      obtenerResumenCajaDia: async () => ({}),
      actualizarProducto: async (id, payload) => Object.assign(products.find(x => x.id === id), payload),
    };
    const shared = { mostrarNotificacion: () => {}, confirmarAccion: async () => true };
    document.querySelectorAll('[data-admin-view]').forEach(x => { x.classList.toggle('active', x.dataset.adminView === 'products'); x.style.display = x.dataset.adminView === 'products' ? 'block' : 'none'; });
    await window.createAdminProductsController({ shared }).init();
    const sections = () => [...document.querySelectorAll('.product-location-table')];
    check(sections().length === 2, 'Deben existir dos tablas');
    const remove = [...sections()[1].querySelectorAll('button')].find(x => x.textContent === 'Quitar del local');
    remove.click(); await wait();
    check(products[0].availableLocal1 && !products[0].availableLocal2, 'Quitar solo afecta al local elegido');
    const select = sections()[1].querySelector('select'); select.value = '1'; select.dispatchEvent(new Event('change'));
    sections()[1].querySelector('.product-add-toggle').click();
    [...sections()[1].querySelectorAll('button')].find(x => x.textContent === 'Agregar').click(); await wait();
    check(products[0].availableLocal1 && products[0].availableLocal2, 'Se puede volver a agregar sin duplicar');
    await wait();
    check(document.querySelector('#class-coach').tagName === 'INPUT', 'Profesor de clase debe ser texto');
    check(document.querySelector('#workout-professor').tagName === 'INPUT', 'Profesor de rutina debe ser texto');
  })()`);
  fs.writeFileSync(path.join(root, 'products.png'), (await win.webContents.capturePage()).toPNG());
  win.setSize(1024, 768);
  await new Promise(resolve => setTimeout(resolve, 100));
  await win.webContents.executeJavaScript(`(() => {
    const toggle = document.querySelector('.product-add-toggle'); toggle.click();
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    if (panel.hidden || toggle.getAttribute('aria-expanded') !== 'true') throw Error('Agregar no abre el formulario');
    if (document.activeElement !== panel.querySelector('select')) throw Error('Debe enfocar el selector');
    const buttons = [...document.querySelectorAll('.product-row-actions button')];
    if (buttons.some(x => x.getBoundingClientRect().right > innerWidth)) throw Error('Acciones fuera de pantalla');
  })()`);
  await new Promise(resolve => setTimeout(resolve, 150));
  fs.writeFileSync(path.join(root, 'products-add-1024.png'), (await win.webContents.capturePage()).toPNG());
  await win.webContents.executeJavaScript(`(() => {
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    if (document.activeElement !== document.querySelector('.product-add-toggle')) throw Error('Escape debe devolver el foco');
  })()`);
  await new Promise(resolve => setTimeout(resolve, 150));
  fs.writeFileSync(path.join(root, 'products-1024.png'), (await win.webContents.capturePage()).toPNG());
  for (const file of ['tablet-app/model.js', 'tablet-app/routines-model.js', 'tablet-app/routines.js'])
    await win.webContents.executeJavaScript(fs.readFileSync(file, 'utf8') + '\n;void 0;');
  await win.webContents.executeJavaScript(`(() => {
    document.body.innerHTML = '<main id="test-main"></main>';
    window.TabletLive = { routineData: { templates: [], assignments: [] } };
    window.TabletExercises = { items: () => [] };
    window.TabletControls = { enhance: () => {} };
    window.TabletRoutines.render({ main: document.getElementById('test-main'), members: [{ id: '123', ci: '123', name: 'Socio prueba' }], esc: value => String(value ?? '') });
    if (document.querySelector('[data-routine-tab="members"]').getAttribute('aria-pressed') !== 'true') throw Error('Rutinas debe iniciar en socios');
    document.querySelector('[data-person="123"]').click();
    if (document.getElementById('routine-professor').tagName !== 'INPUT') throw Error('Rutina de tablet debe pedir nombre escrito');
  })()`);
  console.log('PASS: dos tablas, quitar/agregar por local y campos de profesor. Captura: ' + path.join(root, 'products.png'));
  win.destroy(); app.quit();
}).catch(error => { console.error(error); app.exit(1); });
