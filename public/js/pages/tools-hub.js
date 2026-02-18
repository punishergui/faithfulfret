// Daily Fret — Tools Hub Page

window.Pages = window.Pages || {};

Pages.ToolsHub = {
  render() {
    const app = document.getElementById('app');

    const tools = [
      {
        href: '#/tools/tunings',
        icon: '🎵',
        title: 'TUNINGS',
        desc: 'Switch between common tunings and preview string pitches.',
      },
      {
        href: '#/tools/metronome',
        icon: '⏱',
        title: 'METRONOME',
        desc: 'Set BPM, accent beat one, and practice with quarter/eighth notes.',
      },
      {
        href: '#/tools/chords',
        icon: '🎸',
        title: 'CHORDS',
        desc: 'Pick root + chord type and view a clean SVG chord diagram.',
      },
      {
        href: '#/tools/scales',
        icon: '🎼',
        title: 'SCALES',
        desc: 'Choose key + scale type and view scale tones on a fretboard.',
      },
    ];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Tools</div>
          <div style="font-size:16px;color:var(--text2);font-family:var(--f-body);margin-top:8px;font-weight:300;">Practical tools for daily practice.</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:40px 24px 60px;">
        <div class="tools-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);">
          ${tools.map(t => `
            <a href="${t.href}" class="tool-card">
              <div class="tool-card__icon">${t.icon}</div>
              <div class="tool-card__title">${t.title}</div>
              <div class="tool-card__desc">${t.desc}</div>
              <div class="tool-card__arrow">&rarr;</div>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  },
};
