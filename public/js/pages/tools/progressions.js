window.Pages = window.Pages || {};

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_ALIASES = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#' };
const DISPLAY_ALIASES = { 'C#': 'C#/Db', 'D#': 'D#/Eb', 'F#': 'F#/Gb', 'G#': 'G#/Ab', 'A#': 'A#/Bb' };
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];
const MAJOR_QUALITIES = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'dim'];
const MINOR_QUALITIES = ['minor', 'dim', 'major', 'minor', 'minor', 'major', 'major'];

const MAJOR_PROGRESSIONS = [
  { label: 'I – V – vi – IV', roman: ['I', 'V', 'vi', 'IV'] },
  { label: 'I – IV – V', roman: ['I', 'IV', 'V'] },
  { label: 'vi – IV – I – V', roman: ['vi', 'IV', 'I', 'V'] },
  { label: 'ii – V – I', roman: ['ii', 'V', 'I'] },
];

const MINOR_PROGRESSIONS = [
  { label: 'i – VI – III – VII', roman: ['i', 'VI', 'III', 'VII'] },
  { label: 'i – iv – V', roman: ['i', 'iv', 'V'] },
  { label: 'i – VII – VI – VII', roman: ['i', 'VII', 'VI', 'VII'] },
];

function toNoteName(note) {
  return DISPLAY_ALIASES[note] || note;
}

function normalizeNote(note) {
  return NOTE_ALIASES[note] || note;
}

function getScale(keyRoot, mode) {
  const root = normalizeNote(keyRoot);
  const rootIndex = CHROMATIC.indexOf(root);
  const intervals = mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const numerals = mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;
  const qualities = mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES;

  return intervals.map((interval, idx) => {
    const note = CHROMATIC[(rootIndex + interval) % 12];
    const quality = qualities[idx];
    const suffix = quality === 'minor' ? 'm' : quality === 'dim' ? 'dim' : '';
    return {
      numeral: numerals[idx],
      note,
      quality,
      chordName: `${note}${suffix}`,
      shapeType: quality,
    };
  });
}

function getInt(key, fallback) {
  const parsed = parseInt(localStorage.getItem(key) || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

Pages.Progressions = {
  render() {
    const app = document.getElementById('app');
    const keyOptions = [
      ...CHROMATIC.map((note) => ({ value: `${note}|major`, label: `${toNoteName(note)} Major` })),
      ...CHROMATIC.map((note) => ({ value: `${note}|minor`, label: `${toNoteName(note)} Minor` })),
    ];
    const savedKeyRoot = localStorage.getItem('df_last_key_root');
    const savedKeyMode = localStorage.getItem('df_last_key_mode');
    const savedKeyValue = savedKeyRoot && savedKeyMode ? `${savedKeyRoot}|${savedKeyMode}` : 'C|major';

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Progressions</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:28px 24px 60px;display:grid;gap:18px;">
        ${window.renderHelpCard({
          title: 'Progressions Practice Mode guide',
          description: 'Use Practice Mode to run a timed loop that highlights each chord on beat boundaries.',
          bullets: ['Count-in gives you setup bars before highlighting starts.', 'Beats per chord controls how long each chord stays active.', 'Pause keeps your place; Stop resets the loop to chord 1.'],
          storageKey: 'df_help_tool_progressions',
        })}

        <div class="df-field">
          <label class="df-label" for="prog-key">Key</label>
          <select id="prog-key" class="df-input">${keyOptions.map((opt) => `<option value="${opt.value}" ${opt.value === savedKeyValue ? 'selected' : ''}>${opt.label}</option>`).join('')}</select>
        </div>

        <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text2);">
          <input type="checkbox" id="theory-toggle" />
          Show Why This Works
        </label>

        <div id="diatonic-list" class="prog-diatonic-grid"></div>

        <div>
          <div class="df-label" style="margin-bottom:8px;">Common Progressions</div>
          <div id="prog-buttons" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>

        <div id="practice-panel" class="df-card prog-practice-panel"></div>
        <div id="progression-output" class="prog-output"></div>
      </div>
    `;

    this._bind(app);
  },

  _bind(container) {
    window.bindHelpCards(container);

    const keyEl = container.querySelector('#prog-key');
    const diatonicEl = container.querySelector('#diatonic-list');
    const buttonsEl = container.querySelector('#prog-buttons');
    const outputEl = container.querySelector('#progression-output');
    const theoryToggleEl = container.querySelector('#theory-toggle');
    const practicePanelEl = container.querySelector('#practice-panel');
    const leftHanded = window.Utils?.isLeftHanded?.() || false;
    const functionByNumeral = { I: 'Tonic (home)', i: 'Tonic (home)', IV: 'Subdominant (movement)', iv: 'Subdominant (movement)', V: 'Dominant (tension)', v: 'Dominant (tension)' };

    let activeProgression = null;
    let activeChordIndex = 0;
    let modeState = 'stopped';
    let countInBeatsDone = 0;
    let progressionBeatsDone = 0;
    let practiceTickOffset = 0;

    let practiceModeEnabled = localStorage.getItem('df_practice_mode_enabled') === '1';
    let bpm = getInt('df_last_bpm', 80);
    let beatsPerChord = getInt('df_practice_beats_per_chord', 4);
    let loopEnabled = localStorage.getItem('df_practice_loop_enabled') !== '0';
    let countInEnabled = localStorage.getItem('df_practice_countin_enabled') !== '0';
    let countInBars = getInt('df_practice_countin_bars', 1);

    const stopMetronome = () => {
      window.FFMetronome.stopMetronome();
    };

    const getCountInBeatsTotal = () => (countInEnabled ? countInBars * 4 : 0);

    const pausePractice = () => {
      if (modeState !== 'countin' && modeState !== 'playing') return;
      stopMetronome();
      modeState = 'paused';
      renderPracticePanel();
      renderOutput();
    };

    const stopPractice = () => {
      stopMetronome();
      modeState = 'stopped';
      activeChordIndex = 0;
      countInBeatsDone = 0;
      progressionBeatsDone = 0;
      renderPracticePanel();
      renderOutput();
    };

    const startPractice = ({ forceTwoBarsCountIn = false } = {}) => {
      if (!activeProgression || !practiceModeEnabled) return;

      const countInBarsToUse = forceTwoBarsCountIn ? 2 : countInBars;
      const countInBeats = countInEnabled ? countInBarsToUse * 4 : 0;
      const wasStopped = modeState === 'stopped';
      if (wasStopped) {
        activeChordIndex = 0;
        progressionBeatsDone = 0;
        countInBeatsDone = 0;
      }

      modeState = countInBeats > 0 && countInBeatsDone < countInBeats ? 'countin' : 'playing';
      practiceTickOffset = countInBeatsDone + progressionBeatsDone;

      window.FFMetronome.startMetronome({
        bpm,
        subdivision: 4,
        accent: true,
        onTick: (tickBeat) => {
          const absolutePracticeBeat = practiceTickOffset + tickBeat + 1;
          if (countInBeatsDone < countInBeats) {
            countInBeatsDone = Math.min(countInBeats, absolutePracticeBeat);
            modeState = countInBeatsDone < countInBeats ? 'countin' : 'playing';
            renderPracticePanel();
            renderOutput();
            return;
          }

          modeState = 'playing';
          progressionBeatsDone += 1;

          if (progressionBeatsDone > 0 && progressionBeatsDone % beatsPerChord === 0) {
            const nextIndex = activeChordIndex + 1;
            if (nextIndex >= activeProgression.length) {
              if (loopEnabled) activeChordIndex = 0;
              else {
                stopPractice();
                return;
              }
            } else {
              activeChordIndex = nextIndex;
            }
          }

          renderPracticePanel();
          renderOutput();
        },
      });

      renderPracticePanel();
      renderOutput();
    };

    const renderPracticePanel = () => {
      const statusText = modeState === 'countin'
        ? 'Count-in…'
        : modeState === 'playing'
          ? 'Playing…'
          : modeState === 'paused'
            ? 'Paused'
            : 'Stopped';

      practicePanelEl.innerHTML = `
        <div style="font-family:var(--f-mono);font-size:15px;">Practice Mode</div>
        <div class="prog-practice-grid">
          <label><input type="checkbox" id="practice-toggle" ${practiceModeEnabled ? 'checked' : ''}/> Practice Mode</label>
          <label>BPM <input id="practice-bpm" class="df-input" type="number" min="30" max="240" value="${bpm}"/></label>
          <label>Beats / chord
            <select id="practice-beats" class="df-input">
              ${[2, 4, 8].map((v) => `<option value="${v}" ${v === beatsPerChord ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </label>
          <label><input type="checkbox" id="practice-loop" ${loopEnabled ? 'checked' : ''}/> Loop</label>
          <label><input type="checkbox" id="practice-countin" ${countInEnabled ? 'checked' : ''}/> Count-in</label>
          <label>Count-in bars
            <select id="practice-countin-bars" class="df-input" ${countInEnabled ? '' : 'disabled'}>
              ${[1, 2, 3, 4].map((v) => `<option value="${v}" ${v === countInBars ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="df-btn df-btn--primary" id="practice-start" ${!practiceModeEnabled || !activeProgression ? 'disabled' : ''}>Start</button>
          <button class="df-btn df-btn--outline" id="practice-pause" ${modeState === 'countin' || modeState === 'playing' ? '' : 'disabled'}>Pause</button>
          <button class="df-btn df-btn--outline" id="practice-stop" ${modeState === 'stopped' ? 'disabled' : ''}>Stop</button>
          <button class="df-btn df-btn--outline" id="practice-start-2bar" ${!practiceModeEnabled || !activeProgression ? 'disabled' : ''}>Start with 2-bar count-in</button>
        </div>
        <div style="color:var(--text2);font-size:13px;">Highlight moves every ${beatsPerChord} beats.</div>
        <div style="font-family:var(--f-mono);font-size:12px;color:var(--accent);">${statusText}</div>
      `;

      practicePanelEl.querySelector('#practice-toggle').addEventListener('change', (e) => {
        practiceModeEnabled = e.target.checked;
        localStorage.setItem('df_practice_mode_enabled', practiceModeEnabled ? '1' : '0');
        if (!practiceModeEnabled) stopPractice();
        else renderPracticePanel();
      });

      practicePanelEl.querySelector('#practice-bpm').addEventListener('change', (e) => {
        bpm = Math.max(30, Math.min(240, parseInt(e.target.value, 10) || 80));
        localStorage.setItem('df_last_bpm', String(bpm));
        if (modeState === 'countin' || modeState === 'playing') startPractice();
        else renderPracticePanel();
      });

      practicePanelEl.querySelector('#practice-beats').addEventListener('change', (e) => {
        beatsPerChord = parseInt(e.target.value, 10);
        localStorage.setItem('df_practice_beats_per_chord', String(beatsPerChord));
        renderPracticePanel();
      });

      practicePanelEl.querySelector('#practice-loop').addEventListener('change', (e) => {
        loopEnabled = e.target.checked;
        localStorage.setItem('df_practice_loop_enabled', loopEnabled ? '1' : '0');
      });

      practicePanelEl.querySelector('#practice-countin').addEventListener('change', (e) => {
        countInEnabled = e.target.checked;
        localStorage.setItem('df_practice_countin_enabled', countInEnabled ? '1' : '0');
        renderPracticePanel();
      });

      practicePanelEl.querySelector('#practice-countin-bars').addEventListener('change', (e) => {
        countInBars = parseInt(e.target.value, 10);
        localStorage.setItem('df_practice_countin_bars', String(countInBars));
      });

      practicePanelEl.querySelector('#practice-start').addEventListener('click', () => startPractice());
      practicePanelEl.querySelector('#practice-start-2bar').addEventListener('click', () => {
        countInBeatsDone = 0;
        progressionBeatsDone = 0;
        activeChordIndex = 0;
        startPractice({ forceTwoBarsCountIn: true });
      });
      practicePanelEl.querySelector('#practice-pause').addEventListener('click', pausePractice);
      practicePanelEl.querySelector('#practice-stop').addEventListener('click', stopPractice);
    };

    const renderOutput = () => {
      const [root, mode] = keyEl.value.split('|');
      const scale = getScale(root, mode);
      const showTheory = theoryToggleEl.checked;

      if (!activeProgression) {
        outputEl.innerHTML = '<div style="color:var(--text2);">Pick a progression to render playable chord diagrams.</div>';
        return;
      }

      const chordLookup = Object.fromEntries(scale.map((item) => [item.numeral, item]));
      const chords = activeProgression.map((roman) => chordLookup[roman]).filter(Boolean);

      outputEl.innerHTML = `
        <div style="font-family:var(--f-mono);">${activeProgression.join(' – ')}</div>
        <div class="prog-chord-row">
          ${chords.map((chord, idx) => {
            const shape = window.FF_getChordShape(chord.note, chord.shapeType);
            const role = functionByNumeral[chord.numeral] || '';
            const activeClass = practiceModeEnabled && modeState !== 'stopped' && idx === activeChordIndex ? 'prog-chord-card--active' : '';
            return `
              <div class="prog-chord-card ${activeClass} ${showTheory && role ? 'prog-chord-card--theory' : ''}">
                <div style="font-family:var(--f-mono);font-size:13px;color:var(--text3);">${chord.numeral}</div>
                <div style="margin-bottom:6px;">${chord.chordName}</div>
                <div>${window.renderChordSvg(shape, { leftHanded, showStringLabels: false, height: 170, markerRadius: 6 })}</div>
                ${showTheory && role ? `<div class="prog-note">${role}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    };

    const renderState = () => {
      const [root, mode] = keyEl.value.split('|');
      const scale = getScale(root, mode);
      const progressionSet = mode === 'major' ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
      const showTheory = theoryToggleEl.checked;

      localStorage.setItem('df_last_key_root', root);
      localStorage.setItem('df_last_key_mode', mode);

      diatonicEl.innerHTML = scale.map((item) => {
        const role = functionByNumeral[item.numeral] || '';
        const roleClass = /^I$|^i$/.test(item.numeral) ? 'prog-role--tonic' : /^V$|^v$/.test(item.numeral) ? 'prog-role--dominant' : /^IV$|^iv$/.test(item.numeral) ? 'prog-role--sub' : '';
        return `
          <div class="prog-diatonic-item ${showTheory ? roleClass : ''}">
            <div style="font-family:var(--f-mono);font-size:13px;color:var(--text3);">${item.numeral}</div>
            <div>${item.chordName}</div>
            ${showTheory && role ? `<div class="prog-note">${role}</div>` : ''}
          </div>
        `;
      }).join('');

      buttonsEl.innerHTML = progressionSet.map((progression) => {
        const isActive = activeProgression && progression.roman.join(',') === activeProgression.join(',');
        return `<button class="df-btn df-btn--outline ${isActive ? 'active' : ''}" data-prog="${progression.roman.join(',')}">${progression.label}</button>`;
      }).join('');

      buttonsEl.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          activeProgression = btn.dataset.prog.split(',');
          activeChordIndex = 0;
          countInBeatsDone = 0;
          progressionBeatsDone = 0;
          modeState = 'stopped';
          renderState();
        });
      });

      renderPracticePanel();
      renderOutput();
    };

    keyEl.addEventListener('change', () => {
      activeProgression = null;
      stopPractice();
      renderState();
    });
    theoryToggleEl.addEventListener('change', renderState);

    const observer = new MutationObserver(() => {
      if (!container.contains(keyEl)) {
        stopMetronome();
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });

    renderState();
  },
};
