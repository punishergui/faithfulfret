// Daily Fret — BPM Guide

window.Pages = window.Pages || {};

const BPM_TEMPOS = [
  { min: 20,  max: 40,  name: 'Grave',       desc: 'Slow and solemn' },
  { min: 41,  max: 60,  name: 'Largo',        desc: 'Very slow, broad' },
  { min: 61,  max: 66,  name: 'Larghetto',    desc: 'Rather slow' },
  { min: 67,  max: 76,  name: 'Adagio',       desc: 'Slow and stately' },
  { min: 77,  max: 84,  name: 'Andante',      desc: 'Walking pace' },
  { min: 85,  max: 100, name: 'Moderato',     desc: 'Moderate speed' },
  { min: 101, max: 115, name: 'Allegretto',   desc: 'Moderately fast' },
  { min: 116, max: 140, name: 'Allegro',      desc: 'Fast and bright' },
  { min: 141, max: 167, name: 'Vivace',       desc: 'Lively and fast' },
  { min: 168, max: 200, name: 'Presto',       desc: 'Very fast' },
  { min: 201, max: 240, name: 'Prestissimo',  desc: 'As fast as possible' },
];

Pages.BpmGuide = {
  render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">BPM Guide</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:32px 24px 60px;max-width:800px;">
        <p style="font-size:14px;color:var(--text2);margin-bottom:28px;font-weight:300;">
          Click any row to open the metronome at that tempo. Tempos overlap slightly between tradition and practice.
        </p>

        <div style="border:1px solid var(--line2);">
          ${BPM_TEMPOS.map(t => {
            const mid = Math.round((t.min + t.max) / 2);
            return `
              <div class="bpm-row" onclick="go('#/tools/metronome?bpm=${mid}')">
                <div class="bpm-row__range">${t.min}–${t.max} <span style="color:var(--text3);font-size:9px;">BPM</span></div>
                <div class="bpm-row__name">${t.name}</div>
                <div class="bpm-row__desc">${t.desc}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top:20px;font-family:var(--f-mono);font-size:10px;color:var(--text3);letter-spacing:0.06em;">
          Tip: Clicking a row opens the metronome at the midpoint BPM for that tempo marking.
        </div>
      </div>
    `;
  },
};
