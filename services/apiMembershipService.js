const { mapMember, mapMembershipRenewal } = require('./apiUserService');

const PLAN_TO_API = {
  mensual: 30,
  trimestral: 90,
  semestral: 180,
};

const PLAN_FROM_API = {
  30: 'mensual',
  90: 'trimestral',
  180: 'semestral',
  Monthly: 'mensual',
  Quarterly: 'trimestral',
  Semiannual: 'semestral',
};

function todayLocal() {
  const date = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createApiMembershipService({ apiClient, clock = todayLocal }) {
  return {
    async renewMembership({ ci, dias, tipo = null, formaPago = 'efectivo' } = {}) {
      const plan = PLAN_TO_API[String(tipo || '').toLowerCase()]
        || (Number(dias) === 90 ? 90 : Number(dias) === 180 ? 180 : 30);
      const response = await apiClient.renewMembership(String(ci), {
        plan,
        paidOn: clock(),
        paymentMethod: formaPago,
      });
      const renewal = response.renewal;
      const member = mapMember(response.member);
      const payment = mapMembershipRenewal(renewal);

      return {
        success: true,
        reason: 'renewed',
        changes: 1,
        user: { ci: member.ci, nombre: member.nombre },
        previousExpiration: renewal.previousExpiration,
        paymentDate: renewal.paidOn,
        expirationDate: renewal.newExpiration,
        membershipType: PLAN_FROM_API[renewal.plan] || 'mensual',
        daysAdded: renewal.daysAdded,
        movimientoCaja: renewal.cashMovementId
          ? {
            id: renewal.cashMovementId,
            caja_sesion_id: renewal.cashSessionId,
            monto: Number(renewal.amount || 0),
            formaPago: renewal.paymentMethod,
          }
          : null,
        pagoMembresia: payment,
        dataSource: 'api',
      };
    },
  };
}

module.exports = { createApiMembershipService };
