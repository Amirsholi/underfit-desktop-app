(function (root) {
  function create({createAudio = url => new root.Audio(url)} = {}) {
    let muted = true;
    let sounds = {};
    let playing = null;
    let generation = 0;
    let stopTimer;
    function stop() {
      generation++;
      clearTimeout(stopTimer);
      if (playing) {
        playing.pause();
        playing.removeAttribute('src');
        playing.load();
        playing = null;
      }
    }
    async function play(kind) {
      stop();
      if (muted || !['success', 'expired'].includes(kind) || !sounds[kind]?.url) return false;
      const version = generation;
      try {
        const audio = createAudio(sounds[kind].url);
        playing = audio;
        audio.onended = audio.onerror = () => { if (playing === audio) stop(); };
        // Long files must not overlap the next person's entrance.
        stopTimer = setTimeout(stop, 2000);
        await audio.play();
        return version === generation && !muted;
      } catch (_) { if (version === generation) stop(); return false; }
    }
    return {play, stop,
      configure(preferences) { stop(); muted = preferences?.muted !== false; sounds = preferences?.sounds || {}; },
      setMuted(value) { muted = value !== false; if (muted) stop(); },
      dispose: stop,
    };
  }
  root.KioskAudio = { create };
  if (typeof module !== 'undefined') module.exports = { create };
})(typeof window === 'undefined' ? globalThis : window);
