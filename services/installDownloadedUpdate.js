function installDownloadedUpdate(updater, nativeUpdater, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = error => { cleanup(); reject(error); };
    const timer = setTimeout(() => failed(new Error('El instalador no confirmó su inicio.')), timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      nativeUpdater.removeListener('before-quit-for-update', done);
      updater.removeListener('error', failed);
    }
    nativeUpdater.once('before-quit-for-update', done);
    updater.once('error', failed);
    try { updater.quitAndInstall(true, true); } catch (error) { failed(error); }
  });
}
module.exports = { installDownloadedUpdate };
