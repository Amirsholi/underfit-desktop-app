function registerEntryHandlers(ipcMain, entryService) {
  ipcMain.handle('obtener-ultimos-ingresos', async () => {
    if (entryService.listLatestEntries) return entryService.listLatestEntries();
    const rows = await entryService.listEntriesByDateRange({});
    const latest = new Map();
    for (const row of rows) {
      const old = latest.get(String(row.ci));
      if (!old || `${row.fecha} ${row.hora}` > `${old.fecha} ${old.hora}`) latest.set(String(row.ci), row);
    }
    return [...latest.values()];
  });
  ipcMain.handle('validar-y-registrar-ingreso', async (_evt, payload = {}) => {
    return entryService.validateAndRegisterEntry(payload);
  });

  ipcMain.handle('obtener-ingresos', async (_evt, { desde, hasta, socioCi }) => {
    const rows = await entryService.listEntriesByDateRange({ desde, hasta, socioCi });
    return socioCi ? rows.filter(row => String(row.ci) === String(socioCi)) : rows;
  });

  ipcMain.handle('anular-ingreso', async (_evt, payload) => {
    return entryService.annulEntry(payload || {});
  });
}

module.exports = { registerEntryHandlers };
