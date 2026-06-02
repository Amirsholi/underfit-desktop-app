const membershipRules = require('../membershipRules');
const { createDatabase } = require('../database/database');
const { createCashRepository } = require('../repositories/cashRepository');
const { createEntryRepository } = require('../repositories/entryRepository');
const { createProductRepository } = require('../repositories/productRepository');
const { createProductSaleRepository } = require('../repositories/productSaleRepository');
const { createMembershipPaymentRepository } = require('../repositories/membershipPaymentRepository');
const { createSettingsRepository } = require('../repositories/settingsRepository');
const { createUserRepository } = require('../repositories/userRepository');
const { createCashService } = require('./cashService');
const { createEntryService } = require('./entryService');
const { createMembershipService } = require('./membershipService');
const { createProductService } = require('./productService');
const { createSettingsService } = require('./settingsService');
const { createUserService } = require('./userService');

function createServices() {
  const db = createDatabase();
  const userRepository = createUserRepository(db);
  const entryRepository = createEntryRepository(db);
  const productRepository = createProductRepository(db);
  const productSaleRepository = createProductSaleRepository(db);
  const membershipPaymentRepository = createMembershipPaymentRepository(db);
  const cashRepository = createCashRepository(db);
  const settingsRepository = createSettingsRepository(db);
  const cashService = createCashService({ cashRepository });
  const settingsService = createSettingsService({ settingsRepository });

  return {
    userService: createUserService({ db, userRepository, membershipPaymentRepository, membershipRules, cashService, settingsService }),
    membershipService: createMembershipService({ userRepository, membershipPaymentRepository, membershipRules, cashService, settingsService }),
    entryService: createEntryService({ userRepository, entryRepository, membershipRules }),
    productService: createProductService({ db, productRepository, productSaleRepository, cashService }),
    cashService,
    settingsService,
  };
}

module.exports = { createServices };
