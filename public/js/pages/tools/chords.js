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
        <div class="page-hero__inner">
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
            <pre id="chord-diagram" class="chord-diagram-board"></pre>
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
    container.querySelector('#chord-diagram').innerHTML = this._buildTextFretboard(chord.frets);
    container.querySelector('#chord-fingers').textContent = 'Finger positions: ' + chord.fingers;
    container.querySelector('#chord-tip').textContent = chord.tip;
  },

  // Build a fretboard-style chord chart with the same orientation as scales
  // (high e string at top, low E at bottom).
  _buildTextFretboard(frets) {
    const markersByString = frets.split('');
    const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];
    const mapping = [5, 4, 3, 2, 1, 0];
    const visibleFrets = 6;

    let header = '     ';
    for (let f = 0; f < visibleFrets; f++) header += `${f}`.padEnd(5, ' ');
    const rows = [header];

    for (let rowIndex = 0; rowIndex < stringNames.length; rowIndex++) {
      const stringName = stringNames[rowIndex].padEnd(2, ' ');
      const marker = markersByString[mapping[rowIndex]];
      let row = `${stringName} `;

      for (let fret = 0; fret < visibleFrets; fret++) {
        if (marker === 'x' && fret === 0) row += '<span style="color:var(--red);">✕</span>    ';
        else if (marker === '0' && fret === 0) row += '<span style="color:var(--green);">○</span>    ';
        else if (parseInt(marker, 10) === fret) row += '<span style="color:var(--accent);text-shadow:0 0 8px var(--glow);">●</span>    ';
        else row += '<span style="color:var(--text3);">─</span>    ';
      }

      rows.push(row);
    }

    rows.push(header);
    return rows.join('\n');
  },
};
