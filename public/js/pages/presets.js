window.Pages = window.Pages || {};

Pages.Presets = {
  fxBlocks: ['noiseGate', 'overdrive', 'delay', 'reverb', 'modulation'],
  encoderColors: ['green', 'yellow', 'red'],
  instStompColors: ['red', 'green'],
  ampChannelColors: ['green', 'orange', 'yellow', 'red'],
  effectTypes: ['Delay', 'Reverb', 'Chorus', 'Phaser', 'Flanger', 'Tremolo', 'Octaver', 'Pitch Shifter', 'Rotary', 'Filter', 'Compressor', 'Noise Gate', 'Overdrive'],
  bankOptions: ['A', 'B', 'C', 'D'],
  slotColors: ['red', 'orange', 'yellow', 'green'],
  toneClockLabels: ['7:30', '9:00', '10:30', '12:00', '1:30', '3:00', '4:30'],

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  },

  makeUid() {
    return `fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  defaultVypyrX2() {
    return {
      encoders: {
        instStomp: { index: 0, color: 'green' },
        amp: { index: 0, channel: 'green' },
        effects: { index: 0, color: 'green' },
      },
      knobs: {
        preGain: 3,
        low: 3,
        mid: 3,
        high: 3,
        postGain: 3,
      },
      bank: 'A',
      slotColor: 'green',
      status: {
        looper: false,
        edit: false,
        tempo: false,
      },
      effectRows: [],
    };
  },

  normalizeVypyrX2EffectRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        uid: row.uid || this.makeUid(),
        effect: this.effectTypes.includes(row.effect) ? row.effect : 'Delay',
        p1: this.clamp(row.p1, 0, 6),
        p2: this.clamp(row.p2, 0, 6),
        delayFeedback: this.clamp(row.delayFeedback, 0, 6),
        delayLevel: this.clamp(row.delayLevel, 0, 6),
        reverbLevel: this.clamp(row.reverbLevel, 0, 6),
      }));
  },

  normalizeVypyrX2(raw) {
    const defaults = this.defaultVypyrX2();
    const parsed = raw && typeof raw === 'object' ? raw : {};
    const legacyBank = Number.isInteger(parsed.bank) ? this.bankOptions[this.clamp(parsed.bank, 0, 3)] : null;

    return {
      encoders: {
        instStomp: {
          index: this.clamp(parsed.encoders?.instStomp?.index, 0, 11),
          color: this.instStompColors.includes(parsed.encoders?.instStomp?.color) ? parsed.encoders.instStomp.color : defaults.encoders.instStomp.color,
        },
        amp: {
          index: this.clamp(parsed.encoders?.amp?.index, 0, 11),
          channel: this.ampChannelColors.includes(parsed.encoders?.amp?.channel) ? parsed.encoders.amp.channel : defaults.encoders.amp.channel,
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
      bank: this.bankOptions.includes(parsed.bank) ? parsed.bank : (legacyBank || defaults.bank),
      slotColor: this.slotColors.includes(parsed.slotColor) ? parsed.slotColor : defaults.slotColor,
      status: {
        looper: Boolean(parsed.status?.looper),
        edit: Boolean(parsed.status?.edit),
        tempo: Boolean(parsed.status?.tempo),
      },
      effectRows: this.normalizeVypyrX2EffectRows(parsed.effectRows),
    };
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

  toneLabel(index) {
    return this.toneClockLabels[this.clamp(index, 0, this.toneClockLabels.length - 1)] || this.toneClockLabels[3];
  },

  renderVypyrSummary(v2) {
    return `<div style="font-size:12px;color:var(--text2);display:grid;gap:4px;">
      <div><strong>Vypyr X2:</strong> Bank ${this.escapeHtml(v2.bank)} · Slot ${this.escapeHtml(v2.slotColor)}</div>
      <div>Inst/Stomp ${v2.encoders.instStomp.index + 1}/12 (${this.escapeHtml(v2.encoders.instStomp.color)}) · Amp ${v2.encoders.amp.index + 1}/12 (${this.escapeHtml(v2.encoders.amp.channel)}) · Effects ${v2.encoders.effects.index + 1}/12 (${this.escapeHtml(v2.encoders.effects.color)})</div>
      <div>Pre ${this.toneLabel(v2.knobs.preGain)} · Low ${this.toneLabel(v2.knobs.low)} · Mid ${this.toneLabel(v2.knobs.mid)} · High ${this.toneLabel(v2.knobs.high)} · Post ${this.toneLabel(v2.knobs.postGain)}</div>
      <div>Effect rows: ${v2.effectRows.length}</div>
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

  renderEncoderFieldset(label, key, model, helperText, colors) {
    const colorField = key === 'amp' ? 'channel' : 'color';
    return `<div style="border:1px solid var(--line2);padding:10px;background:var(--bg0);">
      <strong style="font-size:13px;">${label}</strong>
      <p style="margin-top:4px;font-size:12px;color:var(--text2);">${helperText}</p>
      <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
        <div class="df-field"><label class="df-label">Position</label>
          <select name="v2_${key}_index" class="df-input">
            ${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${model.index === i ? 'selected' : ''}>${i + 1} of 12</option>`).join('')}
          </select>
        </div>
        <div class="df-field"><label class="df-label">Color</label>
          <select name="v2_${key}_${colorField}" class="df-input">
            ${colors.map((color) => `<option value="${color}" ${String(model[colorField]) === color ? 'selected' : ''}>${color}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>`;
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
      <div style="margin-top:8px;">${this.renderVypyrSummary(settings.vypyrX2)}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:8px;">Tags: ${this.escapeHtml(this.prettyTags(p))}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Notes: ${this.escapeHtml(this.getNotesPreview(settings.notes))}</div>
      ${settings.imagePath ? `<img src="${settings.imagePath}" alt="Preset amp" style="margin-top:8px;width:100%;max-height:120px;object-fit:cover;border:1px solid var(--line2);" />` : ''}
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:12px;color:var(--text2);">Raw data</summary>
        <pre style="white-space:pre-wrap;color:var(--text2);font-size:11px;margin-top:6px;">${this.escapeHtml(JSON.stringify(settings, null, 2))}</pre>
      </details>
    </div>`;
  },

  collectEffectRows(form) {
    const rows = [];
    form.querySelectorAll('[data-effect-row]').forEach((rowEl) => {
      rows.push({
        uid: rowEl.dataset.uid || this.makeUid(),
        effect: String(rowEl.querySelector('[name="v2_effect_type"]')?.value || 'Delay'),
        p1: Number(rowEl.querySelector('[name="v2_effect_p1"]')?.value || 0),
        p2: Number(rowEl.querySelector('[name="v2_effect_p2"]')?.value || 0),
        delayFeedback: Number(rowEl.querySelector('[name="v2_effect_delayFeedback"]')?.value || 0),
        delayLevel: Number(rowEl.querySelector('[name="v2_effect_delayLevel"]')?.value || 0),
        reverbLevel: Number(rowEl.querySelector('[name="v2_effect_reverbLevel"]')?.value || 0),
      });
    });
    return this.normalizeVypyrX2EffectRows(rows);
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
        bank: String(fd.get('v2_bank') || 'A'),
        slotColor: String(fd.get('v2_slotColor') || 'green'),
        status: {
          looper: fd.get('v2_status_looper') === 'on',
          edit: fd.get('v2_status_edit') === 'on',
          tempo: fd.get('v2_status_tempo') === 'on',
        },
        effectRows: this.collectEffectRows(form),
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

  renderEffectRow(row) {
    return `<div data-effect-row data-uid="${this.escapeHtml(row.uid)}" style="border:1px solid var(--line2);padding:10px;background:var(--bg0);display:grid;gap:8px;margin-bottom:8px;">
      <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
        <div class="df-field"><label class="df-label">Effect</label>
          <select name="v2_effect_type" class="df-input">
            ${this.effectTypes.map((effect) => `<option value="${effect}" ${row.effect === effect ? 'selected' : ''}>${effect}</option>`).join('')}
          </select>
        </div>
        <div class="df-field"><label class="df-label">P1</label>
          <select name="v2_effect_p1" class="df-input">${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${row.p1 === index ? 'selected' : ''}>${clock}</option>`).join('')}</select>
        </div>
        <div class="df-field"><label class="df-label">P2</label>
          <select name="v2_effect_p2" class="df-input">${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${row.p2 === index ? 'selected' : ''}>${clock}</option>`).join('')}</select>
        </div>
        <div class="df-field"><label class="df-label">Delay Feedback</label>
          <select name="v2_effect_delayFeedback" class="df-input">${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${row.delayFeedback === index ? 'selected' : ''}>${clock}</option>`).join('')}</select>
        </div>
        <div class="df-field"><label class="df-label">Delay Level</label>
          <select name="v2_effect_delayLevel" class="df-input">${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${row.delayLevel === index ? 'selected' : ''}>${clock}</option>`).join('')}</select>
        </div>
        <div class="df-field"><label class="df-label">Reverb Level</label>
          <select name="v2_effect_reverbLevel" class="df-input">${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${row.reverbLevel === index ? 'selected' : ''}>${clock}</option>`).join('')}</select>
        </div>
      </div>
      <div><button type="button" class="df-btn df-btn--danger" data-remove-effect="${this.escapeHtml(row.uid)}">Remove row</button></div>
    </div>`;
  },

  bindEffectRows(form, settings) {
    const rowsWrap = form.querySelector('#vypyrx2-effect-rows');
    const addBtn = form.querySelector('#add-vypyrx2-effect-row');
    let rows = [...settings.vypyrX2.effectRows];

    const renderRows = () => {
      rowsWrap.innerHTML = rows.length
        ? rows.map((row) => this.renderEffectRow(row)).join('')
        : '<div style="font-size:12px;color:var(--text2);">No effect rows yet.</div>';

      rowsWrap.querySelectorAll('[data-remove-effect]').forEach((btn) => {
        btn.addEventListener('click', () => {
          rows = rows.filter((row) => row.uid !== btn.dataset.removeEffect);
          renderRows();
        });
      });
    };

    addBtn.addEventListener('click', () => {
      rows.push({
        uid: this.makeUid(),
        effect: 'Delay',
        p1: 3,
        p2: 3,
        delayFeedback: 3,
        delayLevel: 3,
        reverbLevel: 3,
      });
      renderRows();
    });

    renderRows();
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
        <div style="border:1px solid var(--line2);padding:12px;background:var(--bg1);margin-bottom:12px;">
          <strong style="font-size:13px;">Vypyr X2 Top Panel Reference</strong>
          <p style="margin-top:4px;font-size:12px;color:var(--text2);">Reference only. Use selectors in the editor to capture panel state.</p>
          <img src="/img/amps/vypyrx2-top.png" alt="Vypyr X2 top panel" style="margin-top:8px;max-width:100%;height:auto;border:1px solid var(--line2);">
        </div>
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

  showForm(existing = null) {
    const wrap = document.getElementById('preset-form-wrap');
    const settings = this.parseSettings(existing?.settings);
    const isEdit = Boolean(existing?.id);

    wrap.style.display = 'block';
    wrap.innerHTML = `
      <form id="preset-form">
        <input type="hidden" name="id" value="${this.escapeHtml(existing?.id || '')}">
        <input type="hidden" name="imagePath" value="${this.escapeHtml(settings.imagePath || '')}">
        <input type="hidden" name="gainPre" value="${settings.gain.pre}">
        <input type="hidden" name="gainPost" value="${settings.gain.post}">
        <input type="hidden" name="eqLow" value="${settings.eq.low}">
        <input type="hidden" name="eqMid" value="${settings.eq.mid}">
        <input type="hidden" name="eqHigh" value="${settings.eq.high}">
        <input type="hidden" name="eqPresence" value="${settings.eq.presence}">
        <input type="hidden" name="eqResonance" value="${settings.eq.resonance}">
        <div class="form-grid" style="gap:12px;">
          <div class="df-field"><label class="df-label">Preset Name</label><input name="name" class="df-input" required value="${this.escapeHtml(existing?.name || '')}"></div>
          <div class="df-field"><label class="df-label">Amp Model</label><input name="ampModel" class="df-input" value="${this.escapeHtml(existing?.ampModel || '')}"></div>

          <div class="df-field"><label class="df-label">Channel</label>
            <select name="channel" class="df-input">
              ${['clean', 'crunch', 'lead', 'modern', 'custom'].map((ch) => `<option value="${ch}" ${settings.channel === ch ? 'selected' : ''}>${ch}</option>`).join('')}
            </select>
          </div>

          <div class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;">
            <strong>Vypyr X2 Panel</strong>
            <p style="margin-top:4px;font-size:12px;color:var(--text2);">Selector-only editor for beginner-friendly input.</p>
            <img src="/img/amps/vypyrx2-top.png" alt="Vypyr X2 top panel reference" style="margin-top:8px;max-width:100%;height:auto;border:1px solid var(--line2);">
            <div style="margin-top:10px;display:grid;gap:8px;">
              ${this.renderEncoderFieldset('Inst/Stomp', 'inst', settings.vypyrX2.encoders.instStomp, 'Select ring position + LED color.', this.instStompColors)}
              ${this.renderEncoderFieldset('Amp', 'amp', settings.vypyrX2.encoders.amp, 'Select ring position + channel color.', this.ampChannelColors)}
              ${this.renderEncoderFieldset('Effects', 'fx', settings.vypyrX2.encoders.effects, 'Select ring position + LED color.', this.encoderColors)}
            </div>
            <div style="margin-top:10px;border:1px solid var(--line2);padding:10px;background:var(--bg0);">
              <strong style="font-size:13px;">Tone Ring Selectors</strong>
              <p style="margin-top:4px;font-size:12px;color:var(--text2);">7-position clock selector (stored internally as 0..6).</p>
              <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
                ${this.renderToneKnobControl('Pre Gain', 'preGain', settings.vypyrX2.knobs.preGain)}
                ${this.renderToneKnobControl('Low', 'low', settings.vypyrX2.knobs.low)}
                ${this.renderToneKnobControl('Mid', 'mid', settings.vypyrX2.knobs.mid)}
                ${this.renderToneKnobControl('High', 'high', settings.vypyrX2.knobs.high)}
                ${this.renderToneKnobControl('Post Gain', 'postGain', settings.vypyrX2.knobs.postGain)}
              </div>
            </div>
            <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
              <div class="df-field"><label class="df-label">Bank</label>
                <select name="v2_bank" class="df-input">
                  ${this.bankOptions.map((bank) => `<option value="${bank}" ${settings.vypyrX2.bank === bank ? 'selected' : ''}>${bank}</option>`).join('')}
                </select>
              </div>
              <div class="df-field"><label class="df-label">Slot</label>
                <select name="v2_slotColor" class="df-input">
                  ${this.slotColors.map((slot) => `<option value="${slot}" ${settings.vypyrX2.slotColor === slot ? 'selected' : ''}>${slot}</option>`).join('')}
                </select>
                <p style="margin-top:4px;font-size:12px;color:var(--text2);">Banks A–D are the four banks. Slot colors are the four presets per bank.</p>
              </div>
              <div style="border:1px solid var(--line2);padding:10px;background:var(--bg0);">
                <strong style="font-size:13px;">Status LEDs</strong>
                <p style="margin-top:4px;font-size:12px;color:var(--text2);">LED currently lit on panel (optional).</p>
                <div style="margin-top:8px;display:grid;gap:6px;">
                  <label class="df-label" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="v2_status_looper" ${settings.vypyrX2.status.looper ? 'checked' : ''}> Looper</label>
                  <label class="df-label" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="v2_status_edit" ${settings.vypyrX2.status.edit ? 'checked' : ''}> Edit Mode</label>
                  <label class="df-label" style="display:flex;align-items:center;gap:8px;"><input type="checkbox" name="v2_status_tempo" ${settings.vypyrX2.status.tempo ? 'checked' : ''}> Tap Tempo</label>
                </div>
              </div>
            </div>
            <div style="margin-top:10px;border:1px solid var(--line2);padding:10px;background:var(--bg0);">
              <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                <strong style="font-size:13px;">Effects (Edit Mode Parameters)</strong>
                <button type="button" class="df-btn" id="add-vypyrx2-effect-row">+ Add Effect</button>
              </div>
              <div id="vypyrx2-effect-rows" style="margin-top:8px;"></div>
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

    this.bindEffectRows(form, settings);

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
