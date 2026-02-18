// Daily Fret — Tunings Tool

window.Pages = window.Pages || {};

const NOTE_TO_SEMITONE = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const STRING_INFO = [
  { index: 6, base: 'E', label: 'Low E', octave: 2 },
  { index: 5, base: 'A', label: 'A', octave: 2 },
  { index: 4, base: 'D', label: 'D', octave: 3 },
  { index: 3, base: 'G', label: 'G', octave: 3 },
  { index: 2, base: 'B', label: 'B', octave: 3 },
  { index: 1, base: 'E', label: 'High e', octave: 4 },
];

Pages.Tuning = {
  render() {
    const app = document.getElementById('app');
    const tunings = window.FF_TUNINGS || [];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Tunings</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap" style="display:grid;gap:14px;">
        ${window.renderHelpCard({
          title: 'How to use this tuning tool',
          description: 'This view is in playing orientation: string 1 (high e) is shown at the top and string 6 (low E) is at the bottom.',
          bullets: [
            'The 6th string (Low E) is the thickest string.',
            'The 1st string (High e) is the thinnest string.',
            'Use Play All for a full check, or play each string by itself for quick tuning.',
          ],
          storageKey: 'df_help_tool_tunings',
        })}

        <div class="df-field">
          <label class="df-label" for="tuning-select">Tuning</label>
          <select id="tuning-select" class="df-input">
            ${tunings.map((t, i) => `<option value="${i}">${t.name} (${t.category})</option>`).join('')}
          </select>
        </div>

        <div id="tuning-context" class="help-card__body" style="display:block;"></div>
        <div id="tuning-strings" style="display:grid;grid-template-columns:1fr;gap:8px;"></div>

        <button id="play-tuning" class="df-btn df-btn--primary">Play All Strings</button>
      </div>
    `;

    this._bind(app);
  },

  _bind(container) {
    window.bindHelpCards(container);

    const tunings = window.FF_TUNINGS || [];
    const select = container.querySelector('#tuning-select');
    const stringsEl = container.querySelector('#tuning-strings');
    const playBtn = container.querySelector('#play-tuning');
    const contextEl = container.querySelector('#tuning-context');

    let audioCtx = null;

    const noteToFrequency = (note, octave) => {
      const semitone = NOTE_TO_SEMITONE[note];
      if (semitone == null) return 0;
      const midi = (octave + 1) * 12 + semitone;
      return 440 * Math.pow(2, (midi - 69) / 12);
    };

    const ensureAudio = async () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      return audioCtx;
    };

    const playPluck = async (frequency, whenOffset = 0) => {
      const ctx = await ensureAudio();
      const now = ctx.currentTime + whenOffset;
      const duration = 1.4;

      const burst = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.02), ctx.sampleRate);
      const data = burst.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;

      const source = ctx.createBufferSource();
      source.buffer = burst;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(5500, frequency * 12), now);

      const delay = ctx.createDelay(1);
      delay.delayTime.setValueAtTime(1 / frequency, now);

      const feedback = ctx.createGain();
      feedback.gain.setValueAtTime(0.94, now);

      const out = ctx.createGain();
      out.gain.setValueAtTime(0.32, now);
      out.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(out);
      out.connect(ctx.destination);

      source.start(now);
      source.stop(now + 0.03);
      setTimeout(() => {
        [source, filter, delay, feedback, out].forEach((node) => node.disconnect?.());
      }, (whenOffset + duration + 0.2) * 1000);
    };

    const renderStrings = () => {
      const tuning = tunings[parseInt(select.value, 10)] || tunings[0];
      if (!tuning) return;

      contextEl.innerHTML = `
        <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.08em;color:var(--text3);text-transform:uppercase;margin-bottom:8px;">Tuning details</div>
        <div style="color:var(--text2);font-size:14px;margin-bottom:8px;">${tuning.description}</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:5px;"><strong style="color:var(--text);">Use case:</strong> ${tuning.use_case}</div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:5px;"><strong style="color:var(--text);">Sound:</strong> ${tuning.sound_character}</div>
        <div style="font-size:13px;color:var(--text2);"><strong style="color:var(--text);">Genres:</strong> ${tuning.genres.join(', ')}</div>
      `;

      const playingOrder = STRING_INFO.slice().reverse();
      stringsEl.innerHTML = playingOrder.map((stringInfo) => {
        const tuningIndex = 6 - stringInfo.index;
        const note = tuning.notes[tuningIndex];
        return `
          <div style="border:1px solid var(--line2);background:var(--bg1);padding:10px 12px;display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;">
            <div>
              <div style="font-size:11px;color:var(--text3);font-family:var(--f-mono);">String ${stringInfo.index} (${stringInfo.label})</div>
              <div style="font-size:22px;font-family:var(--f-mono);margin-top:2px;">${note}</div>
            </div>
            <div style="color:var(--text3);font-family:var(--f-mono);font-size:10px;">${stringInfo.index === 6 ? 'Thickest' : stringInfo.index === 1 ? 'Thinnest' : ''}</div>
            <button class="df-btn df-btn--outline tuning-play-string" data-index="${stringInfo.index}" data-note="${note}" data-octave="${stringInfo.octave}">Play</button>
          </div>
        `;
      }).join('');
    };

    const playAll = async () => {
      const tuning = tunings[parseInt(select.value, 10)] || tunings[0];
      if (!tuning) return;
      const playingOrder = STRING_INFO.slice().reverse();
      for (let i = 0; i < playingOrder.length; i++) {
        const info = playingOrder[i];
        const note = tuning.notes[6 - info.index];
        const freq = noteToFrequency(note, info.octave);
        if (freq > 0) await playPluck(freq, i * 0.55);
      }
    };

    container.addEventListener('click', async (event) => {
      const btn = event.target.closest('.tuning-play-string');
      if (!btn) return;
      const note = btn.dataset.note;
      const octave = parseInt(btn.dataset.octave, 10);
      const freq = noteToFrequency(note, octave);
      if (freq > 0) await playPluck(freq);
    });

    select.addEventListener('change', renderStrings);
    playBtn.addEventListener('click', playAll);
    renderStrings();

    const observer = new MutationObserver(() => {
      if (!container.contains(playBtn)) {
        if (audioCtx) audioCtx.close().catch(() => {});
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });
  },
};
