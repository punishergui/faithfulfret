window.Pages = window.Pages || {};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToHtml(md) {
  return String(md || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function difficultyLabel(level) {
  const n = Number(level);
  if (!n) return 'Unrated';
  if (n <= 1) return `Beginner (${n})`;
  if (n === 2) return `Intermediate (${n})`;
  if (n >= 3) return `Advanced (${n})`;
  return `Level ${n}`;
}

const TrainingUI = {
  draftSessionId: null,
  timer: null,
  running: false,
  elapsed: 0,
  activeItemId: null,

  resetSessionState() {
    this.draftSessionId = null;
    this.activeItemId = null;
    this.elapsed = 0;
    this.running = false;
  },

  getMessageEl() {
    return document.getElementById('session-builder-message');
  },

  showMessage(text, type = 'info') {
    const el = this.getMessageEl();
    if (!el) return;
    el.textContent = text;
    el.dataset.state = type;
    el.style.display = 'block';
  },

  clearMessage() {
    const el = this.getMessageEl();
    if (!el) return;
    el.textContent = '';
    el.removeAttribute('data-state');
    el.style.display = 'none';
  },

  async getCurrentSession() {
    if (!this.draftSessionId) return null;
    return DB.getTrainingSession(this.draftSessionId);
  },

  setDraftSessionId(id) {
    this.draftSessionId = id ? String(id) : null;
    if (this.draftSessionId) localStorage.setItem('df_draft_session_id', this.draftSessionId);
    else localStorage.removeItem('df_draft_session_id');
  },

  async hydrateDraftFromStorage() {
    const saved = localStorage.getItem('df_draft_session_id');
    if (!saved) return null;
    try {
      const session = await DB.getTrainingSession(saved);
      this.setDraftSessionId(session.id);
      this.showMessage(`Restored draft session ${session.id}`, 'success');
      return session;
    } catch (error) {
      this.setDraftSessionId(null);
      this.showMessage(`Could not restore draft session: ${error.message}`, 'error');
      return null;
    }
  },

  async refreshSessionItems() {
    const list = document.getElementById('items');
    if (!list) return;
    const session = await this.getCurrentSession();
    if (!session) {
      list.innerHTML = '<div style="color:var(--text2);">No draft session. Create one to start building.</div>';
      return;
    }
    const items = Array.isArray(session.items) ? session.items : [];
    list.innerHTML = items.map((item, i) => `
      <div class="card" style="padding:10px;margin-bottom:8px;">
        <div><strong>${esc(item.title || item.type)}</strong> <span style="color:var(--text2);">(${item.type})</span></div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">
          <button class="df-btn df-btn--ghost move-up" data-id="${item.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="df-btn df-btn--ghost move-down" data-id="${item.id}" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
          <input type="number" class="df-input item-min" data-id="${item.id}" value="${item.minutes_spent || 0}" style="max-width:90px;">
          <label><input type="checkbox" class="item-done" data-id="${item.id}" ${item.completed ? 'checked' : ''}> Completed</label>
          <button class="df-btn df-btn--outline set-active" data-id="${item.id}">Active</button>
          <button class="df-btn df-btn--danger del-item" data-id="${item.id}">Delete</button>
        </div>
        <textarea class="df-input item-notes" data-id="${item.id}" rows="2" style="margin-top:6px;">${esc(item.notes || '')}</textarea>
      </div>`).join('') || '<div style="color:var(--text2);">No items yet.</div>';
  },

  renderTimer() {
    const label = document.getElementById('timer-label');
    if (!label) return;
    const m = String(Math.floor(this.elapsed / 60)).padStart(2, '0');
    const s = String(this.elapsed % 60).padStart(2, '0');
    label.textContent = `${m}:${s}`;
  },

  async createDraftSession() {
    try {
      const row = await DB.createTrainingSession({ title: 'Training Session', status: 'draft' });
      this.setDraftSessionId(row.id);
      this.showMessage(`Draft session created: ${row.id}`, 'success');
      await this.refreshSessionItems();
      return row;
    } catch (error) {
      this.showMessage(`API error creating draft session: ${error.message}`, 'error');
      throw error;
    }
  },

  async ensureDraftSession() {
    if (this.draftSessionId) return this.getCurrentSession();
    return this.createDraftSession();
  },

  async addExercise() {
    try {
      const session = await this.ensureDraftSession();
      const title = prompt('Exercise title');
      if (!title) return;
      await DB.addSessionItem(session.id, { type: 'exercise', title, sort_order: (session.items || []).length + 1 });
      this.showMessage(`Exercise added: ${title}`, 'success');
      await this.refreshSessionItems();
    } catch (error) {
      this.showMessage(`Failed to add exercise: ${error.message}`, 'error');
    }
  },

  async addNote() {
    try {
      const session = await this.ensureDraftSession();
      const title = prompt('Note text');
      if (!title) return;
      await DB.addSessionItem(session.id, { type: 'note', title, sort_order: (session.items || []).length + 1 });
      this.showMessage(`Note added.`, 'success');
      await this.refreshSessionItems();
    } catch (error) {
      this.showMessage(`Failed to add note: ${error.message}`, 'error');
    }
  },

  async searchLessons(query) {
    const rows = await DB.getLessons({ q: query || '' });
    return Array.isArray(rows) ? rows : [];
  },

  openLessonModal() {
    const modal = document.getElementById('lesson-search-modal');
    if (!modal) return;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    const input = modal.querySelector('#lesson-search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    const results = modal.querySelector('#lesson-search-results');
    if (results) results.innerHTML = '<div style="color:var(--text2);">Type to search lessons.</div>';
  },

  closeLessonModal() {
    const modal = document.getElementById('lesson-search-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  },

  async addLesson(lessonId, title) {
    try {
      const session = await this.ensureDraftSession();
      await DB.addSessionItem(session.id, { type: 'lesson', lesson_id: lessonId, title, sort_order: (session.items || []).length + 1 });
      this.showMessage(`Lesson added: ${title}`, 'success');
      this.closeLessonModal();
      await this.refreshSessionItems();
    } catch (error) {
      this.showMessage(`Failed to add lesson: ${error.message}`, 'error');
    }
  },
};

window.TrainingUI = TrainingUI;

Pages.TrainingHome = {
  async render() {
    const app = document.getElementById('app');
    const [providers, recommended] = await Promise.all([
      DB.getProviders().catch(() => []),
      DB.getLessons({ type: 'core' }).then(async (all) => {
        for (const lesson of all) {
          const stats = await DB.getLessonStats(lesson.id);
          if ((stats.times_completed || 0) < 1) return lesson;
        }
        return null;
      }).catch(() => null),
    ]);
    app.innerHTML = `
      ${Utils.renderPageHero({ title: 'Training', subtitle: 'Provider → Course → Difficulty → Module → Lessons', actions: '<button class="df-btn df-btn--primary" data-action="open-session-builder">Session Builder</button>' })}
      <div class="page-wrap" style="padding:24px;display:grid;gap:16px;">
        <div class="card" style="padding:16px;">
          <div class="df-label">Continue</div>
          ${recommended ? `<a href="#/training/lesson/${recommended.id}" class="df-btn df-btn--outline" style="margin-top:8px;">${esc(recommended.title)}</a>` : '<div style="color:var(--text2);margin-top:8px;">No recommendation yet.</div>'}
        </div>
        <div class="card" style="padding:16px;">
          <div class="df-label">Providers</div>
          <div style="display:grid;gap:8px;margin-top:8px;">
            ${providers.map((p) => `<a class="df-btn df-btn--outline" href="#/training/provider/${p.id}">${esc(p.name)}</a>`).join('') || '<div style="color:var(--text2);">No providers yet.</div>'}
          </div>
          <div style="margin-top:12px;"><a href="#/training/playlists" class="df-btn df-btn--ghost">Playlists</a></div>
        </div>
      </div>`;
  },
};

Pages.TrainingProviders = { async render() {
  const app = document.getElementById('app');
  const providers = await DB.getProviders();
  app.innerHTML = `${Utils.renderPageHero({ title: 'Training Providers', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}
  <div class="page-wrap" style="padding:24px;">
    <div class="card" style="padding:16px;">
      <form id="provider-form" style="display:flex;gap:8px;"><input class="df-input" name="name" placeholder="Provider name"><input class="df-input" name="url" placeholder="URL"><button class="df-btn df-btn--primary">Add</button></form>
      <div style="margin-top:12px;">${providers.map((p) => `<div><a href="#/training/provider/${p.id}">${esc(p.name)}</a></div>`).join('')}</div>
    </div>
  </div>`;
  app.querySelector('#provider-form').addEventListener('submit', async (e) => { e.preventDefault(); const fd = new FormData(e.target); await DB.saveProvider(Object.fromEntries(fd.entries())); go('#/training/providers'); });
}};

Pages.TrainingProvider = { async render(id) {
  const app = document.getElementById('app');
  const courses = await DB.getCourses(id);
  app.innerHTML = `${Utils.renderPageHero({ title: 'Provider Courses', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}
    <div class="page-wrap" style="padding:24px;">
      <div class="card" style="padding:16px;">
        ${courses.map((c) => `<div style="padding:8px 0;border-bottom:1px solid var(--line);"><a href="#/training/course/${c.id}">${esc(c.title)}</a><div style="color:var(--text2);">Difficulty: ${difficultyLabel(c.level)}</div></div>`).join('') || 'No courses'}
        <form id="course-form" style="margin-top:10px;display:grid;gap:8px;max-width:420px;">
          <input class="df-input" name="title" placeholder="Course title" required>
          <input class="df-input" name="level" type="number" min="1" placeholder="Difficulty level (1..N)">
          <button class="df-btn df-btn--primary">Add Course</button>
        </form>
      </div>
    </div>`;
  app.querySelector('#course-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await DB.saveCourse({ provider_id: Number(id), title: fd.get('title'), level: Number(fd.get('level')) || null });
    go(`#/training/provider/${id}`);
  });
}};

Pages.TrainingCourse = { async render(id) {
  const app = document.getElementById('app');
  const modules = await DB.getModules(id);
  const courses = await DB.getCourses();
  const course = courses.find((row) => Number(row.id) === Number(id));
  app.innerHTML = `${Utils.renderPageHero({ title: esc(course?.title || 'Course Modules'), subtitle: `Difficulty: ${difficultyLabel(course?.level)}` })}
    <div class="page-wrap" style="padding:24px;">
      <div class="card" style="padding:16px;">
        ${modules.map((m) => `<div style="padding:8px 0;border-bottom:1px solid var(--line);"><a href="#/training/module/${m.id}">Module ${m.sort_order || m.id}: ${esc(m.title)}</a></div>`).join('') || 'No modules'}
        <form id="module-form" style="margin-top:10px;display:grid;gap:8px;max-width:420px;">
          <input class="df-input" name="title" placeholder="Module title" required>
          <input class="df-input" name="sort_order" type="number" min="1" placeholder="Module number">
          <button class="df-btn df-btn--primary">Add Module</button>
        </form>
      </div>
    </div>`;
  app.querySelector('#module-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await DB.saveModule({ course_id: Number(id), title: fd.get('title'), sort_order: Number(fd.get('sort_order')) || 0 });
    go(`#/training/course/${id}`);
  });
}};

Pages.TrainingModule = { async render(id) {
  const app = document.getElementById('app');
  const lessons = await DB.getLessons({ moduleId: id });
  const rows = [];
  for (const lesson of lessons) {
    const stats = await DB.getLessonStats(lesson.id);
    rows.push({ lesson, stats });
  }
  app.innerHTML = `${Utils.renderPageHero({ title: 'Module Lessons', actions: '<button class="df-btn df-btn--outline" data-action="open-session-builder">Open Builder</button>' })}
    <div class="page-wrap" style="padding:24px;">
      <div class="card" style="padding:16px;">
        ${rows.map(({ lesson, stats }) => `<div style="padding:10px 0;border-bottom:1px solid var(--line);">
          <a href="#/training/lesson/${lesson.id}">${esc(lesson.title)}</a>
          ${lesson.lesson_type === 'core' ? '<span class="df-label">Core</span>' : '<span class="df-label">Optional</span>'}
          <div style="color:var(--text2);">Repeats: ${stats.times_completed || 0} • Minutes: ${stats.total_minutes_spent || 0}</div>
        </div>`).join('') || '<div style="color:var(--text2);">No lessons yet.</div>'}
      </div>
    </div>`;
}};

Pages.TrainingLesson = { async render(id) {
  const app = document.getElementById('app');
  const lesson = await DB.getLesson(id);
  if (!lesson) { app.innerHTML = '<div class="page-wrap" style="padding:24px;">Not found</div>'; return; }
  const [attachments] = await Promise.all([DB.getAttachments('lesson', id)]);
  let active = 'overview';
  const renderTab = () => {
    const stats = lesson.stats || {};
    const history = lesson.history || [];
    const tabBody = active === 'overview' ? `
      ${lesson.video_id ? `<iframe style="width:100%;max-width:860px;aspect-ratio:16/9;border:0;" src="https://www.youtube-nocookie.com/embed/${lesson.video_id}" allowfullscreen></iframe>` : ''}
      <p>${esc(lesson.summary || '')}</p>`
      : active === 'practice' ? `<textarea id="practice-md" class="df-input" rows="8">${esc(lesson.practice_plan_md || lesson.practice_plan || '')}</textarea><div id="practice-preview" style="display:none;padding:8px;">${mdToHtml(lesson.practice_plan_md || lesson.practice_plan || '')}</div>`
      : active === 'notes' ? `<textarea id="notes-md" class="df-input" rows="8">${esc(lesson.notes_md || lesson.notes || '')}</textarea><div id="notes-preview" style="display:none;padding:8px;">${mdToHtml(lesson.notes_md || lesson.notes || '')}</div>`
      : `<div>${history.map((h) => `<div style="padding:8px 0;border-bottom:1px solid var(--line);">${new Date(h.created_at).toLocaleString()} • ${h.minutes_spent}m • completed:${h.completed ? 'yes' : 'no'}<br>${esc(h.notes || '')}<br><a href="#/session/${h.session_id}">Open session</a></div>`).join('') || 'No attempts yet.'}</div>`;
    app.querySelector('#lesson-body').innerHTML = `
      <div style="margin-bottom:8px;color:var(--text2);">Completed: ${stats.times_completed || 0} • Minutes: ${stats.total_minutes_spent || 0}</div>
      ${tabBody}
      <div style="margin-top:16px;"><button id="save-lesson-notes" class="df-btn df-btn--primary">Save Notes</button> <button id="toggle-preview" class="df-btn df-btn--outline">Preview Toggle</button></div>`;
  };
  app.innerHTML = `${Utils.renderPageHero({ title: esc(lesson.title), actions: '<button class="df-btn df-btn--outline" data-action="open-session-builder">Practice This</button>' })}
    <div class="page-wrap" style="padding:24px;">
      <div class="card" style="padding:16px;">
        <div style="display:flex;gap:8px;margin-bottom:12px;"><button class="df-btn df-btn--outline tab-btn" data-tab="overview">Overview</button><button class="df-btn df-btn--outline tab-btn" data-tab="practice">Practice Plan</button><button class="df-btn df-btn--outline tab-btn" data-tab="notes">Notes</button><button class="df-btn df-btn--outline tab-btn" data-tab="history">History</button></div>
        <div id="lesson-body"></div>
        <hr style="margin:14px 0;border-color:var(--line);">
        <form id="attach-form" style="display:grid;gap:8px;max-width:560px;"><input class="df-input" name="caption" placeholder="Caption"><input class="df-input" type="file" name="file" accept="application/pdf,image/*"><button class="df-btn df-btn--outline">Upload</button></form>
        <div style="margin-top:10px;">${attachments.map((a) => `<div style="padding:8px 0;border-bottom:1px solid var(--line);">${a.kind === 'image' ? `<img src="/uploads/${a.storage_path}" style="max-width:140px;display:block;margin-bottom:6px;">` : ''}<a href="/uploads/${a.storage_path}" target="_blank" rel="noopener">${esc(a.filename)}</a> <button class="df-btn df-btn--ghost del-attach" data-id="${a.id}">Delete</button></div>`).join('') || 'No attachments.'}</div>
      </div>
    </div>`;
  app.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => { active = b.dataset.tab; renderTab(); }));
  renderTab();
  app.addEventListener('click', async (e) => {
    if (e.target.id === 'save-lesson-notes') {
      const notes = app.querySelector('#notes-md')?.value || lesson.notes_md || '';
      const practice = app.querySelector('#practice-md')?.value || lesson.practice_plan_md || '';
      await DB.saveLesson({ ...lesson, id: lesson.id, notes_md: notes, practice_plan_md: practice });
      alert('Saved');
    }
    if (e.target.id === 'toggle-preview') {
      ['notes-preview', 'practice-preview'].forEach((idEl) => {
        const el = app.querySelector(`#${idEl}`);
        if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
      });
    }
    if (e.target.classList.contains('del-attach')) { await DB.deleteAttachment(e.target.dataset.id); go(`#/training/lesson/${lesson.id}`); }
  });
  app.querySelector('#attach-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file) return;
    await DB.uploadAttachment({ entity_type: 'lesson', entity_id: lesson.id, caption: e.target.caption.value, file });
    go(`#/training/lesson/${lesson.id}`);
  });
}};

Pages.TrainingSessionBuilder = { async render() {
  const app = document.getElementById('app');
  TrainingUI.resetSessionState();

  app.innerHTML = `${Utils.renderPageHero({ title: 'Session Builder' })}
    <div class="page-wrap" style="padding:24px;">
      <div class="card" style="padding:16px;">
        <div id="session-builder-message" style="display:none;padding:8px;border:1px solid var(--line);border-radius:10px;margin-bottom:10px;"></div>
        <button class="df-btn df-btn--primary" data-action="create-draft-session">Create Draft Session</button>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="df-btn df-btn--outline" data-action="add-lesson">Add Lesson</button>
          <button class="df-btn df-btn--outline" data-action="add-exercise">Add Exercise</button>
          <button class="df-btn df-btn--outline" data-action="add-note">Add Note</button>
          <button id="timer-toggle" class="df-btn df-btn--ghost">Start Timer</button>
          <span id="timer-label">00:00</span>
        </div>
        <div id="items" style="margin-top:12px;"></div>
      </div>
    </div>
    <div id="lesson-search-modal" style="display:none;position:fixed;inset:0;background:var(--overlay);padding:24px;z-index:20;" aria-hidden="true">
      <div class="card" style="max-width:640px;margin:0 auto;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong>Add Lesson</strong>
          <button class="df-btn df-btn--ghost" id="close-lesson-modal">Close</button>
        </div>
        <input id="lesson-search-input" class="df-input" style="margin-top:10px;" placeholder="Search lessons...">
        <div id="lesson-search-results" style="margin-top:10px;"></div>
      </div>
    </div>`;

  TrainingUI.renderTimer();
  TrainingUI.clearMessage();
  await TrainingUI.hydrateDraftFromStorage();
  await TrainingUI.refreshSessionItems();

  const timerToggle = app.querySelector('#timer-toggle');
  timerToggle.addEventListener('click', () => {
    TrainingUI.running = !TrainingUI.running;
    timerToggle.textContent = TrainingUI.running ? 'Pause Timer' : 'Start Timer';
    if (!TrainingUI.timer) {
      TrainingUI.timer = setInterval(async () => {
        if (!TrainingUI.running) return;
        TrainingUI.elapsed += 1;
        TrainingUI.renderTimer();
        if (TrainingUI.elapsed % 60 !== 0 || !TrainingUI.activeItemId || !TrainingUI.draftSessionId) return;
        const session = await TrainingUI.getCurrentSession();
        const item = session?.items?.find((x) => Number(x.id) === Number(TrainingUI.activeItemId));
        if (!item) return;
        await DB.updateSessionItem(item.id, { minutes_spent: (item.minutes_spent || 0) + 1 });
        await TrainingUI.refreshSessionItems();
      }, 1000);
    }
  });

  document.getElementById('close-lesson-modal')?.addEventListener('click', () => TrainingUI.closeLessonModal());
  document.getElementById('lesson-search-input')?.addEventListener('input', async (event) => {
    const q = event.target.value.trim();
    const list = document.getElementById('lesson-search-results');
    try {
      const rows = await TrainingUI.searchLessons(q);
      list.innerHTML = rows.map((row) => `<button class="df-btn df-btn--outline" style="display:block;width:100%;text-align:left;margin-bottom:6px;" data-lesson-id="${row.id}" data-lesson-title="${esc(row.title)}">${esc(row.title)}</button>`).join('') || '<div style="color:var(--text2);">No lessons found.</div>';
    } catch (error) {
      list.innerHTML = '';
      TrainingUI.showMessage(`Lesson search failed: ${error.message}`, 'error');
    }
  });

  app.addEventListener('click', async (e) => {
    const target = e.target;
    const id = Number(target.dataset.id || 0);
    if (target.classList.contains('set-active')) TrainingUI.activeItemId = id;
    if (target.classList.contains('del-item')) { await DB.deleteSessionItem(id); await TrainingUI.refreshSessionItems(); }
    if (target.classList.contains('move-up') || target.classList.contains('move-down')) {
      const session = await TrainingUI.getCurrentSession();
      if (!session) return;
      const items = [...(session.items || [])];
      const idx = items.findIndex((x) => Number(x.id) === id);
      const swap = target.classList.contains('move-up') ? idx - 1 : idx + 1;
      if (idx < 0 || swap < 0 || swap >= items.length) return;
      [items[idx], items[swap]] = [items[swap], items[idx]];
      for (let i = 0; i < items.length; i += 1) await DB.updateSessionItem(items[i].id, { sort_order: i + 1 });
      await TrainingUI.refreshSessionItems();
    }
    if (target.dataset.lessonId) {
      await TrainingUI.addLesson(Number(target.dataset.lessonId), target.dataset.lessonTitle || 'Lesson');
    }
  });

  app.addEventListener('change', async (e) => {
    const id = Number(e.target.dataset.id || 0);
    if (!id) return;
    if (e.target.classList.contains('item-min')) await DB.updateSessionItem(id, { minutes_spent: Number(e.target.value) || 0 });
    if (e.target.classList.contains('item-done')) await DB.updateSessionItem(id, { completed: e.target.checked ? 1 : 0 });
    if (e.target.classList.contains('item-notes')) await DB.updateSessionItem(id, { notes: e.target.value || '' });
    await TrainingUI.refreshSessionItems();
  });
}};

Pages.TrainingPlaylists = { async render() {
  const app = document.getElementById('app');
  const playlists = await DB.getTrainingPlaylists();
  app.innerHTML = `${Utils.renderPageHero({ title: 'Playlists', actions: '<a href="#/training" class="df-btn df-btn--outline">Back to Training</a>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:16px;">
      <div class="card" style="padding:16px;">
        <form id="playlist-form" style="display:grid;gap:8px;max-width:520px;">
          <input class="df-input" name="name" placeholder="Playlist name" required>
          <textarea class="df-input" name="description" rows="3" placeholder="Description"></textarea>
          <button class="df-btn df-btn--primary">Create Playlist</button>
        </form>
      </div>
      <div class="card" style="padding:16px;">
        ${playlists.map((p) => `<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;"><div><div>${esc(p.name)}</div><div style="color:var(--text2);">${esc(p.description || '')}</div></div><a class="df-btn df-btn--outline" href="#/training/playlists/${p.id}">Open</a></div>`).join('') || '<div style="color:var(--text2);">No playlists yet.</div>'}
      </div>
    </div>`;
  app.querySelector('#playlist-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await DB.saveTrainingPlaylist({ name: fd.get('name'), description: fd.get('description') });
    go('#/training/playlists');
  });
}};

Pages.TrainingPlaylistDetail = { async render(id) {
  const app = document.getElementById('app');
  const [playlist, items, lessons] = await Promise.all([
    DB.getTrainingPlaylist(id),
    DB.getTrainingPlaylistItems(id),
    DB.getLessons({}),
  ]);
  if (!playlist) {
    app.innerHTML = '<div class="page-wrap" style="padding:24px;">Playlist not found.</div>';
    return;
  }
  app.innerHTML = `${Utils.renderPageHero({ title: `Playlist: ${esc(playlist.name)}`, actions: '<a class="df-btn df-btn--outline" href="#/training/playlists">Back</a>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:16px;">
      <div class="card" style="padding:16px;">
        <form id="playlist-edit" style="display:grid;gap:8px;max-width:520px;">
          <input class="df-input" name="name" value="${esc(playlist.name)}" required>
          <textarea class="df-input" name="description" rows="3">${esc(playlist.description || '')}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="df-btn df-btn--primary">Save</button>
            <button type="button" id="delete-playlist" class="df-btn df-btn--danger">Delete</button>
            <button type="button" class="df-btn df-btn--outline" data-start-playlist="${playlist.id}">Start Session from Playlist</button>
          </div>
        </form>
      </div>
      <div class="card" style="padding:16px;">
        <form id="playlist-items-form" style="display:grid;gap:8px;">
          <label class="df-label">Add lesson</label>
          <select class="df-input" name="lesson_id">
            ${lessons.map((lesson) => `<option value="${lesson.id}">${esc(lesson.title)}</option>`).join('')}
          </select>
          <button class="df-btn df-btn--outline">Add lesson to playlist</button>
        </form>
        <div style="margin-top:12px;">
          ${(items || []).map((item, i) => `<div style="padding:8px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;"><span>${i + 1}. ${esc(item.lesson_title || `Lesson ${item.lesson_id}`)}</span><button class="df-btn df-btn--ghost" data-remove-playlist-item="${item.lesson_id}">Remove</button></div>`).join('') || '<div style="color:var(--text2);">No lessons in this playlist.</div>'}
        </div>
      </div>
    </div>`;

  app.querySelector('#playlist-edit').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await DB.saveTrainingPlaylist({ id: playlist.id, name: fd.get('name'), description: fd.get('description') });
    go(`#/training/playlists/${playlist.id}`);
  });

  app.querySelector('#delete-playlist').addEventListener('click', async () => {
    await DB.deleteTrainingPlaylist(playlist.id);
    go('#/training/playlists');
  });

  app.querySelector('#playlist-items-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lessonId = Number(fd.get('lesson_id'));
    const next = [...items, { lesson_id: lessonId, position: items.length + 1 }];
    await DB.replaceTrainingPlaylistItems(playlist.id, next);
    go(`#/training/playlists/${playlist.id}`);
  });

  app.addEventListener('click', async (e) => {
    if (e.target.dataset.removePlaylistItem) {
      const removeLessonId = Number(e.target.dataset.removePlaylistItem);
      const next = items.filter((item) => Number(item.lesson_id) !== removeLessonId).map((item, idx) => ({ lesson_id: item.lesson_id, position: idx + 1 }));
      await DB.replaceTrainingPlaylistItems(playlist.id, next);
      go(`#/training/playlists/${playlist.id}`);
    }
    if (e.target.dataset.startPlaylist) {
      const draft = await TrainingUI.createDraftSession();
      const playlistItems = await DB.getTrainingPlaylistItems(playlist.id);
      for (let i = 0; i < playlistItems.length; i += 1) {
        const lessonItem = playlistItems[i];
        await DB.addSessionItem(draft.id, { type: 'lesson', lesson_id: lessonItem.lesson_id, title: lessonItem.lesson_title || `Lesson ${lessonItem.lesson_id}`, sort_order: i + 1 });
      }
      go('#/training/session-builder');
    }
  });
}};
