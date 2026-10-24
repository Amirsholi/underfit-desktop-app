// Open the isolated rehearsal and exercise Concurrencia in the actual Electron runtime.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const report = path.join(process.env.LOCALAPPDATA, 'UnderFitRehearsal/gym-copy/window-check.json');
app.on('browser-window-created', (_event, window) => {
  window.webContents.once('did-finish-load', async () => {
    if (!window.webContents.getURL().endsWith('/index.html')) return;
    try {
      const result = await window.webContents.executeJavaScript(`(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        await wait(1500);
        const products = await window.api.obtenerProductos();
        const inactive = products.filter(p => Number(p.activo) === 0).map(p => p.nombre);
        const shown = [...document.querySelectorAll('#home-products-list .home-product-name')].map(x => x.textContent);
        if (shown.some(name => inactive.includes(name))) throw Error('Inicio muestra productos inactivos');
        const started = performance.now();
        document.querySelector('[data-admin-section="records"]').click();
        await wait(500);
        const input = document.getElementById('records-date');
        input.value = '2026-09-29'; input.dispatchEvent(new Event('change'));
        const expected = (await window.api.obtenerIngresos('2026-09-29', '2026-09-29'))
          .filter(x => !x.claseId && !x.claseNombre && Number(x.localId || 1) === 1).length;
        for (let i = 0; i < 50 && document.querySelectorAll('#records-entry-body tr').length !== expected; i++) await wait(100);
        const rows = document.querySelectorAll('#records-entry-body tr').length;
        if (expected === 0 || rows !== expected || rows > 1000) throw Error('Filtro diario incorrecto: ' + rows);
        const modal = document.getElementById('modal-concurrencia');
        if (getComputedStyle(modal).display === 'none' || !modal.getClientRects().length) throw Error('Concurrencia no visible: ' + JSON.stringify({inline:modal.style.display,computed:getComputedStyle(modal).display,classes:modal.className,rows,shown:shown.length}));
        modal.querySelector('[data-close-modal]').click();
        if (getComputedStyle(modal).display !== 'none') throw Error('Concurrencia no cierra');
        const latest = await window.api.obtenerUltimosIngresos();
        const navigation = {};
        for (const section of ['users', 'cash', 'home']) {
          const start = performance.now();
          document.dispatchEvent(new CustomEvent('admin:navigate', { detail: { section } }));
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          navigation[section] = Math.round(performance.now() - start);
          const expectedView = section === 'cash' ? 'operations' : section;
          if (!document.querySelector('[data-admin-view="' + expectedView + '"].is-active')) throw Error('No abrió ' + section);
          await wait(500);
        }
        return { verified: true, historicalDate: input.value, dailyRows: rows, elapsedMs: Math.round(performance.now() - started),
          homeProducts: shown.length, inactiveHidden: inactive.length, opensAndCloses: true, lastEntryRows: latest.length, navigationMs: navigation };
      })()`);
      fs.writeFileSync(report, JSON.stringify(result, null, 2));
    } catch (error) { fs.writeFileSync(report, JSON.stringify({ verified: false, error: error.message })); }
  });
});
require('./gym-copy-desktop');
