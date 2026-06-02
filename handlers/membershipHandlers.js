function registerMembershipHandlers(ipcMain, membershipService) {
  ipcMain.handle('renovar-membresia', async (_evt, payload) => {
    return membershipService.renewMembership(payload);
  });
}

module.exports = { registerMembershipHandlers };
