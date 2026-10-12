function localDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function createApiProductService({ apiClient }) {
  return {
    listProducts: () => apiClient.listProducts(),
    createProduct: ({ nombre, precio, activo = true }) =>
      apiClient.createProduct({ nombre, precio: Number(precio), activo: activo !== false }),
    updateProduct: (id, { nombre, precio, activo = true }) =>
      apiClient.updateProduct(Number(id), { nombre, precio: Number(precio), activo: activo !== false }),
    deleteProduct: id => apiClient.deleteProduct(Number(id)),
    sellOneProduct: payload => apiClient.sellProduct(Number(payload?.id ?? payload), {
      id: Number(payload?.id ?? payload),
      quantity: Number(payload?.quantity ?? 1),
      payment: payload?.payment ? {
        monto: payload.payment.monto,
        formaPago: payload.payment.formaPago,
        montoRecibido: payload.payment.montoRecibido,
        observacion: payload.payment.observacion,
      } : null,
    }),
    listSalesByDate: fecha => apiClient.listProductSales(fecha || localDate()),
    getSalesTotalByDate: async fecha =>
      Number((await apiClient.getProductSalesTotal(fecha || localDate())).total || 0),
  };
}

module.exports = { createApiProductService };
