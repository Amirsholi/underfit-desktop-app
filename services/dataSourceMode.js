function resolveDataSourceMode(env = process.env) {
  const mode = String(env.UNDERFIT_DATA_MODE || 'local').trim().toLowerCase();
  if (!['local', 'api'].includes(mode)) {
    throw new Error('UNDERFIT_DATA_MODE debe ser "local" o "api"');
  }

  return {
    mode,
    apiBaseUrl: String(env.UNDERFIT_API_BASE_URL || 'http://127.0.0.1:5187').trim(),
    deviceKey: String(
      env.UNDERFIT_DEVICE_KEY || 'underfit-development-device-key-change-me'
    ),
  };
}

module.exports = { resolveDataSourceMode };
