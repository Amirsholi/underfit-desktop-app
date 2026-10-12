const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../classDetailModel');

test('inscription alone is never attendance; absence only after the class finishes', () => {
  const student = { presente: false };
  assert.equal(model.attendance({ estado: 'programada' }, student).label, 'Sin ingresar');
  assert.equal(model.attendance({ estado: 'en_curso' }, student).label, 'Sin ingresar');
  assert.equal(model.attendance({ estado: 'dictada' }, student).label, 'Ausente');
  assert.equal(model.attendance({ estado: 'cancelada' }, student).label, 'No se dio');
  assert.deepEqual(model.attendance({ estado: 'dictada' }, { presente: 1, horaIngreso: '07:08:00' }), { label: 'Presente', type: 'present', time: '07:08' });
});
test('rating requires a finished trial, a real attendance and its professor', () => {
  const detail = { esPrueba: true, estado: 'dictada', profesorProgramadoId: 1 };
  const student = { presente: true, asistenciaId: 2 };
  assert.equal(model.canRate(detail, student), true);
  for (const variant of [{ ...detail, esPrueba: false }, { ...detail, estado: 'en_curso' }, { ...detail, profesorProgramadoId: null }]) assert.equal(model.canRate(variant, student), false);
  assert.equal(model.canRate(detail, { ...student, presente: false }), false);
  assert.equal(model.canRate(detail, { ...student, asistenciaId: null }), false);
});
test('search handles accents, case and formatted identity numbers without mutating data', () => {
  const students = [{ usuarioNombre: 'Martín Suárez', usuarioCi: '45678901' }, { usuarioNombre: 'Ana Pereira', usuarioCi: '56789012' }];
  assert.equal(model.filterStudents(students, 'MARTIN')[0].usuarioCi, '45678901');
  assert.equal(model.filterStudents(students, '4.567.890-1')[0].usuarioNombre, 'Martín Suárez');
  assert.equal(model.filterStudents(students, '')[0].usuarioNombre, 'Ana Pereira');
  assert.equal(students[0].usuarioNombre, 'Martín Suárez');
  assert.equal(model.filterStudents(students, 'ZZZ').length, 0);
});
test('roster filters only put eligible attendees in the optional evaluation queue', () => {
  const detail = { esPrueba: true, estado: 'dictada', profesorProgramadoId: 1 };
  const student = { presente: true, asistenciaId: 2, puntuacion: null };
  assert.equal(model.matchesFilter(detail, student, 'unrated'), true);
  assert.equal(model.matchesFilter(detail, {...student,presente:false}, 'unrated'), false);
  assert.equal(model.matchesFilter(detail, {...student,puntuacion:4}, 'unrated'), false);
  assert.equal(model.matchesFilter({...detail,estado:'programada'}, student, 'unrated'), false);
  assert.equal(model.matchesFilter(detail, student, 'present'), true);
  assert.equal(model.matchesFilter(detail, {...student,presente:false}, 'all'), true);
});
