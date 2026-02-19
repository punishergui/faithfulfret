window.Pages = window.Pages || {};

Pages.Presets = {
  ampModels: ['Generic', 'Vypyr X2'],
  bankOptions: ['A', 'B', 'C', 'D'],
  slotColors: ['Red', 'Orange', 'Yellow', 'Green'],
  toneClockLabels: ['7:30', '9:00', '10:30', '12:00', '1:30', '3:00', '4:30'],
  instStompOptions: ['Bypass', 'Acs 1/2', '12Str/7Str', 'Res/Sit', 'Evio*/Syn*', 'Bari/Bss*', 'Rmd/Slap', 'Achr/Uvb', 'Wah/Slice', 'Aphs/Aflg', 'Comp/Bst', 'Tsc/Fuzz'],
  ampDialOptions: ['Budda', '6506', '6534', 'XXX', 'Classic', 'Butcher', 'British', 'Peavy(Base)', 'Trace(Bass)', 'Ecous(Acous)', 'Trace(Acous)', 'Twn'],
  effectsDialOptions: ['Bypass', 'Chorus', 'Env', 'Filtr', 'Comp Bst', 'Flanger', 'M.O.G.*', 'Pitch Shifter', 'Reverse', 'Rot. Spkr', 'Phaser', 'Octaver*', 'Tremelo'],
  ampLedColorOptions: ['green', 'amber', 'red'],

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  },

  makeUid() {
    return `fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  toneLabel(index) {
    return this.toneClockLabels[this.clamp(index, 0, this.toneClockLabels.length - 1)] || this.toneClockLabels[3];
  },

  normalizeRowKnobValue(value) {
    if (value === '' || value === null || value === undefined) return -1;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return -1;
    if (parsed < 0) return -1;
    return this.clamp(parsed, 0, 6);
  },

  renderRowKnobOptions(value) {
    return [
      `<option value="-1" ${value === -1 ? 'selected' : ''}>Off</option>`,
      ...this.toneClockLabels.map((clock, index) => `<option value="${index}" ${value === index ? 'selected' : ''}>${clock}</option>`),
    ].join('');
  },

  defaultVypyrRow(label = '') {
    return {
      uid: this.makeUid(),
      label,
      p1: 3,
      p2: 3,
      delayFeedback: 3,
      delayLevel: 3,
      reverbLevel: 3,
    };
  },

  normalizeVypyrRows(rows, fallbackLabel, options) {
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        uid: row.uid || this.makeUid(),
        label: options.includes(row.label) ? row.label : fallbackLabel,
        p1: this.normalizeRowKnobValue(row.p1),
        p2: this.normalizeRowKnobValue(row.p2),
        delayFeedback: this.normalizeRowKnobValue(row.delayFeedback),
        delayLevel: this.normalizeRowKnobValue(row.delayLevel),
        reverbLevel: this.normalizeRowKnobValue(row.reverbLevel),
      }));
  },

  defaultVypyrX2() {
    return {
      bankLetter: 'A',
      slotColor: 'Red',
      instStompLabel: this.instStompOptions[0],
      ampLabel: this.ampDialOptions[0],
      ampLedColor: this.ampLedColorOptions[0],
      effectsLabel: this.effectsDialOptions[0],
      tone: {
        pre: 3,
        low: 3,
        mid: 3,
        high: 3,
        post: 3,
      },
      instStompRows: [],
      effectsRows: [],
    };
  },

  normalizeVypyrX2(raw) {
    const defaults = this.defaultVypyrX2();
    const parsed = raw && typeof raw === 'object' ? raw : {};
    const legacyBank = Number.isInteger(parsed.bank) ? this.bankOptions[this.clamp(parsed.bank, 0, 3)] : null;
    const legacyInstIndex = this.clamp(parsed.encoders?.instStomp?.index, 0, this.instStompOptions.length - 1);
    const legacyAmpIndex = this.clamp(parsed.encoders?.amp?.index, 0, this.ampDialOptions.length - 1);
    const legacyEffectsIndex = this.clamp(parsed.encoders?.effects?.index, 0, this.effectsDialOptions.length - 1);

    return {
      bankLetter: this.bankOptions.includes(parsed.bankLetter) ? parsed.bankLetter : (this.bankOptions.includes(parsed.bank) ? parsed.bank : (legacyBank || defaults.bankLetter)),
      slotColor: this.slotColors.includes(parsed.slotColor) ? parsed.slotColor : defaults.slotColor,
      instStompLabel: this.instStompOptions.includes(parsed.instStompLabel) ? parsed.instStompLabel : this.instStompOptions[legacyInstIndex],
      ampLabel: this.ampDialOptions.includes(parsed.ampLabel) ? parsed.ampLabel : this.ampDialOptions[legacyAmpIndex],
      ampLedColor: this.ampLedColorOptions.includes(parsed.ampLedColor) ? parsed.ampLedColor : defaults.ampLedColor,
      effectsLabel: this.effectsDialOptions.includes(parsed.effectsLabel) ? parsed.effectsLabel : this.effectsDialOptions[legacyEffectsIndex],
      tone: {
        pre: this.clamp(parsed.tone?.pre ?? parsed.knobs?.preGain, 0, 6),
        low: this.clamp(parsed.tone?.low ?? parsed.knobs?.low, 0, 6),
        mid: this.clamp(parsed.tone?.mid ?? parsed.knobs?.mid, 0, 6),
        high: this.clamp(parsed.tone?.high ?? parsed.knobs?.high, 0, 6),
        post: this.clamp(parsed.tone?.post ?? parsed.knobs?.postGain, 0, 6),
      },
      instStompRows: this.normalizeVypyrRows(parsed.instStompRows || parsed.effectRows, this.instStompOptions.includes(parsed.instStompLabel) ? parsed.instStompLabel : this.instStompOptions[legacyInstIndex], this.instStompOptions),
      effectsRows: this.normalizeVypyrRows(parsed.effectsRows, this.effectsDialOptions.includes(parsed.effectsLabel) ? parsed.effectsLabel : this.effectsDialOptions[legacyEffectsIndex], this.effectsDialOptions),
    };
  },

  defaultSettings() {
    return {
      ampModel: 'Generic',
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

  parseSettings(raw, presetAmpModel = '') {
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
    Object.keys(defaults.fx).forEach((key) => {
      mergedFx[key] = {
        enabled: Boolean(mergedFx[key]?.enabled),
        params: { ...(defaults.fx[key]?.params || {}), ...(mergedFx[key]?.params || {}) },
      };
    });

    const ampModel = this.ampModels.includes(parsed.ampModel)
      ? parsed.ampModel
      : (this.ampModels.includes(presetAmpModel) ? presetAmpModel : defaults.ampModel);

    return {
      ...defaults,
      ...parsed,
      ampModel,
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
    const settings = this.parseSettings(p.settings, p.ampModel);
    if (settings.tags.length) return settings.tags.join(', ');
    return p.tags || '—';
  },

  getNotesPreview(notes) {
    const compact = String(notes || '').trim().replace(/\s+/g, ' ');
    if (!compact) return 'No notes yet.';
    return compact.length > 100 ? `${compact.slice(0, 100)}…` : compact;
  },

  renderDialField(name, label, value, options, helperText = '', extraContent = '') {
    return `<div class="df-panel df-panel--tight" style="padding:10px;">
      <label class="df-label">${label}</label>
      <select name="${name}" class="df-input" style="margin-top:6px;">
        ${options.map((option) => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('')}
      </select>
      ${helperText ? `<p style="margin-top:6px;font-size:12px;color:var(--text2);">${helperText}</p>` : ''}
      ${extraContent}
    </div>`;
  },

  renderToneKnobControl(label, key, value) {
    return `<div class="df-field">
      <label class="df-label">${label}</label>
      <select name="v2_tone_${key}" class="df-input">
        ${this.toneClockLabels.map((clock, index) => `<option value="${index}" ${value === index ? 'selected' : ''}>${clock}</option>`).join('')}
      </select>
    </div>`;
  },

  renderVypyrRow(scope, row, rowLabel, labelOptions) {
    return `<div data-v2-row="${scope}" data-uid="${this.escapeHtml(row.uid)}" class="df-panel df-panel--tight" style="padding:10px;display:grid;gap:8px;margin-bottom:8px;">
      <div class="df-field"><label class="df-label">${rowLabel}</label>
        <select name="${scope}_label" class="df-input">${labelOptions.map((option) => `<option value="${option}" ${row.label === option ? 'selected' : ''}>${option}</option>`).join('')}</select>
      </div>
      <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
        <div class="df-field"><label class="df-label">P1</label>
          <select name="${scope}_p1" class="df-input">${this.renderRowKnobOptions(row.p1)}</select>
        </div>
        <div class="df-field"><label class="df-label">P2</label>
          <select name="${scope}_p2" class="df-input">${this.renderRowKnobOptions(row.p2)}</select>
        </div>
        <div class="df-field"><label class="df-label">Delay Feedback</label>
          <select name="${scope}_delayFeedback" class="df-input">${this.renderRowKnobOptions(row.delayFeedback)}</select>
        </div>
        <div class="df-field"><label class="df-label">Delay Level</label>
          <select name="${scope}_delayLevel" class="df-input">${this.renderRowKnobOptions(row.delayLevel)}</select>
        </div>
        <div class="df-field"><label class="df-label">Reverb Level</label>
          <select name="${scope}_reverbLevel" class="df-input">${this.renderRowKnobOptions(row.reverbLevel)}</select>
        </div>
      </div>
      <div><button type="button" class="df-btn df-btn--danger" data-remove-v2-row="${this.escapeHtml(row.uid)}" data-row-scope="${scope}">Remove row</button></div>
    </div>`;
  },

  bindScopedRows(form, scope, initialRows, wrapId, addBtnId, emptyText, rowLabel, labelOptions, defaultLabel) {
    const rowsWrap = form.querySelector(`#${wrapId}`);
    const addBtn = form.querySelector(`#${addBtnId}`);
    let rows = [...initialRows];

    const renderRows = () => {
      rowsWrap.innerHTML = rows.length ? rows.map((row) => this.renderVypyrRow(scope, row, rowLabel, labelOptions)).join('') : `<div style="font-size:12px;color:var(--text2);">${emptyText}</div>`;
      rowsWrap.querySelectorAll('[data-remove-v2-row]').forEach((btn) => {
        btn.addEventListener('click', () => {
          rows = rows.filter((row) => row.uid !== btn.dataset.removeV2Row);
          renderRows();
        });
      });
    };

    addBtn.addEventListener('click', () => {
      rows.push(this.defaultVypyrRow(defaultLabel));
      renderRows();
    });

    renderRows();
  },

  collectScopedRows(form, scope) {
    const rows = [];
    form.querySelectorAll(`[data-v2-row="${scope}"]`).forEach((rowEl) => {
      rows.push({
        uid: rowEl.dataset.uid || this.makeUid(),
        label: String(rowEl.querySelector(`[name="${scope}_label"]`)?.value || ''),
        p1: this.normalizeRowKnobValue(rowEl.querySelector(`[name="${scope}_p1"]`)?.value),
        p2: this.normalizeRowKnobValue(rowEl.querySelector(`[name="${scope}_p2"]`)?.value),
        delayFeedback: this.normalizeRowKnobValue(rowEl.querySelector(`[name="${scope}_delayFeedback"]`)?.value),
        delayLevel: this.normalizeRowKnobValue(rowEl.querySelector(`[name="${scope}_delayLevel"]`)?.value),
        reverbLevel: this.normalizeRowKnobValue(rowEl.querySelector(`[name="${scope}_reverbLevel"]`)?.value),
      });
    });
    return rows;
  },

  renderVypyrSummary(v2) {
    return `<div style="font-size:12px;color:var(--text2);display:grid;gap:4px;">
      <div>Bank ${this.escapeHtml(v2.bankLetter)} · Slot ${this.escapeHtml(v2.slotColor)}</div>
      <div>Inst/Stomp ${this.escapeHtml(v2.instStompLabel)} · Amp ${this.escapeHtml(v2.ampLabel)} (${this.escapeHtml(v2.ampLedColor)}) · Effects ${this.escapeHtml(v2.effectsLabel)}</div>
      <div>Pre ${this.toneLabel(v2.tone.pre)} · Low ${this.toneLabel(v2.tone.low)} · Mid ${this.toneLabel(v2.tone.mid)} · High ${this.toneLabel(v2.tone.high)} · Post ${this.toneLabel(v2.tone.post)}</div>
      <div>Inst/Stomp rows: ${v2.instStompRows.length} · Effects rows: ${v2.effectsRows.length}</div>
    </div>`;
  },

  renderAudioSection(preset) {
    const support = this.getAudioRecordingSupport();
    const presetId = this.escapeHtml(preset.id);
    const audioSrc = preset.audioData || (preset.audioPath ? `/${this.escapeHtml(String(preset.audioPath).replace(/^\/+/, ''))}` : '');
    if (audioSrc) {
      return `<div style="margin-top:8px;display:grid;gap:6px;">
        <audio controls preload="none" src="${audioSrc}" style="width:100%;"></audio>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="df-btn df-btn--outline" data-remove-audio="${presetId}">Remove audio</button>
          <button class="df-btn df-btn--outline" data-upload-audio="${presetId}">Upload</button>
          ${support.supported ? `<button class="df-btn df-btn--outline" data-record-audio="${presetId}">${this.audioRecordings?.get(preset.id) ? 'Stop' : 'Record'}</button>` : ''}
          <input type="file" accept="audio/*" data-audio-file="${presetId}" style="display:none;">
        </div>
        ${support.supported ? '' : `<div style="font-size:12px;color:var(--text2);">Recording not supported here — use Upload instead.</div>`}
      </div>`;
    }
    return `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
      ${support.supported ? `<button class="df-btn df-btn--outline" data-record-audio="${presetId}">${this.audioRecordings?.get(preset.id) ? 'Stop' : 'Record'}</button>` : ''}
      <button class="df-btn df-btn--outline" data-upload-audio="${presetId}">Upload</button>
      <input type="file" accept="audio/*" data-audio-file="${presetId}" style="display:none;">
      ${support.supported ? '' : `<div style="font-size:12px;color:var(--text2);">Recording not supported here — use Upload instead.</div>`}
    </div>`;
  },

  getAudioRecordingSupport() {
    if (!window.isSecureContext) return { supported: false, mimeType: '', reason: 'secure-context' };
    if (!navigator.mediaDevices?.getUserMedia) return { supported: false, mimeType: '', reason: 'media-devices' };
    if (typeof window.MediaRecorder === 'undefined') return { supported: false, mimeType: '', reason: 'media-recorder' };

    const mimeFallbacks = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    const chosenMime = mimeFallbacks.find((type) => {
      if (typeof window.MediaRecorder.isTypeSupported !== 'function') return type === mimeFallbacks[0];
      return window.MediaRecorder.isTypeSupported(type);
    }) || '';

    return { supported: true, mimeType: chosenMime, reason: '' };
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read audio file.'));
      reader.readAsDataURL(blob);
    });
  },

  async savePresetAudioData(presetId, audioData, audioMime = null) {
    const preset = (this.presets || []).find((item) => String(item.id) === String(presetId)) || await DB.getPreset(presetId);
    if (!preset) throw new Error('Preset not found.');
    return DB.savePreset({ ...preset, audioData, audioMime, audioPath: null, audioDuration: null });
  },

  stopRecordingSession(session) {
    if (!session) return;
    try { session.recorder.ondataavailable = null; } catch (_) {}
    try { session.recorder.onstop = null; } catch (_) {}
    try {
      if (session.recorder && session.recorder.state !== 'inactive') session.recorder.stop();
    } catch (_) {}
    try { (session.stream?.getTracks?.() || []).forEach((track) => track.stop()); } catch (_) {}
    this.audioRecordings.delete(session.presetId);
  },

  bindAudioControls(app) {
    this.audioRecordings = this.audioRecordings || new Map();

    app.querySelectorAll('[data-upload-audio]').forEach((btn) => btn.addEventListener('click', () => {
      const id = btn.dataset.uploadAudio;
      app.querySelector(`[data-audio-file="${id}"]`)?.click();
    }));

    app.querySelectorAll('[data-audio-file]').forEach((input) => input.addEventListener('change', async () => {
      const file = input.files?.[0];
      const presetId = input.dataset.audioFile;
      if (!file || !presetId) return;
      try {
        const audioData = await this.blobToDataUrl(file);
        await this.savePresetAudioData(presetId, audioData, file.type || 'application/octet-stream');
        Utils.toast?.('Audio uploaded.');
        await this.render();
      } catch (err) {
        Utils.toast?.(err.message || 'Audio upload failed.', 'error');
      } finally {
        input.value = '';
      }
    }));

    app.querySelectorAll('[data-remove-audio]').forEach((btn) => btn.addEventListener('click', async () => {
      try {
        await this.savePresetAudioData(btn.dataset.removeAudio, null, null);
        Utils.toast?.('Audio removed.');
        await this.render();
      } catch (err) {
        Utils.toast?.(err.message || 'Could not remove audio.', 'error');
      }
    }));

    app.querySelectorAll('[data-record-audio]').forEach((btn) => btn.addEventListener('click', async () => {
      const presetId = btn.dataset.recordAudio;
      const active = this.audioRecordings.get(presetId);
      if (active) {
        try { active.recorder.stop(); } catch (_) { this.stopRecordingSession(active); }
        return;
      }

      const support = this.getAudioRecordingSupport();
      if (!support.supported) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const options = {};
        if (support.mimeType) options.mimeType = support.mimeType;
        const recorder = new MediaRecorder(stream, options);
        const chunks = [];
        const session = { presetId, recorder, stream, chunks, mimeType: recorder.mimeType || options.mimeType || 'audio/webm' };
        this.audioRecordings.set(presetId, session);
        btn.textContent = 'Stop';
        btn.classList.add('df-btn--danger');

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) chunks.push(event.data);
        };

        recorder.onstop = async () => {
          (stream.getTracks() || []).forEach((track) => track.stop());
          this.audioRecordings.delete(presetId);
          btn.textContent = 'Record';
          btn.classList.remove('df-btn--danger');
          const blob = new Blob(chunks, { type: session.mimeType || 'audio/webm' });
          if (!blob.size) {
            Utils.toast?.('No audio captured.', 'error');
            return;
          }
          try {
            const audioData = await this.blobToDataUrl(blob);
            await this.savePresetAudioData(presetId, audioData, session.mimeType || 'application/octet-stream');
            Utils.toast?.('Audio recorded and saved.');
            await this.render();
          } catch (err) {
            Utils.toast?.(err.message || 'Could not save recording.', 'error');
          }
        };

        recorder.start();
      } catch (err) {
        const message = err?.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow mic permission to record.'
          : 'Could not start audio recording.';
        Utils.toast?.(message, 'error');
      }
    }));
  },

  card(p) {
    const settings = this.parseSettings(p.settings, p.ampModel);
    return `<div class="df-panel df-panel--wide" style="padding:14px;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <strong>${this.escapeHtml(p.name)}</strong>
        <div style="display:flex;gap:6px;">
          <button class="df-btn" data-edit="${p.id}" style="padding:4px 8px;font-size:10px;">Edit</button>
          <button class="df-btn df-btn--danger" data-del="${p.id}" style="padding:4px 8px;font-size:10px;">Delete</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Amp Model: ${this.escapeHtml(settings.ampModel)}</div>
      ${settings.ampModel === 'Vypyr X2' ? `<div style="margin-top:8px;">${this.renderVypyrSummary(settings.vypyrX2)}</div>` : ''}
      <div style="font-size:12px;color:var(--text2);margin-top:8px;">Tags: ${this.escapeHtml(this.prettyTags(p))}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Notes: ${this.escapeHtml(this.getNotesPreview(settings.notes))}</div>
      ${settings.imagePath ? `<img src="${settings.imagePath}" alt="Preset amp" style="margin-top:8px;width:100%;max-height:120px;object-fit:cover;border:1px solid var(--line2);" />` : ''}
      ${this.renderAudioSection(p)}
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;font-size:12px;color:var(--text2);">Raw data</summary>
        <pre style="white-space:pre-wrap;color:var(--text2);font-size:11px;margin-top:6px;">${this.escapeHtml(JSON.stringify(settings, null, 2))}</pre>
      </details>
    </div>`;
  },

  settingsFromForm(form, baseSettings) {
    const fd = new FormData(form);
    const tags = String(fd.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const ampModel = String(fd.get('ampModel') || 'Generic');
    return {
      ...baseSettings,
      ampModel,
      notes: String(fd.get('notes') || ''),
      tags,
      imagePath: String(fd.get('imagePath') || ''),
      vypyrX2: this.normalizeVypyrX2({
        ...baseSettings.vypyrX2,
        bankLetter: String(fd.get('v2_bankLetter') || 'A'),
        slotColor: String(fd.get('v2_slotColor') || 'Red'),
        instStompLabel: String(fd.get('v2_instStompLabel') || this.instStompOptions[0]),
        ampLabel: String(fd.get('v2_ampLabel') || this.ampDialOptions[0]),
        ampLedColor: String(fd.get('v2_ampLedColor') || this.ampLedColorOptions[0]),
        effectsLabel: String(fd.get('v2_effectsLabel') || this.effectsDialOptions[0]),
        tone: {
          pre: Number(fd.get('v2_tone_pre') || 0),
          low: Number(fd.get('v2_tone_low') || 0),
          mid: Number(fd.get('v2_tone_mid') || 0),
          high: Number(fd.get('v2_tone_high') || 0),
          post: Number(fd.get('v2_tone_post') || 0),
        },
        instStompRows: this.collectScopedRows(form, 'v2_instStompRow'),
        effectsRows: this.collectScopedRows(form, 'v2_effectsRow'),
      }),
    };
  },

  async render() {
    const app = document.getElementById('app');
    const presets = await DB.getAllPresets();

    app.innerHTML = `
      ${Utils.renderPageHero({
        title: 'Presets',
        actions: '<button id="new-preset-btn" class="df-btn df-btn--primary">+ Add Preset</button>',
      })}
      <div class="page-wrap" style="padding:24px;">
        <div id="preset-form-wrap" class="df-panel df-panel--wide" style="display:none;margin-bottom:16px;padding:14px;"></div>
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

    this.bindAudioControls(app);
  },

  showForm(existing = null) {
    const wrap = document.getElementById('preset-form-wrap');
    const settings = this.parseSettings(existing?.settings, existing?.ampModel);
    const isEdit = Boolean(existing?.id);

    wrap.style.display = 'block';
    wrap.innerHTML = `
      <form id="preset-form" class="df-panel df-panel--wide">
        <input type="hidden" name="id" value="${this.escapeHtml(existing?.id || '')}">
        <input type="hidden" name="imagePath" value="${this.escapeHtml(settings.imagePath || '')}">
        <div class="form-grid" style="gap:12px;">
          <div class="df-field"><label class="df-label">Preset Name</label><input name="name" class="df-input" required value="${this.escapeHtml(existing?.name || '')}"></div>
          <div class="df-field"><label class="df-label">Amp Model</label>
            <select name="ampModel" id="preset-amp-model" class="df-input">
              ${this.ampModels.map((ampModel) => `<option value="${ampModel}" ${settings.ampModel === ampModel ? 'selected' : ''}>${ampModel}</option>`).join('')}
            </select>
          </div>

          <div id="vypyr-x2-section" class="full-width" style="border-top:1px solid var(--line2);padding-top:10px;${settings.ampModel === 'Vypyr X2' ? '' : 'display:none;'}">
            <strong>Vypyr X2 Preset</strong>
            <img src="/img/amps/vypyrx2-top.png" alt="Vypyr X2 top panel reference" style="margin-top:8px;max-width:100%;height:auto;border:1px solid var(--line2);">

            <div class="form-grid" style="margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
              <div class="df-field"><label class="df-label">Bank</label>
                <select name="v2_bankLetter" class="df-input">
                  ${this.bankOptions.map((bank) => `<option value="${bank}" ${settings.vypyrX2.bankLetter === bank ? 'selected' : ''}>${bank}</option>`).join('')}
                </select>
              </div>
              <div class="df-field"><label class="df-label">Slot</label>
                <select name="v2_slotColor" class="df-input">
                  ${this.slotColors.map((slot) => `<option value="${slot}" ${settings.vypyrX2.slotColor === slot ? 'selected' : ''}>${slot}</option>`).join('')}
                </select>
              </div>
            </div>
            <p style="margin-top:6px;font-size:12px;color:var(--text2);">Banks A–D contain four presets each; the color indicates which of the four.</p>

            <div style="margin-top:10px;display:grid;gap:8px;">
              ${this.renderDialField('v2_instStompLabel', 'Inst/Stomp Dial', settings.vypyrX2.instStompLabel, this.instStompOptions, '* indicates Monophonic Effect', `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line2);">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <strong style="font-size:13px;">Inst/Stomp Settings Rows</strong>
                    <button type="button" class="df-btn" id="add-v2-inst-row">+ Add Inst/Stomp Settings Row</button>
                  </div>
                  <div id="v2-inst-rows" style="margin-top:8px;"></div>
                </div>
              `)}
              <div class="df-panel df-panel--tight" style="padding:10px;">
                <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
                  <div class="df-field"><label class="df-label">Amplifiers Dial</label>
                    <select name="v2_ampLabel" class="df-input">${this.ampDialOptions.map((option) => `<option value="${option}" ${option === settings.vypyrX2.ampLabel ? 'selected' : ''}>${option}</option>`).join('')}</select>
                  </div>
                  <div class="df-field"><label class="df-label">Amp LED Color</label>
                    <select name="v2_ampLedColor" class="df-input">${this.ampLedColorOptions.map((option) => `<option value="${option}" ${option === settings.vypyrX2.ampLedColor ? 'selected' : ''}>${option}</option>`).join('')}</select>
                  </div>
                </div>
                <p style="margin-top:6px;font-size:12px;color:var(--text2);">Hold for tuner (hardware)</p>
                <p style="margin-top:4px;font-size:12px;color:var(--text2);">Green = cleanest, Orange = crunch, Red = most gain</p>
              </div>
              ${this.renderDialField('v2_effectsLabel', 'Effects Dial', settings.vypyrX2.effectsLabel, this.effectsDialOptions, '* indicates Monophonic Effect', `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line2);">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                    <strong style="font-size:13px;">Effects Settings Rows</strong>
                    <button type="button" class="df-btn" id="add-v2-effects-row">+ Add Effects Settings Row</button>
                  </div>
                  <div id="v2-effects-rows" style="margin-top:8px;"></div>
                </div>
              `)}
            </div>

            <div style="margin-top:10px;border:1px solid var(--line2);padding:10px;background:var(--bg0);">
              <strong style="font-size:13px;">Tone Ring Selectors</strong>
              <p style="margin-top:4px;font-size:12px;color:var(--text2);">7-position clock selector (stored internally as 0..6).</p>
              <div class="form-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
                ${this.renderToneKnobControl('Pre Gain', 'pre', settings.vypyrX2.tone.pre)}
                ${this.renderToneKnobControl('Low', 'low', settings.vypyrX2.tone.low)}
                ${this.renderToneKnobControl('Mid', 'mid', settings.vypyrX2.tone.mid)}
                ${this.renderToneKnobControl('High', 'high', settings.vypyrX2.tone.high)}
                ${this.renderToneKnobControl('Post Gain', 'post', settings.vypyrX2.tone.post)}
              </div>
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
    const ampModelEl = wrap.querySelector('#preset-amp-model');
    const vypyrSection = wrap.querySelector('#vypyr-x2-section');
    const uploadBtn = wrap.querySelector('#upload-preset-image');
    const statusEl = wrap.querySelector('#preset-image-status');
    const previewEl = wrap.querySelector('#preset-image-preview');

    this.bindScopedRows(form, 'v2_instStompRow', settings.vypyrX2.instStompRows, 'v2-inst-rows', 'add-v2-inst-row', 'No Inst/Stomp settings rows yet.', 'Inst/Stomp Type', this.instStompOptions, settings.vypyrX2.instStompLabel);
    this.bindScopedRows(form, 'v2_effectsRow', settings.vypyrX2.effectsRows, 'v2-effects-rows', 'add-v2-effects-row', 'No effects settings rows yet.', 'Effect Type', this.effectsDialOptions, settings.vypyrX2.effectsLabel);

    ampModelEl.addEventListener('change', () => {
      vypyrSection.style.display = ampModelEl.value === 'Vypyr X2' ? '' : 'none';
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
      const settingsPayload = this.settingsFromForm(form, settings);
      const payload = {
        id: form.id.value || undefined,
        name: form.name.value,
        ampModel: settingsPayload.ampModel,
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
