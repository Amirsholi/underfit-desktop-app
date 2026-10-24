const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

function createUsbKeypad({ app, BrowserWindow, dialog, getEntryWindow, spawnImpl = spawn, executablePath }) {
  const file = path.join(app.getPath('userData'), 'usb-keypad.json');
  let selected = null, ready = false, child = null, learning = null;
  try { selected = JSON.parse(fs.readFileSync(file, 'utf8')).device; } catch { /* not paired */ }
  const active = () => ready && Boolean(selected || learning);
  function receive(message) {
    if (message.ready) { ready = true; return; }
    if (!active() || !message.device || !message.key) return;
    if (learning) {
      if (message.down) {
        selected = message.device;
        fs.writeFileSync(file, JSON.stringify({ device: selected }));
        learning(true);
      }
      return;
    }
    const target = BrowserWindow.getFocusedWindow();
    if (!target) return;
    if (message.device === selected) {
      if (message.down) getEntryWindow()?.webContents.send('tecla-pad-ingreso', message.digit);
      return;
    }
    // Normal keyboard replay uses non-numpad key codes; the native keypad event
    // is suppressed separately, so this cannot loop or redirect to reception.
    target.webContents.sendInputEvent({ type: message.down ? 'keyDown' : 'keyUp', keyCode: message.key,
      modifiers: ['control', 'shift', 'alt'].filter(key => message[key]) });
    if (message.down && message.key.length === 1 && !message.control && !message.alt)
      target.webContents.sendInputEvent({ type: 'char', keyCode: message.key });
  }
  function attach(window) {
    window.webContents.on('before-input-event', (event, input) => {
      if (active() && /^Numpad(?:[0-9]|Enter|Decimal)$/.test(input.code)) event.preventDefault();
    });
  }
  function start() {
    if (process.platform !== 'win32') return;
    const executable = executablePath || (app.isPackaged ? path.join(process.resourcesPath, 'keypad', 'UnderFit.Keypad.exe')
      : path.join(__dirname, '..', 'release', 'keypad', 'UnderFit.Keypad.exe'));
    if (!fs.existsSync(executable)) return;
    child = spawnImpl(executable, [String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    readline.createInterface({ input: child.stdout }).on('line', line => {
      try { receive(JSON.parse(line)); } catch (error) { console.error('No se pudo procesar el pad USB:', error.message); }
    });
    child.on('error', () => { ready = false; });
    child.on('exit', () => { ready = false; learning?.(false); });
  }
  async function pair() {
    if (!ready) { dialog.showErrorBox('Pad USB', 'El lector USB no está disponible. Reiniciá Under-Fit.'); return; }
    const result = await dialog.showMessageBox({ type: 'info', title: 'Vincular pad USB',
      message: 'Al cerrar este mensaje, presioná un número en el pad USB de ingreso.',
      detail: 'Tenés 30 segundos. No uses el teclado de Administración durante la vinculación.', buttons: ['Comenzar', 'Cancelar'], cancelId: 1 });
    if (result.response !== 0) return;
    const window = BrowserWindow.getAllWindows().find(w => w !== getEntryWindow());
    window?.show(); window?.focus();
    const paired = await new Promise(resolve => {
      const timer = setTimeout(() => { learning = null; resolve(false); }, 30000);
      learning = value => { clearTimeout(timer); learning = null; resolve(value); };
    });
    await dialog.showMessageBox({ type: paired ? 'info' : 'warning', title: 'Pad USB',
      message: paired ? 'Pad vinculado. El teclado de Administración queda independiente.' : 'No se detectó el pad. Volvé a intentar.' });
  }
  function stop() { ready = false; child?.kill(); }
  return { start, attach, pair, stop };
}
module.exports = { createUsbKeypad };
