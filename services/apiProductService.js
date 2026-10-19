function localDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function createApiProductService({ apiClient }) {
  return {
    listProducts: () => apiClient.listProducts(),
    createProduct: ({ nombre, precio, activo = true, availableLocal1, availableLocal2 }) =>
      apiClient.createProduct({ nombre, precio: Number(precio), activo: activo !== false, ...(availableLocal1 === undefined ? {} : { availableLocal1 }), ...(availableLocal2 === undefined ? {} : { availableLocal2 }) }),
    updateProduct: (id, { nombre, precio, activo = true, availableLocal1, availableLocal2 }) =>
      apiClient.updateProduct(Number(id), { nombre, precio: Number(precio), activo: activo !== false, ...(availableLocal1 === undefined ? {} : { availableLocal1 }), ...(availableLocal2 === undefined ? {} : { availableLocal2 }) }),
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
