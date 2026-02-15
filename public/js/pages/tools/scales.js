// Daily Fret — Scale Reference

window.Pages = window.Pages || {};

const SCALES = {
  'E Minor Pentatonic': {
    type: 'pent-minor',
    strings: { 0:[0,3], 1:[0,3], 2:[0,2], 3:[0,2], 4:[2,5], 5:[0,3] },
    roots:   { 0:[0], 5:[0] },
    desc: 'Box 1 — the foundation of rock and blues. Learn this first.',
  },
  'A Minor Pentatonic': {
    type: 'pent-minor',
    strings: { 0:[0,3], 1:[1,3], 2:[0,2], 3:[0,2], 4:[0,2], 5:[0,3] },
    roots:   { 0:[0], 1:[1] },
    desc: 'Box 1 — most-used soloing pattern in rock and blues.',
  },
  'G Major Scale': {
    type: 'major',
    strings: { 0:[0,2,3], 1:[0,2,3], 2:[0,2], 3:[0,2,4], 4:[0,2,4], 5:[0,2,3] },
    roots:   {},
    desc: 'Open position major scale. Essential for understanding harmony.',
  },
  'C Major Pentatonic': {
    type: 'pent-major',
    strings: { 0:[0,3], 1:[0,3], 2:[0,2], 3:[0,2], 4:[3,5], 5:[0,3] },
    roots:   {},
    desc: 'Major pentatonic — bright, happy sound. Country and pop staple.',
  },
  'E Blues Scale': {
    type: 'blues',
    strings: { 0:[0,3], 1:[0,3], 2:[0,2], 3:[0,2,4], 4:[2,5], 5:[0,2,3] },
    roots:   { 0:[0], 5:[0] },
    desc: 'Minor pentatonic + flat 5. The core of blues guitar.',
  },
};

Pages.Scales = {
  render() {
    const app = document.getElementById('app');

    const typeColor = {
      'pent-minor': '#5599ff',
      'pent-major': 'var(--green)',
      'major':      'var(--accent)',
      'blues':      'var(--yellow)',
    };

    const typeLabel = {
      'pent-minor': 'Minor Pentatonic',
      'pent-major': 'Major Pentatonic',
      'major':      'Major Scale',
      'blues':      'Blues Scale',
    };

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div class="page-title">Scales</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap">
        <div class="scale-grid">
          ${Object.entries(SCALES).map(([name, scale]) => `
            <button class="scale-btn scale-btn--${scale.type}" data-scale="${name}"
              style="border-top-color:${typeColor[scale.type]};">
              ${name}
            </button>
          `).join('')}
        </div>

        <!-- Type legend -->
        <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
          ${Object.entries({ 'Minor Pentatonic': '#5599ff', 'Major Pentatonic': 'var(--green)', 'Major Scale': 'var(--accent)', 'Blues Scale': 'var(--yellow)' }).map(([label, color]) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:12px;height:12px;background:${color};"></div>
              <span style="font-family:var(--f-mono);font-size:9px;color:var(--text3);letter-spacing:0.08em;text-transform:uppercase;">${label}</span>
            </div>
          `).join('')}
        </div>

        <div id="scale-display" style="display:none;" class="scale-display">
          <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start;">
            <div class="scale-display__name" id="scale-name"></div>
            <div id="scale-diagram"></div>
            <div class="scale-display__desc" id="scale-desc"></div>
          </div>
          <div>
            <div style="background:var(--bg1);border:1px solid var(--line2);padding:16px;margin-top:8px;">
              <div style="font-family:var(--f-mono);font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Legend</div>
              <div style="display:flex;gap:20px;font-family:var(--f-mono);font-size:12px;flex-wrap:wrap;">
                <span><svg width="16" height="16" style="vertical-align:middle;margin-right:4px;"><circle cx="8" cy="8" r="7" fill="#ff6a00"/></svg>Root note</span>
                <span><svg width="16" height="16" style="vertical-align:middle;margin-right:4px;"><circle cx="8" cy="8" r="7" fill="#1e2a50" stroke="#5599ff" stroke-width="2"/></svg>Scale tone</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Select first scale by default
    const firstScale = Object.keys(SCALES)[0];
    this._showScale(app, firstScale);

    // Bind scale buttons
    app.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._showScale(app, btn.dataset.scale);
      });
    });

    // Auto-select first button
    app.querySelector(`[data-scale="${firstScale}"]`)?.classList.add('active');
  },

  _showScale(container, name) {
    const scale = SCALES[name];
    if (!scale) return;

    const display = container.querySelector('#scale-display');
    display.style.display = 'grid';

    container.querySelector('#scale-name').textContent = name;
    container.querySelector('#scale-diagram').innerHTML = this._buildFretboard(scale);
    container.querySelector('#scale-desc').textContent = scale.desc;
  },

  _buildFretboard(scale) {
    const SX = 35;    // left margin for string names
    const SY = 28;    // top margin for fret numbers
    const SS = 32;    // string spacing (vertical)
    const FS = 72;    // fret spacing (horizontal)
    const STRINGS = 6;
    const FRETS = 6;  // positions 0-5
    const DOT_R = 9;

    const W = SX + FS * (FRETS - 1) + 30;
    const H = SY + SS * (STRINGS - 1) + 28;

    // x coord of fret fi (0=open, 1-5=fretted)
    const fx = fi => SX + fi * FS;
    // y coord of string si (0=high-e, 5=low-E)
    const sy = si => SY + si * SS;

    const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E']; // high to low

    const parts = [];

    // Background
    // Fret numbers along the top
    for (let fi = 0; fi < FRETS; fi++) {
      parts.push(`<text x="${fx(fi)}" y="${SY - 10}" font-family="JetBrains Mono,monospace" font-size="11" fill="#3a3a34" text-anchor="middle">${fi}</text>`);
    }

    // Nut (thick vertical line at fret 0 position — left edge of fretboard)
    parts.push(`<line x1="${fx(0)}" y1="${sy(0)}" x2="${fx(0)}" y2="${sy(STRINGS-1)}" stroke="#d8d8cf" stroke-width="4"/>`);

    // Fret lines (fi 1-5)
    for (let fi = 1; fi < FRETS; fi++) {
      parts.push(`<line x1="${fx(fi)}" y1="${sy(0)}" x2="${fx(fi)}" y2="${sy(STRINGS-1)}" stroke="#2a2a28" stroke-width="1.5"/>`);
    }

    // String lines
    for (let si = 0; si < STRINGS; si++) {
      const thickness = si === 0 ? 1 : si < 3 ? 1.5 : 2;
      parts.push(`<line x1="${fx(0)}" y1="${sy(si)}" x2="${fx(FRETS-1)}" y2="${sy(si)}" stroke="#3a3a34" stroke-width="${thickness}"/>`);
    }

    // String names on the left
    for (let si = 0; si < STRINGS; si++) {
      parts.push(`<text x="${SX - 10}" y="${sy(si) + 4}" font-family="JetBrains Mono,monospace" font-size="11" fill="#6a6a60" text-anchor="middle">${STRING_NAMES[si]}</text>`);
    }

    // Note markers
    for (let si = 0; si < STRINGS; si++) {
      const notes = scale.strings[si] || [];
      const roots = scale.roots[si] || [];

      for (const fi of notes) {
        const x = fx(fi);
        const y = sy(si);

        if (roots.includes(fi)) {
          // Root: orange filled
          parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R}" fill="#ff6a00"/>`);
          parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R + 4}" fill="none" stroke="rgba(255,106,0,0.3)" stroke-width="1.5"/>`);
        } else {
          // Scale tone: blue-tinted
          parts.push(`<circle cx="${x}" cy="${y}" r="${DOT_R}" fill="#1e2a50" stroke="#5599ff" stroke-width="2"/>`);
        }
      }
    }

    // Fret number footer
    for (let fi = 0; fi < FRETS; fi++) {
      parts.push(`<text x="${fx(fi)}" y="${H - 4}" font-family="JetBrains Mono,monospace" font-size="11" fill="#2a2a28" text-anchor="middle">${fi}</text>`);
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:var(--bg1);border:1px solid var(--line2);overflow:visible;">${parts.join('')}</svg>`;
  },
};
