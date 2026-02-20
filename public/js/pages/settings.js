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
    const themes = Utils.getThemes();
    const heroSettings = Utils.getHeroSettings();

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Settings',
        subtitle: 'Personalize your theme and local practice defaults. These settings stay on this device via localStorage.',
        texture: false,
      })}

      <div class="page-wrap" style="padding:28px 24px 40px;display:grid;gap:16px;">
        <section class="df-panel df-panel--wide ff-panel--page settings-panel">
          <div class="df-label">Theme Picker</div>

          <div class="ff-theme-grid">
            ${themes.map((t) => {
              const [sw1, sw2, sw3, sw4] = t.swatches;
              const accent = t.vars?.['--accent'] || t.metaColor || sw3;
              const border = t.vars?.['--line2'] || accent;
              const glow = t.id === 'radioactive-gain' ? '#86ff1e' : accent;
              const cardStyle = [
                `--theme-bg1:${sw1}`,
                `--theme-bg2:${sw2}`,
                `--theme-accent:${accent}`,
                `--theme-border:${border}`,
                `--theme-glow:${glow}`,
                `--theme-nameplate-glow:${sw4}`,
              ].join(';');
              return `
                <button
                  type="button"
                  class="ff-theme-card ${t.id === theme ? 'is-active' : ''}"
                  data-theme-value="${t.id}"
                  style="${cardStyle}"
                  aria-label="Switch to ${t.name} theme"
                >
                  <div class="ff-theme-swatches">
                    ${t.swatches.map((swatch) => `<span class="ff-theme-swatch" style="background:${swatch};"></span>`).join('')}
                  </div>
                  <div class="ff-theme-nameplate"><span class="ff-theme-title">${t.name}</span></div>
                </button>
              `;
            }).join('')}
          </div>

          <div style="display:grid;gap:10px;padding:12px;border:1px solid var(--line2);">
            <div class="df-label">Hero</div>
            <label class="df-label" for="hero-img-opacity">Image Strength</label>
            <input id="hero-img-opacity" type="range" min="0.15" max="0.85" step="0.01" value="${heroSettings.img.toFixed(2)}">
            <div id="hero-img-opacity-value" style="font-size:12px;color:var(--text2);">${heroSettings.img.toFixed(2)}</div>

            <label class="df-label" for="hero-overlay-alpha">Overlay Darkness</label>
            <input id="hero-overlay-alpha" type="range" min="0.10" max="0.85" step="0.01" value="${heroSettings.overlay.toFixed(2)}">
            <div id="hero-overlay-alpha-value" style="font-size:12px;color:var(--text2);">${heroSettings.overlay.toFixed(2)}</div>

            <div>
              <button id="hero-settings-reset" type="button" class="df-btn df-btn--outline">Reset</button>
            </div>
          </div>

          <div style="height:1px;background:var(--line2);"></div>

          <div style="display:grid;gap:14px;">
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


    const heroImgInput = app.querySelector('#hero-img-opacity');
    const heroOverlayInput = app.querySelector('#hero-overlay-alpha');
    const heroImgValue = app.querySelector('#hero-img-opacity-value');
    const heroOverlayValue = app.querySelector('#hero-overlay-alpha-value');

    const syncHeroSettings = () => {
      const applied = Utils.setHeroSettings({
        img: heroImgInput?.value,
        overlay: heroOverlayInput?.value,
      });
      if (heroImgInput) heroImgInput.value = applied.img.toFixed(2);
      if (heroOverlayInput) heroOverlayInput.value = applied.overlay.toFixed(2);
      if (heroImgValue) heroImgValue.textContent = applied.img.toFixed(2);
      if (heroOverlayValue) heroOverlayValue.textContent = applied.overlay.toFixed(2);
    };

    heroImgInput?.addEventListener('input', syncHeroSettings);
    heroOverlayInput?.addEventListener('input', syncHeroSettings);

    app.querySelector('#hero-settings-reset')?.addEventListener('click', () => {
      const reset = Utils.resetHeroSettings();
      if (heroImgInput) heroImgInput.value = reset.img.toFixed(2);
      if (heroOverlayInput) heroOverlayInput.value = reset.overlay.toFixed(2);
      if (heroImgValue) heroImgValue.textContent = reset.img.toFixed(2);
      if (heroOverlayValue) heroOverlayValue.textContent = reset.overlay.toFixed(2);
    });

    app.querySelector('#settings-reset-phase0')?.addEventListener('click', () => {
      ['theme', 'handedness', 'bpmStep', 'defaultSessionMinutes', 'displayName', 'ff.heroImgOpacity', 'ff.heroOverlayAlpha'].forEach((key) => localStorage.removeItem(key));
      location.reload();
    });
  },
};
