const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const version = require('../package.json').version;
const file = `dist/Under-Fit-Setup-${version}.exe`;
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync('dist/build-provenance.json', JSON.stringify({ version, sha256,
  commit: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])),
  builtAtUtc: new Date().toISOString() }, null, 2));
