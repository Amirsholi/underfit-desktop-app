(function () {
  // To remove the campaign later, set enabled to false or delete this script import.
  const CONFIG = {
    enabled: true,
    targetDate: new Date(2026, 4, 24, 0, 0, 0),
    activeUntil: new Date(2026, 4, 24, 23, 59, 59),
    backgroundImage: 'gym.jpg',
    eventName: 'UNDER RUNNING',
    distances: '3KM & 5KM',
  };

  function parseEventDate(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return {
      targetDate: new Date(year, month, day, 0, 0, 0),
      activeUntil: new Date(year, month, day, 23, 59, 59),
      label: new Intl.DateTimeFormat('es-UY', { day: 'numeric', month: 'long' })
        .format(new Date(year, month, day))
        .toUpperCase(),
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildConfig(settings = {}) {
    const eventDate = parseEventDate(settings.eventoRunningFecha) || {
      targetDate: CONFIG.targetDate,
      activeUntil: CONFIG.activeUntil,
      label: '24 MAYO',
    };

    return {
      enabled: settings.eventoRunningActivo === true,
      targetDate: eventDate.targetDate,
      activeUntil: eventDate.activeUntil,
      dateLabel: eventDate.label,
      backgroundImage: CONFIG.backgroundImage,
      eventName: String(settings.eventoRunningNombre || CONFIG.eventName).trim() || CONFIG.eventName,
      distances: String(settings.eventoRunningDistancias || CONFIG.distances).trim() || CONFIG.distances,
    };
  }

  function isActive(config = CONFIG, now = new Date()) {
    return config.enabled && now <= config.activeUntil;
  }

  function getCountdownParts(targetDate, now = new Date()) {
    const diff = targetDate.getTime() - now.getTime();
    if (diff <= 0) {
      return { days: '00', hours: '00', minutes: '00', seconds: '00' };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  }

  function initParticles(canvas) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return () => {};

    let width = 0;
    let height = 0;
    let frame = 0;
    let animationId = 0;
    const particles = Array.from({ length: 38 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      size: 0.7 + Math.random() * 1.6,
      speed: 0.08 + Math.random() * 0.22,
      drift: (index % 2 === 0 ? 1 : -1) * (0.015 + Math.random() * 0.04),
      alpha: 0.16 + Math.random() * 0.26,
    }));

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw() {
      frame += 0.006;
      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.x += (particle.speed / Math.max(width, 1)) + Math.sin(frame + particle.y * 5) * particle.drift / 20;
        particle.y -= particle.drift / 22;

        if (particle.x > 1.08) particle.x = -0.08;
        if (particle.y < -0.08) particle.y = 1.08;
        if (particle.y > 1.08) particle.y = -0.08;

        const x = particle.x * width;
        const y = particle.y * height;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, particle.size * 5);
        gradient.addColorStop(0, `rgba(255, 76, 0, ${particle.alpha})`);
        gradient.addColorStop(1, 'rgba(255, 76, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 5, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    animationId = window.requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationId);
    };
  }

  async function loadConfig() {
    if (!window.api?.obtenerInfoSistema) return buildConfig();
    try {
      const info = await window.api.obtenerInfoSistema();
      return buildConfig(info?.settings || {});
    } catch (error) {
      console.error('No se pudo cargar configuracion de evento:', error);
      return buildConfig();
    }
  }

  async function init(options = {}) {
    const config = options.config || await loadConfig();
    if (!isActive(config)) {
      return { active: false, playEntryTransition: () => Promise.resolve(), destroy: () => {} };
    }

    const content = options.content || document.querySelector('.kiosk-content');
    const form = options.form || document.querySelector('.kiosk-form');
    if (!content || !form) {
      return { active: false, playEntryTransition: () => Promise.resolve(), destroy: () => {} };
    }

    document.body.classList.add('under-running-active');
    document.documentElement.style.setProperty('--event-poster-image', `url('${config.backgroundImage}')`);
    const eventName = escapeHtml(config.eventName);
    const distances = escapeHtml(config.distances);
    const dateLabel = escapeHtml(config.dateLabel);

    const canvas = document.createElement('canvas');
    canvas.className = 'running-particles';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const backdrop = document.createElement('div');
    backdrop.className = 'running-event-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `
      <div class="running-backdrop-word running-backdrop-distance">${distances}</div>
      <div class="running-backdrop-word running-backdrop-name">${eventName}</div>
    `;
    document.body.appendChild(backdrop);

    const banner = document.createElement('section');
    banner.className = 'running-event-banner';
    banner.setAttribute('aria-label', 'UNDER RUNNING - 3KM y 5KM');
    banner.innerHTML = `
      <div class="running-event-poster" aria-hidden="true"></div>
      <div class="running-event-content">
        <p class="running-event-kicker">${eventName}</p>
        <h2 class="running-event-title">${distances}</h2>
        <p class="running-event-date"><span>///</span> ${dateLabel} <span>///</span></p>
        <div class="running-event-divider"><span></span><strong>FALTAN</strong><span></span></div>
        <div class="running-event-countdown" aria-live="polite"></div>
        <p class="running-event-question">&iquest;Est&aacute;s listo para el <span>desaf&iacute;o</span>?</p>
      </div>
    `;
    const panel = options.panel || document.querySelector('.kiosk-panel');
    const brand = panel?.querySelector('.brand-lockup');
    if (panel && brand) {
      panel.insertBefore(banner, brand);
    } else {
      content.insertBefore(banner, form);
    }

    const countdown = banner.querySelector('.running-event-countdown');
    let previousCountdown = '';
    let countdownTimer = 0;

    function renderCountdown() {
      const parts = getCountdownParts(config.targetDate);
      const nextValue = `${parts.days}:${parts.hours}:${parts.minutes}:${parts.seconds}`;
      if (nextValue === previousCountdown) return;
      previousCountdown = nextValue;
      countdown.innerHTML = `
        <span class="running-count-box"><strong>${parts.days}</strong><small>DIAS</small></span>
        <span class="running-count-box"><strong>${parts.hours}</strong><small>HORAS</small></span>
        <span class="running-count-box"><strong>${parts.minutes}</strong><small>MIN</small></span>
        <span class="running-count-box"><strong>${parts.seconds}</strong><small>SEG</small></span>
      `;
      countdown.classList.remove('is-changing');
      window.requestAnimationFrame(() => countdown.classList.add('is-changing'));
    }

    renderCountdown();
    countdownTimer = window.setInterval(renderCountdown, 1000);
    const stopParticles = initParticles(canvas);

    function playEntryTransition() {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'running-transition';
        overlay.innerHTML = `
          <div class="running-transition-flash"></div>
          <div class="running-transition-panel">
            <strong>${eventName}</strong>
            <em>inscribite ya</em>
          </div>
        `;
        document.body.appendChild(overlay);

        window.setTimeout(() => overlay.classList.add('is-active'), 20);
        window.setTimeout(() => {
          overlay.classList.add('is-leaving');
          window.setTimeout(() => {
            overlay.remove();
            resolve();
          }, 360);
        }, 1740);
      });
    }

    function destroy() {
      window.clearInterval(countdownTimer);
      stopParticles();
      canvas.remove();
      backdrop.remove();
      banner.remove();
      document.body.classList.remove('under-running-active');
    }

    return { active: true, playEntryTransition, destroy };
  }

  window.UnderRunningEvent = { init, isActive };
})();
