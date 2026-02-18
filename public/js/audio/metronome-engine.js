window.FFMetronome = (function() {
  let audioCtx = null;
  let schedulerTimer = null;
  let lookahead = 25.0;
  let scheduleAhead = 0.1;
  let nextBeatTime = 0;
  let beatIndex = 0;
  let running = false;
  let bpm = 80;
  let subdivision = 4;
  let accent = true;
  let onTick = null;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function scheduleClick(isAccent, when) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = isAccent ? 880 : 440;
    gain.gain.setValueAtTime(isAccent ? 0.6 : 0.3, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  function scheduler() {
    const ctx = getAudioCtx();
    while (nextBeatTime < ctx.currentTime + scheduleAhead) {
      const inBar = beatIndex % subdivision;
      const isAccentBeat = accent && inBar === 0;
      scheduleClick(isAccentBeat, nextBeatTime);

      if (typeof onTick === 'function') {
        const tickBeat = beatIndex;
        const tickTime = nextBeatTime;
        const delay = Math.max(0, (tickTime - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (running && onTick) onTick(tickBeat, tickTime);
        }, delay);
      }

      nextBeatTime += 60 / bpm;
      beatIndex += 1;
    }

    if (running) schedulerTimer = setTimeout(scheduler, lookahead);
  }

  function startMetronome(opts = {}) {
    stopMetronome();
    bpm = Math.max(30, Math.min(240, parseInt(opts.bpm, 10) || 80));
    subdivision = Math.max(1, parseInt(opts.subdivision, 10) || 4);
    accent = opts.accent !== false;
    onTick = typeof opts.onTick === 'function' ? opts.onTick : null;

    const ctx = getAudioCtx();
    beatIndex = 0;
    nextBeatTime = ctx.currentTime + 0.1;
    running = true;
    scheduler();
  }

  function stopMetronome() {
    running = false;
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    onTick = null;
  }

  return {
    startMetronome,
    stopMetronome,
    isRunning: () => running,
    close: () => {
      stopMetronome();
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    },
  };
})();
