// Daily Fret — Amp Wiki (Peavey Vypyr X2)

window.Pages = window.Pages || {};

const AMP_WIKI_SECTIONS = [
  {
    id: 'quick-start',
    title: 'Quick Start',
    tags: ['power', 'startup', 'beginner'],
    body: [
      'Set master volume low before powering on.',
      'Select a clean amp model first, then raise post volume gradually.',
      'Dial gain before effects. Keep gain moderate while learning chords/scales.',
    ],
  },
  {
    id: 'signal-chain',
    title: 'Signal Chain Basics',
    tags: ['effects', 'order', 'tone'],
    body: [
      'Think in order: guitar input → stomp/effects → amp model → modulation/delay/reverb → output.',
      'Too much pre-gain can make delays/reverbs muddy. Lower gain first.',
      'Use one variable at a time while editing tone (gain, EQ, then effects).',
    ],
  },
  {
    id: 'practice-presets',
    title: 'Practice Preset Ideas',
    tags: ['preset', 'practice', 'rhythm', 'lead'],
    body: [
      'Clean Practice: low gain, slight reverb, neutral EQ.',
      'Crunch Rhythm: medium gain, bass slightly down, mids slightly up.',
      'Lead Sustain: medium-high gain, mids boosted, delay short and subtle.',
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    tags: ['noise', 'hum', 'buzz', 'no sound'],
    body: [
      'If noisy: lower gain first, then check cable and pickup selector.',
      'If muddy: cut bass before adding treble; reduce effect mix.',
      'If volume jumps between presets: normalize channel/post volumes per preset.',
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance & Safety',
    tags: ['care', 'cleaning', 'safety'],
    body: [
      'Keep vents clear and avoid enclosed cabinets while operating.',
      'Power off before plugging/unplugging instrument cables.',
      'Back up favorite settings manually in a notes doc until app export is built for presets.',
    ],
  },
];

Pages.AmpManual = {
  render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80');">
        <div class="page-hero__inner">
          <div>
            <div class="page-title">Amp Wiki</div>
            <div style="font-size:13px;color:var(--text2);">Peavey Vypyr X2 quick-reference manual</div>
          </div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap">
        <div class="df-field" style="margin-bottom:18px;">
          <label class="df-label" for="amp-search">Search manual/wiki</label>
          <input id="amp-search" class="df-input" type="text" placeholder="Try: noise, clean, preset, gain, startup...">
        </div>

        <div id="amp-results" style="display:flex;flex-direction:column;gap:12px;"></div>
      </div>
    `;

    const searchInput = app.querySelector('#amp-search');
    const results = app.querySelector('#amp-results');

    const renderSections = (query = '') => {
      const q = query.trim().toLowerCase();
      const filtered = !q ? AMP_WIKI_SECTIONS : AMP_WIKI_SECTIONS.filter(section => {
        const haystack = [
          section.title,
          section.tags.join(' '),
          section.body.join(' '),
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });

      if (!filtered.length) {
        results.innerHTML = `
          <div class="df-card" style="padding:18px;border:1px solid var(--line2);background:var(--bg1);">
            <div style="font-family:var(--f-mono);font-size:12px;color:var(--text2);">No results found. Try simpler terms like <em>clean</em> or <em>noise</em>.</div>
          </div>
        `;
        return;
      }

      results.innerHTML = filtered.map(section => `
        <article class="df-card" style="padding:18px;border:1px solid var(--line2);background:var(--bg1);">
          <h3 style="font-family:var(--f-mono);font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;">${section.title}</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
            ${section.tags.map(tag => `<span style="font-family:var(--f-mono);font-size:10px;color:var(--text3);border:1px solid var(--line);padding:2px 6px;">#${tag}</span>`).join('')}
          </div>
          <ul style="padding-left:18px;color:var(--text2);font-size:14px;line-height:1.7;">
            ${section.body.map(line => `<li>${line}</li>`).join('')}
          </ul>
        </article>
      `).join('');
    };

    searchInput.addEventListener('input', () => renderSections(searchInput.value));
    renderSections('');
  },
};
