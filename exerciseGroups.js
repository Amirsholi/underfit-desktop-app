(function (global) {
  function clean(value) {
    return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  function key(value) {
    return clean(value).toLocaleLowerCase('es');
  }

  function label(value) {
    const text = key(value);
    return text ? text[0].toLocaleUpperCase('es') + text.slice(1) : '';
  }

  function list(exercises) {
    const groups = new Map();
    for (const exercise of exercises) {
      const normalized = key(exercise.muscleGroup);
      if (normalized) groups.set(normalized, label(exercise.muscleGroup));
    }
    return [...groups.values()].sort((a, b) => a.localeCompare(b, 'es'));
  }

  const groups = { key, label, list };
  if (typeof module !== 'undefined' && module.exports) module.exports = groups;
  global.exerciseGroups = groups;
})(typeof window !== 'undefined' ? window : globalThis);
