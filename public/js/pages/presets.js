window.Pages = window.Pages || {};

Pages.Presets = {
  fxBlocks: ['noiseGate', 'overdrive', 'delay', 'reverb', 'modulation'],

  defaultSettings() {
    return {
      channel: 'clean',
      gain: { pre: 5, post: 5 },
      eq: { low: 5, mid: 5, high: 5, presence: 0, resonance: 0 },
      fx: {
        noiseGate: { enabled: false, params: { threshold: 0, level: 5 } },
        overdrive: { enabled: false, params: { drive: 5, tone: 5, level: 5 } },
        delay: { enabled: false, params: { time: 400, feedback: 35, mix: 25 } },
        reverb: { enabled: false, params: { decay: 4, tone: 5, mix: 20 } },
        modulation: { enabled: false, params: { depth: 5, rate: 5, mix: 15 } },
      },
      knobsPushed: {
        gain: false,
        low: false,
        mid: false,
        high: false,
        presence: false,
        resonance: false,
        master: false,
      },
      notes: '',
      tags: [],
      imagePath: '',
    };
  },

  parseSettings(raw) {
    const defaults = this.defaultSettings();
    let parsed = {};

    if (raw && typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {};
      }
    } else if (raw && typeof raw === 'object') {
      parsed = raw;
    }

    const mergedFx = { ...defaults.fx, ...(parsed.fx || {}) };
    this.fxBlocks.forEach((key) => {
      mergedFx[key] = {
        enabled: Boolean(mergedFx[key]?.enabled),
        params: { ...(defaults.fx[key]?.params || {}), ...(mergedFx[key]?.params || {}) },
      };
    });

    return {
      ...defaults,
      ...parsed,
      gain: { ...defaults.gain, ...(parsed.gain || {}) },
      eq: { ...defaults.eq, ...(parsed.eq || {}) },
      knobsPushed: { ...defaults.knobsPushed, ...(parsed.knobsPushed || {}) },
      fx: mergedFx,
      tags: Array.isArray(parsed.tags) ? parsed.tags : defaults.tags,
      notes: parsed.notes || '',
      imagePath: parsed.imagePath || '',
    };
  },

  escapeHtml(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  prettyTags(p) {
    const settings = this.parseSettings(p.settings);
    if (settings.tags.length) return settings.tags.join(', ');
    return p.tags || '—';
  },

  async render() {
    const app = document.getElementById('app');
    const presets = await DB.getAllPresets();

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;">
          <div class="page-title">Presets</div>
          <button id="new-preset-btn" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Add Preset</button>
        </div>
        <div class="fret-line"></div>
      </div>
      <div class="page-wrap" style="padding:24px;">
        <div id="preset-form-wrap" style="display:none;margin-bottom:16px;border:1px solid var(--line2);padding:14px;background:var(--bg1);"></div>
        ${presets.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">${presets.map((preset) => this.card(preset)).join('')}</div>` : '<div class="empty-state"><div class="empty-state__title">No presets yet</div><div class="empty-state__text">Save amp settings you want to reuse.</div></div>'}
      </div>
    `;

    app.querySelector('#new-preset-btn')?.addEventListener('click', () => this.showForm());
    app.querySelectorAll('[data-del]').forEach((btn) => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.del;
      if (confirm('Delete preset?')) {
        await DB.deletePreset(id);
        this.render();
      }
    }));

    app.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.edit;
      const preset = await DB.getPreset(id);
      this.showForm(preset);
      document.getElementById('preset-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  },

  card(p) {
    const settings = this.parseSettings(p.settings);
    return `<div style="border:1px solid var(--line2);padding:14px;background:var(--bg1);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <strong>${this.escapeHtml(p.name)}</strong>
        <div style="display:flex;gap:6px;">
          <button class="df-btn" data-edit="${p.id}" style="padding:4px 8px;font-size:10px;">Edit</button>
          <button class="df-btn df-btn--danger" data-del="${p.id}" style="padding:4px 8px;font-size:10px;">Delete</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Amp: ${this.escapeHtml(p.ampModel || '—')} · ${this.escapeHtml(settings.channel || '—')}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Gain: Pre ${settings.gain.pre} / Post ${settings.gain.post}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">EQ: L ${settings.eq.low} · M ${settings.eq.mid} · H ${settings.eq.high}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Tags: ${this.escapeHtml(this.prettyTags(p))}</div>
      ${settings.imagePath ? `<img src="${settings.imagePath}" alt="Preset amp" style="margin-top:8px;width:100%;max-height:160px;object-fit:cover;border:1px solid var(--line2);" />` : ''}
      <pre style="white-space:pre-wrap;color:var(--text3);font-size:11px;margin-top:8px;">${this.escapeHtml(JSON.stringify(settings, null, 2))}</pre>
    </div>`;
  },

  settingsFromForm(form) {
    const fd = new FormData(form);
    const tags = String(fd.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const settings = {
      channel: String(fd.get('channel') || 'clean'),
      gain: {
        pre: Number(fd.get('gainPre') || 0),
        post: Number(fd.get('gainPost') || 0),
      },
      eq: {
        low: Number(fd.get('eqLow') || 0),
        mid: Number(fd.get('eqMid') || 0),
        high: Number(fd.get('eqHigh') || 0),
        presence: Number(fd.get('eqPresence') || 0),
        resonance: Number(fd.get('eqResonance') || 0),
      },
      fx: {},
      knobsPushed: {},
      notes: String(fd.get('notes') || ''),
      tags,
      imagePath: String(fd.get('imagePath') || ''),
    };

    this.fxBlocks.forEach((key) => {
      const params = {};
      Object.keys(this.defaultSettings().fx[key].params).forEach((paramKey) => {
        params[paramKey] = Number(fd.get(`fx_${key}_${paramKey}`) || 0);
      });
      settings.fx[key] = {
        enabled: fd.get(`fx_${key}_enabled`) === 'on',
        params,
      };
    });

    Object.keys(this.defaultSettings().knobsPushed).forEach((knob) => {
      settings.knobsPushed[knob] = fd.get(`knob_${knob}`) === 'on';
    });

    return settings;
  },

  renderFxBlock(key, block) {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    const params = Object.entries(block.params)
      .map(([paramKey, value]) => `<div class="df-field"><label class="df-label">${paramKey}</label><input type="number" name="fx_${key}_${paramKey}" class="df-input" value="${value}"></div>`)
      .join('');

    return `<div style="border:1px solid var(--line2);padding:10px;background:var(--bg0);margin-bottom:8px;">
      <label class="df-label" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><input type="checkbox" name="fx_${key}_enabled" ${block.enabled ? 'checked' : ''}> ${label}</label>
      <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));">${params}</div>
    </div>`;
  },

  showForm(existing = null) {
    const wrap = document.getElementById('preset-form-wrap');
    const settings = this.parseSettings(existing?.settings);
    const isEdit = Boolean(existing?.id);

    wrap.style.display = 'block';
    wrap.innerHTML = `
      <form id="preset-form">
        <input type="hidden" name="id" value="${this.escapeHtml(existing?.id || '')}">
        <input type="hidden" name="imagePath" value="${this.escapeHtml(settings.imagePath || '')}">
        <div class="form-grid" style="gap:12px;">
          <div class="df-field"><label class="df-label">Preset Name</label><input name="name" class="df-input" required value="${this.escapeHtml(existing?.name || '')}"></div>
          <div class="df-field"><label class="df-label">Amp Model</label><input name="ampModel" class="df-input" value="${this.escapeHtml(existing?.ampModel || '')}"></div>

          <div class="df-field"><label class="df-label">Channel</label>
            <select name="channel" class="df-input">
              ${['clean', 'crunch', 'lead', 'modern', 'custom'].map((ch) => `<option value="${ch}" ${settings.channel === ch ? 'selected' : ''}>${ch}</option>`).join('')}
            </select>
          </div>

          <div class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;">
            <strong>Gain Staging</strong>
            <div class="form-grid" style="margin-top:8px;">
              <div class="df-field"><label class="df-label">Gain (Pre)</label><input type="number" name="gainPre" class="df-input" value="${settings.gain.pre}"></div>
              <div class="df-field"><label class="df-label">Gain (Post)</label><input type="number" name="gainPost" class="df-input" value="${settings.gain.post}"></div>
            </div>
          </div>

          <div class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;">
            <strong>EQ</strong>
            <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));">
              <div class="df-field"><label class="df-label">Low</label><input type="number" name="eqLow" class="df-input" value="${settings.eq.low}"></div>
              <div class="df-field"><label class="df-label">Mid</label><input type="number" name="eqMid" class="df-input" value="${settings.eq.mid}"></div>
              <div class="df-field"><label class="df-label">High</label><input type="number" name="eqHigh" class="df-input" value="${settings.eq.high}"></div>
              <div class="df-field"><label class="df-label">Presence</label><input type="number" name="eqPresence" class="df-input" value="${settings.eq.presence}"></div>
              <div class="df-field"><label class="df-label">Resonance</label><input type="number" name="eqResonance" class="df-input" value="${settings.eq.resonance}"></div>
            </div>
          </div>

          <div class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;">
            <strong>FX Blocks</strong>
            <div style="margin-top:8px;">${this.fxBlocks.map((key) => this.renderFxBlock(key, settings.fx[key])).join('')}</div>
          </div>

          <div class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;">
            <strong>Knobs pushed / rotated</strong>
            <div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;">
              ${Object.keys(settings.knobsPushed).map((knob) => `<label class="df-label" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="knob_${knob}" ${settings.knobsPushed[knob] ? 'checked' : ''}> ${knob}</label>`).join('')}
            </div>
          </div>

          <div class="df-field full-width"><label class="df-label">Tags (comma separated)</label><input name="tags" class="df-input" value="${this.escapeHtml(settings.tags.join(', '))}"></div>
          <div class="df-field full-width"><label class="df-label">Notes</label><textarea name="notes" class="df-input" rows="4">${this.escapeHtml(settings.notes)}</textarea></div>

          <div class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;">
            <strong>Image Upload</strong>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;">
              <input type="file" name="imageFile" accept="image/*" class="df-input" style="max-width:280px;">
              <button type="button" id="upload-preset-image" class="df-btn">Upload image</button>
              <span id="preset-image-status" style="font-size:12px;color:var(--text2);"></span>
            </div>
            <img id="preset-image-preview" src="${this.escapeHtml(settings.imagePath)}" alt="Preset image preview" style="${settings.imagePath ? '' : 'display:none;'}margin-top:10px;max-width:260px;border:1px solid var(--line2);">
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="df-btn df-btn--primary" type="submit">${isEdit ? 'Update Preset' : 'Save Preset'}</button>
          <button class="df-btn" type="button" id="cancel-preset-form">Cancel</button>
        </div>
      </form>
    `;

    const form = wrap.querySelector('#preset-form');
    const uploadBtn = wrap.querySelector('#upload-preset-image');
    const statusEl = wrap.querySelector('#preset-image-status');
    const previewEl = wrap.querySelector('#preset-image-preview');

    uploadBtn.addEventListener('click', async () => {
      const file = form.imageFile.files[0];
      if (!file) {
        statusEl.textContent = 'Choose an image first.';
        return;
      }

      statusEl.textContent = 'Uploading...';
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = String(reader.result || '');
          const response = await DB.uploadPresetImage({
            fileName: file.name,
            mimeType: file.type,
            dataBase64: dataUrl,
          });
          form.imagePath.value = response.filePath || '';
          previewEl.src = form.imagePath.value;
          previewEl.style.display = form.imagePath.value ? 'block' : 'none';
          statusEl.textContent = 'Uploaded.';
        } catch (err) {
          statusEl.textContent = err.message || 'Upload failed.';
        }
      };
      reader.onerror = () => {
        statusEl.textContent = 'Could not read image file.';
      };
      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const settingsPayload = this.settingsFromForm(form);
      const payload = {
        id: form.id.value || undefined,
        name: form.name.value,
        ampModel: form.ampModel.value,
        tags: settingsPayload.tags.join(', '),
        settings: settingsPayload,
      };
      await DB.savePreset(payload);
      this.render();
    });

    wrap.querySelector('#cancel-preset-form').addEventListener('click', () => {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
    });
  },
};
