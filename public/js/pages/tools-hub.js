// Daily Fret — Tools Hub Page

window.Pages = window.Pages || {};

Pages.ToolsHub = {
  render() {
    const app = document.getElementById('app');

    const tools = [
      {
        href: '#/tools/tunings',
        icon: '🎵',
        title: 'Tunings',
        desc: 'Switch between common tunings and preview string pitches.',
      },
      {
        href: '#/tools/metronome',
        icon: '⏱',
        title: 'Metronome',
        desc: 'Set BPM, accent beat one, and practice with quarter/eighth notes.',
      },
      {
        href: '#/tools/chords',
        icon: '🎸',
        title: 'Chords',
        desc: 'Pick root + chord type and view a clean SVG chord diagram.',
      },
      {
        href: '#/tools/scales',
        icon: '🎼',
        title: 'Scales',
        desc: 'Choose key + scale type and view scale tones on a fretboard.',
      },
      {
        href: '#/tools/progressions',
        icon: '🧭',
        title: 'Progressions',
        desc: 'Build common progressions by key and view why they resolve.',
      },
      {
        href: '#/tools/chord-chart',
        icon: '🗂️',
        title: 'Chord Chart',
        desc: 'Open the full reference chart with major, minor, extended, and altered shapes.',
      },
    ];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture">
        <div class="page-hero__inner">
          <div class="page-title">Tools</div>
          <div style="font-size:16px;color:var(--text2);font-family:var(--f-body);margin-top:8px;font-weight:300;">Practical tools for daily practice.</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap tools-wrap">
        <div class="tools-grid">
          ${tools.map(t => `
            <a href="${t.href}" class="tool-card" aria-label="Open ${t.title}">
              <div class="tool-card__icon">${t.icon}</div>
              <div class="tool-card__title">${t.title}</div>
              <div class="tool-card__desc">${t.desc}</div>
              <div class="tool-card__arrow">Open &rarr;</div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  },
};
