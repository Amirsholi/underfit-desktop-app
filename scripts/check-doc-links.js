// Check local Markdown targets without fetching external sites.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/).filter(file => file.endsWith('.md'));
const missing = [];
for (const file of files) {
  const body = fs.readFileSync(path.join(root, file), 'utf8');
  for (const match of body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (/^(?:[a-z]+:|#|\/\/)/i.test(target)) continue;
    const local = decodeURIComponent(target.split('#')[0]);
    if (local && !fs.existsSync(path.resolve(root, path.dirname(file), local))) missing.push(file + ': ' + target);
  }
}
if (missing.length) { console.error(missing.join('\n')); process.exitCode = 1; }
else console.log('Local Markdown links verified: ' + files.length + ' files.');
