// Daily Fret — Chords Tool

window.Pages = window.Pages || {};

const CHORD_ROOT_OPTIONS = [
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C# / Db' },
  { value: 'D', label: 'D' },
  { value: 'D#', label: 'D# / Eb' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'F#', label: 'F# / Gb' },
  { value: 'G', label: 'G' },
  { value: 'G#', label: 'G# / Ab' },
  { value: 'A', label: 'A' },
  { value: 'A#', label: 'A# / Bb' },
  { value: 'B', label: 'B' },
];

Pages.Chords = {
  render() {
    const app = document.getElementById('app');
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const resumeRequested = params.get('resume') === '1';
    const lastPractice = resumeRequested ? Utils.getLastPractice() : null;
    const queryRoot = params.get('root') || (lastPractice?.tool === 'chords' ? (lastPractice.chord_id || '').split(':')[0] : '');
    const queryType = params.get('type') || (lastPractice?.tool === 'chords' ? (lastPractice.chord_id || '').split(':')[1] : '');
    const savedBpm = parseInt(localStorage.getItem('df_last_bpm') || '', 10);

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Chords</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="chords-wrap" style="display:grid;gap:14px;">
        ${window.renderHelpCard({
          title: 'Chords Practice guide',
          description: 'Use the chord diagram for shape reference and run a metronome to keep strumming or picking in time.',
          bullets: ['Count-in (on other tools) gives setup beats before loop start.', 'Beats per chord in Progressions changes how fast the highlight moves.', 'Use this page for focused reps on one chord shape.'],
          storageKey: 'df_help_tool_chords',
        })}

        <div class="df-card prog-practice-panel">
          <div style="font-family:var(--f-mono);font-size:15px;">Practice helper</div>
          <div class="prog-practice-grid">
            <label>BPM <input id="chord-practice-bpm" class="df-input" type="number" min="30" max="240" value="${Number.isFinite(savedBpm) ? savedBpm : 80}" /></label>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="df-btn df-btn--primary" id="chord-metro-start">Start metronome</button>
            <button class="df-btn df-btn--outline" id="chord-metro-stop" disabled>Stop</button>
          </div>
        </div>

        <div class="df-field">
          <label class="df-label" for="chord-root">Root</label>
          <select id="chord-root" class="df-input">${CHORD_ROOT_OPTIONS.map((root) => `<option value="${root.value}" ${root.value === queryRoot ? 'selected' : ''}>${root.label}</option>`).join('')}</select>
        </div>

        <div class="df-field">
          <label class="df-label" for="chord-type">Chord Type</label>
          <select id="chord-type" class="df-input">
            ${window.FF_CHORD_TYPES.map((type) => `<option value="${type.id}" ${type.id === queryType ? 'selected' : ''}>${type.label}</option>`).join('')}
          </select>
        </div>

        <div id="chord-name" style="font-family:var(--f-mono);font-size:18px;"></div>
        <div id="chord-svg" style="border:1px solid var(--line2);background:var(--bg1);padding:12px;"></div>
        <div id="chord-fingers" style="color:var(--text2);"></div>
      </div>
    `;

    this._bind(app);
  },

  _bind(container) {
    window.bindHelpCards(container);

    const rootEl = container.querySelector('#chord-root');
    const typeEl = container.querySelector('#chord-type');
    const nameEl = container.querySelector('#chord-name');
    const svgEl = container.querySelector('#chord-svg');
    const fingersEl = container.querySelector('#chord-fingers');
    const bpmEl = container.querySelector('#chord-practice-bpm');
    const startBtn = container.querySelector('#chord-metro-start');
    const stopBtn = container.querySelector('#chord-metro-stop');

    let running = false;

    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const resumeRequested = params.get('resume') === '1';
    const lastPractice = resumeRequested ? Utils.getLastPractice() : null;

    const writeLastPractice = (extra = {}) => {
      Utils.setLastPractice({
        tool: 'chords',
        key_root: rootEl.value || null,
        key_mode: null,
        progression_id: null,
        scale_id: null,
        chord_id: `${rootEl.value}:${typeEl.value}`,
        bpm: Math.max(30, Math.min(240, parseInt(bpmEl.value, 10) || 80)),
        beats_per_chord: null,
        countin_enabled: null,
        countin_bars: null,
        ...extra,
      });
    };

    const setRunning = (next) => {
      running = next;
      startBtn.disabled = running;
      stopBtn.disabled = !running;
    };

    if (lastPractice?.tool === 'chords' && Number.isFinite(Number(lastPractice.bpm))) {
      bpmEl.value = String(Number(lastPractice.bpm));
    }

    const renderChord = () => {
      const root = rootEl.value;
      const type = typeEl.value;
      const leftHanded = window.Utils?.isLeftHanded?.() || false;
      const shape = window.FF_getChordShape(root, type);

      if (!shape) {
        nameEl.textContent = `${root} ${type}`;
        svgEl.innerHTML = '<div style="color:var(--text2);">No chord shape in this phase for that selection.</div>';
        fingersEl.textContent = '';
        return;
      }

      nameEl.textContent = `${shape.name}${leftHanded ? ' (left-handed)' : ''}`;
      fingersEl.textContent = shape.fingers.length
        ? `Finger hints: ${shape.fingers.join(' ')}${shape.barre ? ' • Barre shape' : ''}`
        : shape.barre ? 'Barre shape.' : '';
      svgEl.innerHTML = window.renderChordSvg(shape, { leftHanded, showStringLabels: true, height: 230 });
    };

    rootEl.addEventListener('change', () => { renderChord(); writeLastPractice(); });
    typeEl.addEventListener('change', () => { renderChord(); writeLastPractice(); });

    startBtn.addEventListener('click', () => {
      const bpm = Math.max(30, Math.min(240, parseInt(bpmEl.value, 10) || 80));
      localStorage.setItem('df_last_bpm', String(bpm));
      writeLastPractice({ bpm });
      window.FFMetronome.startMetronome({ bpm, subdivision: 4, accent: true });
      setRunning(true);
    });

    stopBtn.addEventListener('click', () => {
      window.FFMetronome.stopMetronome();
      writeLastPractice();
      setRunning(false);
    });

    const observer = new MutationObserver(() => {
      if (!container.contains(rootEl)) {
        window.FFMetronome.stopMetronome();
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });

    renderChord();
    writeLastPractice();
    if (resumeRequested && lastPractice?.tool === 'chords') {
      setTimeout(() => startBtn.click(), 0);
    }
  },
};
