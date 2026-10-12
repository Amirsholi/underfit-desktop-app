// Updates run only before opening the desktop and starting the local API.
// Published stable releases are the owner's explicit deployment decision.
async function runStartupUpdate({ updater, backup, install, log = () => {}, timeoutMs = 15000, downloadTimeoutMs = 180000 }) {
  const writeLog = log;
  log = (...args) => { try { writeLog(...args); } catch { /* Logging must not prevent opening the gym. */ } };
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  let available = false;
  let updateError = null;
  const onAvailable = () => { available = true; };
  const onError = error => { updateError = error; log('update-error', error.message); };
  updater.on('update-available', onAvailable);
  updater.on('error', onError);
  const bounded = async (task, ms, cancel = () => {}) => {
    let timer;
    try {
      return await Promise.race([task, new Promise((_, reject) => {
        timer = setTimeout(() => { cancel(); reject(new Error('Se agotó el tiempo de actualización.')); }, ms);
      })]);
    } finally { clearTimeout(timer); }
  };
  try {
    const result = await bounded(updater.checkForUpdates(), timeoutMs);
    if (!available || !result) return { installing: false, reason: 'no-update' };
    await bounded(updater.downloadUpdate(result.cancellationToken), downloadTimeoutMs,
      () => result.cancellationToken?.cancel());
    if (updateError) throw updateError;
    const saved = await backup();
    if (!saved?.created) throw new Error('No se pudo respaldar: se conserva la versión instalada.');
    log('backup-created', saved.path);
    await install();
    if (updateError) throw updateError;
    return { installing: true, version: result.updateInfo.version };
  } catch (error) {
    log('update-deferred', error.message);
    return { installing: false, reason: 'deferred' };
  } finally {
    updater.removeListener('update-available', onAvailable);
    // Keep an error listener: a timed-out network request can finish later.
  }
}
module.exports = { runStartupUpdate };
