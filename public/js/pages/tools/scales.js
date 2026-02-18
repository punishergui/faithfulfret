// Daily Fret — Scales Tool

window.Pages = window.Pages || {};

const SCALE_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const STRING_OPEN_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];
const STRING_LABELS = ['6 (Low E)', '5 (A)', '4 (D)', '3 (G)', '2 (B)', '1 (High e)'];
const MAJOR_NOTES = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MAJOR_TYPES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];

function normToSharps(note) {
  return { Eb: 'D#', Ab: 'G#', Bb: 'A#', Db: 'C#', Gb: 'F#' }[note] || note;
}

Pages.Scales = {
  render() {
    const app = document.getElementById('app');
    const scales = window.FF_SCALES || [];
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const resumeRequested = params.get('resume') === '1';
    const lastPractice = resumeRequested ? Utils.getLastPractice() : null;
    const savedKey = (lastPractice?.tool === 'scales' && lastPractice.key_root) || localStorage.getItem('df_last_key_root') || 'C';
    const savedScale = (lastPractice?.tool === 'scales' && lastPractice.scale_id) || '';
    const savedBpm = parseInt(localStorage.getItem('df_last_bpm') || '', 10);

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Scales</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap" style="display:grid;gap:14px;">
        ${window.renderHelpCard({
          title: 'Scales Practice Mode guide',
          description: 'Use this page to visualize scale notes and run a simple metronome for focused repetition.',
          bullets: ['Count-in gives you time before your first phrase.', 'Use matching diatonic chords to connect scale and harmony.', 'Click a chord chip to jump straight into the Chords tool.'],
          storageKey: 'df_help_tool_scales',
        })}

        <div class="df-card prog-practice-panel" id="scale-practice-panel"></div>

        <div class="df-field">
          <label class="df-label" for="scale-type">Scale Type</label>
          <select id="scale-type" class="df-input">
            ${scales.map((scale) => `<option value="${scale.id}" ${scale.id === savedScale ? 'selected' : ''}>${scale.name}</option>`).join('')}
          </select>
        </div>

        <div class="df-field">
          <label class="df-label" for="scale-key">Key</label>
          <select id="scale-key" class="df-input">${SCALE_KEYS.map((key) => `<option value="${key}" ${key === savedKey ? 'selected' : ''}>${key}</option>`).join('')}</select>
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text2);">
          <input type="checkbox" id="show-diatonic" /> Show matching diatonic chords for this key (Major)
        </label>
        <div id="scale-diatonic-row"></div>

        <div id="scale-title" style="font-family:var(--f-mono);font-size:16px;"></div>
        <div id="scale-svg" style="border:1px solid var(--line2);background:var(--bg1);padding:12px;"></div>
        <div id="scale-help"></div>
      </div>
    `;

    this._bind(app, Number.isFinite(savedBpm) ? savedBpm : 80);
  },

  _bind(container, initialBpm) {
    const scales = window.FF_SCALES || [];
    const typeEl = container.querySelector('#scale-type');
    const keyEl = container.querySelector('#scale-key');
    const titleEl = container.querySelector('#scale-title');
    const svgEl = container.querySelector('#scale-svg');
    const helpEl = container.querySelector('#scale-help');
    const showDiatonicEl = container.querySelector('#show-diatonic');
    const diatonicRowEl = container.querySelector('#scale-diatonic-row');
    const practicePanelEl = container.querySelector('#scale-practice-panel');

    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const resumeRequested = params.get('resume') === '1';
    const lastPractice = resumeRequested ? Utils.getLastPractice() : null;

    let bpm = initialBpm;
    let countInEnabled = localStorage.getItem('df_practice_countin_enabled') !== '0';
    let running = false;
    let beatCount = 0;

    if (lastPractice?.tool === 'scales') {
      if (Number.isFinite(Number(lastPractice.bpm))) bpm = Number(lastPractice.bpm);
      if (typeof lastPractice.countin_enabled === 'boolean') countInEnabled = lastPractice.countin_enabled;
      if (lastPractice.scale_id) typeEl.value = lastPractice.scale_id;
      if (lastPractice.key_root) keyEl.value = lastPractice.key_root;
    }

    const writeLastPractice = (extra = {}) => {
      Utils.setLastPractice({
        tool: 'scales',
        key_root: keyEl.value || null,
        key_mode: 'major',
        progression_id: null,
        scale_id: typeEl.value || null,
        chord_id: null,
        bpm,
        beats_per_chord: null,
        countin_enabled: countInEnabled,
        countin_bars: null,
        ...extra,
      });
    };

    const stopMetro = () => {
      writeLastPractice();
      window.progressMem?.practicePauseOrStop?.();
      running = false;
      window.FFMetronome.stopMetronome();
      renderPracticePanel();
    };

    const startMetro = () => {
      beatCount = 0;
      writeLastPractice();
      window.progressMem?.practiceStart?.({
        tool: 'scales',
        key: `${keyEl.value} Major`,
        progressionId: null,
      });
      const countInBeats = countInEnabled ? 4 : 0;
      running = true;
      window.FFMetronome.startMetronome({
        bpm,
        subdivision: 4,
        accent: true,
        onTick: () => {
          beatCount += 1;
          const stateEl = practicePanelEl.querySelector('#scale-practice-status');
          if (!stateEl) return;
          stateEl.textContent = countInEnabled && beatCount <= countInBeats ? 'Count-in…' : 'Playing…';
        },
      });
      renderPracticePanel();
    };

    const renderPracticePanel = () => {
      practicePanelEl.innerHTML = `
        <div style="font-family:var(--f-mono);font-size:15px;">Practice Mode (Scales)</div>
        <div class="prog-practice-grid">
          <label>BPM <input id="scale-practice-bpm" class="df-input" type="number" min="30" max="240" value="${bpm}" /></label>
          <label><input id="scale-practice-countin" type="checkbox" ${countInEnabled ? 'checked' : ''}/> Count-in</label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="df-btn df-btn--primary" id="scale-practice-start" ${running ? 'disabled' : ''}>Start metronome</button>
          <button class="df-btn df-btn--outline" id="scale-practice-stop" ${running ? '' : 'disabled'}>Stop</button>
        </div>
        <div id="scale-practice-status" style="font-family:var(--f-mono);font-size:12px;color:var(--accent);">${running ? 'Playing…' : 'Stopped'}</div>
      `;

      practicePanelEl.querySelector('#scale-practice-bpm').addEventListener('change', (e) => {
        bpm = Math.max(30, Math.min(240, parseInt(e.target.value, 10) || 80));
        localStorage.setItem('df_last_bpm', String(bpm));
        writeLastPractice();
        if (running) startMetro();
      });
      practicePanelEl.querySelector('#scale-practice-countin').addEventListener('change', (e) => {
        countInEnabled = e.target.checked;
        localStorage.setItem('df_practice_countin_enabled', countInEnabled ? '1' : '0');
        writeLastPractice();
      });
      practicePanelEl.querySelector('#scale-practice-start').addEventListener('click', startMetro);
      practicePanelEl.querySelector('#scale-practice-stop').addEventListener('click', stopMetro);
    };

    const renderDiatonicChords = () => {
      if (!showDiatonicEl.checked) {
        diatonicRowEl.innerHTML = '';
        return;
      }
      const root = normToSharps(keyEl.value);
      const rootIdx = NOTE_INDEX[root];
      const chips = MAJOR_NOTES.map((interval, i) => {
        const note = Object.keys(NOTE_INDEX).find((k) => NOTE_INDEX[k] === ((rootIdx + interval) % 12) && k.length <= 2 && !k.includes('b'));
        const type = MAJOR_TYPES[i];
        const suffix = type === 'major' ? '' : type === 'minor' ? 'm' : 'dim';
        return { roman: MAJOR_ROMAN[i], note: note || root, type, label: `${MAJOR_ROMAN[i]} ${note || root}${suffix}` };
      });
      diatonicRowEl.innerHTML = `<div class="prog-chip-row">${chips.map((chip) => `<button class="prog-chip" data-root="${chip.note}" data-type="${chip.type}">${chip.label}</button>`).join('')}</div>`;
      diatonicRowEl.querySelectorAll('.prog-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          location.hash = `#/tools/chords?root=${encodeURIComponent(btn.dataset.root)}&type=${encodeURIComponent(btn.dataset.type)}`;
        });
      });
    };

    const renderScale = () => {
      const scale = scales.find((item) => item.id === typeEl.value) || scales[0];
      if (!scale) return;
      const key = keyEl.value;
      localStorage.setItem('df_last_key_root', key);
      localStorage.setItem('df_last_key_mode', 'major');
      titleEl.textContent = `${key} ${scale.name}`;
      svgEl.innerHTML = this._buildScaleSvg(key, scale.intervals || []);
      helpEl.innerHTML = window.renderHelpCard({
        title: `${scale.name} quick help`,
        description: scale.description,
        bullets: [
          `Mood: ${scale.mood}`,
          `Genres: ${scale.genres.join(', ')}`,
          `Fits over: ${scale.fits_over}`,
        ],
        storageKey: 'df_help_tool_scales_dynamic',
      });
      window.bindHelpCards(helpEl);
      renderDiatonicChords();
      writeLastPractice();
    };

    keyEl.addEventListener('change', renderScale);
    typeEl.addEventListener('change', renderScale);
    showDiatonicEl.addEventListener('change', renderDiatonicChords);

    const observer = new MutationObserver(() => {
      if (!container.contains(keyEl)) {
        stopMetro();
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });

    renderPracticePanel();
    renderScale();
    if (resumeRequested && lastPractice?.tool === 'scales') {
      setTimeout(() => startMetro(), 0);
    }
  },

  _buildScaleSvg(key, intervals) {
    const width = 760;
    const height = 280;
    const margin = 54;
    const stringGap = 32;
    const fretGap = 48;
    const maxFrets = 12;

    const rootIndex = NOTE_INDEX[key];
    const scaleNotes = new Set(intervals.map((i) => (rootIndex + i) % 12));

    const fretLines = Array.from({ length: maxFrets + 1 }, (_, fret) => {
      const x = margin + fret * fretGap;
      return `<line x1="${x}" y1="${margin}" x2="${x}" y2="${margin + stringGap * 5}" stroke="var(--line2)" stroke-width="${fret === 0 ? 4 : 1.5}" />`;
    }).join('');

    const stringLines = Array.from({ length: 6 }, (_, stringIdx) => {
      const y = margin + stringIdx * stringGap;
      return `<line x1="${margin}" y1="${y}" x2="${margin + fretGap * maxFrets}" y2="${y}" stroke="var(--line2)" stroke-width="1.5" />`;
    }).join('');

    const stringLabels = STRING_LABELS.map((label, stringIdx) => {
      const y = margin + stringIdx * stringGap + 4;
      return `<text x="12" y="${y}" fill="var(--text3)" font-size="10">${label}</text>`;
    }).join('');

    const markers = [];
    for (let stringIdx = 0; stringIdx < 6; stringIdx += 1) {
      const openIndex = NOTE_INDEX[STRING_OPEN_NOTES[stringIdx]];
      const y = margin + stringIdx * stringGap;
      for (let fret = 0; fret <= maxFrets; fret += 1) {
        const noteIndex = (openIndex + fret) % 12;
        if (!scaleNotes.has(noteIndex)) continue;
        const x = margin + fret * fretGap;
        const isRoot = noteIndex === rootIndex;
        markers.push(`<circle cx="${x}" cy="${y}" r="${isRoot ? 8 : 5.5}" fill="${isRoot ? 'var(--accent)' : 'var(--text2)'}" />`);
      }
    }

    const fretLabels = Array.from({ length: maxFrets + 1 }, (_, fret) => `<text x="${margin + fret * fretGap}" y="${height - 10}" text-anchor="middle" fill="var(--text3)" font-size="11">${fret}</text>`).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="250" role="img" aria-label="Scale fretboard diagram">
        ${stringLines}
        ${fretLines}
        ${stringLabels}
        ${markers.join('')}
        ${fretLabels}
      </svg>
    `;
  },
};
