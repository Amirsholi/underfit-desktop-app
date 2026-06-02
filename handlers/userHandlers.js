function registerUserHandlers(ipcMain, userService) {
  ipcMain.handle('agregar-usuario', async (_evt, payload) => {
    return userService.createUser(payload);
  });

  ipcMain.handle('obtener-usuarios', async () => {
    return userService.listUsers();
  });

  ipcMain.handle('obtener-usuario', async (_evt, ci) => {
    return userService.getUserByCi(ci);
  });

  ipcMain.handle('obtener-pagos-membresia-usuario', async (_evt, ci) => {
    return userService.listMembershipPayments(ci);
  });

  ipcMain.handle('guardar-edicion-manual-usuario', async (_evt, ci, datos) => {
    return userService.saveAdminManualEdit(ci, datos);
  });

  ipcMain.handle('eliminar-usuario', async (_evt, ci) => {
    return userService.deleteUser(ci);
  });
}

module.exports = { registerUserHandlers };
