// Daily Fret — Tuning Guide

window.Pages = window.Pages || {};

Pages.Tuning = {
  render() {
    const app = document.getElementById('app');

    const standard = [
      { string: '6 (Low E)', note: 'E2', hz: '82.41 Hz' },
      { string: '5 (A)', note: 'A2', hz: '110.00 Hz' },
      { string: '4 (D)', note: 'D3', hz: '146.83 Hz' },
      { string: '3 (G)', note: 'G3', hz: '196.00 Hz' },
      { string: '2 (B)', note: 'B3', hz: '246.94 Hz' },
      { string: '1 (High e)', note: 'E4', hz: '329.63 Hz' },
    ];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div class="page-title">Tuning Guide</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap">
        <div class="df-card" style="padding:20px;border:1px solid var(--line2);background:var(--bg1);margin-bottom:16px;">
          <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.12em;color:var(--text3);text-transform:uppercase;margin-bottom:10px;">Standard tuning reference</div>
          <div style="display:grid;grid-template-columns:1.2fr .7fr .8fr;gap:10px;font-family:var(--f-mono);font-size:12px;">
            ${standard.map(item => `
              <div>${item.string}</div><div>${item.note}</div><div style="color:var(--text2);">${item.hz}</div>
            `).join('')}
          </div>
        </div>

        <div class="scale-help">
          <div class="scale-help__title">Quick tuning workflow (by ear + tuner)</div>
          <ul>
            <li>Mute all strings, set amp volume low, and switch to clean channel.</li>
            <li>Tune low E first, then 5th fret method: E→A→D→G, then 4th fret G→B, then 5th fret B→e.</li>
            <li>After each pass, strum open chord and re-check all strings (tension changes pitch).</li>
            <li>Use harmonics (5th/7th fret) for finer checks after rough tuning.</li>
          </ul>
        </div>

        <div class="scale-help" style="margin-top:14px;">
          <div class="scale-help__title">Peavey Vypyr X2 setup for easier tuning</div>
          <ul>
            <li>Pick a clean amp model and reduce gain/noise gate while tuning.</li>
            <li>Use bridge pickup for strongest attack, then pick lightly for accurate pitch reading.</li>
            <li>If pitch drifts, stretch new strings gently and retune 2–3 times.</li>
            <li>Keep tuner source first in your signal path (before heavy effects/distortion).</li>
          </ul>
        </div>
      </div>
    `;
  },
};
