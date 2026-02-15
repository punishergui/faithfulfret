// Daily Fret — Tools Hub Page

window.Pages = window.Pages || {};

Pages.ToolsHub = {
  render() {
    const app = document.getElementById('app');

    const tools = [
      {
        href: '#/tools/metronome',
        icon: '⏱',
        title: 'METRONOME + BPM GUIDE',
        desc: 'Click track, tap tempo, and full tempo marking guide in one tool',
      },
      {
        href: '#/tools/chords',
        icon: '🎸',
        title: 'CHORDS',
        desc: '15 essential chords · ASCII fretboard diagrams · Playing tips',
      },
      {
        href: '#/tools/scales',
        icon: '🎼',
        title: 'SCALES',
        desc: 'Common scale patterns · Fretboard visualization · Root notes',
      },
      {
        href: '#/tools/tuning',
        icon: '🪛',
        title: 'TUNING GUIDE',
        desc: 'Standard tuning reference · Ear + tuner workflow · Vypyr X2 tips',
      },
      {
        href: '/manual.pdf',
        icon: '📘',
        title: 'MANUAL PDF',
        desc: 'Open the amp manual PDF in a new tab',
      },
    ];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Tools</div>
          <div style="font-size:16px;color:var(--text2);font-family:var(--f-body);margin-top:8px;font-weight:300;">Practice smarter.</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:40px 24px 60px;">
        <div class="tools-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);">
          ${tools.map(t => `
            <a href="${t.href}" class="tool-card" ${t.href.startsWith('/') ? "target=\"_blank\" rel=\"noopener\"" : ""}>
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
