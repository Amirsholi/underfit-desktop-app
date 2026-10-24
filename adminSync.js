(function(root) {
  'use strict';
  function createScheduler({ safe, status = () => {} }) {
    const jobs = [];
    function watch({ enabled, read, apply }) {
      const job = { enabled, read, apply, busy: false, failed: false, fingerprint: null };
      jobs.push(job);
    }
    async function refresh() {
      if (!safe()) return;
      let checked = false;
      await Promise.all(jobs.map(async job => {
        if (job.busy || !job.enabled()) return;
        job.busy = true;
        try {
          const result = await job.read();
          if (!safe() || !job.enabled()) return;
          const fingerprint = JSON.stringify(result);
          if (fingerprint !== job.fingerprint) {
            job.apply(result);
            job.fingerprint = fingerprint;
          }
          job.failed = false;
          checked = true;
        } catch (_) { job.failed = true; checked = true; }
        finally { job.busy = false; }
      }));
      if (checked) status(jobs.some(job => job.enabled() && job.failed));
    }
    return { watch, refresh };
  }
  if (typeof module === 'object' && module.exports) module.exports = { createScheduler };
  if (!root.document) return;
  const visible = element => element && element.getClientRects().length > 0;
  const safe = () => !document.hidden &&
    !document.querySelector('[aria-haspopup="listbox"][aria-expanded="true"]') &&
    !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') &&
    ![...document.querySelectorAll('dialog[open],.app-modal,[aria-modal="true"]')].some(element => {
      if (element.id === 'modal-dashboard') return false;
      if (element.id === 'modal-concurrencia') return false;
      if (element.id === 'modal-cobrar-pendiente' && visible(document.getElementById('pending-list-panel'))) return false;
      return visible(element);
    }) &&
    !document.querySelector('[data-admin-view].is-active.is-editor');
  root.adminSync = createScheduler({ safe, status: failed => {
    const box = document.getElementById('system-status');
    if (!box) return;
    box.classList.remove('is-connecting', 'is-connected', 'is-offline');
    box.classList.add(failed ? 'is-offline' : 'is-connected');
    document.getElementById('system-status-title').textContent = failed ? 'Sin actualizar' : 'Conectado';
    document.getElementById('system-status-copy').textContent = failed ? 'Reintentando conexión; datos anteriores' : 'Datos sincronizados';
  }});
  root.adminSync.visible = visible;
  root.adminSync.active = section => Boolean(document.querySelector(`[data-admin-view="${section}"].is-active`));
  setInterval(root.adminSync.refresh, 10000);
  for (const event of ['focus', 'online']) root.addEventListener(event, root.adminSync.refresh);
  for (const event of ['visibilitychange', 'admin-section:show', 'admin-home:show', 'admin-dashboard:show']) {
    document.addEventListener(event, () => queueMicrotask(root.adminSync.refresh));
  }
})(typeof window === 'object' ? window : globalThis);
