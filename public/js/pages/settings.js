// Daily Fret — Settings Page

window.Pages = window.Pages || {};

Pages.Settings = {
  render() {
    const app = document.getElementById('app');
    const theme = Utils.getTheme();
    const hand = Utils.isLeftHanded() ? 'left' : 'right';
    const bpmStep = Utils.getBpmStep();
    const defaultSessionMinutes = Utils.getDefaultSessionMinutes();
    const displayName = Utils.getDisplayName();

    const themes = [
      { id: 'shed', name: 'Shed', swatches: ['#0f0f0d', '#1d1d18', '#ff6a00', '#d8d8cf'], texture: "/img/textures/tex1.png" },
      { id: 'faithful', name: 'Faithful', swatches: ['#14100d', '#2a2219', '#c9a96e', '#e9ddca'], texture: "/img/textures/tex2.png" },
      { id: 'stage', name: 'Stage', swatches: ['#070b10', '#152132', '#00ffaa', '#d7f4ea'], texture: "/img/textures/tex7.png" },
      { id: 'acoustic', name: 'Acoustic', swatches: ['#e8dac5', '#f4e9d8', '#8b4513', '#2f2015'], texture: "/img/textures/tex6.png" },
    ];

    app.innerHTML = `
      <div class="page-hero">
        <div class="page-hero__inner">
          <div class="page-title">Settings</div>
          <p style="color:var(--text2);max-width:760px;">Personalize your theme and local practice defaults. These settings stay on this device via localStorage.</p>
        </div>
      </div>

      <div class="page-wrap" style="padding:28px 24px 40px;display:grid;gap:16px;">
        <section class="card" style="padding:16px;">
          <div class="df-label" style="margin-bottom:12px;">Theme Picker</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
            ${themes.map((t) => `
              <button type="button" class="ff-theme-opt ${t.id === theme ? 'is-active' : ''}" data-theme-value="${t.id}" style="text-align:left;padding:12px;border:1px solid var(--line2);background:var(--card2);">
                <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text1);margin-bottom:8px;">${t.name}</div>
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                  ${t.swatches.map((c) => `<span style="width:18px;height:18px;border:1px solid rgba(0,0,0,.22);background:${c};display:inline-block;"></span>`).join('')}
                </div>
                <div style="height:42px;border:1px solid var(--line2);background-image:linear-gradient(160deg, rgba(255,255,255,.12), rgba(0,0,0,.25)), url('${t.texture}');background-size:auto,cover;background-position:center;"></div>
              </button>
            `).join('')}
          </div>
        </section>

        <section class="card" style="padding:16px;display:grid;gap:14px;">
          <div>
            <div class="df-label">Playing Hand</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="df-btn ${hand === 'right' ? 'df-btn--primary' : 'df-btn--outline'}" data-handedness="right">Right-handed</button>
              <button type="button" class="df-btn ${hand === 'left' ? 'df-btn--primary' : 'df-btn--outline'}" data-handedness="left">Left-handed</button>
            </div>
            <p style="margin-top:8px;color:var(--text2);font-size:12px;">Mirrored fretboard/tool layouts are planned for a future phase.</p>
          </div>

          <div class="df-field">
            <label class="df-label" for="setting-bpm-step">BPM Step Size</label>
            <input id="setting-bpm-step" class="df-input" type="number" min="1" max="20" value="${bpmStep}">
          </div>

          <div class="df-field">
            <label class="df-label" for="setting-default-minutes">Default Session Minutes</label>
            <input id="setting-default-minutes" class="df-input" type="number" min="1" max="600" value="${defaultSessionMinutes}">
          </div>

          <div class="df-field">
            <label class="df-label" for="setting-display-name">Display Name</label>
            <input id="setting-display-name" class="df-input" type="text" maxlength="80" value="${displayName.replace(/"/g, '&quot;')}">
          </div>

          <div>
            <button id="settings-reset-phase0" type="button" class="df-btn df-btn--danger">Reset Phase 0 Settings</button>
          </div>
        </section>
      </div>
    `;

    this.bindEvents(app);
  },

  bindEvents(app) {
    app.querySelectorAll('[data-theme-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-theme-value');
        Utils.setTheme(selected);
        app.querySelectorAll('[data-theme-value]').forEach((el) => el.classList.toggle('is-active', el === btn));
      });
    });

    app.querySelectorAll('[data-handedness]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-handedness') === 'left' ? 'left' : 'right';
        localStorage.setItem('handedness', selected);
        document.documentElement.dataset.handedness = selected;
        app.querySelectorAll('[data-handedness]').forEach((el) => {
          const active = el.getAttribute('data-handedness') === selected;
          el.classList.toggle('df-btn--primary', active);
          el.classList.toggle('df-btn--outline', !active);
        });
      });
    });

    const bpmInput = app.querySelector('#setting-bpm-step');
    bpmInput?.addEventListener('change', () => {
      const value = Math.max(1, parseInt(bpmInput.value || '2', 10) || 2);
      localStorage.setItem('bpmStep', String(value));
      bpmInput.value = String(value);
    });

    const defaultMinutesInput = app.querySelector('#setting-default-minutes');
    defaultMinutesInput?.addEventListener('change', () => {
      const value = Math.max(1, parseInt(defaultMinutesInput.value || '20', 10) || 20);
      localStorage.setItem('defaultSessionMinutes', String(value));
      defaultMinutesInput.value = String(value);
    });

    const displayNameInput = app.querySelector('#setting-display-name');
    displayNameInput?.addEventListener('change', () => {
      localStorage.setItem('displayName', (displayNameInput.value || '').trim());
    });

    app.querySelector('#settings-reset-phase0')?.addEventListener('click', () => {
      ['theme', 'handedness', 'bpmStep', 'defaultSessionMinutes', 'displayName'].forEach((key) => localStorage.removeItem(key));
      location.reload();
    });
  },
};
