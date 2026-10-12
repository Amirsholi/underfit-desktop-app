(function (root) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const isPresent = student => student.presente === true || student.presente === 1;
  function attendance(detail, student) {
    if (isPresent(student)) return { label: 'Presente', type: 'present', time: String(student.horaIngreso || '').slice(0, 5) };
    if (detail.estado === 'cancelada') return { label: 'No se dio', type: 'neutral', time: '' };
    if (detail.estado === 'dictada') return { label: 'Ausente', type: 'absent', time: '' };
    return { label: 'Sin ingresar', type: 'neutral', time: '' };
  }
  function hasEvaluation(detail) { return Boolean(detail.esPrueba) && detail.estado === 'dictada'; }
  function canRate(detail, student) {
    return hasEvaluation(detail) && isPresent(student) && Boolean(student.asistenciaId) && Number(detail.profesorProgramadoId || detail.profesorId) > 0;
  }
  function matchesFilter(detail, student, filter) {
    if (filter === 'present') return isPresent(student);
    if (filter === 'unrated') return canRate(detail, student) && !student.puntuacion;
    return true;
  }
  function filterStudents(students, query) {
    const text = normalize(query), digits = text.replace(/\D/g, '');
    const identityQuery = /^[\d.\s-]+$/.test(text);
    return students.filter(student => !text || normalize(student.usuarioNombre).includes(text)
      || (identityQuery && digits && String(student.usuarioCi).replace(/\D/g, '').includes(digits)))
      .sort((a, b) => String(a.usuarioNombre).localeCompare(String(b.usuarioNombre), 'es'));
  }
  function identity(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits.length > 1 ? `${Number(digits.slice(0, -1)).toLocaleString('es-UY')}-${digits.slice(-1)}` : digits;
  }
  const api = { normalize, isPresent, attendance, hasEvaluation, canRate, matchesFilter, filterStudents, identity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.classDetailModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
