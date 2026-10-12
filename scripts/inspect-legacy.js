const fs = require('fs');
const path = require('path');
const { inspectLegacyDatabase } = require('./inspectLegacyDatabase');

async function main() {
  const source = process.argv[2];
  const output = process.argv[3];
  if (!source) {
    throw new Error('Uso: node scripts/inspect-legacy.js <base.db> [informe.json]');
  }
  const report = await inspectLegacyDatabase(source);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    const target = path.resolve(output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, json, 'utf8');
    console.log(`Informe creado: ${target}`);
  } else {
    process.stdout.write(json);
  }
  if (!report.canImport) process.exitCode = 2;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
