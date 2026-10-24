const SESSION_KEY = "underfit.member.session";
const CACHE_KEY = "underfit.member.last-data";
const app = document.querySelector("#app");
let session = readJson(SESSION_KEY);
let cache = readJson(CACHE_KEY) || {};

function readJson(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function saveSession(value) { session = value; value ? localStorage.setItem(SESSION_KEY, JSON.stringify(value)) : localStorage.removeItem(SESSION_KEY); }
function saveCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
function escapeHtml(value = "") { const node = document.createElement("span"); node.textContent = value; return node.innerHTML; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)) : ""; }
function apiError(body, fallback) { return body?.title || fallback; }

async function request(path, options = {}, authenticated = true) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authenticated && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  let response;
  try { response = await fetch(path, { ...options, headers }); }
  catch { throw new Error("Sin conexión. Mostramos la última información guardada cuando esté disponible."); }
  if (response.status === 401 && authenticated && session?.refreshToken) {
    const refreshed = await fetch("/api/v1/mobile/auth/refresh", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    });
    if (refreshed.ok) {
      saveSession(await refreshed.json());
      return request(path, options, authenticated);
    }
    saveSession(null);
    showAuth();
    throw new Error("Tu sesión venció. Ingresá nuevamente.");
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiError(body, "No pudimos completar la operación."));
  return body;
}

function showAuth(firstUse = false) {
  session = null;
  location.hash = "";
  app.innerHTML = document.querySelector(".auth-card")?.outerHTML || `
    <section class="card auth-card"><p class="eyebrow">SOCIOS</p><h1>${firstUse ? "Creá tu acceso." : "Tu entrenamiento, siempre a mano."}</h1>
    <form id="login-form"><label>Cédula<input name="identityNumber" inputmode="numeric" autocomplete="username" required></label>
    <label>Contraseña<input name="password" type="password" autocomplete="${firstUse ? "new-password" : "current-password"}" minlength="${firstUse ? 10 : 1}" required></label>
    ${firstUse ? '<label>Repetir contraseña<input name="repeatPassword" type="password" autocomplete="new-password" minlength="10" required></label>' : ""}
    <button type="submit">${firstUse ? "Crear acceso" : "Ingresar"}</button></form>
    <button class="link-button" id="first-use" type="button">${firstUse ? "Volver al ingreso" : "Primera vez: crear contraseña"}</button><p class="message" id="auth-message"></p></section>`;
  const form = document.querySelector("#login-form");
  document.querySelector("#first-use").onclick = () => showAuth(!firstUse);
  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const message = document.querySelector("#auth-message");
    if (firstUse && data.password !== data.repeatPassword) { message.textContent = "Las contraseñas no coinciden."; return; }
    message.textContent = "Conectando…";
    try {
      const path = firstUse ? "/api/v1/mobile/auth/first-use" : "/api/v1/mobile/auth/login";
      saveSession(await request(path, { method: "POST", body: JSON.stringify(data) }, false));
      showHome();
    } catch (error) { message.textContent = error.message; }
  };
}

function showHome() {
  const fragment = document.querySelector("#home-template").content.cloneNode(true);
  app.replaceChildren(fragment);
  document.querySelector("[data-name]").textContent = session.member.name;
  document.querySelector("[data-membership]").textContent = `${session.member.daysRemaining} días restantes · vence ${formatDate(session.member.membershipExpiresOn)}`;
  document.querySelectorAll("[data-view]").forEach(button => button.onclick = () => openView(button.dataset.view));
  openView(location.hash.slice(1) || "routine");
}

async function loadCached(name, path) {
  try { const data = await request(path); cache[name] = data; cache.savedAt = new Date().toISOString(); saveCache(); return { data, offline: false }; }
  catch (error) { if (cache[name] !== undefined) return { data: cache[name], offline: true, message: error.message }; throw error; }
}

function setContent(html) { document.querySelector("#content").innerHTML = html; }
function markTab(name) { document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === name)); location.hash = name; }
async function openView(name) {
  markTab(name); setContent('<p class="empty">Cargando…</p>');
  try {
    if (name === "routine") await showRoutine();
    if (name === "classes") await showClasses();
    if (name === "history") await showHistory();
    if (name === "account") showAccount();
  } catch (error) { setContent(`<p class="empty">${escapeHtml(error.message)}</p>`); }
}

async function showRoutine() {
  const result = await loadCached("routine", "/api/v1/mobile/workout-plan");
  const plan = result.data;
  if (!plan) return setContent('<p class="empty">Todavía no tenés una rutina asignada.</p>');
  setContent(`${result.offline ? '<p class="offline">Sin conexión · última rutina guardada</p>' : ""}<h2>${escapeHtml(plan.name)}</h2><div class="day-list">${plan.days.map((day, index) => `
    <button class="day-card" data-day="${index}"><small>DÍA ${day.position}</small><h3>${escapeHtml(day.name)}</h3><p>${escapeHtml(day.muscleGroups)}</p></button>`).join("")}</div>`);
  document.querySelectorAll("[data-day]").forEach(button => button.onclick = () => showWorkoutDay(plan, Number(button.dataset.day), result.offline));
}
function showWorkoutDay(plan, index, offline) {
  const day = plan.days[index];
  setContent(`${offline ? '<p class="offline">Sin conexión · última rutina guardada</p>' : ""}<button class="secondary" id="back-routine">← Días</button><h2>${escapeHtml(day.name)}</h2>
    <div class="content">${day.exercises.map(exercise => `<article class="item exercise">
      <div><p class="eyebrow">${escapeHtml(exercise.muscleGroup)}</p><h3>${escapeHtml(exercise.name)}</h3></div>
      ${exercise.gifUrl ? `<video src="${escapeHtml(exercise.gifUrl)}" autoplay muted loop playsinline preload="metadata"></video>` : ""}
      <div class="meta"><span class="pill">${exercise.sets} series</span><span class="pill">${escapeHtml(exercise.repetitions)} reps</span>${exercise.load ? `<span class="pill">${escapeHtml(exercise.load)}</span>` : ""}${exercise.restSeconds ? `<span class="pill">${exercise.restSeconds}s descanso</span>` : ""}</div>
      ${exercise.instructions ? `<p>${escapeHtml(exercise.instructions)}</p>` : ""}${exercise.notes ? `<p><b>Nota:</b> ${escapeHtml(exercise.notes)}</p>` : ""}
    </article>`).join("") || '<p class="empty">Este día todavía no tiene ejercicios.</p>'}</div>`);
  document.querySelector("#back-routine").onclick = showRoutine;
}
async function showClasses() {
  const result = await loadCached("classes", "/api/v1/mobile/classes/available");
  const myClasses = result.data.filter(item => item.isEnrolled);
  const available = result.data.filter(item => !item.isEnrolled);
  const renderClass = item => `<article class="item">
    <p class="eyebrow">${formatDate(item.date)} · ${escapeHtml(item.time.slice(0,5))}</p>
    <h3>${escapeHtml(item.name)}</h3>
    <p>${escapeHtml(item.professor)} · ${escapeHtml(item.locationName)}</p>
    <p>${item.availableSpots} de ${item.capacity} cupos disponibles</p>
    ${result.offline ? "" : item.isEnrolled
      ? `<button class="secondary" data-cancel-class="${item.id}" ${item.canCancel ? "" : "disabled"}>Cancelar reserva</button>`
      : `<button data-enroll-class="${item.id}" ${item.canEnroll ? "" : "disabled"}>${item.status === "full" ? "Clase completa" : item.status === "membership_expired" ? "Membresía insuficiente" : "Anotarme"}</button>`}
    </article>`;
  setContent(`${result.offline ? '<p class="offline">Sin conexión · las reservas requieren conexión</p>' : ""}
    <h2>Mis clases</h2>${myClasses.map(renderClass).join("") || '<p class="empty">No tenés clases próximas reservadas.</p>'}
    <h2>Explorar clases</h2>${available.map(renderClass).join("") || '<p class="empty">No hay más clases disponibles.</p>'}`);
  document.querySelectorAll("[data-enroll-class]").forEach(button => button.onclick = () => updateClassBooking(button, true));
  document.querySelectorAll("[data-cancel-class]").forEach(button => button.onclick = () => updateClassBooking(button, false));
}
async function updateClassBooking(button, enroll) {
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = enroll ? "Reservando…" : "Cancelando…";
  try {
    await request(`/api/v1/mobile/classes/${enroll ? button.dataset.enrollClass : button.dataset.cancelClass}/enrollment`, {
      method: enroll ? "POST" : "DELETE",
      headers: { "Idempotency-Key": crypto.randomUUID() }
    });
    await showClasses();
  } catch (error) {
    button.disabled = false;
    button.textContent = previous;
    alert(error.message);
  }
}
async function showHistory() {
  const result = await loadCached("history", "/api/v1/mobile/history");
  const entries = result.data.entries || [], renewals = result.data.renewals || [];
  setContent(`${result.offline ? '<p class="offline">Sin conexión · último historial guardado</p>' : ""}<h2>Ingresos</h2>${entries.map(item => `
    <article class="item"><h3>${new Intl.DateTimeFormat("es-UY",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.occurredAtUtc))}</h3><p>${escapeHtml(item.locationName)}${item.observation ? ` · ${escapeHtml(item.observation)}` : ""}</p>${item.classId ? `<p>${item.performanceRating ? `Desempeño: ${"★".repeat(item.performanceRating)}${"☆".repeat(5-item.performanceRating)} ${item.performanceRating}/5` : "Desempeño aún no registrado"}</p>` : ""}</article>`).join("") || '<p class="empty">Sin ingresos registrados.</p>'}
    <h2>Renovaciones</h2>${renewals.map(item => `<article class="item"><h3>${formatDate(item.paidOn)} · ${escapeHtml(item.plan)}</h3><p>$ ${Number(item.amount).toLocaleString("es-UY")} · vence ${formatDate(item.newExpiration)}</p></article>`).join("") || '<p class="empty">Sin renovaciones registradas.</p>'}`);
}
function showAccount() {
  setContent(`<article class="card"><h2>Mi cuenta</h2><p>${escapeHtml(session.member.identityNumber)} · ${escapeHtml(session.member.name)}</p>
    <form id="password-form"><label>Contraseña actual<input name="currentPassword" type="password" required></label><label>Nueva contraseña<input name="newPassword" type="password" minlength="10" required></label><button>Cambiar contraseña</button></form>
    <p class="message" id="account-message"></p><button class="secondary" id="logout">Cerrar sesión</button>
    <button class="danger" id="delete-account">Solicitar eliminación de mi cuenta</button></article>`);
  document.querySelector("#logout").onclick = async () => { try { await request("/api/v1/mobile/auth/logout", { method:"POST", body:JSON.stringify({ refreshToken:session.refreshToken }) }, false); } finally { saveSession(null); showAuth(); } };
  document.querySelector("#password-form").onsubmit = async event => {
    event.preventDefault(); const message = document.querySelector("#account-message");
    try { saveSession(await request("/api/v1/mobile/change-password", { method:"POST", body:JSON.stringify(Object.fromEntries(new FormData(event.target))) })); message.textContent = "Contraseña actualizada."; }
    catch(error) { message.textContent = error.message; }
  };
  document.querySelector("#delete-account").onclick = async () => {
    if (!confirm("¿Querés solicitar la eliminación del acceso móvil? Los registros administrativos y contables se conservarán.")) return;
    try { await request("/api/v1/mobile/account-deletion-request", { method:"POST" }); saveSession(null); localStorage.removeItem(CACHE_KEY); alert("Solicitud registrada."); showAuth(); }
    catch(error) { document.querySelector("#account-message").textContent = error.message; }
  };
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/socios/service-worker.js");
if (session?.accessToken) showHome(); else showAuth();
