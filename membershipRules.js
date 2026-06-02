(function (global) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function todayLocal() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function parseLocalDate(isoDate) {
    if (!isoDate || typeof isoDate !== 'string') return null;

    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return null;

    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatLocalDate(date) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function daysRemaining(expirationDate, referenceDate = todayLocal()) {
    const expiration = parseLocalDate(expirationDate);
    if (!expiration) return 0;

    const reference = new Date(referenceDate);
    reference.setHours(0, 0, 0, 0);

    return Math.max(0, Math.floor((expiration - reference) / MS_PER_DAY));
  }

  function isMembershipActive(expirationDate, referenceDate = todayLocal()) {
    const expiration = parseLocalDate(expirationDate);
    if (!expiration) return false;

    const reference = new Date(referenceDate);
    reference.setHours(0, 0, 0, 0);

    return expiration >= reference;
  }

  function calculateRenewalExpiration(expirationDate, daysToAdd, paymentDate = todayLocal()) {
    const currentExpiration = parseLocalDate(expirationDate);
    const payment = new Date(paymentDate);
    payment.setHours(0, 0, 0, 0);

    const baseDate = currentExpiration && currentExpiration >= payment ? currentExpiration : payment;
    return formatLocalDate(addDays(baseDate, daysToAdd));
  }

  function calculateManualExpirationFromToday(days) {
    return formatLocalDate(addDays(todayLocal(), days));
  }

  const rules = {
    todayLocal,
    parseLocalDate,
    formatLocalDate,
    addDays,
    daysRemaining,
    isMembershipActive,
    calculateRenewalExpiration,
    calculateManualExpirationFromToday,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = rules;
  }

  global.membershipRules = rules;
})(typeof window !== 'undefined' ? window : globalThis);
