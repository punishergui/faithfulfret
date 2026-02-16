import { VYPYRX2_PANEL_MAP } from '../lib/vypyrx2-panel-map.js';

window.Pages = window.Pages || {};

Pages.Presets = {
  fxBlocks: ['noiseGate', 'overdrive', 'delay', 'reverb', 'modulation'],
  encoderColors: ['green', 'yellow', 'red'],
  toneClockLabels: ['7:30', '9:00', '10:30', '12:00', '1:30', '3:00', '4:30'],

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  },

  defaultVypyrX2() {
    return {
      encoders: {
        instStomp: { index: 0, color: 'green' },
        amp: { index: 0, channel: 'green' },
        effects: { index: 0, color: 'green' },
      },
      knobs: {
        preGain: 0,
        low: 0,
        mid: 0,
        high: 0,
        postGain: 0,
      },
      bank: 0,
      status: {
        looper: false,
        edit: false,
        tempo: false,
      },
    };
  },

  normalizeVypyrX2(raw) {
    const defaults = this.defaultVypyrX2();
    const parsed = raw && typeof raw === 'object' ? raw : {};
    const normalized = {
      encoders: {
        instStomp: {
          index: this.clamp(parsed.encoders?.instStomp?.index, 0, 11),
          color: this.encoderColors.includes(parsed.encoders?.instStomp?.color) ? parsed.encoders.instStomp.color : defaults.encoders.instStomp.color,
        },
        amp: {
          index: this.clamp(parsed.encoders?.amp?.index, 0, 11),
          channel: this.encoderColors.includes(parsed.encoders?.amp?.channel) ? parsed.encoders.amp.channel : defaults.encoders.amp.channel,
        },
        effects: {
          index: this.clamp(parsed.encoders?.effects?.index, 0, 11),
          color: this.encoderColors.includes(parsed.encoders?.effects?.color) ? parsed.encoders.effects.color : defaults.encoders.effects.color,
        },
      },
      knobs: {
        preGain: this.clamp(parsed.knobs?.preGain, 0, 6),
        low: this.clamp(parsed.knobs?.low, 0, 6),
        mid: this.clamp(parsed.knobs?.mid, 0, 6),
        high: this.clamp(parsed.knobs?.high, 0, 6),
        postGain: this.clamp(parsed.knobs?.postGain, 0, 6),
      },
      bank: this.clamp(parsed.bank, 0, 3),
      status: {
        looper: Boolean(parsed.status?.looper),
        edit: Boolean(parsed.status?.edit),
        tempo: Boolean(parsed.status?.tempo),
      },
    };

    return normalized;
  },

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
      vypyrX2: this.defaultVypyrX2(),
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
      vypyrX2: this.normalizeVypyrX2(parsed.vypyrX2),
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

  getNotesPreview(notes) {
    const compact = String(notes || '').trim().replace(/\s+/g, ' ');
    if (!compact) return 'No notes yet.';
    return compact.length > 100 ? `${compact.slice(0, 100)}…` : compact;
  },

  renderRingDots(points, activeIndex, color) {
    return points.map((point, index) => `<span class="amp-dot ${index === activeIndex ? `is-on ${color}` : ''}" style="left:${point.x * 100}%;top:${point.y * 100}%;"></span>`).join('');
  },

  renderSingleDots(dots, activeKey, color = 'blue') {
    return Object.entries(dots)
      .map(([key, point]) => `<span class="amp-dot ${key === activeKey ? `is-on ${color}` : ''}" style="left:${point.x * 100}%;top:${point.y * 100}%;"></span>`)
      .join('');
  },

  renderStatusDots(status) {
    return Object.entries(VYPYRX2_PANEL_MAP.status)
      .map(([key, point]) => `<span class="amp-dot ${status[key] ? 'is-on yellow' : ''}" style="left:${point.x * 100}%;top:${point.y * 100}%;"></span>`)
      .join('');
  },

  renderVypyrX2Overlay(vypyrX2Settings, compact = false) {
    const normalized = this.normalizeVypyrX2(vypyrX2Settings);
    const cls = compact ? 'amp-panel amp-panel--compact' : 'amp-panel';

    return `<div class="${cls}">
      <img class="amp-panel__bg" src="/img/amps/vypyrx2-top.png" alt="Peavey Vypyr X2 top panel">
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.encoders.instStomp, normalized.encoders.instStomp.index, normalized.encoders.instStomp.color)}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.encoders.amp, normalized.encoders.amp.index, normalized.encoders.amp.channel)}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.encoders.effects, normalized.encoders.effects.index, normalized.encoders.effects.color)}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.knobs.preGain, normalized.knobs.preGain, 'blue')}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.knobs.low, normalized.knobs.low, 'blue')}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.knobs.mid, normalized.knobs.mid, 'blue')}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.knobs.high, normalized.knobs.high, 'blue')}
      ${this.renderRingDots(VYPYRX2_PANEL_MAP.knobs.postGain, normalized.knobs.postGain, 'blue')}
      ${this.renderSingleDots(VYPYRX2_PANEL_MAP.bank, String(normalized.bank), 'blue')}
      ${this.renderStatusDots(normalized.status)}
    </div>`;
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
      <div style="margin-top:8px;">${this.renderVypyrX2Overlay(settings.vypyrX2, true)}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:8px;">Tags: ${this.escapeHtml(this.prettyTags(p))}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Notes: ${this.escapeHtml(this.getNotesPreview(settings.notes))}</div>
      ${settings.imagePath ? `<img src="${settings.imagePath}" alt="Preset amp" style="margin-top:8px;width:100%;max-height:120px;object-fit:cover;border:1px solid var(--line2);" />` : ''}
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:12px;color:var(--text2);">Advanced JSON</summary>
        <pre style="white-space:pre-wrap;color:var(--text2);font-size:11px;margin-top:6px;">${this.escapeHtml(JSON.stringify(settings, null, 2))}</pre>
      </details>
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
      vypyrX2: this.normalizeVypyrX2({
        encoders: {
          instStomp: {
            index: Number(fd.get('v2_inst_index') || 0),
            color: String(fd.get('v2_inst_color') || 'green'),
          },
          amp: {
            index: Number(fd.get('v2_amp_index') || 0),
            channel: String(fd.get('v2_amp_channel') || 'green'),
          },
          effects: {
            index: Number(fd.get('v2_fx_index') || 0),
            color: String(fd.get('v2_fx_color') || 'green'),
          },
        },
        knobs: {
          preGain: Number(fd.get('v2_knob_preGain') || 0),
          low: Number(fd.get('v2_knob_low') || 0),
          mid: Number(fd.get('v2_knob_mid') || 0),
          high: Number(fd.get('v2_knob_high') || 0),
          postGain: Number(fd.get('v2_knob_postGain') || 0),
        },
        bank: Number(fd.get('v2_bank') || 0),
        status: {
          looper: fd.get('v2_status_looper') === 'on',
          edit: fd.get('v2_status_edit') === 'on',
          tempo: fd.get('v2_status_tempo') === 'on',
        },
      }),
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

  renderEncoderFieldset(label, key, model, helperText) {
    return `<div style="border:1px solid var(--line2);padding:10px;background:var(--bg0);">
      <strong style="font-size:13px;">${label}</strong>
      <p style="margin-top:4px;font-size:12px;color:var(--text2);">${helperText}</p>
      <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
        <div class="df-field"><label class="df-label">LED Position</label>
          <select name="v2_${key}_index" class="df-input">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${model.index === i ? 'selected' : ''}>${i + 1} of 12</option>`).join('')}
          </select>
        </div>
        <div class="df-field"><label class="df-label">Color</label>
          <select name="v2_${key}_${key === 'amp' ? 'channel' : 'color'}" class="df-input">
            ${this.encoderColors.map((color) => `<option value="${color}" ${String(model[key === 'amp' ? 'channel' : 'color']) === color ? 'selected' : ''}>${color}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
  },

  renderToneKnobControl(label, key, value) {
    return `<div class="df-field">
      <label class="df-label">${label}</label>
      <select name="v2_knob_${key}" class="df-input">
        ${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${value === index ? 'selected' : ''}>${clock}</option>`).join('')}
      </select>
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
            <strong>Vypyr X2 Panel</strong>
            <p style="margin-top:4px;font-size:12px;color:var(--text2);">Use the selectors below to match what you see on the real amp panel.</p>
            <div id="vypyrx2-overlay-preview" style="margin-top:10px;"></div>
            <div style="margin-top:10px;display:grid;gap:8px;">
              ${this.renderEncoderFieldset('Inst/Stomp', 'inst', settings.vypyrX2.encoders.instStomp, 'This matches the LED ring on the amp. Pick the lit LED position you see.')}
              ${this.renderEncoderFieldset('Amp', 'amp', settings.vypyrX2.encoders.amp, 'This matches the AMP selector ring and channel color on the amp.')}
              ${this.renderEncoderFieldset('Effects', 'fx', settings.vypyrX2.encoders.effects, 'This matches the LED ring on the amp. Pick the lit LED position you see.')}
            </div>
            <div style="margin-top:10px;border:1px solid var(--line2);padding:10px;background:var(--bg0);">
              <strong style="font-size:13px;">Tone Knobs</strong>
              <p style="margin-top:4px;font-size:12px;color:var(--text2);">7-position clock selector (7:30 to 4:30, no 6 o'clock LED).</p>
              <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
                ${this.renderToneKnobControl('Pre', 'preGain', settings.vypyrX2.knobs.preGain)}
                ${this.renderToneKnobControl('Low', 'low', settings.vypyrX2.knobs.low)}
                ${this.renderToneKnobControl('Mid', 'mid', settings.vypyrX2.knobs.mid)}
                ${this.renderToneKnobControl('High', 'high', settings.vypyrX2.knobs.high)}
                ${this.renderToneKnobControl('Post', 'postGain', settings.vypyrX2.knobs.postGain)}
              </div>
            </div>
            <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
              <div class="df-field"><label class="df-label">Bank</label>
                <select name="v2_bank" class="df-input">
                  ${[1, 2, 3, 4].map((label, index) => `<option value="${index}" ${settings.vypyrX2.bank === index ? 'selected' : ''}>Bank ${label}</option>`).join('')}
                </select>
                <p style="margin-top:4px;font-size:12px;color:var(--text2);">Pick the active bank LED shown on your amp.</p>
              </div>
              <div style="border:1px solid var(--line2);padding:10px;background:var(--bg0);">
                <strong style="font-size:13px;">Status LEDs</strong>
                <p style="margin-top:4px;font-size:12px;color:var(--text2);">Toggle LEDs that are currently lit.</p>
                <div style="margin-top:8px;display:grid;gap:6px;">
                  ${['looper', 'edit', 'tempo'].map((key) => `<label class="df-label" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="v2_status_${key}" ${settings.vypyrX2.status[key] ? 'checked' : ''}> ${key[0].toUpperCase() + key.slice(1)}</label>`).join('')}
                </div>
              </div>
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
    const overlayPreview = wrap.querySelector('#vypyrx2-overlay-preview');

    const refreshOverlay = () => {
      const draftSettings = this.settingsFromForm(form);
      overlayPreview.innerHTML = this.renderVypyrX2Overlay(draftSettings.vypyrX2);
    };

    refreshOverlay();
    form.querySelectorAll('select,input[type="checkbox"]').forEach((input) => {
      if (String(input.name || '').startsWith('v2_')) {
        input.addEventListener('change', refreshOverlay);
      }
    });

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
