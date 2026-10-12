const { importLegacyClasses } = require('./importLegacyMasters');

async function main() {
  const dbPath=process.argv[2];
  const apply=process.argv.includes('--apply');
  if(!dbPath)throw new Error('Uso: node scripts/import-legacy-classes.js <base.db> [--apply]');
  const result=await importLegacyClasses(dbPath,{apply});
  console.log(JSON.stringify(result,null,2));
  if(!apply)console.log('Simulacion completa. Agregue --apply para escribir en PostgreSQL.');
  if(result.requiresProfessorPinReset)console.log('Los profesores importados deben configurar un PIN nuevo.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
