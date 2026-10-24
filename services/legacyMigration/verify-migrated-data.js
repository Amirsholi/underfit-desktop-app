const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');

async function verifyMigratedData(source, query) {
  const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  const read = sql => new Promise((resolve, reject) => db.all(sql, (e, rows) => e ? reject(e) : resolve(rows)));
  const checks = [
    ['socios', 'SELECT ci AS id, nombre AS name, substr(fecha_vencimiento,1,10) AS expires FROM usuarios ORDER BY ci',
      'SELECT "IdentityNumber" AS id,"Name" AS name,"MembershipExpiresOn"::text AS expires FROM members'],
    ['movimientos', 'SELECT id, monto AS amount FROM caja_movimientos',
      `SELECT m."SourceId" AS id,t."Amount" AS amount FROM cash_movements t JOIN legacy_import_map m ON m."SourceTable"='caja_movimientos' AND m."TargetKey"=t."Id"::text`],
    ['pagos', 'SELECT id,monto AS amount,substr(vencimiento_nuevo,1,10) AS expires FROM pagos_membresia',
      `SELECT m."SourceId" AS id,t."Amount" AS amount,t."NewExpiration"::text AS expires FROM membership_renewals t JOIN legacy_import_map m ON m."SourceTable"='pagos_membresia' AND m."TargetKey"=t."Id"::text`],
    ['ventas', 'SELECT id,total AS amount,cantidad AS quantity FROM ventas_productos',
      'SELECT "Id" AS id,"Total" AS amount,"Quantity" AS quantity FROM product_sales'],
    ['cajas', 'SELECT id,monto_inicial_efectivo AS opening,total_ingresos AS income,total_efectivo AS cash,total_transferencia AS transfer FROM caja_sesiones',
      `SELECT m."SourceId" AS id,t."OpeningCash" AS opening,t."TotalIncome" AS income,t."TotalCash" AS cash,t."TotalTransfer" AS transfer FROM cash_sessions t JOIN legacy_import_map m ON m."SourceTable"='caja_sesiones' AND m."TargetKey"=t."Id"::text`],
  ];
  const results = {};
  try {
    for (const [name, sqlite, postgres] of checks) {
      const expected = await read(sqlite);
      const actual = JSON.parse(query(`SELECT COALESCE(json_agg(t),'[]') FROM (${postgres}) t`));
      const byId = new Map(actual.map(row => [String(row.id), row]));
      assert.equal(actual.length, expected.length, `${name}: cantidad diferente`);
      let mismatches = 0;
      for (const row of expected) {
        const target = byId.get(String(row.id));
        if (!target || Object.keys(row).some(key => {
          if (['amount','quantity','opening','income','cash','transfer'].includes(key))
            return Math.round(Number(row[key] || 0) * 100) !== Math.round(Number(target[key] || 0) * 100);
          return String(row[key] ?? '') !== String(target[key] ?? '');
        })) mismatches++;
      }
      assert.equal(mismatches, 0, `${name}: ${mismatches} registros difieren (sin datos personales en el informe)`);
      results[name] = { recordsCompared: expected.length, mismatches };
    }
    return results;
  } finally { await new Promise(resolve => db.close(resolve)); }
}
module.exports = { verifyMigratedData };
