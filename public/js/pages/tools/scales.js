// Daily Fret — Scale Reference

window.Pages = window.Pages || {};

const SCALES = {
  'E Minor Pentatonic': {
    strings: { 0:[0,3], 1:[0,3], 2:[0,2], 3:[0,2], 4:[2,5], 5:[0,3] },
    roots:   { 0:[0], 5:[0] },
    desc: 'Box 1 — the foundation of rock and blues. Learn this first.',
  },
  'A Minor Pentatonic': {
    strings: { 0:[0,3], 1:[1,3], 2:[0,2], 3:[0,2], 4:[0,2], 5:[0,3] },
    roots:   { 0:[0], 1:[1] },
    desc: 'Box 1 — most-used soloing pattern in rock and blues.',
  },
  'G Major Scale': {
    strings: { 0:[0,2,3], 1:[0,2,3], 2:[0,2], 3:[0,2,4], 4:[0,2,4], 5:[0,2,3] },
    roots:   {},
    desc: 'Open position major scale. Essential for understanding harmony.',
  },
  'C Major Pentatonic': {
    strings: { 0:[0,3], 1:[0,3], 2:[0,2], 3:[0,2], 4:[3,5], 5:[0,3] },
    roots:   {},
    desc: 'Major pentatonic — bright, happy sound. Country and pop staple.',
  },
  'E Blues Scale': {
    strings: { 0:[0,3], 1:[0,3], 2:[0,2], 3:[0,2,4], 4:[2,5], 5:[0,2,3] },
    roots:   { 0:[0], 5:[0] },
    desc: 'Minor pentatonic + flat 5. The core of blues guitar.',
  },
};

Pages.Scales = {
  render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div class="page-title">Scales</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap">
        <div class="df-field scale-select">
          <label class="df-label" for="scale-picker">Scale Pattern</label>
          <select id="scale-picker" class="df-input">
            ${Object.keys(SCALES).map(name => `<option value="${name}">${name}</option>`).join('')}
          </select>
        </div>

        <div class="scale-fretboard" id="scale-fretboard"></div>
        <div class="scale-desc" id="scale-desc"></div>

        <div style="margin-top:24px;background:var(--bg1);border:1px solid var(--line2);padding:16px;">
          <div style="font-family:var(--f-mono);font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">Legend</div>
          <div style="display:flex;gap:20px;font-family:var(--f-mono);font-size:12px;">
            <span><span style="color:var(--accent);">●</span> Root note</span>
            <span><span style="color:var(--text2);">○</span> Scale tone</span>
            <span><span style="color:var(--text3);">─</span> Open string / No note</span>
          </div>
        </div>
      </div>
    `;

    const picker = app.querySelector('#scale-picker');
    const showScale = (name) => {
      const scale = SCALES[name];
      if (!scale) return;
      app.querySelector('#scale-fretboard').innerHTML = this._buildFretboard(scale);
      app.querySelector('#scale-desc').textContent = scale.desc;
    };

    picker.addEventListener('change', () => showScale(picker.value));
    showScale(picker.value);
  },

  _buildFretboard(scale) {
    const FRETS = 6; // frets 0-5
    const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']; // high e to low E

    // String indices in our data: 0=e(high), 1=B, 2=G, 3=D, 4=A, 5=E(low)
    // Display top-to-bottom: e, B, G, D, A, E

    let header = '     ';
    for (let f = 0; f <= FRETS - 1; f++) {
      header += f.toString().padEnd(5, ' ');
    }

    let rows = [header];

    for (let si = 0; si < 6; si++) {
      const strName = STRING_NAMES[si].padEnd(2, ' ');
      const notesOnString = scale.strings[si] || [];
      const rootsOnString = (scale.roots[si] || []);

      let row = strName + ' ';
      for (let f = 0; f < FRETS; f++) {
        if (notesOnString.includes(f)) {
          if (rootsOnString.includes(f)) {
            row += '<span style="color:var(--accent);text-shadow:0 0 8px var(--glow);">●</span>    ';
          } else {
            row += '<span style="color:var(--text2);">○</span>    ';
          }
        } else {
          row += '<span style="color:var(--text3);">─</span>    ';
        }
      }

      rows.push(row);
    }

    // Fret number footer
    let footer = '     ';
    for (let f = 0; f < FRETS; f++) {
      footer += f.toString().padEnd(5, ' ');
    }
    rows.push(footer);

    return rows.join('\n');
  },
};
