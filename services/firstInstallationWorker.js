const { parentPort, workerData } = require('node:worker_threads');
const { completeFirstInstallation } = require('./firstInstallation');
completeFirstInstallation({ ...workerData,
  onProgress: async text => parentPort.postMessage({ progress: text }),
}).then(() => parentPort.postMessage({ complete: true }))
  .catch(error => parentPort.postMessage({ error: error.message }));
