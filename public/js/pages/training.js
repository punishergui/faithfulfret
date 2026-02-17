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

Pages.TrainingHome = {
  async render() {
    const app = document.getElementById('app');
    const [recommended, recent] = await Promise.all([
      DB.getLessons({ type: 'core' }).then(async (all) => {
        for (const lesson of all) {
          const stats = await DB.getLessonStats(lesson.id);
          if ((stats.times_completed || 0) < 1) return lesson;
        }
        return null;
      }),
      DB.getSessions?.() || Promise.resolve([]),
    ]).catch(() => [null, []]);
    const recentRows = await DB.getLessons({}).then(() => fetch('/api/lessons?q=').then(r => r.json())).catch(() => []);
    app.innerHTML = `
      ${Utils.renderPageHero({ title: 'Training', subtitle: 'Structured lessons and focused sessions', actions: '<a href="#/training/session-builder" class="df-btn df-btn--primary">Session Builder</a>' })}
      <div class="page-wrap" style="padding:24px;display:grid;gap:16px;">
        <div class="card" style="padding:16px;">
          <label class="df-label">Search lessons</label>
          <input id="training-search" class="df-input" placeholder="Search by title..." />
          <div id="training-search-results" style="margin-top:10px;"></div>
        </div>
        <div class="card" style="padding:16px;">
          <div class="df-label">Continue / Recommended Next</div>
          ${recommended ? `<a href="#/training/lesson/${recommended.id}" class="df-btn df-btn--outline" style="margin-top:8px;">${esc(recommended.title)}</a>` : '<div style="color:var(--text2);margin-top:8px;">No recommendation yet.</div>'}
        </div>
        <div class="card" style="padding:16px;">
          <div class="df-label">Recent lessons practiced</div>
          ${recentRows.slice(0, 8).map((l) => `<div><a href="#/training/lesson/${l.id}">${esc(l.title)}</a></div>`).join('') || '<div style="color:var(--text2);">No history yet.</div>'}
        </div>
      </div>`;
    app.querySelector('#training-search').addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      const rows = q ? await DB.getLessons({ q }) : [];
      app.querySelector('#training-search-results').innerHTML = rows.map((l) => `<div><a href="#/training/lesson/${l.id}">${esc(l.title)}</a></div>`).join('');
    });
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
Pages.TrainingProvider = { async render(id) { const app=document.getElementById('app'); const courses=await DB.getCourses(id); app.innerHTML=`${Utils.renderPageHero({title:'Provider Courses'})}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${courses.map((c)=>`<div><a href="#/training/course/${c.id}">${esc(c.title)}</a></div>`).join('')||'No courses'}<form id="course-form" style="margin-top:10px;"><input class="df-input" name="title" placeholder="Course title"><button class="df-btn df-btn--primary">Add Course</button></form></div></div>`; app.querySelector('#course-form').addEventListener('submit', async (e)=>{e.preventDefault(); const fd=new FormData(e.target); await DB.saveCourse({provider_id:Number(id), title:fd.get('title')}); go(`#/training/provider/${id}`);}); }};
Pages.TrainingCourse = { async render(id) { const app=document.getElementById('app'); const modules=await DB.getModules(id); app.innerHTML=`${Utils.renderPageHero({title:'Course Modules'})}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${modules.map((m)=>`<div><a href="#/training/module/${m.id}">${esc(m.title)}</a></div>`).join('')||'No modules'}<form id="module-form" style="margin-top:10px;"><input class="df-input" name="title" placeholder="Module title"><button class="df-btn df-btn--primary">Add Module</button></form></div></div>`; app.querySelector('#module-form').addEventListener('submit', async (e)=>{e.preventDefault(); const fd=new FormData(e.target); await DB.saveModule({course_id:Number(id), title:fd.get('title')}); go(`#/training/course/${id}`);}); }};
Pages.TrainingModule = { async render(id) {
  const app=document.getElementById('app');
  const lessons=await DB.getLessons({moduleId:id});
  let recommendedId = null;
  for (const lesson of lessons) {
    if (lesson.lesson_type !== 'core') continue;
    const stats = await DB.getLessonStats(lesson.id);
    if ((stats.times_completed || 0) < 1) { recommendedId = lesson.id; break; }
  }
  const rows = [];
  for (const lesson of lessons) {
    const stats = await DB.getLessonStats(lesson.id);
    rows.push({ lesson, stats });
  }
  app.innerHTML=`${Utils.renderPageHero({title:'Module Lessons', actions:'<a href="#/training/session-builder" class="df-btn df-btn--outline">Open Builder</a>'})}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${rows.map(({lesson,stats})=>`<div style="padding:10px 0;border-bottom:1px solid var(--line);"><a href="#/training/lesson/${lesson.id}">${esc(lesson.title)}</a> ${recommendedId===lesson.id?'<span class="df-label">Recommended Next</span>':''} ${lesson.lesson_type==='core'&&stats.times_completed>=1?'<span class="df-label">Completed</span>':''}<div style="color:var(--text2);">Repeats: ${stats.times_completed||0} • Minutes: ${stats.total_minutes_spent||0}</div></div>`).join('')}</div></div>`;
}};

Pages.TrainingLesson = { async render(id) {
  const app=document.getElementById('app');
  const lesson=await DB.getLesson(id);
  if (!lesson) { app.innerHTML='<div class="page-wrap" style="padding:24px;">Not found</div>'; return; }
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
  app.innerHTML=`${Utils.renderPageHero({title:esc(lesson.title), actions:'<a href="#/training/session-builder" class="df-btn df-btn--outline">Practice This</a>'})}
    <div class="page-wrap" style="padding:24px;">
      <div class="card" style="padding:16px;">
        <div style="display:flex;gap:8px;margin-bottom:12px;"><button class="df-btn df-btn--outline tab-btn" data-tab="overview">Overview</button><button class="df-btn df-btn--outline tab-btn" data-tab="practice">Practice Plan</button><button class="df-btn df-btn--outline tab-btn" data-tab="notes">Notes</button><button class="df-btn df-btn--outline tab-btn" data-tab="history">History</button></div>
        <div id="lesson-body"></div>
      </div>
      <div class="card" style="padding:16px;margin-top:12px;">
        <div class="df-label">Attachments</div>
        <form id="attach-form" style="display:flex;gap:8px;align-items:center;"><input type="file" name="file" class="df-input"><input class="df-input" name="caption" placeholder="Caption"><button class="df-btn df-btn--primary">Upload</button></form>
        <div style="margin-top:10px;">${attachments.map((a) => `<div style="padding:8px 0;border-bottom:1px solid var(--line);">${a.kind==='image' ? `<img src="/uploads/${a.storage_path}" style="max-width:140px;display:block;margin-bottom:6px;">` : ''}<a href="/uploads/${a.storage_path}" target="_blank" rel="noopener">${esc(a.filename)}</a> <button class="df-btn df-btn--ghost del-attach" data-id="${a.id}">Delete</button></div>`).join('') || 'No attachments.'}</div>
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
      ['notes-preview', 'practice-preview'].forEach((idEl) => { const el = app.querySelector(`#${idEl}`); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; });
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
  const app=document.getElementById('app');
  let currentSession = null;
  let timer = null;
  let activeItemId = null;
  const refresh = async () => {
    if (!currentSession) return;
    currentSession = await DB.getTrainingSession(currentSession.id);
    app.querySelector('#items').innerHTML = currentSession.items.map((item, i) => `<div class="card" style="padding:10px;margin-bottom:8px;">
      <div><strong>${esc(item.title || item.type)}</strong> <span style="color:var(--text2);">(${item.type})</span></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px;"><button class="df-btn df-btn--ghost move-up" data-id="${item.id}" ${i===0?'disabled':''}>↑</button><button class="df-btn df-btn--ghost move-down" data-id="${item.id}" ${i===currentSession.items.length-1?'disabled':''}>↓</button><input type="number" class="df-input item-min" data-id="${item.id}" value="${item.minutes_spent||0}" style="max-width:90px;"><label><input type="checkbox" class="item-done" data-id="${item.id}" ${item.completed?'checked':''}> Completed</label><button class="df-btn df-btn--outline set-active" data-id="${item.id}">Active</button><button class="df-btn df-btn--danger del-item" data-id="${item.id}">Delete</button></div>
      <textarea class="df-input item-notes" data-id="${item.id}" rows="2" style="margin-top:6px;">${esc(item.notes||'')}</textarea>
    </div>`).join('');
  };
  app.innerHTML=`${Utils.renderPageHero({title:'Session Builder'})}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;"><button id="create-session" class="df-btn df-btn--primary">Create Draft Session</button><div style="margin-top:12px;display:flex;gap:8px;"><button id="add-lesson" class="df-btn df-btn--outline">Add Lesson</button><button id="add-exercise" class="df-btn df-btn--outline">Add Exercise</button><button id="add-note" class="df-btn df-btn--outline">Add Note</button><button id="timer-toggle" class="df-btn df-btn--ghost">Start Timer</button><span id="timer-label">00:00</span></div><div id="items" style="margin-top:12px;"></div><button id="finish-session" class="df-btn df-btn--primary">Finish Session</button></div></div>`;
  let elapsed = 0; let running = false;
  const renderTimer = () => { const m = String(Math.floor(elapsed/60)).padStart(2,'0'); const s=String(elapsed%60).padStart(2,'0'); app.querySelector('#timer-label').textContent=`${m}:${s}`; };
  app.querySelector('#create-session').addEventListener('click', async () => { currentSession = await DB.createTrainingSession({ title: 'Training Session' }); await refresh(); });
  app.querySelector('#add-lesson').addEventListener('click', async () => { if (!currentSession) return; const q = prompt('Search lesson title'); const rows = await DB.getLessons({ q: q || '' }); if (!rows.length) return alert('No lesson found'); const pick = rows[0]; await DB.addSessionItem(currentSession.id, { type: 'lesson', lesson_id: pick.id, title: pick.title, sort_order: currentSession.items.length + 1 }); await refresh(); });
  app.querySelector('#add-exercise').addEventListener('click', async () => { if (!currentSession) return; const title = prompt('Exercise title'); if (!title) return; await DB.addSessionItem(currentSession.id, { type: 'exercise', title, sort_order: currentSession.items.length + 1 }); await refresh(); });
  app.querySelector('#add-note').addEventListener('click', async () => { if (!currentSession) return; const title = prompt('Note title'); if (!title) return; await DB.addSessionItem(currentSession.id, { type: 'note', title, sort_order: currentSession.items.length + 1 }); await refresh(); });
  app.querySelector('#timer-toggle').addEventListener('click', () => {
    running = !running;
    app.querySelector('#timer-toggle').textContent = running ? 'Pause Timer' : 'Start Timer';
    if (!timer) timer = setInterval(async () => {
      if (!running) return;
      elapsed += 1; renderTimer();
      if (elapsed % 60 === 0 && activeItemId) {
        const item = currentSession.items.find((x) => x.id === Number(activeItemId));
        if (item) await DB.updateSessionItem(item.id, { minutes_spent: (item.minutes_spent || 0) + 1 });
        await refresh();
      }
    }, 1000);
  });
  app.addEventListener('click', async (e) => {
    if (!currentSession) return;
    const id = Number(e.target.dataset.id || 0);
    if (e.target.classList.contains('set-active')) activeItemId = id;
    if (e.target.classList.contains('del-item')) { await DB.deleteSessionItem(id); await refresh(); }
    if (e.target.classList.contains('move-up') || e.target.classList.contains('move-down')) {
      const items = [...currentSession.items];
      const idx = items.findIndex((x) => x.id === id);
      const swap = e.target.classList.contains('move-up') ? idx - 1 : idx + 1;
      if (idx < 0 || swap < 0 || swap >= items.length) return;
      [items[idx], items[swap]] = [items[swap], items[idx]];
      for (let i = 0; i < items.length; i += 1) await DB.updateSessionItem(items[i].id, { sort_order: i + 1 });
      await refresh();
    }
    if (e.target.id === 'finish-session') {
      const done = await DB.finishTrainingSession(currentSession.id);
      alert(`Finished: ${done.total_minutes || done.durationMinutes || 0} minutes`);
    }
  });
  app.addEventListener('change', async (e) => {
    if (!currentSession) return;
    const id = Number(e.target.dataset.id || 0);
    if (e.target.classList.contains('item-min')) await DB.updateSessionItem(id, { minutes_spent: Number(e.target.value) || 0 });
    if (e.target.classList.contains('item-done')) await DB.updateSessionItem(id, { completed: e.target.checked ? 1 : 0 });
    if (e.target.classList.contains('item-notes')) await DB.updateSessionItem(id, { notes: e.target.value || '' });
    await refresh();
  });
  renderTimer();
}};
