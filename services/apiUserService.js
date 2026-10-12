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

function mapMember(member) {
  const createdOn = String(member.createdAtUtc || '').slice(0, 10);
  return {
    id: member.id,
    ci: member.identityNumber,
    nombre: member.name,
    numero: member.phone || '',
    email: member.email || '',
    detalle: member.details || '',
    contacto_emergencia: member.emergencyContactName || '',
    telefono_emergencia: member.emergencyContactPhone || '',
    autorizacion_imagen: member.imageUseAuthorized ? 1 : 0,
    fecha_nacimiento: member.birthDate || '',
    direccion: member.address || '',
    relacion_emergencia: member.emergencyRelationship || '',
    condicion_medica: member.medicalCondition || '',
    objetivo: member.goal || '',
    forma_pago_alta: member.registrationPaymentMethod || '',
    preferencia_pago: member.paymentPreference || '',
    fecha_creacion: createdOn,
    ultima_actualizacion: String(member.updatedAtUtc || member.createdAtUtc || '').slice(0, 10),
    fecha_vencimiento: member.membershipExpiresOn,
    tipo_membresia: PLAN_FROM_API[member.currentMembershipPlan] || 'mensual',
    data_source: 'api',
  };
}

function mapMembershipRenewal(renewal) {
  return {
    id: renewal.id,
    usuario_ci: renewal.memberIdentityNumber,
    usuario_nombre: renewal.memberName,
    fecha_pago: renewal.paidOn,
    hora_pago: String(renewal.paidAtUtc || '').slice(11, 19),
    ts: renewal.paidAtUtc,
    tipo_membresia: PLAN_FROM_API[renewal.plan] || 'mensual',
    dias_agregados: renewal.daysAdded,
    monto: Number(renewal.amount || 0),
    forma_pago: renewal.paymentMethod,
    vencimiento_anterior: renewal.previousExpiration,
    vencimiento_nuevo: renewal.newExpiration,
    caja_movimiento_id: renewal.cashMovementId,
    caja_sesion_id: renewal.cashSessionId,
    observacion: renewal.notes || null,
    data_source: 'api',
  };
}

function createApiUserService({ apiClient, clock = todayLocal }) {
  return {
    async createUser(payload = {}) {
      const result = await apiClient.createMember({
        identityNumber: String(payload.ci || '').trim(),
        name: String(payload.nombre || '').trim(),
        plan: PLAN_TO_API[payload.tipoMembresia] || PLAN_TO_API.mensual,
        startsOn: clock(),
        phone: payload.numero || null,
        email: payload.email || null,
        details: payload.detalle || null,
        emergencyContactName: payload.contactoEmergencia || null,
        emergencyContactPhone: payload.telefonoEmergencia || null,
        imageUseAuthorized: Boolean(payload.autorizacionImagen),
        birthDate: payload.fechaNacimiento || null,
        address: payload.direccion || null,
        emergencyRelationship: payload.relacionEmergencia || null,
        medicalCondition: payload.condicionMedica || null,
        goal: payload.objetivo || null,
        registrationPaymentMethod: payload.formaPagoAlta || null,
        paymentPreference: payload.preferenciaPago || payload.formaPagoAlta || null,
      });
      const member = result.member || result;
      const movement = result.cashMovement || null;
      return {
        success: true,
        id: member.id,
        user: mapMember(member),
        movimientoCaja: movement ? {
          id: movement.id,
          caja_sesion_id: movement.cashSessionId,
          fecha: movement.businessDate,
          tipo_ingreso: movement.type,
          forma_pago: movement.paymentMethod,
          monto: Number(movement.amount),
          descripcion: movement.description,
          usuario_ci: movement.memberIdentityNumber,
          usuario_nombre: movement.memberName,
          ts: movement.occurredAtUtc,
        } : null,
        dataSource: 'api',
      };
    },
    async listUsers() {
      const members = await apiClient.listMembers();
      return members.map(mapMember);
    },
    async getUserByCi(ci) {
      return mapMember(await apiClient.getMember(String(ci)));
    },
    async listMembershipPayments(ci) {
      const renewals = await apiClient.listMembershipRenewals(String(ci));
      return renewals.map(mapMembershipRenewal);
    },
    async saveAdminManualEdit(ci, payload = {}) {
      const member = await apiClient.updateMember(String(ci), {
        name: String(payload.nombre || '').trim(),
        plan: PLAN_TO_API[payload.tipoMembresia] || PLAN_TO_API.mensual,
        daysRemaining: Number.parseInt(payload.diasRestantes, 10),
        phone: payload.numero || null,
        email: payload.email || null,
        details: payload.detalle || null,
        emergencyContactName: payload.contactoEmergencia || null,
        emergencyContactPhone: payload.telefonoEmergencia || null,
        imageUseAuthorized: Boolean(payload.autorizacionImagen),
        birthDate: payload.fechaNacimiento || null,
        address: payload.direccion || null,
        emergencyRelationship: payload.relacionEmergencia || null,
        medicalCondition: payload.condicionMedica || null,
        goal: payload.objetivo || null,
        registrationPaymentMethod: payload.formaPagoAlta || null,
        paymentPreference: payload.preferenciaPago || payload.formaPagoAlta || null,
      });
      return { success: true, changes: 1, user: mapMember(member), dataSource: 'api' };
    },
    async deleteUser(ci) {
      return apiClient.deleteMember(String(ci));
    },
    async resetMobileAccess(ci, password) {
      await apiClient.configureMemberMobileAccess(String(ci), password);
      return { success: true };
    },
  };
}

module.exports = { createApiUserService, mapMember, mapMembershipRenewal };
