// Daily Fret — Settings Page

window.Pages = window.Pages || {};

Pages.Settings = {
  TAB_STORAGE_KEY: 'ff_settings_tab',
  TABS: [
    { key: 'general', label: 'General' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'motivation', label: 'Motivation' },
    { key: 'data', label: 'Data' },
    { key: 'advanced', label: 'Advanced' },
  ],
  THEME_EDITOR_VARS: [
    '--bg', '--bg2', '--panel', '--panel2', '--text', '--text2', '--line', '--line2', '--glow', '--glow2',
    '--accent', '--accent2', '--green', '--yellow', '--red', '--hero-bg-tint', '--hero-bg-opacity', '--heroH',
  ],

  render() {
    const app = document.getElementById('app');
    const theme = Utils.getTheme();
    const hand = Utils.isLeftHanded() ? 'left' : 'right';
    const bpmStep = Utils.getBpmStep();
    const defaultSessionMinutes = Utils.getDefaultSessionMinutes();
    const displayName = Utils.getDisplayName();
    const themes = Utils.getThemes();
    const heroSettings = Utils.getHeroSettings();

    const activeTab = this.getInitialTab();

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Settings',
        subtitle: 'Personalize your theme and local practice defaults. These settings stay on this device via localStorage.',
        texture: false,
      })}

      <div class="page-wrap" style="padding:28px 24px 40px;display:grid;gap:16px;">
        <div class="df-pillrow" role="tablist" aria-label="Settings sections" style="display:flex;gap:8px;flex-wrap:wrap;">
          ${this.TABS.map((tab) => `
            <button
              type="button"
              class="df-btn ${tab.key === activeTab ? 'df-btn--primary is-active' : 'df-btn--outline'}"
              role="tab"
              aria-selected="${tab.key === activeTab ? 'true' : 'false'}"
              data-settings-pill="${tab.key}"
            >${tab.label}</button>
          `).join('')}
        </div>

        <section class="df-panel df-panel--wide ff-panel--page settings-panel">
          <section data-settings-tab="general" style="display:grid;gap:12px;">
            <header>
              <h2 style="margin:0 0 4px;">General</h2>
              <p style="margin:0;font-size:13px;color:var(--text2);">Theme, layout preferences, and default session behavior.</p>
            </header>

            <div>
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
            </div>

            <details class="ff-theme-editor" open>
              <summary class="ff-theme-editor__summary">Theme Editor</summary>
              <div id="theme-editor-body" class="ff-theme-editor__body"></div>
            </details>

            <div style="display:grid;gap:8px;padding:12px;border:1px solid var(--line2);">
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

            <div style="display:grid;gap:10px;">
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
            </div>
          </section>

          <section data-settings-tab="timeline" style="display:grid;gap:12px;">
            <header>
              <h2 style="margin:0 0 4px;">Timeline</h2>
              <p style="margin:0;font-size:13px;color:var(--text2);">Feed visibility preferences and timeline management controls.</p>
            </header>
            <div style="padding:12px;border:1px solid var(--line2);font-size:13px;color:var(--text2);">
              Timeline feed filters are controlled from Dashboard and saved there as defaults. Use Advanced tab actions for destructive timeline reset.
            </div>
          </section>

          <section data-settings-tab="motivation" style="display:grid;gap:12px;">
            <header>
              <h2 style="margin:0 0 4px;">Motivation</h2>
              <p style="margin:0;font-size:13px;color:var(--text2);">Configure reminders and streak-restore behavior.</p>
            </header>
            <div style="display:grid;gap:10px;padding:12px;border:1px solid var(--line2);">
              <div class="df-label">Motivation</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
              <div class="df-field"><label class="df-label" for="mot-usual-time">Usual practice time</label><input id="mot-usual-time" class="df-input" type="time" value="19:00"></div>
              <div class="df-field"><label class="df-label" for="mot-cooldown">Restore cooldown days</label><input id="mot-cooldown" class="df-input" type="number" min="1" value="7"></div>
              <div class="df-field"><label class="df-label" for="mot-max-uses">Max restore uses / 30 days</label><input id="mot-max-uses" class="df-input" type="number" min="1" value="1"></div>
              </div>
              <div style="display:flex;gap:14px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:8px;"><input id="mot-allow-restore" type="checkbox" checked> Allow streak restore</label>
                <label style="display:flex;align-items:center;gap:8px;"><input id="mot-reminder" type="checkbox"> Daily practice reminder</label>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button id="mot-save" type="button" class="df-btn df-btn--outline">Save Motivation Settings</button>
                <span id="mot-status" style="font-size:12px;color:var(--text2);"></span>
              </div>
            </div>
          </section>

          <section data-settings-tab="data" style="display:grid;gap:12px;">
            <header>
              <h2 style="margin:0 0 4px;">Data</h2>
              <p style="margin:0;font-size:13px;color:var(--text2);">Export and restore full local backups.</p>
            </header>
            <div style="display:grid;gap:10px;padding:12px;border:1px solid var(--line2);">
              <div class="df-label">Backup &amp; Restore</div>
              <div style="font-size:13px;color:var(--text2);">Create a full data backup zip or import one to restore all sessions, gear, presets, uploads, and training history.</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                <button id="settings-backup-download" type="button" class="df-btn df-btn--outline">Download Backup (.zip)</button>
                <label class="df-btn df-btn--outline" style="position:relative;overflow:hidden;cursor:pointer;">
                  Select Backup (.zip)
                  <input id="settings-backup-import-file" type="file" accept=".zip" style="position:absolute;inset:0;opacity:0;cursor:pointer;">
                </label>
                <button id="settings-backup-import" type="button" class="df-btn df-btn--danger" disabled>Import Backup</button>
                <button id="settings-backup-restore-last" type="button" class="df-btn df-btn--outline">Restore Last Safety Backup</button>
              </div>
              <div id="settings-backup-status" style="font-size:12px;color:var(--text2);"></div>
            </div>
          </section>

          <section data-settings-tab="advanced" style="display:grid;gap:12px;">
            <header>
              <h2 style="margin:0 0 4px;">Advanced</h2>
              <p style="margin:0;font-size:13px;color:var(--text2);">Danger zone actions that reset or remove local data.</p>
            </header>
            <div style="display:grid;gap:8px;padding:12px;border:1px solid var(--line2);">
              <div class="df-label">Danger Zone</div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button id="mot-reset-badges" type="button" class="df-btn df-btn--danger">Reset badges</button>
                <button id="mot-clear-timeline" type="button" class="df-btn df-btn--danger">Clear timeline history</button>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <button id="settings-reset-phase0" type="button" class="df-btn df-btn--danger">Reset Phase 0 Settings</button>
              </div>
            </div>
          </section>

        </section>
      </div>
    `;

    this.bindTabs(app, activeTab);
    this.renderThemeEditor(app, theme);
    this.bindEvents(app);
  },

  getInitialTab() {
    const hash = location.hash || '';
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const tabFromUrl = new URLSearchParams(query).get('tab');
    if (this.TABS.some((tab) => tab.key === tabFromUrl)) return tabFromUrl;

    const stored = localStorage.getItem(this.TAB_STORAGE_KEY);
    if (this.TABS.some((tab) => tab.key === stored)) return stored;
    return 'general';
  },

  updateSettingsTabUrl(tabKey) {
    const nextHash = `#/settings?tab=${encodeURIComponent(tabKey)}`;
    const nextUrl = `${location.pathname}${location.search}${nextHash}`;
    window.history.replaceState(null, '', nextUrl);
  },

  setActiveTab(tabKey) {
    const selected = this.TABS.some((tab) => tab.key === tabKey) ? tabKey : 'general';
    this._activeTab = selected;
    localStorage.setItem(this.TAB_STORAGE_KEY, selected);
    this.updateSettingsTabUrl(selected);

    document.querySelectorAll('[data-settings-tab]').forEach((section) => {
      section.style.display = section.dataset.settingsTab === selected ? '' : 'none';
    });

    document.querySelectorAll('[data-settings-pill]').forEach((button) => {
      const isActive = button.dataset.settingsPill === selected;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.classList.toggle('is-active', isActive);
      button.classList.toggle('df-btn--primary', isActive);
      button.classList.toggle('df-btn--outline', !isActive);
    });
  },

  bindTabs(app, activeTab) {
    const pills = Array.from(app.querySelectorAll('[data-settings-pill]'));
    pills.forEach((pill, index) => {
      pill.addEventListener('click', () => this.setActiveTab(pill.dataset.settingsPill));
      pill.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % pills.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + pills.length) % pills.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = pills.length - 1;
        pills[nextIndex]?.focus();
      });
    });
    this.setActiveTab(activeTab);
  },

  normalizeHex(value) {
    const v = String(value || '').trim();
    const short = /^#([\da-f]{3})$/i.exec(v);
    if (short) return `#${short[1].split('').map((c) => c + c).join('')}`.toLowerCase();
    const full = /^#([\da-f]{6})$/i.exec(v);
    return full ? `#${full[1].toLowerCase()}` : '';
  },

  parseRgb(value) {
    const match = String(value || '').trim().match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(',').map((p) => p.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts[3] == null ? null : Number(parts[3]);
    if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return null;
    if (a != null && (!Number.isFinite(a) || a < 0 || a > 1)) return null;
    return { r, g, b, a };
  },

  rgbToHex({ r, g, b }) {
    const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  isColor(value) {
    return !!this.normalizeHex(value) || !!this.parseRgb(value);
  },

  buildThemeVarRows(themeId) {
    const theme = Utils.getThemeMap()[themeId];
    const baseVars = theme?.vars || {};
    const overrides = window.ThemeOverrides?.getOverrides(themeId) || {};
    return this.THEME_EDITOR_VARS.map((varName) => {
      const baseValue = baseVars[varName] ?? '';
      const value = overrides[varName] ?? baseValue;
      return {
        varName,
        baseValue,
        value,
        overridden: Object.prototype.hasOwnProperty.call(overrides, varName),
      };
    });
  },

  renderThemeEditor(app, themeId) {
    const host = app.querySelector('#theme-editor-body');
    if (!host) return;
    const theme = Utils.getThemeMap()[themeId];
    const rows = this.buildThemeVarRows(themeId);
    const overrides = window.ThemeOverrides?.getOverrides(themeId) || {};

    host.innerHTML = `
      <div class="ff-theme-editor__current">Current theme: <strong>${theme?.name || themeId}</strong> <span>(${themeId})</span></div>
      <div class="ff-theme-editor__rows">
        ${rows.map((row) => {
          const rgb = this.parseRgb(row.value);
          const hex = this.normalizeHex(row.value) || (rgb ? this.rgbToHex(rgb) : '');
          const colorInput = this.isColor(row.value) ? `<input type="color" class="df-input ff-theme-editor__color" data-color-for="${row.varName}" value="${hex || '#000000'}">` : '';
          const alpha = rgb && rgb.a != null ? `<input type="range" min="0" max="1" step="0.01" value="${rgb.a.toFixed(2)}" data-alpha-for="${row.varName}">` : '';
          return `
            <div class="ff-theme-editor__row" data-var-row="${row.varName}">
              <label class="df-label">${row.varName}</label>
              <span class="ff-theme-editor__swatch" style="background:${row.value || 'transparent'};"></span>
              ${colorInput}
              <input class="df-input" type="text" data-var-input="${row.varName}" value="${row.value.replace(/"/g, '&quot;')}" placeholder="${row.baseValue || 'unset'}">
              ${alpha}
              <button type="button" class="df-btn df-btn--outline" data-reset-var="${row.varName}">Reset variable</button>
              ${row.overridden ? '<span class="ff-theme-editor__badge">override</span>' : ''}
            </div>
          `;
        }).join('')}
      </div>
      <div class="ff-theme-editor__actions">
        <button type="button" class="df-btn df-btn--danger" id="theme-editor-reset-all">Reset all overrides for this theme</button>
        <button type="button" class="df-btn df-btn--outline" id="theme-editor-copy-json">Copy overrides JSON</button>
      </div>
      <div class="ff-theme-editor__paste">
        <label class="df-label" for="theme-editor-paste-json">Paste overrides JSON</label>
        <textarea id="theme-editor-paste-json" class="df-input" rows="3" placeholder='{"--accent":"#ff6600"}'></textarea>
        <div>
          <button type="button" class="df-btn df-btn--outline" id="theme-editor-apply-json">Apply JSON</button>
        </div>
      </div>
      <div class="ff-theme-editor__custom">
        <label class="df-label" for="theme-editor-custom-name">Advanced: add custom variable name</label>
        <input id="theme-editor-custom-name" class="df-input" type="text" placeholder="--my-custom-var">
        <input id="theme-editor-custom-value" class="df-input" type="text" placeholder="value">
        <button type="button" class="df-btn df-btn--outline" id="theme-editor-add-custom">Save custom override</button>
      </div>
      <pre class="ff-theme-editor__json-preview">${JSON.stringify(overrides, null, 2)}</pre>
    `;

    this.bindThemeEditorEvents(app, themeId);
  },

  bindThemeEditorEvents(app, themeId) {
    const applyValue = (varName, value) => {
      window.ThemeOverrides?.setOverride(themeId, varName, value);
      window.ThemeOverrides?.applyOverrides(themeId);
      Utils.applyThemeColorMeta(themeId);
      this.renderThemeEditor(app, themeId);
    };

    app.querySelectorAll('[data-var-input]').forEach((input) => {
      input.addEventListener('change', () => applyValue(input.dataset.varInput, input.value));
    });

    app.querySelectorAll('[data-color-for]').forEach((input) => {
      input.addEventListener('input', () => {
        const varName = input.dataset.colorFor;
        const textInput = app.querySelector(`[data-var-input="${varName}"]`);
        if (textInput) textInput.value = input.value;
        applyValue(varName, input.value);
      });
    });

    app.querySelectorAll('[data-alpha-for]').forEach((input) => {
      input.addEventListener('input', () => {
        const varName = input.dataset.alphaFor;
        const textInput = app.querySelector(`[data-var-input="${varName}"]`);
        const parsed = this.parseRgb(textInput?.value);
        if (!parsed) return;
        const next = `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${Number(input.value).toFixed(2)})`;
        if (textInput) textInput.value = next;
        applyValue(varName, next);
      });
    });

    app.querySelectorAll('[data-reset-var]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.ThemeOverrides?.clearOverride(themeId, btn.dataset.resetVar);
        window.ThemeOverrides?.applyOverrides(themeId);
        Utils.applyThemeColorMeta(themeId);
        this.renderThemeEditor(app, themeId);
      });
    });

    app.querySelector('#theme-editor-reset-all')?.addEventListener('click', () => {
      window.ThemeOverrides?.clearAllOverrides(themeId);
      window.ThemeOverrides?.applyOverrides(themeId);
      Utils.applyThemeColorMeta(themeId);
      this.renderThemeEditor(app, themeId);
    });

    app.querySelector('#theme-editor-copy-json')?.addEventListener('click', async () => {
      const text = JSON.stringify(window.ThemeOverrides?.getOverrides(themeId) || {}, null, 2);
      await navigator.clipboard.writeText(text);
    });

    app.querySelector('#theme-editor-apply-json')?.addEventListener('click', () => {
      const raw = app.querySelector('#theme-editor-paste-json')?.value || '{}';
      try {
        const parsed = JSON.parse(raw);
        const entries = Object.entries(parsed || {});
        entries.forEach(([varName, value]) => window.ThemeOverrides?.setOverride(themeId, varName, String(value)));
        window.ThemeOverrides?.applyOverrides(themeId);
        Utils.applyThemeColorMeta(themeId);
        this.renderThemeEditor(app, themeId);
      } catch {
        alert('Invalid JSON');
      }
    });

    app.querySelector('#theme-editor-add-custom')?.addEventListener('click', () => {
      const nameInput = app.querySelector('#theme-editor-custom-name');
      const valueInput = app.querySelector('#theme-editor-custom-value');
      const varName = String(nameInput?.value || '').trim();
      const value = String(valueInput?.value || '').trim();
      if (!varName.startsWith('--') || !value) return;
      window.ThemeOverrides?.setOverride(themeId, varName, value);
      window.ThemeOverrides?.applyOverrides(themeId);
      Utils.applyThemeColorMeta(themeId);
      this.renderThemeEditor(app, themeId);
    });
  },

  bindEvents(app) {
    app.querySelectorAll('[data-theme-value]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-theme-value');
        const applied = Utils.setTheme(selected);
        app.querySelectorAll('[data-theme-value]').forEach((el) => el.classList.toggle('is-active', el === btn));
        this.renderThemeEditor(app, applied);
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

    const backupStatus = app.querySelector('#settings-backup-status');
    const backupFileInput = app.querySelector('#settings-backup-import-file');
    const backupImportBtn = app.querySelector('#settings-backup-import');
    const setBackupStatus = (text, ok = true) => {
      if (!backupStatus) return;
      backupStatus.textContent = text;
      backupStatus.style.color = ok ? 'var(--green)' : 'var(--red)';
    };

    app.querySelector('#settings-backup-download')?.addEventListener('click', async () => {
      try {
        setBackupStatus('Preparing backup download...', true);
        const blob = await DB.exportAllZip();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faithfulfret-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setBackupStatus(`Backup downloaded at ${new Date().toLocaleString()}.`, true);
      } catch (error) {
        setBackupStatus(`Backup export failed: ${error.message}`, false);
      }
    });

    backupFileInput?.addEventListener('change', () => {
      const file = backupFileInput.files?.[0];
      backupImportBtn.disabled = !file;
      if (file) setBackupStatus(`Selected backup file: ${file.name}`, true);
    });

    backupImportBtn?.addEventListener('click', async () => {
      const file = backupFileInput?.files?.[0];
      if (!file) return;
      const warning = 'Importing a backup REPLACES current data. A safety backup will be created first. Continue?';
      if (!window.confirm(warning)) return;
      try {
        setBackupStatus('Import started: creating safety backup first...', true);
        const result = await DB.importZip(file);
        setBackupStatus(`Import complete at ${new Date().toLocaleString()}. Rollback ready: ${result?.rollbackReady ? 'yes' : 'unknown'}.`, true);
        backupFileInput.value = '';
        backupImportBtn.disabled = true;
      } catch (error) {
        setBackupStatus(`Import failed: ${error.message}`, false);
      }
    });

    app.querySelector('#settings-backup-restore-last')?.addEventListener('click', async () => {
      if (!window.confirm('Restore the most recent safety backup now? This will replace current data.')) return;
      try {
        setBackupStatus('Restoring last safety backup...', true);
        const result = await DB.restoreLastBackup();
        setBackupStatus(`Restored safety backup ${result?.restoredSnapshot || ''} at ${new Date().toLocaleString()}.`, true);
      } catch (error) {
        setBackupStatus(`Restore failed: ${error.message}`, false);
      }
    });

    const motStatus = app.querySelector('#mot-status');
    const setMotStatus = (text, ok = true) => {
      if (!motStatus) return;
      motStatus.textContent = text;
      motStatus.style.color = ok ? 'var(--green)' : 'var(--red)';
    };
    DB.getMotivationSettings().then((settings) => {
      const get = (id) => app.querySelector(id);
      get('#mot-usual-time').value = settings.usual_practice_time || '19:00';
      get('#mot-cooldown').value = String(Number(settings.streak_restore_cooldown_days) || 7);
      get('#mot-max-uses').value = String(Number(settings.streak_restore_max_uses_per_30_days) || 1);
      get('#mot-allow-restore').checked = Boolean(Number(settings.allow_streak_restore));
      get('#mot-reminder').checked = Boolean(Number(settings.daily_practice_reminder));
    }).catch(() => setMotStatus('Could not load motivation settings.', false));

    app.querySelector('#mot-save')?.addEventListener('click', async () => {
      try {
        await DB.saveMotivationSettings({
          usual_practice_time: app.querySelector('#mot-usual-time')?.value || '19:00',
          streak_restore_cooldown_days: Number(app.querySelector('#mot-cooldown')?.value || 7),
          streak_restore_max_uses_per_30_days: Number(app.querySelector('#mot-max-uses')?.value || 1),
          allow_streak_restore: app.querySelector('#mot-allow-restore')?.checked ? 1 : 0,
          daily_practice_reminder: app.querySelector('#mot-reminder')?.checked ? 1 : 0,
        });
        setMotStatus('Saved.', true);
      } catch (error) {
        setMotStatus(`Save failed: ${error.message}`, false);
      }
    });

    app.querySelector('#mot-reset-badges')?.addEventListener('click', async () => {
      if (!window.confirm('Delete all earned badges? This cannot be undone.')) return;
      try {
        await DB.resetBadges();
        Utils.toast?.('All earned badges deleted.');
        setMotStatus('All badges removed.', true);
        window.dispatchEvent(new Event('ff:data-changed'));
      } catch (error) {
        setMotStatus(`Reset failed: ${error.message}`, false);
      }
    });

    app.querySelector('#mot-clear-timeline')?.addEventListener('click', async () => {
      if (!window.confirm('Clear ALL timeline history? This is irreversible and does not delete sessions, gear, videos, playlists, resources, presets, or songs.')) return;
      try {
        await DB.clearTimelineHistory();
        Utils.toast?.('Timeline history cleared.');
        setMotStatus('Timeline history cleared.', true);
        window.dispatchEvent(new Event('ff:data-changed'));
      } catch (error) {
        setMotStatus(`Clear failed: ${error.message}`, false);
      }
    });
  },
};
