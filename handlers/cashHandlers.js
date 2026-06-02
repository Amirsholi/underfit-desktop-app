function registerCashHandlers(ipcMain, cashService, closureExportService = null) {
  ipcMain.handle('abrir-caja-dia', async (_evt, payload) => {
    return cashService.openDay(payload || {});
  });

  ipcMain.handle('obtener-apertura-caja-dia', async (_evt, fecha) => {
    return cashService.getOpeningByDate(fecha);
  });

  ipcMain.handle('obtener-movimientos-caja', async (_evt, fecha) => {
    return cashService.listMovementsByDate(fecha);
  });

  ipcMain.handle('obtener-resumen-caja-dia', async (_evt, fecha) => {
    return cashService.getDailySummary(fecha);
  });

  ipcMain.handle('obtener-reporte-caja-dia', async (_evt, fecha) => {
    return cashService.getDailyReport(fecha);
  });

  ipcMain.handle('registrar-ingreso-manual-caja', async (_evt, payload) => {
    return cashService.registerManualIncome(payload || {});
  });

  ipcMain.handle('cerrar-caja-dia', async (_evt, { fecha, efectivoContado = null, observacion = null, cajeroCierre = null }) => {
    const cierre = await cashService.closeDay({ fecha, efectivoContado, observacion, cajeroCierre });

    if (!closureExportService) {
      return { cierre, exportacion: null };
    }

    try {
      const exportacion = await closureExportService.exportDailyClosurePdf(fecha);
      return { cierre, exportacion };
    } catch (error) {
      return {
        cierre,
        exportacion: {
          created: false,
          error: error?.message || 'No se pudo generar el PDF del cierre',
        },
      };
    }
  });

  ipcMain.handle('obtener-cierre-caja-dia', async (_evt, fecha) => {
    return cashService.getClosureByDate(fecha);
  });

  ipcMain.handle('ajustar-total-caja-dia', async (_evt, { fecha, nuevoTotal, observacion = null }) => {
    return cashService.adjustDailyTotal(fecha, nuevoTotal, observacion);
  });

  ipcMain.handle('registrar-salida-caja', async (_evt, { fecha, monto, observacion = null }) => {
    return cashService.registerCashOutput({ fecha, monto, observacion });
  });
}

module.exports = { registerCashHandlers };
