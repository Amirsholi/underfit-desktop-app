const { ipcMain } = require('electron');
const { createServices } = require('./services/createServices');
const { getDbPathFromConfigOrDefault } = require('./config');
const { registerCashHandlers } = require('./handlers/cashHandlers');
const { registerEntryHandlers } = require('./handlers/entryHandlers');
const { registerMembershipHandlers } = require('./handlers/membershipHandlers');
const { registerProductHandlers } = require('./handlers/productHandlers');
const { registerSystemHandlers } = require('./handlers/systemHandlers');
const { registerUserHandlers } = require('./handlers/userHandlers');
const { createClosureExportService } = require('./services/closureExportService');

const { userService, membershipService, entryService, productService, cashService } = createServices();
const closureExportService = createClosureExportService({
  cashService,
  getDbPath: getDbPathFromConfigOrDefault,
});
registerUserHandlers(ipcMain, userService);
registerMembershipHandlers(ipcMain, membershipService);
registerEntryHandlers(ipcMain, entryService);
registerProductHandlers(ipcMain, productService);
registerCashHandlers(ipcMain, cashService, closureExportService);
registerSystemHandlers(ipcMain);
