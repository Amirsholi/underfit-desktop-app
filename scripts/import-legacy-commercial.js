const { importLegacyCommercial } = require('./importLegacyMasters');
async function main(){
 const dbPath=process.argv[2],apply=process.argv.includes('--apply');
 if(!dbPath)throw new Error('Uso: node scripts/import-legacy-commercial.js <base.db> [--apply]');
 const result=await importLegacyCommercial(dbPath,{apply});
 console.log(JSON.stringify(result,null,2));
 if(!apply)console.log('Simulacion completa. Agregue --apply para escribir en PostgreSQL.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
