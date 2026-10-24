const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createUsbKeypad } = require('../services/usbKeypad');

test('paired USB routes to reception while normal numpad stays in administration', { skip: process.platform !== 'win32' }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'underfit-pad-test-'));
  t.after(()=>{assert.equal(path.dirname(root), path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'usb-keypad.json'),JSON.stringify({device:'usb-pad'}));
  const executablePath = path.join(root,'test-helper.exe');fs.writeFileSync(executablePath,'');
  const child = new EventEmitter();child.stdout=new PassThrough();child.kill=()=>child.stdout.end();
  const inputs=[],entry=[],listeners={};
  const main={webContents:{sendInputEvent:e=>inputs.push(e),on:(event,callback)=>{listeners[event]=callback;}}};
  const reader=createUsbKeypad({app:{isPackaged:false,getPath:()=>root},BrowserWindow:{getFocusedWindow:()=>main},
    dialog:{},getEntryWindow:()=>({webContents:{send:(...args)=>entry.push(args)}}),spawnImpl:()=>child,executablePath});
  reader.attach(main);reader.start();
  const emit = message=>child.stdout.write(JSON.stringify(message)+'\n');
  emit({ready:true});
  emit({device:'usb-pad',digit:'7',key:'7',down:true});
  emit({device:'keyboard',digit:'4',key:'4',down:true});
  assert.deepEqual(entry,[['tecla-pad-ingreso','7']]);
  assert.deepEqual(inputs.map(i=>[i.type,i.keyCode]),[['keyDown','4'],['char','4']]);
  let blocked=0;
  listeners['before-input-event']({preventDefault:()=>blocked++},{code:'Numpad4'});
  listeners['before-input-event']({preventDefault:()=>blocked++},{code:'Digit4'});
  assert.equal(blocked,1);
  child.emit('exit');
  listeners['before-input-event']({preventDefault:()=>blocked++},{code:'Numpad4'});
  assert.equal(blocked,1,'Fail open to normal keyboard if reader stops');
  reader.stop();
});
