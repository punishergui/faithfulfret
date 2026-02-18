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

Pages.Progressions = {
  render() {
    const app = document.getElementById('app');
    const keyOptions = [
      ...CHROMATIC.map((note) => ({ value: `${note}|major`, label: `${toNoteName(note)} Major` })),
      ...CHROMATIC.map((note) => ({ value: `${note}|minor`, label: `${toNoteName(note)} Minor` })),
    ];

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
          title: 'Progressions quick guide',
          description: 'Choose a key to map diatonic chords, then click a progression to practice.',
          bullets: ['Major and minor keys are calculated dynamically.', 'Roman numerals show chord function in any key.', 'Use the same numeral pattern to transpose instantly.'],
          storageKey: 'df_help_tool_progressions',
        })}

        <div class="df-field">
          <label class="df-label" for="prog-key">Key</label>
          <select id="prog-key" class="df-input">${keyOptions.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('')}</select>
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

        <div id="progression-output" class="prog-output"></div>

        <div class="df-card" style="padding:14px;display:grid;gap:8px;">
          <div style="font-family:var(--f-mono);font-size:15px;">Theory explanation layer</div>
          <ul style="margin:0;padding-left:18px;color:var(--text2);line-height:1.45;">
            <li>Roman numerals are scale-degree numbers, so one pattern fits every key.</li>
            <li>Uppercase numerals are major chords; lowercase numerals are minor chords.</li>
            <li>V creates tension (dominant), and I resolves tension back home (tonic).</li>
            <li>vi feels emotional because it shares tones with I but shifts the center darker.</li>
            <li>Transpose by keeping numerals the same and changing only the key.</li>
          </ul>
        </div>
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
    const leftHanded = window.Utils?.isLeftHanded?.() || false;
    const functionByNumeral = { I: 'Tonic (home)', i: 'Tonic (home)', IV: 'Subdominant (movement)', iv: 'Subdominant (movement)', V: 'Dominant (tension)', v: 'Dominant (tension)' };
    let activeProgression = null;

    const renderState = () => {
      const [root, mode] = keyEl.value.split('|');
      const scale = getScale(root, mode);
      const progressionSet = mode === 'major' ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
      const showTheory = theoryToggleEl.checked;

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
          renderState();
        });
      });

      if (!activeProgression) {
        outputEl.innerHTML = '<div style="color:var(--text2);">Pick a progression to render playable chord diagrams.</div>';
        return;
      }

      const chordLookup = Object.fromEntries(scale.map((item) => [item.numeral, item]));
      const chords = activeProgression.map((roman) => chordLookup[roman]).filter(Boolean);

      outputEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="font-family:var(--f-mono);">${activeProgression.join(' – ')}</div>
          <button class="df-btn df-btn--outline" id="play-placeholder">▶ Practice Loop (placeholder)</button>
        </div>
        <div class="prog-chord-row">
          ${chords.map((chord) => {
            const shape = window.FF_getChordShape(chord.note, chord.shapeType);
            const role = functionByNumeral[chord.numeral] || '';
            return `
              <div class="prog-chord-card ${showTheory && role ? 'prog-chord-card--theory' : ''}">
                <div style="font-family:var(--f-mono);font-size:13px;color:var(--text3);">${chord.numeral}</div>
                <div style="margin-bottom:6px;">${chord.chordName}</div>
                <div>${window.renderChordSvg(shape, { leftHanded, showStringLabels: false, height: 170, markerRadius: 6 })}</div>
                ${showTheory && role ? `<div class="prog-note">${role}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;

      const playBtn = outputEl.querySelector('#play-placeholder');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          playBtn.textContent = 'Loop coming soon';
          setTimeout(() => { playBtn.textContent = '▶ Practice Loop (placeholder)'; }, 1200);
        });
      }
    };

    keyEl.addEventListener('change', () => {
      activeProgression = null;
      renderState();
    });
    theoryToggleEl.addEventListener('change', renderState);

    renderState();
  },
};
