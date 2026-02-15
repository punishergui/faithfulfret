// Daily Fret — Metronome
// Uses Web Audio API scheduler pattern (NOT setInterval)

window.Pages = window.Pages || {};

const METRO_TEMPOS = [
  { min: 20,  max: 40,  name: 'Grave',       desc: 'Slow and solemn' },
  { min: 41,  max: 60,  name: 'Largo',       desc: 'Very slow, broad' },
  { min: 61,  max: 66,  name: 'Larghetto',   desc: 'Rather slow' },
  { min: 67,  max: 76,  name: 'Adagio',      desc: 'Slow and stately' },
  { min: 77,  max: 84,  name: 'Andante',     desc: 'Walking pace' },
  { min: 85,  max: 100, name: 'Moderato',    desc: 'Moderate speed' },
  { min: 101, max: 115, name: 'Allegretto',  desc: 'Moderately fast' },
  { min: 116, max: 140, name: 'Allegro',     desc: 'Fast and bright' },
  { min: 141, max: 167, name: 'Vivace',      desc: 'Lively and fast' },
  { min: 168, max: 200, name: 'Presto',      desc: 'Very fast' },
  { min: 201, max: 240, name: 'Prestissimo', desc: 'As fast as possible' },
];

Pages.Metronome = {
  render() {
    const app = document.getElementById('app');

    // Parse BPM from URL if coming from BPM guide
    const hashParams = location.hash.split('?')[1] || '';
    const urlBpm = parseInt(new URLSearchParams(hashParams).get('bpm')) || 120;

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1452457750107-be127b9f2f77?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div class="page-title">Metronome</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="metro-wrap">
        <!-- BPM display -->
        <div class="metro-display" id="metro-display">${urlBpm}</div>

        <!-- Beat dots -->
        <div class="metro-beats" id="metro-beats"></div>

        <!-- Tempo name -->
        <div class="metro-tempo-name" id="metro-tempo-name"></div>

        <!-- Slider -->
        <div class="metro-slider-wrap" style="margin-top:16px;">
          <input type="range" class="metro-slider" id="metro-slider" min="30" max="240" value="${urlBpm}" step="1">
        </div>

        <!-- Adjust buttons -->
        <div class="metro-adj">
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="-5">−5</button>
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="-1">−1</button>
          <div style="flex:2;"></div>
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="1">+1</button>
          <button class="df-btn df-btn--outline metro-adj-btn" data-delta="5">+5</button>
        </div>

        <!-- Play/Stop -->
        <button id="metro-play" class="df-btn df-btn--primary metro-play">&#9654; START</button>

        <!-- Tap tempo -->
        <button id="metro-tap" class="df-btn df-btn--outline metro-tap">TAP TEMPO</button>

        <!-- Time signature -->
        <div class="metro-sig" id="metro-sig">
          <button class="metro-sig-btn active" data-sig="4">4/4</button>
          <button class="metro-sig-btn" data-sig="3">3/4</button>
          <button class="metro-sig-btn" data-sig="2">2/4</button>
          <button class="metro-sig-btn" data-sig="6">6/8</button>
        </div>

        <div style="margin-top:22px;border:1px solid var(--line2);">
          ${METRO_TEMPOS.map(t => {
            const mid = Math.round((t.min + t.max) / 2);
            return `<button type="button" class="bpm-row" data-mid="${mid}"><div class="bpm-row__range">${t.min}-${t.max}</div><div class="bpm-row__name">${t.name}</div><div class="bpm-row__desc">${t.desc}</div></button>`;
          }).join('')}
        </div>
      </div>
    `;

    this._init(app, urlBpm);
  },

  _init(container, initialBpm) {
    // ─── Audio Engine ─────────────────────────────────
    let audioCtx = null;
    let isPlaying = false;
    let bpm = initialBpm;
    let beat = 0;
    let nextBeatTime = 0.0;
    let schedulerTimer = null;
    let sig = 4;

    const LOOKAHEAD = 25.0;        // ms
    const SCHEDULE_AHEAD = 0.1;    // seconds

    const displayEl = container.querySelector('#metro-display');
    const beatsEl = container.querySelector('#metro-beats');
    const playBtn = container.querySelector('#metro-play');
    const tapBtn = container.querySelector('#metro-tap');
    const slider = container.querySelector('#metro-slider');
    const tempoName = container.querySelector('#metro-tempo-name');

    function getAudioCtx() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function scheduleBeep(freq, vol, duration, when) {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'square';
      gain.gain.setValueAtTime(vol, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
      osc.start(when);
      osc.stop(when + duration + 0.01);
    }

    function updateBeatDots(currentBeat) {
      const dots = beatsEl.querySelectorAll('.metro-beat');
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentBeat);
      });
    }

    function scheduler() {
      const ctx = getAudioCtx();
      while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD) {
        const isDownbeat = (beat % sig) === 0;
        const freq = isDownbeat ? 880 : 440;
        const vol  = isDownbeat ? 0.6 : 0.3;
        scheduleBeep(freq, vol, 0.05, nextBeatTime);

        const currentBeat = beat % sig;
        const delay = Math.max(0, (nextBeatTime - ctx.currentTime) * 1000);

        // Flash display on downbeat
        if (isDownbeat) {
          setTimeout(() => {
            displayEl.classList.add('beat');
            setTimeout(() => displayEl.classList.remove('beat'), 80);
          }, delay);
        }

        setTimeout(() => updateBeatDots(currentBeat), delay);

        nextBeatTime += 60.0 / bpm;
        beat++;
      }
      schedulerTimer = setTimeout(scheduler, LOOKAHEAD);
    }

    function buildDots() {
      beatsEl.innerHTML = '';
      for (let i = 0; i < sig; i++) {
        const dot = document.createElement('div');
        dot.className = `metro-beat ${i === 0 ? 'metro-beat--down' : 'metro-beat--normal'}`;
        beatsEl.appendChild(dot);
      }
    }

    function setBPM(newBpm) {
      bpm = Math.max(30, Math.min(240, newBpm));
      displayEl.textContent = bpm;
      slider.value = bpm;
      updateTempoName();
    }

    function updateTempoName() {
      const t = METRO_TEMPOS.find(t => bpm >= t.min && bpm <= t.max);
      tempoName.textContent = t ? t.name : '';
    }

    function togglePlay() {
      if (isPlaying) {
        // Stop
        clearTimeout(schedulerTimer);
        isPlaying = false;
        playBtn.textContent = '▶ START';
        playBtn.classList.remove('metro-play--playing');
        updateBeatDots(-1);
      } else {
        // Start
        const ctx = getAudioCtx();
        beat = 0;
        nextBeatTime = ctx.currentTime + 0.1;
        isPlaying = true;
        scheduler();
        playBtn.textContent = '■ STOP';
        playBtn.classList.add('metro-play--playing');
      }
    }

    // ─── Tap Tempo ────────────────────────────────────
    let tapTimes = [];

    tapBtn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes = tapTimes.filter(t => now - t < 3000);
      tapTimes.push(now);

      if (tapTimes.length >= 2) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
          intervals.push(tapTimes[i] - tapTimes[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        setBPM(Math.round(60000 / avgInterval));
      }
    });

    // ─── Controls ─────────────────────────────────────
    playBtn.addEventListener('click', togglePlay);

    slider.addEventListener('input', () => setBPM(parseInt(slider.value)));

    container.querySelectorAll('.metro-adj-btn').forEach(btn => {
      btn.addEventListener('click', () => setBPM(bpm + parseInt(btn.dataset.delta)));
    });

    container.querySelectorAll('.metro-sig-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sig = parseInt(btn.dataset.sig);
        container.querySelectorAll('.metro-sig-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildDots();
        if (isPlaying) {
          clearTimeout(schedulerTimer);
          beat = 0;
          const ctx = getAudioCtx();
          nextBeatTime = ctx.currentTime + 0.1;
          scheduler();
        }
      });
    });

    container.querySelectorAll('.bpm-row[data-mid]').forEach(row => {
      row.addEventListener('click', () => setBPM(parseInt(row.dataset.mid, 10)));
    });

    // ─── Keyboard ─────────────────────────────────────
    // Exclude INPUT, SELECT, and TEXTAREA so typing is never blocked
    const keyHandler = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowUp')   setBPM(bpm + 1);
      if (e.code === 'ArrowDown') setBPM(bpm - 1);
    };
    document.addEventListener('keydown', keyHandler);

    // ─── Cleanup on navigate away ─────────────────────
    // We watch #app for childList mutations. When the metronome is replaced
    // (user navigates away), playBtn is no longer inside container, so we
    // know to fully tear down: stop audio scheduler and remove key handler.
    // NOTE: we cannot check document.contains(container) because container
    // IS #app and is never removed — we must check for our own element.
    const observer = new MutationObserver(() => {
      if (!container.contains(playBtn)) {
        clearTimeout(schedulerTimer);
        isPlaying = false;
        if (audioCtx) {
          audioCtx.close().catch(() => {});
          audioCtx = null;
        }
        document.removeEventListener('keydown', keyHandler);
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });

    // ─── Init ──────────────────────────────────────────
    buildDots();
    updateTempoName();
  },
};
