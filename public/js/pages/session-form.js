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

    const title = isEdit ? 'Edit Session' : 'Log Session';
    const today = Utils.today();

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">${title}</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:32px 24px 60px;">
        <form id="session-form" novalidate>
          <div class="form-grid">
            <div class="df-field">
              <label class="df-label" for="f-date">Date *</label>
              <input type="date" id="f-date" name="date" class="df-input" value="${session.date || today}" required>
            </div>
            <div class="df-field">
              <label class="df-label" for="f-minutes">Duration (minutes)</label>
              <input type="number" id="f-minutes" name="minutes" class="df-input" value="${session.minutes || ''}" min="1" max="999" placeholder="e.g. 30">
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
              <label class="df-label" for="f-video">YouTube Video ID</label>
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
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

      if (!data.date) {
        alert('Date is required.');
        return;
      }

      if (isEdit) {
        data.id = session.id;
        data.createdAt = session.createdAt;
      }

      const saved = await DB.saveSess(data);
      go(`#/session/${saved.id}`);
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
