const { ipcMain } = require('electron');
const { createServices } = require('./services/createServices');
const { getDbPathFromConfigOrDefault } = require('./config');
const { registerCashHandlers } = require('./handlers/cashHandlers');
const { registerEntryHandlers } = require('./handlers/entryHandlers');
const { registerMembershipHandlers } = require('./handlers/membershipHandlers');
const { registerOperationsHandlers } = require('./handlers/operationsHandlers');
const { registerProductHandlers } = require('./handlers/productHandlers');
const { registerSystemHandlers } = require('./handlers/systemHandlers');
const { registerUserHandlers } = require('./handlers/userHandlers');
const { createClosureExportService } = require('./services/closureExportService');

const { userService, membershipService, entryService, productService, cashService, operationsService } = createServices();
const closureExportService = createClosureExportService({
  cashService,
  getDbPath: getDbPathFromConfigOrDefault,
});
registerUserHandlers(ipcMain, userService);
registerMembershipHandlers(ipcMain, membershipService);
registerEntryHandlers(ipcMain, entryService);
registerProductHandlers(ipcMain, productService);
registerOperationsHandlers(ipcMain, operationsService);
registerCashHandlers(ipcMain, cashService, closureExportService);
registerSystemHandlers(ipcMain);
