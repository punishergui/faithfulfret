// Daily Fret — Session Form (New + Edit)

window.Pages = window.Pages || {};

Pages.SessionForm = {
  async render(id) {
    const app = document.getElementById('app');
    const isEdit = !!id;
    let session = {};

    if (isEdit) {
      session = await DB.getSess(id) || {};
    }

    const ownedGear = (await DB.getAllGear(false)).filter((item) => ['Owned', 'Own it', 'owned'].includes(item.status));
    const repertoireSongs = await DB.getRepertoireSongs({}).catch(() => []);
    const sessionSongs = isEdit ? await DB.getSessionSongs(id).catch(() => []) : [];
    const songParam = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('song')) || 0;
    const selectedSongId = Number(sessionSongs?.[0]?.song_id || songParam || 0);
    const selectedGearIds = new Set(Array.isArray(session.gear) ? session.gear.map((row) => row.id) : []);

    const title = isEdit ? 'Edit Session' : 'Log Session';
    const today = Utils.today();

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture">
        <div class="page-hero__inner">
          <div class="page-title">${title}</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:32px 24px 60px;">
        <form id="session-form" class="df-panel df-panel--wide" style="padding:16px;" novalidate>
          <div id="form-error" style="display:none;margin-bottom:14px;padding:12px 14px;border:1px solid var(--red);border-radius:12px;background:var(--panel);color:var(--text);font-family:system-ui;"></div>
          <div class="form-grid">
            <div class="df-field">
              <label class="df-label" for="f-date">Date *</label>
              <input type="date" id="f-date" name="date" class="df-input" value="${session.date || today}" required>
            </div>
            <div class="df-field">
              <label class="df-label">Duration</label>
              <input type="hidden" id="f-minutes" name="minutes" value="">
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;" aria-label="Quick duration">
                ${[10,20,30,45,'60+'].map(m => `
                  <button type="button" class="df-btn df-btn--outline" data-min="${m}" style="font-size:11px;padding:8px 12px;border-radius:999px;">
                    ${m}
                  </button>
                `).join('')}
              </div>
              <div style="margin-top:8px;color:var(--text3);font-size:12px;">Tap a time. You can edit later.</div>
</div>
            <div class="df-field">
              <label class="df-label" for="f-bpm">Peak BPM</label>
              <input type="number" id="f-bpm" name="bpm" class="df-input" value="${session.bpm || ''}" min="20" max="300" placeholder="e.g. 80">
            </div>
            <div class="df-field">
              <label class="df-label" for="f-day">Day #</label>
              <input type="number" id="f-day" name="dayNumber" class="df-input" value="${session.dayNumber || ''}" min="1" placeholder="Journey day number">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-focus">Focus Area</label>
              <input type="text" id="f-focus" name="focus" class="df-input" value="${session.focus || ''}" placeholder="e.g. Chords, Scales, Fingerpicking...">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-mood">Mood / Energy</label>
              <select id="f-mood" name="mood" class="df-input">
                <option value="">— Select —</option>
                ${['😴 Tired', '😐 Meh', '🙂 Decent', '😊 Good', '🔥 On Fire'].map(m =>
                  `<option value="${m}" ${session.mood === m ? 'selected' : ''}>${m}</option>`
                ).join('')}
              </select>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-win">Win / Takeaway</label>
              <textarea id="f-win" name="win" class="df-input" rows="3" placeholder="What did you nail today? What clicked?">${session.win || ''}</textarea>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-video">YouTube Video ID (or URL)</label>
              <input type="text" id="f-video" name="videoId" class="df-input" value="${session.videoId || ''}" placeholder="e.g. dQw4w9WgXcQ (just the ID, not the full URL)">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-checklist">Practice Checklist</label>
              <textarea id="f-checklist" name="checklist" class="df-input" rows="4" placeholder="One item per line&#10;e.g. Warm up&#10;G major scale&#10;F chord practice">${session.checklist || ''}</textarea>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-links">Session Links</label>
              <textarea id="f-links" name="links" class="df-input" rows="3" placeholder="Label | https://url (one per line)&#10;e.g. JustinGuitar Lesson | https://justinguitar.com/...">${session.links || ''}</textarea>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-song-id">Song (optional)</label>
              <select id="f-song-id" class="df-input">
                <option value="">— None —</option>
                ${repertoireSongs.map((song) => `<option value="${song.id}" ${selectedSongId === Number(song.id) ? 'selected' : ''}>${song.title}${song.artist ? ` — ${song.artist}` : ''}</option>`).join('')}
              </select>
            </div>
            <div class="df-field full-width">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                <label class="df-label" style="margin:0;">Gear Used</label>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                  <button type="button" class="df-btn df-btn--outline" id="use-last-gear">Use last gear</button>
                  <button type="button" class="df-btn df-btn--outline" id="clear-gear">Clear</button>
                </div>
              </div>
              <div id="last-gear-hint" style="margin-bottom:8px;color:var(--text3);font-size:12px;"></div>
              <input class="df-input" id="gear-picker-search" placeholder="Search owned gear" style="margin-bottom:8px;">
              <div id="session-gear-choices" style="display:flex;gap:8px;flex-wrap:wrap;">
                ${ownedGear.length ? ownedGear.map((item) => `<button type="button" class="df-btn ${selectedGearIds.has(item.id) ? 'df-btn--primary' : 'df-btn--outline'}" data-gear-id="${item.id}">${item.name}</button>`).join('') : '<span style="color:var(--text3);font-size:12px;">No owned gear available.</span>'}
              </div>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="f-notes">Notes</label>
              <textarea id="f-notes" name="notes" class="df-input" rows="5" placeholder="Free notes, observations, things to remember...">${session.notes || ''}</textarea>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;">
            <button type="submit" class="df-btn df-btn--primary df-btn--full">
              ${isEdit ? 'Save Changes' : 'Save Session'}
            </button>
          </div>

          ${isEdit ? `
            <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;">
              <button type="button" id="delete-btn" class="df-btn df-btn--danger df-btn--full">Delete Session</button>
            </div>
          ` : ''}
        </form>
      </div>
    `;

    this._initForm(app, session, isEdit);
  },

  _initForm(container, session, isEdit) {
    const form = container.querySelector('#session-form');
    // __FF_SESSIONFORM_UX__
    const errBox = container.querySelector('#form-error');
    const lastFocusKey = 'df:lastFocus';
    const lastGearKey = 'df:lastGearIds';

    function showError(msg) {
      if (!errBox) return alert(msg);
      errBox.style.display = 'block';
      errBox.textContent = msg;
    }
    function clearError() {
      if (!errBox) return;
      errBox.style.display = 'none';
      errBox.textContent = '';
    }

    // Quick duration pills
    container.querySelectorAll('[data-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        let m = btn.getAttribute('data-min');
        if (m === '60+') m = 60;
        const minutes = container.querySelector('#f-minutes');
        if (minutes) {
          minutes.value = m;
          minutes.dispatchEvent(new Event('input', { bubbles: true }));
        }
        Utils.toast?.(`Set duration to ${m}m`);
      });
    });

    // Use last focus
    const useLast = container.querySelector('#use-last-focus');
    useLast?.addEventListener('click', () => {
      const last = localStorage.getItem(lastFocusKey) || '';
      if (!last) return Utils.toast?.('No previous focus found', 'error');
      const f = container.querySelector('#f-focus');
      if (f) {
        f.value = last;
        f.dispatchEvent(new Event('input', { bubbles: true }));
      }
      Utils.toast?.('Applied last focus');
    });

    const selectedGearIds = new Set(Array.isArray(session.gear) ? session.gear.map((row) => row.id) : []);
    const gearButtons = [...container.querySelectorAll('[data-gear-id]')];
    const updateGearButtons = () => {
      gearButtons.forEach((btn) => {
        const gearId = btn.getAttribute('data-gear-id');
        btn.classList.toggle('df-btn--primary', selectedGearIds.has(gearId));
        btn.classList.toggle('df-btn--outline', !selectedGearIds.has(gearId));
      });
    };
    const updateLastGearHint = () => {
      const hint = container.querySelector('#last-gear-hint');
      if (!hint) return;
      const saved = JSON.parse(localStorage.getItem(lastGearKey) || '[]');
      hint.textContent = Array.isArray(saved) && saved.length ? `Last used: ${saved.length} items` : '';
    };
    updateLastGearHint();

    const useLastGearBtn = container.querySelector('#use-last-gear');
    useLastGearBtn?.addEventListener('click', () => {
      const saved = JSON.parse(localStorage.getItem(lastGearKey) || '[]');
      if (!Array.isArray(saved) || !saved.length) {
        Utils.toast?.('No previous gear found', 'error');
        return;
      }
      selectedGearIds.clear();
      saved.forEach((id) => selectedGearIds.add(id));
      updateGearButtons();
      Utils.toast?.('Applied last gear');
    });

    container.querySelector('#clear-gear')?.addEventListener('click', () => {
      selectedGearIds.clear();
      updateGearButtons();
      Utils.toast?.('Cleared gear');
    });

    container.querySelector('#gear-picker-search')?.addEventListener('input', (e) => {
      const needle = String(e.target.value || '').toLowerCase();
      gearButtons.forEach((btn) => {
        const match = String(btn.textContent || '').toLowerCase().includes(needle);
        btn.style.display = match ? '' : 'none';
      });
    });

    gearButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const gearId = btn.getAttribute('data-gear-id');
        if (selectedGearIds.has(gearId)) selectedGearIds.delete(gearId);
        else selectedGearIds.add(gearId);
        updateGearButtons();
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn?.dataset?.busy === '1') return;
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());

      // Type coercions
      if (data.minutes) data.minutes = parseInt(data.minutes);
      if (data.bpm) data.bpm = parseInt(data.bpm);
      if (data.dayNumber) data.dayNumber = parseInt(data.dayNumber);

      // Normalize YouTube input (accept full URL or ID)
      if (data.videoId) {
        const extracted = Utils.extractYouTubeId(data.videoId);
        data.videoId = extracted || data.videoId.trim();
      }

      // Strip empty strings
      Object.keys(data).forEach(k => {
        if (data[k] === '') delete data[k];
      });

      if (!data.date) return showError('Date is required.');
      if (!data.minutes) return showError('Duration (minutes) is required.');

      if (isEdit) {
        data.id = session.id;
        data.createdAt = session.createdAt;
      }

      try {
        if (submitBtn) {
          submitBtn.dataset.busy = '1';
          submitBtn.disabled = true;
        }
        const saved = await DB.saveSess(data);
        const nextGearIds = [...selectedGearIds];
        await DB.saveSessionGear(saved.id, nextGearIds);
        const songId = Number(container.querySelector('#f-song-id')?.value || 0);
        await DB.saveSessionSongs(saved.id, songId ? [{ song_id: songId, minutes: data.minutes || null }] : []);
        try { localStorage.setItem(lastGearKey, JSON.stringify(nextGearIds)); } catch (e) {}
        if (data.focus) { try { localStorage.setItem('df:lastFocus', data.focus); } catch (e) {} }
        Utils.toast?.('Saved session ✅');
        go(`#/session/${saved.id}`);
      } catch (error) {
        console.error(error);
        showError(error?.message || 'Failed to save session.');
      } finally {
        if (submitBtn) {
          delete submitBtn.dataset.busy;
          submitBtn.disabled = false;
        }
      }
    });

    // Delete
    const deleteBtn = container.querySelector('#delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this session? This cannot be undone.')) {
          await DB.deleteSess(session.id);
          go('#/sessions');
        }
      });
    }
  },
};
