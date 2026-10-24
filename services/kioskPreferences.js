const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {pathToFileURL} = require('node:url');

// Device-only settings: never written to the shared business database.
function createKioskPreferences(directory) {
  const file = path.join(directory, 'kiosk-audio.json');
  const audioDirectory = path.join(directory, 'entry-sounds');
  const kinds = ['success', 'expired'];
  const defaults = () => ({version: 2, muted: true, sounds: {success: null, expired: null}});
  let queue = Promise.resolve();
  const serialized = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  async function read() {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      // Previous versions supplied built-in tones. Migrate those to silence.
      return data?.version === 2 ? {...defaults(), ...data} : defaults();
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return defaults();
      throw error;
    }
  }
  function managedPath(sound) {
    return sound && /^[a-f0-9-]{36}\.(mp3|wav|ogg|m4a)$/i.test(sound.file || '')
      ? path.join(audioDirectory, sound.file) : null;
  }
  async function present(data) {
    const result = {muted: data.muted !== false, sounds: {success: null, expired: null}};
    for (const kind of kinds) {
      const sound = data.sounds?.[kind];
      const location = managedPath(sound);
      if (location) {
        try {
          await fs.access(location);
          result.sounds[kind] = {name: sound.name, url: pathToFileURL(location).href};
        } catch (_) { /* A missing recording stays silent. */ }
      }
    }
    return result;
  }
  async function write(data) {
    await fs.mkdir(directory, {recursive: true});
    const temporary = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(data), 'utf8');
      await fs.rename(temporary, file);
    } finally { await fs.unlink(temporary).catch(() => {}); }
    return present(data);
  }
  async function get() { await queue; return present(await read()); }
  function save(muted) {
    return serialized(async () => {
      if (typeof muted !== 'boolean') throw new Error('La opción de silencio debe ser un booleano');
      return write({...await read(), muted});
    });
  }
  function importSound(kind, source) {
    return serialized(async () => {
      if (!kinds.includes(kind)) throw new Error('Tipo de sonido no válido');
      const extension = path.extname(source).toLowerCase();
      const stat = await fs.stat(source);
      if (!['.mp3', '.wav', '.ogg', '.m4a'].includes(extension) || !stat.isFile())
        throw new Error('Elegí un audio MP3, WAV, OGG o M4A.');
      if (stat.size > 10 * 1024 * 1024 || stat.size < 12)
        throw new Error('El audio debe pesar menos de 10 MB y no estar vacío.');
      const contents = await fs.readFile(source);
      const signature = contents.toString('ascii', 0, 12);
      const valid = extension === '.wav' ? signature.startsWith('RIFF') && signature.endsWith('WAVE')
        : extension === '.ogg' ? signature.startsWith('OggS')
        : extension === '.m4a' ? signature.slice(4, 8) === 'ftyp'
        : signature.startsWith('ID3') || (contents[0] === 0xff && (contents[1] & 0xe0) === 0xe0);
      if (!valid) throw new Error('El archivo no parece un audio válido. Probá con otro.');
      const data = await read();
      const previous = managedPath(data.sounds?.[kind]);
      const sound = {file: `${randomUUID()}${extension}`, name: path.basename(source)};
      await fs.mkdir(audioDirectory, {recursive: true});
      const destination = managedPath(sound);
      await fs.writeFile(destination, contents);
      let result;
      try { result = await write({...data, sounds: {...data.sounds, [kind]: sound}}); }
      catch (error) { await fs.unlink(destination).catch(() => {}); throw error; }
      if (previous) await fs.unlink(previous).catch(() => {});
      return result;
    });
  }
  return {get, save, importSound};
}
module.exports = {createKioskPreferences};
