const membershipRules = require('../membershipRules');
const { createDatabase } = require('../database/database');
const { createCashRepository } = require('../repositories/cashRepository');
const { createEntryRepository } = require('../repositories/entryRepository');
const { createProductRepository } = require('../repositories/productRepository');
const { createProductSaleRepository } = require('../repositories/productSaleRepository');
const { createMembershipPaymentRepository } = require('../repositories/membershipPaymentRepository');
const { createOperationsRepository } = require('../repositories/operationsRepository');
const { createStaffRepository } = require('../repositories/staffRepository');
const { createTrainingRepository } = require('../repositories/trainingRepository');
const { createSettingsRepository } = require('../repositories/settingsRepository');
const { createUserRepository } = require('../repositories/userRepository');
const { createCashService } = require('./cashService');
const { createEntryService } = require('./entryService');
const { createMembershipService } = require('./membershipService');
const { createOperationsService } = require('./operationsService');
const { createProductService } = require('./productService');
const { createSettingsService } = require('./settingsService');
const { createStaffService } = require('./staffService');
const { createLocalTrainingService } = require('./localTrainingService');
const { createUserService } = require('./userService');
const { createApiUserService } = require('./apiUserService');
const { createApiMembershipService } = require('./apiMembershipService');
const { createApiCashService } = require('./apiCashService');
const { createApiSettingsService } = require('./apiSettingsService');
const { createApiEntryService } = require('./apiEntryService');
const { createApiStaffService } = require('./apiStaffService');
const { createApiClassOperationsService } = require('./apiClassOperationsService');
const { createApiProductService } = require('./apiProductService');
const { createApiTrainingService } = require('./apiTrainingService');
const { resolveDataSourceMode } = require('./dataSourceMode');
const { createUnderFitApiClient } = require('../clients/underFitApiClient');

function createServices({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const dataSource = resolveDataSourceMode(env);
  if (dataSource.mode === 'api') {
    const apiClient = createUnderFitApiClient({
      baseUrl: dataSource.apiBaseUrl,
      deviceKey: dataSource.deviceKey,
      fetchImpl,
    });
    const cashService = createApiCashService({ apiClient });
    const settingsService = createApiSettingsService({ apiClient });
    return {
      userService: createApiUserService({ apiClient }),
      membershipService: createApiMembershipService({ apiClient }),
      entryService: createApiEntryService({ apiClient }),
      productService: createApiProductService({ apiClient }),
      cashService,
      operationsService: createApiClassOperationsService({ apiClient }),
      settingsService,
      staffService: createApiStaffService({ apiClient }),
      trainingService: createApiTrainingService({ apiClient }),
      dataSource,
    };
  }

  const db = createDatabase();
  const userRepository = createUserRepository(db);
  const entryRepository = createEntryRepository(db);
  const productRepository = createProductRepository(db);
  const productSaleRepository = createProductSaleRepository(db);
  const membershipPaymentRepository = createMembershipPaymentRepository(db);
  const cashRepository = createCashRepository(db);
  const operationsRepository = createOperationsRepository(db);
  const staffRepository = createStaffRepository(db);
  const settingsRepository = createSettingsRepository(db);
  const trainingRepository = createTrainingRepository(db);
  const localCashService = createCashService({ cashRepository, operationsRepository });
  const localSettingsService = createSettingsService({ settingsRepository });
  const localStaffService = createStaffService({ staffRepository });
  const localUserService = createUserService({
    db,
    userRepository,
    membershipPaymentRepository,
    membershipRules,
    cashService: localCashService,
    settingsService: localSettingsService,
  });
  const cashService = localCashService;
  const settingsService = localSettingsService;
  const userService = localUserService;
  const staffService = localStaffService;
  const trainingService = createLocalTrainingService({
    trainingRepository,
    userRepository,
    staffRepository,
  });
  const membershipService = createMembershipService({
      userRepository,
      membershipPaymentRepository,
      membershipRules,
      cashService,
      settingsService,
  });

  const localOperationsService = createOperationsService({
    operationsRepository,
    userRepository,
    productRepository,
    cashService,
    staffService,
    membershipRules,
  });
  const operationsService = localOperationsService;

  return {
    userService,
    membershipService,
    entryService: createEntryService({ userRepository, entryRepository, membershipRules }),
    productService: createProductService({ db, productRepository, productSaleRepository, cashService }),
    cashService,
    operationsService,
    settingsService,
    staffService,
    trainingService,
    dataSource,
  };
}

module.exports = { createServices };
