// Daily Fret — Chord Reference

window.Pages = window.Pages || {};

const CHORDS = {
  'Em':    { frets: '022000', fingers: 'x x 2 2 0 0', type: 'minor',    tip: 'First chord most players learn. Practice transitioning to Am.' },
  'Am':    { frets: 'x02210', fingers: 'x 0 2 2 1 0', type: 'minor',    tip: 'The companion to Em. Em → Am is the most common progression.' },
  'Dm':    { frets: 'xx0231', fingers: 'x x 0 2 3 1', type: 'minor',    tip: 'Triangle shape. Common in pop and folk.' },
  'C':     { frets: 'x32010', fingers: 'x 3 2 0 1 0', type: 'major',    tip: 'Essential open chord. Keep your thumb behind the neck.' },
  'G':     { frets: '320003', fingers: '3 2 0 0 0 3', type: 'major',    tip: 'Use pinky on 1st string for cleaner G→C transitions.' },
  'D':     { frets: 'xx0232', fingers: 'x x 0 2 3 2', type: 'major',    tip: 'Diamond shape. Watch that 1st string clearance.' },
  'A':     { frets: 'x02220', fingers: 'x 0 2 2 2 0', type: 'major',    tip: 'Barre all 3 middle strings with one finger.' },
  'E':     { frets: '022100', fingers: '0 2 2 1 0 0', type: 'major',    tip: 'Same shape as Em — just add 2 more fingers.' },
  'F':     { frets: '133211', fingers: '1 3 3 2 1 1', type: 'major',    tip: 'The barre chord wall. Keep index finger right behind the fret.' },
  'B7':    { frets: 'x21202', fingers: 'x 2 1 2 0 2', type: 'dominant', tip: 'Great stepping stone toward full barre chords.' },
  'G7':    { frets: '320001', fingers: '3 2 0 0 0 1', type: 'dominant', tip: 'G but with index on high E. Common in blues.' },
  'D7':    { frets: 'xx0212', fingers: 'x x 0 2 1 2', type: 'dominant', tip: 'D → D7 is a great exercise for chord transitions.' },
  'Cmaj7': { frets: 'x32000', fingers: 'x 3 2 0 0 0', type: 'maj7',     tip: 'Easier than C and sounds gorgeous. Essential in pop.' },
  'Fmaj7': { frets: 'xx3210', fingers: 'x x 3 2 1 0', type: 'maj7',     tip: 'The easy alternative to full F barre. Use it constantly.' },
  'Bm':    { frets: 'x24432', fingers: 'x 2 4 4 3 2', type: 'minor',    tip: 'Partial barre at 2nd fret. Master this one early.' },
};

Pages.Chords = {
  currentChord: null,

  render() {
    const app = document.getElementById('app');

    const typeColor = {
      major:    'var(--accent)',
      minor:    '#5599ff',
      dominant: 'var(--yellow)',
      maj7:     'var(--green)',
    };

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div class="page-title">Chords</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="chords-wrap">
        <div class="chord-grid">
          ${Object.entries(CHORDS).map(([name, chord]) => `
            <button class="chord-btn chord-btn--${chord.type}" data-chord="${name}"
              style="border-top-color:${typeColor[chord.type] || 'var(--accent)'};">
              ${name}
            </button>
          `).join('')}
        </div>

        <!-- Type legend -->
        <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
          ${Object.entries({ Major: 'var(--accent)', Minor: '#5599ff', Dominant: 'var(--yellow)', Maj7: 'var(--green)' }).map(([label, color]) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:12px;height:12px;background:${color};"></div>
              <span style="font-family:var(--f-mono);font-size:9px;color:var(--text3);letter-spacing:0.08em;text-transform:uppercase;">${label}</span>
            </div>
          `).join('')}
        </div>

        <div id="chord-display" style="display:none;" class="chord-display">
          <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start;">
            <div class="chord-display__name" id="chord-name"></div>
            <div id="chord-diagram"></div>
            <div class="chord-display__fingers" id="chord-fingers"></div>
          </div>
          <div>
            <div class="chord-display__tip" id="chord-tip"></div>
          </div>
        </div>
      </div>
    `;

    // Select first chord by default
    const firstChord = Object.keys(CHORDS)[0];
    this._showChord(app, firstChord);

    // Bind chord buttons
    app.querySelectorAll('.chord-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        app.querySelectorAll('.chord-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._showChord(app, btn.dataset.chord);
      });
    });

    // Auto-select first button
    app.querySelector(`[data-chord="${firstChord}"]`)?.classList.add('active');
  },

  _showChord(container, name) {
    const chord = CHORDS[name];
    if (!chord) return;

    const display = container.querySelector('#chord-display');
    display.style.display = 'grid';

    container.querySelector('#chord-name').textContent = name;
    container.querySelector('#chord-diagram').innerHTML = this._buildSVG(chord.frets);
    container.querySelector('#chord-fingers').textContent = 'Finger positions: ' + chord.fingers;
    container.querySelector('#chord-tip').textContent = chord.tip;
  },

  // Renders a proper SVG chord diagram.
  // frets: 6-char string, index 0 = low E ... index 5 = high e
  // Each char: 'x' = mute, '0' = open, '1'-'9' = fret number
  _buildSVG(frets) {
    const f = frets.split('');

    // Determine visible fret window
    const pressed = f.map((v, i) => (v !== 'x' && v !== '0') ? parseInt(v) : 0).filter(v => v > 0);
    const minPressed = pressed.length ? Math.min(...pressed) : 1;
    const startFret  = minPressed <= 1 ? 0 : minPressed - 1;  // 0 means show nut
    const FRETS = 4;   // fret rows shown
    const STRINGS = 6;

    // SVG layout constants
    const SX   = 40;   // left margin (room for fret-position label)
    const SY   = 50;   // top margin (room for X/O markers)
    const SW   = 22;   // string spacing (px)
    const FH   = 28;   // fret height (px)
    const W    = SX + SW * (STRINGS - 1) + 28;
    const H    = SY + FH * FRETS + 20;
    const DOT_R = 8;

    const sx = i => SX + i * SW;          // x coord of string i (0=low E, 5=high e)
    const fy = r => SY + r * FH;          // y coord of top of fret row r (0-based)
    const dotY = r => fy(r) + FH / 2;     // y center of fret row r

    const parts = [];

    // ── Nut or position number ──────────────────────
    if (startFret === 0) {
      // Thick nut bar
      parts.push(`<rect x="${sx(0)}" y="${SY - 5}" width="${SW * (STRINGS - 1)}" height="6" rx="0" fill="#d8d8cf"/>`);
    } else {
      parts.push(`<text x="4" y="${dotY(0) + 5}" font-family="JetBrains Mono,monospace" font-size="12" fill="#6a6a60" text-anchor="start">${startFret + 1}fr</text>`);
    }

    // ── Fret lines (horizontal) ─────────────────────
    for (let r = 0; r <= FRETS; r++) {
      const y = fy(r);
      parts.push(`<line x1="${sx(0)}" y1="${y}" x2="${sx(STRINGS - 1)}" y2="${y}" stroke="#3a3a34" stroke-width="1"/>`);
    }

    // ── String lines (vertical) ─────────────────────
    for (let i = 0; i < STRINGS; i++) {
      const x = sx(i);
      parts.push(`<line x1="${x}" y1="${SY}" x2="${x}" y2="${fy(FRETS)}" stroke="#4a4a44" stroke-width="1.5"/>`);
    }

    // ── Open / mute markers above nut ───────────────
    for (let i = 0; i < STRINGS; i++) {
      const x = sx(i);
      const y = SY - 22;
      if (f[i] === 'x') {
        const d = 6;
        parts.push(`<line x1="${x-d}" y1="${y-d}" x2="${x+d}" y2="${y+d}" stroke="#ff2d55" stroke-width="2" stroke-linecap="square"/>`);
        parts.push(`<line x1="${x+d}" y1="${y-d}" x2="${x-d}" y2="${y+d}" stroke="#ff2d55" stroke-width="2" stroke-linecap="square"/>`);
      } else if (f[i] === '0') {
        parts.push(`<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="#d8d8cf" stroke-width="2"/>`);
      }
    }

    // ── String labels (low E … high e) ──────────────
    const STRING_NAMES = ['E','A','D','G','B','e'];
    for (let i = 0; i < STRINGS; i++) {
      parts.push(`<text x="${sx(i)}" y="${H - 2}" font-family="JetBrains Mono,monospace" font-size="11" fill="#3a3a34" text-anchor="middle">${STRING_NAMES[i]}</text>`);
    }

    // ── Finger dots ─────────────────────────────────
    // Detect barre: if 2+ strings land on the same fret, draw a bar across
    // the span and individual dots on top for other fingers.
    const fretGroups = {};
    for (let i = 0; i < STRINGS; i++) {
      const v = f[i];
      if (v === 'x' || v === '0') continue;
      const fn = parseInt(v);
      if (!fn) continue;
      const row = fn - startFret - 1;  // 0-based row in visible window
      if (row < 0 || row >= FRETS) continue;
      if (!fretGroups[fn]) fretGroups[fn] = [];
      fretGroups[fn].push(i);
    }

    for (const [fn, strings] of Object.entries(fretGroups)) {
      const row  = parseInt(fn) - startFret - 1;
      const cy   = dotY(row);
      const isBarre = strings.length >= 2 && (Math.max(...strings) - Math.min(...strings) === strings.length - 1);

      if (isBarre && strings.length >= 2) {
        // Draw a rounded bar across the barre strings
        const x1 = sx(Math.min(...strings));
        const x2 = sx(Math.max(...strings));
        parts.push(`<rect x="${x1 - DOT_R}" y="${cy - DOT_R}" width="${x2 - x1 + DOT_R * 2}" height="${DOT_R * 2}" rx="${DOT_R}" fill="#ff6a00" opacity="0.9"/>`);
      } else {
        // Individual dots
        for (const si of strings) {
          parts.push(`<circle cx="${sx(si)}" cy="${cy}" r="${DOT_R}" fill="#ff6a00"/>`);
          parts.push(`<circle cx="${sx(si)}" cy="${cy}" r="${DOT_R + 3}" fill="none" stroke="rgba(255,106,0,0.25)" stroke-width="1"/>`);
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;background:var(--bg2);border:1px solid var(--line2);">${parts.join('')}</svg>`;
  },
};
