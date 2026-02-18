// Daily Fret — Scales Tool

window.Pages = window.Pages || {};

const SCALE_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const STRING_OPEN_NOTES = ['E', 'A', 'D', 'G', 'B', 'E'];
const STRING_LABELS = ['6 (Low E)', '5 (A)', '4 (D)', '3 (G)', '2 (B)', '1 (High e)'];

Pages.Scales = {
  render() {
    const app = document.getElementById('app');
    const scales = window.FF_SCALES || [];

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
            ${scales.map((scale) => `<option value="${scale.id}">${scale.name}</option>`).join('')}
          </select>
        </div>

        <div class="df-field">
          <label class="df-label" for="scale-key">Key</label>
          <select id="scale-key" class="df-input">${SCALE_KEYS.map((key) => `<option value="${key}">${key}</option>`).join('')}</select>
        </div>

        <div id="scale-title" style="font-family:var(--f-mono);font-size:16px;"></div>
        <div id="scale-svg" style="border:1px solid var(--line2);background:var(--bg1);padding:12px;"></div>
        <div id="scale-help"></div>
      </div>
    `;

    this._bind(app);
  },

  _bind(container) {
    const scales = window.FF_SCALES || [];
    const typeEl = container.querySelector('#scale-type');
    const keyEl = container.querySelector('#scale-key');
    const titleEl = container.querySelector('#scale-title');
    const svgEl = container.querySelector('#scale-svg');
    const helpEl = container.querySelector('#scale-help');

    const renderScale = () => {
      const scale = scales.find((item) => item.id === typeEl.value) || scales[0];
      if (!scale) return;
      const key = keyEl.value;
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
        storageKey: 'df_help_tool_scales',
      });
      window.bindHelpCards(helpEl);
    };

    keyEl.addEventListener('change', renderScale);
    typeEl.addEventListener('change', renderScale);
    renderScale();
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
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      const openIndex = NOTE_INDEX[STRING_OPEN_NOTES[stringIdx]];
      const y = margin + stringIdx * stringGap;
      for (let fret = 0; fret <= maxFrets; fret++) {
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
