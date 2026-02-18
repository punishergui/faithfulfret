// Daily Fret — Metronome
// Uses shared Web Audio metronome scheduler

window.Pages = window.Pages || {};

const METRO_TEMPOS = [
  { min: 20, max: 40, name: 'Grave', desc: 'Slow and solemn' },
  { min: 41, max: 60, name: 'Largo', desc: 'Very slow, broad' },
  { min: 61, max: 66, name: 'Larghetto', desc: 'Rather slow' },
  { min: 67, max: 76, name: 'Adagio', desc: 'Slow and stately' },
  { min: 77, max: 84, name: 'Andante', desc: 'Walking pace' },
  { min: 85, max: 100, name: 'Moderato', desc: 'Moderate speed' },
  { min: 101, max: 115, name: 'Allegretto', desc: 'Moderately fast' },
  { min: 116, max: 140, name: 'Allegro', desc: 'Fast and bright' },
  { min: 141, max: 167, name: 'Vivace', desc: 'Lively and fast' },
  { min: 168, max: 200, name: 'Presto', desc: 'Very fast' },
  { min: 201, max: 240, name: 'Prestissimo', desc: 'As fast as possible' },
];

Pages.Metronome = {
  render() {
    const app = document.getElementById('app');
    const hashParams = location.hash.split('?')[1] || '';
    const parsedUrlBpm = parseInt(new URLSearchParams(hashParams).get('bpm'), 10);
    const savedBpm = parseInt(localStorage.getItem('df_last_bpm') || '', 10);
    const urlBpm = Number.isFinite(parsedUrlBpm) ? parsedUrlBpm : Number.isFinite(savedBpm) ? savedBpm : 120;

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1452457750107-be127b9f2f77?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Metronome</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="metro-wrap">
        ${window.renderHelpCard({
          title: 'How to use this metronome',
          description: 'Set tempo, pick a time signature, and start. Use this for tight daily timing practice.',
          bullets: ['Tap Tempo matches your feel quickly.', 'Downbeat is louder for easier counting.', 'Spacebar toggles start/stop.'],
          storageKey: 'df_help_tool_metronome',
        })}

        <div class="metro-display" id="metro-display">${urlBpm}</div>
        <div class="metro-beats" id="metro-beats"></div>
        <div class="metro-tempo-name" id="metro-tempo-name"></div>

        <div class="metro-slider-wrap" style="margin-top:16px;">
          <input type="range" class="metro-slider" id="metro-slider" min="30" max="240" value="${urlBpm}" step="1">
        </div>

        <div class="metro-adj">
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="-5">−5</button>
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="-1">−1</button>
          <div style="flex:2;"></div>
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="1">+1</button>
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="5">+5</button>
        </div>

        <button id="metro-play" class="df-btn df-btn--primary metro-play">▶ START</button>
        <button id="metro-tap" class="df-btn df-btn--outline metro-tap">TAP TEMPO</button>

        <div class="metro-sig" id="metro-sig">
          <button class="metro-sig-btn active" data-sig="4">4/4</button>
          <button class="metro-sig-btn" data-sig="3">3/4</button>
          <button class="metro-sig-btn" data-sig="2">2/4</button>
          <button class="metro-sig-btn" data-sig="6">6/8</button>
        </div>

        <div style="margin-top:22px;border:1px solid var(--line2);">
          ${METRO_TEMPOS.map((t) => {
            const mid = Math.round((t.min + t.max) / 2);
            return `<button type="button" class="bpm-row" data-mid="${mid}"><div class="bpm-row__range">${t.min}-${t.max}</div><div class="bpm-row__name">${t.name}</div><div class="bpm-row__desc">${t.desc}</div></button>`;
          }).join('')}
        </div>
      </div>
    `;

    this._init(app, urlBpm);
  },

  _init(container, initialBpm) {
    window.bindHelpCards(container);

    let isPlaying = false;
    let bpm = initialBpm;
    let sig = 4;

    const displayEl = container.querySelector('#metro-display');
    const beatsEl = container.querySelector('#metro-beats');
    const playBtn = container.querySelector('#metro-play');
    const tapBtn = container.querySelector('#metro-tap');
    const slider = container.querySelector('#metro-slider');
    const tempoName = container.querySelector('#metro-tempo-name');

    const updateBeatDots = (currentBeat) => {
      beatsEl.querySelectorAll('.metro-beat').forEach((dot, i) => {
        dot.classList.toggle('active', i === currentBeat);
      });
    };

    const buildDots = () => {
      beatsEl.innerHTML = '';
      for (let i = 0; i < sig; i += 1) {
        const dot = document.createElement('div');
        dot.className = `metro-beat ${i === 0 ? 'metro-beat--down' : 'metro-beat--normal'}`;
        beatsEl.appendChild(dot);
      }
    };

    const updateTempoName = () => {
      const t = METRO_TEMPOS.find((tempo) => bpm >= tempo.min && bpm <= tempo.max);
      tempoName.textContent = t ? t.name : '';
    };

    const setBPM = (newBpm) => {
      bpm = Math.max(30, Math.min(240, newBpm));
      displayEl.textContent = bpm;
      slider.value = bpm;
      updateTempoName();
      localStorage.setItem('df_last_bpm', String(bpm));
      if (isPlaying) {
        window.FFMetronome.startMetronome({ bpm, subdivision: sig, accent: true, onTick });
      }
    };

    const onTick = (beatIndex) => {
      const currentBeat = beatIndex % sig;
      updateBeatDots(currentBeat);
      if (currentBeat === 0) {
        displayEl.classList.add('beat');
        setTimeout(() => displayEl.classList.remove('beat'), 90);
      }
    };

    const start = () => {
      isPlaying = true;
      window.FFMetronome.startMetronome({ bpm, subdivision: sig, accent: true, onTick });
      playBtn.textContent = '■ STOP';
      playBtn.classList.add('metro-play--playing');
    };

    const stop = () => {
      isPlaying = false;
      window.FFMetronome.stopMetronome();
      playBtn.textContent = '▶ START';
      playBtn.classList.remove('metro-play--playing');
      updateBeatDots(-1);
    };

    playBtn.addEventListener('click', () => {
      if (isPlaying) stop();
      else start();
    });

    slider.addEventListener('input', () => setBPM(parseInt(slider.value, 10)));
    container.querySelectorAll('.metro-adj-btn').forEach((btn) => {
      btn.addEventListener('click', () => setBPM(bpm + parseInt(btn.dataset.delta, 10)));
    });

    container.querySelectorAll('.metro-sig-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sig = parseInt(btn.dataset.sig, 10);
        container.querySelectorAll('.metro-sig-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        buildDots();
        if (isPlaying) {
          window.FFMetronome.startMetronome({ bpm, subdivision: sig, accent: true, onTick });
        }
      });
    });

    container.querySelectorAll('.bpm-row[data-mid]').forEach((row) => {
      row.addEventListener('click', () => setBPM(parseInt(row.dataset.mid, 10)));
    });

    let tapTimes = [];
    tapBtn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes = tapTimes.filter((t) => now - t < 3000);
      tapTimes.push(now);
      if (tapTimes.length >= 2) {
        const intervals = tapTimes.slice(1).map((t, i) => t - tapTimes[i]);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        setBPM(Math.round(60000 / avg));
      }
    });

    const keyHandler = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) stop();
        else start();
      }
      if (e.code === 'ArrowUp') setBPM(bpm + 1);
      if (e.code === 'ArrowDown') setBPM(bpm - 1);
    };
    document.addEventListener('keydown', keyHandler);

    const observer = new MutationObserver(() => {
      if (!container.contains(playBtn)) {
        stop();
        document.removeEventListener('keydown', keyHandler);
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });

    buildDots();
    updateTempoName();
    setBPM(initialBpm);
  },
};
