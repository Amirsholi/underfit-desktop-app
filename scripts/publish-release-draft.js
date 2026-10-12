// Explicit command only. Uploads an audited draft; --publish releases it after all uploads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { auditPackage } = require('./audit-package');

async function main() {
  const notesPath = process.argv[2];
  if (!notesPath) throw new Error('Uso: node scripts/publish-release-draft.js <notas-de-version.md>');
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    try {
      const credential = execFileSync('git', ['credential', 'fill'], {
        input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
        timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'],
      });
      token = credential.split('\n').find(line => line.startsWith('password='))?.slice(9).trim();
    } catch { /* No credential available; the message below explains how to authenticate. */ }
  }
  if (!token) throw new Error('Falta GH_TOKEN en esta PC de desarrollo. Nunca se configura en el gimnasio.');
  const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
  if (git(['status', '--porcelain'])) throw new Error('Guardá los cambios en un commit antes de preparar la versión.');
  const commit = git(['rev-parse', 'HEAD']);
  const pkg = require('../package.json');
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Se requiere una versión estable x.y.z.');
  const audit = auditPackage(path.resolve('dist/win-unpacked'));
  if (audit.version !== pkg.version) throw new Error('El instalador no corresponde a la versión actual.');
  const manifest = yaml.load(fs.readFileSync('dist/latest.yml', 'utf8'));
  if (manifest.version !== pkg.version) throw new Error('latest.yml pertenece a otra versión.');
  const name = `Under-Fit-Setup-${pkg.version}.exe`;
  const entry = manifest.files?.find(file => file.url === name);
  if (!entry) throw new Error('El instalador no figura en latest.yml.');
  const installer = fs.readFileSync(path.join('dist', name));
  const provenance = JSON.parse(fs.readFileSync('dist/build-provenance.json', 'utf8'));
  if (provenance.dirty || provenance.commit !== commit || provenance.version !== pkg.version ||
      provenance.sha256 !== crypto.createHash('sha256').update(installer).digest('hex')) {
    throw new Error('Reconstruí desde el commit limpio actual: el instalador no acredita ese código.');
  }
  if (crypto.createHash('sha512').update(installer).digest('base64') !== entry.sha512)
    throw new Error('El instalador no coincide con su firma de integridad.');
  const assets = [name, `${name}.blockmap`, 'latest.yml'].map(name => ({ name, data: fs.readFileSync(path.join('dist', name)) }));
  const headers = { Authorization: `Bearer ${token}`, 'User-Agent': 'UnderFit-release', Accept: 'application/vnd.github+json' };
  const endpoint = 'https://api.github.com/repos/Amirsholi/underfit-desktop-app/releases';
  const existing = await fetch(`${endpoint}/tags/v${pkg.version}`, { headers });
  if (existing.status !== 404) throw new Error('La versión ya existe o no se pudo verificar. No se sobrescribe.');
  const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag_name: `v${pkg.version}`, target_commitish: commit, name: `Under-Fit ${pkg.version}`,
      draft: true, prerelease: false, body: fs.readFileSync(notesPath, 'utf8') }) });
  if (!response.ok) throw new Error(`No se pudo crear el borrador: HTTP ${response.status}`);
  const release = await response.json();
  for (const asset of assets) {
    const upload = await fetch(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(asset.name)}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: asset.data,
    });
    if (!upload.ok) throw new Error(`Falló ${asset.name}; el borrador queda sin publicar: HTTP ${upload.status}`);
  }
  if (process.argv.includes('--publish')) {
    const published = await fetch(`${endpoint}/${release.id}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: false, make_latest: 'true' }),
    });
    if (!published.ok) throw new Error(`No se pudo publicar: HTTP ${published.status}. El borrador conserva los archivos.`);
    console.log(`Versión publicada: ${(await published.json()).html_url}`);
  } else console.log(`Borrador listo: ${release.html_url}\nEl gym no lo recibirá hasta que decidas publicarlo.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
