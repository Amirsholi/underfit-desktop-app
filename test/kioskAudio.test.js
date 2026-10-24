const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const {create} = require('../kioskAudio');
const {createKioskPreferences} = require('../services/kioskPreferences');
const vm = require('node:vm');

const configured = {muted: false, sounds: {success: {url:'file:///success.wav'}, expired: {url:'file:///expired.wav'}}};
test('starts silent with no built-in audio, plays selected files without overlap', async () => {
  const clips = [];
  const audio = create({createAudio:url => {
    const clip = {url, play:async()=>{}, pause(){this.stopped=true;}, removeAttribute(){}, load(){}};
    clips.push(clip); return clip;
  }});
  assert.equal(await audio.play('success'), false);
  audio.setMuted(false);
  assert.equal(await audio.play('success'), false);
  audio.configure(configured);
  assert.equal(await audio.play('success'), true);
  assert.equal(await audio.play('expired'), true);
  assert.equal(clips[0].stopped, true);
  assert.deepEqual(clips.map(clip=>clip.url), ['file:///success.wav','file:///expired.wav']);
  audio.setMuted(true);
  assert.equal(clips[1].stopped, true);
  assert.equal(await audio.play('success'), false);
  audio.configure({muted:false,sounds:{}});
  assert.equal(await audio.play('expired'), false);
  audio.dispose();
});

test('mute cancels pending playback; unsupported/missing recordings do not reject', async () => {
  let finish;
  const clip = {play:()=>new Promise(resolve=>{finish=resolve;}), pause(){},removeAttribute(){},load(){}};
  const audio = create({createAudio:()=>clip});
  audio.configure(configured);
  const pending = audio.play('success');
  audio.setMuted(true);
  finish();
  assert.equal(await pending, false);
  const broken = create({createAudio:()=>({...clip,play:async()=>{throw Error('Invalid media');}})});
  broken.configure(configured);
  assert.equal(await broken.play('expired'), false);
  assert.equal(await broken.play('unknown'), false);
  broken.dispose();
  audio.dispose();
});

test('silence is default, legacy test tones migrate, copies and both settings survive restart', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'underfit-audio-'));
  try {
    const prefs = createKioskPreferences(directory);
    const empty = {muted:true,sounds:{success:null,expired:null}};
    assert.deepEqual(await prefs.get(),empty);
    await fs.writeFile(path.join(directory,'kiosk-audio.json'),JSON.stringify({muted:false}));
    assert.deepEqual(await prefs.get(),empty);
    const source = path.join(directory,'owner sound.wav');
    const wav = Buffer.alloc(46);
    wav.write('RIFF'); wav.writeUInt32LE(38,4); wav.write('WAVEfmt ',8);
    wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
    wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32);
    wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(2,40);
    await fs.writeFile(source,wav);
    const imported = await prefs.importSound('success',source);
    assert.equal(imported.muted,true, 'Import must not unmute');
    assert.equal(imported.sounds.success.name,'owner sound.wav');
    assert.notEqual(fileURLToPath(imported.sounds.success.url),source);
    await Promise.all([prefs.importSound('expired',source),prefs.save(false)]);
    await fs.unlink(source);
    const reopened = await createKioskPreferences(directory).get();
    assert.equal(reopened.muted,false);
    assert.ok(reopened.sounds.success && reopened.sounds.expired);
    assert.deepEqual(await fs.readFile(fileURLToPath(reopened.sounds.success.url)),wav);
    await fs.writeFile(source,wav);
    const replacement = await prefs.importSound('success',source);
    assert.notEqual(replacement.sounds.success.url,reopened.sounds.success.url);
    await assert.rejects(fs.access(fileURLToPath(reopened.sounds.success.url)));
    await fs.writeFile(source,'not actually an audio file');
    await assert.rejects(prefs.importSound('success',source), /audio válido/);
    assert.deepEqual(await prefs.get(),replacement, 'Failed import keeps prior selection');
    await assert.rejects(prefs.importSound('other',source));
    await assert.rejects(prefs.save('true'));
    await fs.unlink(fileURLToPath(replacement.sounds.success.url));
    assert.equal((await prefs.get()).sounds.success,null);
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});

test('native picker cancellation does not import or broadcast; selected recording reaches all windows', async () => {
  const handlers = new Map();
  const sent = [];
  let imported;
  let selection = {canceled:true,filePaths:[]};
  const preferences = {muted:true,sounds:{success:{name:'owner.wav',url:'file:///owner.wav'},expired:null}};
  const source = await fs.readFile(path.join(__dirname,'../handlers/systemHandlers.js'),'utf8');
  const module = {exports:{}};
  const senderWindow = {isDestroyed:()=>false,webContents:{send:(...args)=>sent.push(args)}};
  const electron = {app:{getPath:()=>'/fixture'},BrowserWindow:{fromWebContents:()=>senderWindow,getAllWindows:()=>[senderWindow]},
    dialog:{showOpenDialog:async()=>selection}};
  vm.runInNewContext(source,{module,require:name=> {
    if(name === 'electron') return electron;
    if(name.includes('kioskPreferences')) return {createKioskPreferences:()=>({importSound:async(kind,file)=>{imported={kind,file};return preferences;}})};
    return {};
  }});
  module.exports.registerSystemHandlers({handle:(name,handler)=>handlers.set(name,handler)},{});
  const picker = handlers.get('cargar-sonido-ingreso');
  assert.equal(await picker({sender:{}},'success'),null);
  assert.equal(imported,undefined);
  assert.equal(sent.length,0);
  selection = {canceled:false,filePaths:['C:/fixture/owner.wav']};
  assert.equal(await picker({sender:{}},'success'),preferences);
  assert.deepEqual(imported,{kind:'success',file:'C:/fixture/owner.wav'});
  assert.equal(sent[0][0],'sonidos-ingreso-actualizados');
  await assert.rejects(picker({sender:{}},'invalid'));
});
