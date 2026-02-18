// Daily Fret — Tunings Tool

window.Pages = window.Pages || {};

const TUNINGS = [
  { name: 'Standard (E A D G B E)', notes: ['E', 'A', 'D', 'G', 'B', 'E'] },
  { name: 'Drop D (D A D G B E)', notes: ['D', 'A', 'D', 'G', 'B', 'E'] },
  { name: 'Half Step Down (Eb Ab Db Gb Bb Eb)', notes: ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'] },
  { name: 'Open G (D G D G B D)', notes: ['D', 'G', 'D', 'G', 'B', 'D'] },
];

const NOTE_TO_SEMITONE = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

Pages.Tuning = {
  render() {
    const app = document.getElementById('app');

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Tunings</div>
          <a href="#/tools" class="df-btn df-btn--outline" style="margin-bottom:4px;">← Tools</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="scales-wrap">
        <div class="df-field" style="margin-bottom:14px;">
          <label class="df-label" for="tuning-select">Tuning</label>
          <select id="tuning-select" class="df-input">
            ${TUNINGS.map((t, i) => `<option value="${i}">${t.name}</option>`).join('')}
          </select>
        </div>

        <div id="tuning-strings" style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:16px;"></div>

        <button id="play-tuning" class="df-btn df-btn--primary">Play Tuning</button>
      </div>
    `;

    this._bind(app);
  },

  _bind(container) {
    const select = container.querySelector('#tuning-select');
    const stringsEl = container.querySelector('#tuning-strings');
    const playBtn = container.querySelector('#play-tuning');

    let audioCtx = null;

    const renderStrings = () => {
      const tuning = TUNINGS[parseInt(select.value, 10)] || TUNINGS[0];
      stringsEl.innerHTML = tuning.notes
        .map((note, i) => `<div style="border:1px solid var(--line2);background:var(--bg1);padding:10px 8px;text-align:center;"><div style="font-size:10px;color:var(--text3);font-family:var(--f-mono);">String ${6 - i}</div><div style="font-size:20px;font-family:var(--f-mono);margin-top:4px;">${note}</div></div>`)
        .join('');
    };

    const noteToFrequency = (note, octave) => {
      const semitone = NOTE_TO_SEMITONE[note];
      if (semitone == null) return 0;
      const midi = (octave + 1) * 12 + semitone;
      return 440 * Math.pow(2, (midi - 69) / 12);
    };

    const playTuning = async () => {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const tuning = TUNINGS[parseInt(select.value, 10)] || TUNINGS[0];
      const octaves = [2, 2, 3, 3, 3, 4];
      const startAt = audioCtx.currentTime + 0.05;

      tuning.notes.forEach((note, i) => {
        const when = startAt + (i * 0.8);
        const freq = noteToFrequency(note, octaves[i]);
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, when);
        gain.gain.setValueAtTime(0.0001, when);
        gain.gain.exponentialRampToValueAtTime(0.25, when + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.7);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(when);
        osc.stop(when + 0.72);
      });
    };

    select.addEventListener('change', renderStrings);
    playBtn.addEventListener('click', playTuning);
    renderStrings();

    const observer = new MutationObserver(() => {
      if (!container.contains(playBtn)) {
        if (audioCtx) audioCtx.close().catch(() => {});
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true });
  },
};
