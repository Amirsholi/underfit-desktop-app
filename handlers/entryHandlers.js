function registerEntryHandlers(ipcMain, entryService) {
  ipcMain.handle('validar-y-registrar-ingreso', async (_evt, { ci, fuente = 'kiosk', observacion = null }) => {
    return entryService.validateAndRegisterEntry({ ci, fuente, observacion });
  });

  ipcMain.handle('obtener-ingresos', async (_evt, { desde, hasta }) => {
    return entryService.listEntriesByDateRange({ desde, hasta });
  });

  ipcMain.handle('anular-ingreso', async (_evt, payload) => {
    return entryService.annulEntry(payload || {});
  });
}

module.exports = { registerEntryHandlers };
