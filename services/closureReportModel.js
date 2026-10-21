// All report amounts come from posted cash movements, never current catalog prices.
const cents = value => Math.round(Number(value || 0) * 100);
const typeOf = value => ({ registration: 'alta', productsale: 'venta_producto', membershiprenewal: 'renovacion' }[value] || value);
function summarizeMovements(movements = []) {
  const groups = new Map();
  const adjustments = [];
  const net = { efectivo: 0, transferencia: 0, otros: 0 };
  const receipts = { efectivo: 0, transferencia: 0, otros: 0 };
  for (const m of movements) {
    const amount = cents(m.monto);
    const method = ['efectivo', 'transferencia'].includes(m.forma_pago) ? m.forma_pago : 'otros';
    const type = typeOf(m.tipo_ingreso);
    net[method] += amount;
    if (amount <= 0 || ['egreso', 'anulacion', 'ajuste_manual'].includes(type)) {
      const label = { egreso: 'Salida', anulacion: 'Anulación', ajuste_manual: 'Ajuste' }[type] || 'Devolución';
      adjustments.push({ label, detail: m.motivo_correccion || m.observacion || m.descripcion || label, method, amount });
      continue;
    }
    const labels = { alta: 'Inscripciones', renovacion: 'Renovaciones', ingreso_manual: 'Ingresos manuales' };
    let label = type === 'venta_producto' ? (m.producto_nombre || m.descripcion || 'Producto sin nombre') : labels[type] || 'Otros ingresos';
    // Older pending collections carried this technical suffix in the description.
    label = label.replace(/\s*·\s*venta pendiente Local \d+$/i, '');
    const key = type === 'venta_producto' ? `product:${m.producto_id ?? label}` : `${type}:${label}`;
    const group = groups.get(key) || { label, quantity: 0, knownQuantity: true, efectivo: 0, transferencia: 0, otros: 0 };
    const quantity = ['alta', 'renovacion'].includes(type) ? 1 : type === 'venta_producto' && Number(m.cantidad) > 0 ? Number(m.cantidad) : null;
    if (quantity === null) group.knownQuantity = false;
    else group.quantity += quantity;
    group[method] += amount;
    receipts[method] += amount;
    groups.set(key, group);
  }
  const sum = value => value.efectivo + value.transferencia + value.otros;
  return { groups: [...groups.values()], adjustments, net, receipts, totalReceipts: sum(receipts), totalNet: sum(net), hasOther: net.otros !== 0 || receipts.otros !== 0 || adjustments.some(a => a.method === 'otros') };
}
module.exports = { summarizeMovements, cents };
