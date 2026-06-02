function registerProductHandlers(ipcMain, productService) {
  ipcMain.handle('obtener-productos', async () => {
    return productService.listProducts();
  });

  ipcMain.handle('crear-producto', async (_evt, payload) => {
    return productService.createProduct(payload);
  });

  ipcMain.handle('actualizar-producto', async (_evt, { id, datos }) => {
    return productService.updateProduct(id, datos);
  });

  ipcMain.handle('eliminar-producto', async (_evt, id) => {
    return productService.deleteProduct(id);
  });

  ipcMain.handle('vender-producto', async (_evt, payload) => {
    return productService.sellOneProduct(payload);
  });

  ipcMain.handle('obtener-ventas-productos', async (_evt, fecha) => {
    return productService.listSalesByDate(fecha);
  });

  ipcMain.handle('obtener-total-ventas-productos', async (_evt, fecha) => {
    return productService.getSalesTotalByDate(fecha);
  });
}

module.exports = { registerProductHandlers };
