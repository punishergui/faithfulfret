// Daily Fret — Scales Tool

window.Pages = window.Pages || {};

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonicMinor: [0, 3, 5, 7, 10],
};

const SCALE_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const STRING_OPEN_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];

Pages.Scales = {
  render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Scales</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap" style="display:grid;gap:14px;">
        <div class="df-field">
          <label class="df-label" for="scale-type">Scale Type</label>
          <select id="scale-type" class="df-input">
            <option value="major">Major</option>
            <option value="minor">Natural Minor</option>
            <option value="pentatonicMinor">Minor Pentatonic</option>
          </select>
        </div>

        <div class="df-field">
          <label class="df-label" for="scale-key">Key</label>
          <select id="scale-key" class="df-input">${SCALE_KEYS.map((key) => `<option value="${key}">${key}</option>`).join('')}</select>
        </div>

        <div id="scale-title" style="font-family:var(--f-mono);font-size:16px;"></div>
        <div id="scale-svg" style="border:1px solid var(--line2);background:var(--bg1);padding:12px;"></div>
      </div>
    `;

    this._bind(app);
  },

  _bind(container) {
    const typeEl = container.querySelector('#scale-type');
    const keyEl = container.querySelector('#scale-key');
    const titleEl = container.querySelector('#scale-title');
    const svgEl = container.querySelector('#scale-svg');

    const renderScale = () => {
      const type = typeEl.value;
      const key = keyEl.value;
      titleEl.textContent = `${key} ${type === 'pentatonicMinor' ? 'Minor Pentatonic' : type === 'minor' ? 'Minor' : 'Major'}`;
      svgEl.innerHTML = this._buildScaleSvg(key, SCALE_INTERVALS[type] || SCALE_INTERVALS.major);
    };

    keyEl.addEventListener('change', renderScale);
    typeEl.addEventListener('change', renderScale);
    renderScale();
  },

  _buildScaleSvg(key, intervals) {
    const width = 660;
    const height = 230;
    const margin = 24;
    const stringGap = 34;
    const fretGap = 50;
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

    const markers = [];
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      const openIndex = NOTE_INDEX[STRING_OPEN_NOTES[stringIdx]];
      const y = margin + stringIdx * stringGap;
      for (let fret = 0; fret <= maxFrets; fret++) {
        const noteIndex = (openIndex + fret) % 12;
        if (!scaleNotes.has(noteIndex)) continue;
        const x = margin + fret * fretGap;
        const isRoot = noteIndex === rootIndex;
        markers.push(`<circle cx="${x}" cy="${y}" r="${isRoot ? 9 : 6}" fill="${isRoot ? 'var(--accent)' : 'var(--text2)'}" />`);
      }
    }

    const fretLabels = Array.from({ length: maxFrets + 1 }, (_, fret) => `<text x="${margin + fret * fretGap}" y="${height - 10}" text-anchor="middle" fill="var(--text3)" font-size="11">${fret}</text>`).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="230" role="img" aria-label="Scale fretboard diagram">
        ${stringLines}
        ${fretLines}
        ${markers.join('')}
        ${fretLabels}
      </svg>
    `;
  },
};
