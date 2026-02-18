// Daily Fret — Chords Tool

window.Pages = window.Pages || {};

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD_SHAPES = {
  C: {
    major: { name: 'C', frets: ['x', 3, 2, 0, 1, 0], fingers: ['x', 3, 2, 0, 1, 0], barre: null },
    minor: { name: 'Cm', frets: ['x', 3, 5, 5, 4, 3], fingers: ['x', 1, 3, 4, 2, 1], barre: 'Barre on fret 3 (strings 5-1)' },
    7: { name: 'C7', frets: ['x', 3, 2, 3, 1, 0], fingers: ['x', 3, 2, 4, 1, 0], barre: null },
  },
  D: {
    major: { name: 'D', frets: ['x', 'x', 0, 2, 3, 2], fingers: ['x', 'x', 0, 1, 3, 2], barre: null },
    minor: { name: 'Dm', frets: ['x', 'x', 0, 2, 3, 1], fingers: ['x', 'x', 0, 2, 3, 1], barre: null },
    7: { name: 'D7', frets: ['x', 'x', 0, 2, 1, 2], fingers: ['x', 'x', 0, 2, 1, 3], barre: null },
  },
  E: {
    major: { name: 'E', frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barre: null },
    minor: { name: 'Em', frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barre: null },
    7: { name: 'E7', frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], barre: null },
  },
  G: {
    major: { name: 'G', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barre: null },
    minor: { name: 'Gm', frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: 'Barre on fret 3 (strings 6-1)' },
    7: { name: 'G7', frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], barre: null },
  },
  A: {
    major: { name: 'A', frets: ['x', 0, 2, 2, 2, 0], fingers: ['x', 0, 1, 2, 3, 0], barre: null },
    minor: { name: 'Am', frets: ['x', 0, 2, 2, 1, 0], fingers: ['x', 0, 2, 3, 1, 0], barre: null },
    7: { name: 'A7', frets: ['x', 0, 2, 0, 2, 0], fingers: ['x', 0, 2, 0, 3, 0], barre: null },
  },
};

Pages.Chords = {
  render() {
    const app = document.getElementById('app');

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
          title: 'How to read chord diagrams',
          description: 'These diagrams are shown in playing view: low E string at the bottom, high e string at the top.',
          bullets: ['Dots are fretted notes.', '“X” means do not play that string.', '“O” means play open string.', 'A barre means one finger presses multiple strings.'],
          storageKey: 'df_help_tool_chords',
        })}

        <div class="df-field">
          <label class="df-label" for="chord-root">Root</label>
          <select id="chord-root" class="df-input">${ROOTS.map((root) => `<option value="${root}">${root}</option>`).join('')}</select>
        </div>

        <div class="df-field">
          <label class="df-label" for="chord-type">Chord Type</label>
          <select id="chord-type" class="df-input">
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="7">Dominant 7</option>
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

    const renderChord = () => {
      const root = rootEl.value;
      const type = typeEl.value;
      const leftHanded = window.Utils?.isLeftHanded?.() || false;
      const shape = CHORD_SHAPES[root]?.[type];

      if (!shape) {
        nameEl.textContent = `${root} ${type}`;
        svgEl.innerHTML = '<div style="color:var(--text2);">No static shape in this phase for that selection.</div>';
        fingersEl.textContent = '';
        return;
      }

      nameEl.textContent = `${shape.name}${leftHanded ? ' (left-handed)' : ''}`;
      fingersEl.textContent = `Finger hints: ${shape.fingers.join(' ')}${shape.barre ? ` • ${shape.barre}` : ''}`;
      svgEl.innerHTML = this._buildChordSvg(shape, leftHanded);
    };

    rootEl.addEventListener('change', renderChord);
    typeEl.addEventListener('change', renderChord);
    renderChord();
  },

  _buildChordSvg(shape, leftHanded) {
    const width = 300;
    const height = 260;
    const left = 42;
    const top = 32;
    const stringGap = 40;
    const fretGap = 34;
    const strings = ['E', 'A', 'D', 'G', 'B', 'e'];

    const indexToX = (i) => left + (leftHanded ? (5 - i) : i) * stringGap;
    const indexToY = (i) => top + (5 - i) * fretGap;

    const stringLines = strings.map((_, i) => {
      const y = indexToY(i);
      return `<line x1="${left}" y1="${y}" x2="${left + stringGap * 5}" y2="${y}" stroke="var(--line2)" stroke-width="2" />`;
    }).join('');

    const fretLines = Array.from({ length: 5 }, (_, i) => {
      const x = left + i * stringGap;
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + fretGap * 5}" stroke="var(--line2)" stroke-width="${i === 0 ? 4 : 2}" />`;
    }).join('');

    const markers = shape.frets.map((fret, i) => {
      const y = indexToY(i);
      if (fret === 'x') return `<text x="16" y="${y + 4}" text-anchor="middle" fill="var(--text2)" font-size="14">X</text>`;
      if (fret === 0) return `<text x="16" y="${y + 4}" text-anchor="middle" fill="var(--text2)" font-size="14">O</text>`;
      const x = left + (fret - 0.5) * stringGap;
      return `<circle cx="${x}" cy="${y}" r="10" fill="var(--accent)" />`;
    }).join('');

    const labels = strings.map((name, i) => `<text x="${left - 18}" y="${indexToY(i) + 4}" text-anchor="middle" fill="var(--text2)" font-size="12">${name}</text>`).join('');

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="240" role="img" aria-label="Chord diagram">
        ${stringLines}
        ${fretLines}
        ${markers}
        ${labels}
      </svg>
    `;
  },
};
