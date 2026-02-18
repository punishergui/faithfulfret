// Daily Fret — Metronome Tool
// Uses AudioContext.currentTime scheduling for click timing.

window.Pages = window.Pages || {};

Pages.Metronome = {
  render() {
    const app = document.getElementById('app');
    const savedBpm = parseInt(localStorage.getItem('df_last_bpm') || '120', 10);
    const initialBpm = Number.isFinite(savedBpm) ? Math.min(240, Math.max(30, savedBpm)) : 120;

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1452457750107-be127b9f2f77?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Metronome</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="metro-wrap" style="display:grid;gap:14px;">
        <div class="df-field">
          <label class="df-label" for="metro-bpm">BPM</label>
          <input id="metro-bpm" class="df-input" type="number" min="30" max="240" value="${initialBpm}">
        </div>

        <div class="df-field">
          <label class="df-label" for="metro-subdivision">Subdivision</label>
          <select id="metro-subdivision" class="df-input">
            <option value="1">1/4 notes</option>
            <option value="2">1/8 notes</option>
          </select>
        </div>

        <div id="metro-status" style="font-family:var(--f-mono);color:var(--text2);">Stopped</div>
        <button id="metro-toggle" class="df-btn df-btn--primary">Start</button>
      </div>
    `;

    this._bind(app, initialBpm);
  },

  _bind(container, initialBpm) {
    const bpmInput = container.querySelector('#metro-bpm');
    const subdivisionSelect = container.querySelector('#metro-subdivision');
    const toggleBtn = container.querySelector('#metro-toggle');
    const statusEl = container.querySelector('#metro-status');

    let audioCtx = null;
    let timerId = null;
    let isRunning = false;
    let bpm = initialBpm;
    let nextNoteTime = 0;
    let stepIndex = 0;

    const lookAheadMs = 25;
    const scheduleAheadSeconds = 0.1;
    const beatsPerMeasure = 4;

    const getAudioContext = async () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      return audioCtx;
    };

    const clickAt = (ctx, when, accent, isOffbeat) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(accent ? 1000 : (isOffbeat ? 550 : 750), when);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.35 : 0.2, when + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(when);
      osc.stop(when + 0.06);
    };

    const nextStepDuration = () => {
      const subdivision = parseInt(subdivisionSelect.value, 10) || 1;
      return 60 / bpm / subdivision;
    };

    const scheduler = async () => {
      const ctx = await getAudioContext();
      const subdivision = parseInt(subdivisionSelect.value, 10) || 1;
      const stepsPerMeasure = beatsPerMeasure * subdivision;

      while (nextNoteTime < ctx.currentTime + scheduleAheadSeconds) {
        const isBeatStart = stepIndex % subdivision === 0;
        const beatInMeasure = Math.floor(stepIndex / subdivision) % beatsPerMeasure;
        const isAccent = isBeatStart && beatInMeasure === 0;
        clickAt(ctx, nextNoteTime, isAccent, !isBeatStart);

        nextNoteTime += nextStepDuration();
        stepIndex = (stepIndex + 1) % stepsPerMeasure;
      }
    };

    const start = async () => {
      await getAudioContext();
      isRunning = true;
      stepIndex = 0;
      nextNoteTime = audioCtx.currentTime + 0.05;
      timerId = window.setInterval(scheduler, lookAheadMs);
      scheduler();
      toggleBtn.textContent = 'Stop';
      statusEl.textContent = `Running at ${bpm} BPM`;
    };

    const stop = () => {
      isRunning = false;
      if (timerId) clearInterval(timerId);
      timerId = null;
      toggleBtn.textContent = 'Start';
      statusEl.textContent = 'Stopped';
    };

    const setBpm = (value) => {
      const next = Math.max(30, Math.min(240, parseInt(value, 10) || 120));
      bpm = next;
      bpmInput.value = String(next);
      localStorage.setItem('df_last_bpm', String(next));
      if (isRunning) statusEl.textContent = `Running at ${bpm} BPM`;
    };

    bpmInput.addEventListener('change', () => setBpm(bpmInput.value));
    toggleBtn.addEventListener('click', () => (isRunning ? stop() : start()));

    const observer = new MutationObserver(() => {
      if (!container.contains(toggleBtn)) {
        stop();
        if (audioCtx) audioCtx.close().catch(() => {});
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });
  },
};
