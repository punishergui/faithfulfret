window.Pages = window.Pages || {};

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(sec) { const n = Number(sec) || 0; return `${Math.floor(n / 60)}m`; }
function qv(name) { return new URLSearchParams(location.hash.split('?')[1] || '').get(name) || ''; }

async function renderWithError(renderFn) {
  const app = document.getElementById('app');
  try { await renderFn(); } catch (e) {
    app.innerHTML = `<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;color:var(--danger);">${esc(e.message || e)}</div></div>`;
  }
}

Pages.TrainingHome = { async render() { await renderWithError(async () => {
  const app = document.getElementById('app');
  const [levels, groups] = await Promise.all([DB.getTrainingLevels(), DB.getTrainingSkillGroups()]);
  const tracks = ['Beginner', 'Intermediate', 'Advanced'];
  const byTrack = tracks.map((t) => ({ track: t, rows: levels.filter((l) => l.track === t).sort((a,b)=>a.level_num-b.level_num) }));
  app.innerHTML = `${Utils.renderPageHero({ title: 'Training', subtitle: 'Browse lessons by level, skills, songs, or search.', actions: '<a href="#/training/admin" class="df-btn df-btn--outline">Admin</a>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:16px;">
      <div class="card" style="padding:16px;"><form id="training-search" style="display:flex;gap:8px;"><input class="df-input" name="q" placeholder="Search all lessons"><button class="df-btn df-btn--primary">Search</button></form></div>
      <div class="card" style="padding:16px;"><h3>BY LEVEL</h3>${byTrack.map((g)=>`<div><strong>${g.track}</strong><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px;">${g.rows.map((l)=>`<a class="df-btn df-btn--outline" href="#/training/level/${l.id}">${esc(l.name)}</a>`).join('')}</div></div>`).join('')}</div>
      <div class="card" style="padding:16px;"><h3>FOR SKILLS</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">${groups.map((g)=>`<div><strong>${esc(g.name)}</strong>${(g.skills||[]).map((s)=>`<div><a href="#/training/skills/${esc(s.slug)}">${esc(s.name)}</a></div>`).join('')}</div>`).join('')}</div></div>
      <div class="card" style="padding:16px;"><h3>SONGS</h3><a href="#/training/songs" class="df-btn df-btn--outline">Browse Songs</a></div>
      <div class="card" style="padding:16px;"><h3>NOT SURE WHERE TO START?</h3><div style="display:flex;gap:8px;flex-wrap:wrap;"><a class="df-btn df-btn--outline" href="#/training/levels">Beginner Course</a><a class="df-btn df-btn--outline" href="#/training/levels">Lesson Map</a><a class="df-btn df-btn--outline" href="#/training/all">All Lessons</a></div></div>
    </div>`;
  app.querySelector('#training-search').addEventListener('submit', (e) => { e.preventDefault(); go(`#/training/all?q=${encodeURIComponent(new FormData(e.target).get('q') || '')}`); });
}); }};

Pages.TrainingLevels = { async render() { await renderWithError(async () => {
  const app = document.getElementById('app');
  const levels = await DB.getTrainingLevels();
  app.innerHTML = `${Utils.renderPageHero({ title: 'Levels', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}<div class="page-wrap" style="padding:24px;display:grid;gap:16px;">${['Beginner','Intermediate','Advanced'].map((t)=>`<div class="card" style="padding:16px;"><h3>${t}</h3><div style="display:flex;gap:10px;flex-wrap:wrap;">${levels.filter((l)=>l.track===t).sort((a,b)=>a.level_num-b.level_num).map((l)=>`<a class="df-btn df-btn--outline" href="#/training/level/${l.id}">${esc(l.name)}</a>`).join('')}</div></div>`).join('')}</div>`;
}); }};

Pages.TrainingLevel = { async render(id) { await renderWithError(async () => {
  const app = document.getElementById('app');
  const [levels, modules] = await Promise.all([DB.getTrainingLevels(), DB.getTrainingModules(id)]);
  const level = levels.find((l) => Number(l.id) === Number(id));
  const withLessons = await Promise.all(modules.map(async (m) => ({ ...m, lessons: await DB.getTrainingLessons({ module_id: m.id }) })));
  app.innerHTML = `${Utils.renderPageHero({ title: esc(level?.name || 'Level'), actions: '<a href="#/training/levels" class="df-btn df-btn--outline">All Levels</a>' })}<div class="page-wrap" style="padding:24px;display:grid;gap:12px;">${withLessons.map((m)=>`<div class="card" style="padding:16px;"><div style="display:flex;justify-content:space-between;"><h3>MODULE ${m.module_num}</h3><button class="df-btn df-btn--ghost" data-module="${m.id}">Preview Lessons</button></div><div>${esc(m.title)}</div><div style="color:var(--text2);">${esc(m.description || '')}</div><div style="color:var(--text2);margin-top:8px;">${m.lessons.length} lessons • ${fmt(m.lessons.reduce((s,l)=>s+(Number(l.duration_sec)||0),0))}</div><div id="module-${m.id}" style="display:none;margin-top:8px;">${m.lessons.map((l)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line);"><a href="#/training/lesson/${l.id}">${esc(l.title)}</a><span style="color:var(--text2);">${fmt(l.duration_sec)}</span></div>`).join('')}</div></div>`).join('')}</div>`;
  app.querySelectorAll('[data-module]').forEach((b)=>b.addEventListener('click', ()=>{ const el=app.querySelector(`#module-${b.dataset.module}`); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }));
}); }};

Pages.TrainingSkills = { async render() { await renderWithError(async () => {
  const groups = await DB.getTrainingSkillGroups();
  const app = document.getElementById('app');
  app.innerHTML = `${Utils.renderPageHero({ title: 'Skills', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">${groups.map((g)=>`<div><h3>${esc(g.name)}</h3>${(g.skills||[]).map((s)=>`<div><a href="#/training/skills/${s.slug}">${esc(s.name)}</a></div>`).join('')}</div>`).join('')}</div></div>`;
}); }};

Pages.TrainingSkillGroup = { async render(slug) { await renderWithError(async () => {
  const lessons = await DB.getTrainingSkillLessons(slug);
  const app = document.getElementById('app');
  app.innerHTML = `${Utils.renderPageHero({ title: `Skill: ${esc(slug)}`, actions: '<a href="#/training/skills" class="df-btn df-btn--outline">All Skills</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${lessons.map((l)=>`<div style="padding:8px 0;border-bottom:1px solid var(--line);"><a href="#/training/lesson/${l.id}">${esc(l.title)}</a></div>`).join('') || '<div>No lessons yet.</div>'}</div></div>`;
}); }};

Pages.TrainingSongs = { async render() { await renderWithError(async () => {
  const songs = await DB.getTrainingSongs({ q: qv('q') });
  const app = document.getElementById('app');
  app.innerHTML = `${Utils.renderPageHero({ title: 'Songs', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${songs.map((s)=>`<div style="padding:8px 0;border-bottom:1px solid var(--line);"><a href="#/training/song/${s.id}">${esc(s.title)}</a> — ${esc(s.artist || '')} <span style="color:var(--text2);">${esc(s.level_hint || '')}</span></div>`).join('') || 'No songs yet.'}</div></div>`;
}); }};

Pages.TrainingSong = { async render(id) { await renderWithError(async () => {
  const song = await DB.getTrainingSong(id);
  const app = document.getElementById('app');
  app.innerHTML = `${Utils.renderPageHero({ title: esc(song.title), subtitle: esc(song.artist || ''), actions: '<a href="#/training/songs" class="df-btn df-btn--outline">All Songs</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${(song.lessons||[]).map((l)=>`<div style="padding:8px 0;border-bottom:1px solid var(--line);"><a href="#/training/lesson/${l.id}">${esc(l.title)}</a></div>`).join('') || 'No song lessons.'}</div></div>`;
}); }};

Pages.TrainingLesson = { async render(id) { await renderWithError(async () => {
  const lesson = await DB.getTrainingLesson(id);
  const chips = (lesson.skills || []).map((s)=>`<span class="df-label">${esc(s.name)}</span>`).join(' ');
  const songLinks = (lesson.songs || []).map((s)=>`<a href="#/training/song/${s.id}">${esc(s.title)}</a>`).join(', ');
  const app = document.getElementById('app');
  app.innerHTML = `${Utils.renderPageHero({ title: esc(lesson.title), actions: '<a href="#/training/all" class="df-btn df-btn--outline">All Lessons</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${lesson.video_id ? `<iframe style="width:100%;aspect-ratio:16/9;border:0;" src="https://www.youtube-nocookie.com/embed/${esc(lesson.video_id)}" allowfullscreen></iframe>` : ''}<p>${esc(lesson.description || '')}</p><div>${chips || ''}</div>${lesson.lesson_kind === 'song' && songLinks ? `<div style="margin-top:8px;">Song: ${songLinks}</div>` : ''}</div></div>`;
}); }};

Pages.TrainingAll = { async render() { await renderWithError(async () => {
  const q = qv('q');
  const lessons = await DB.getTrainingLessons({ q });
  const app = document.getElementById('app');
  app.innerHTML = `${Utils.renderPageHero({ title: 'All Lessons', subtitle: q ? `Search: ${esc(q)}` : '', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${lessons.map((l)=>`<div style="padding:8px 0;border-bottom:1px solid var(--line);"><a href="#/training/lesson/${l.id}">${esc(l.title)}</a></div>`).join('') || 'No lessons found.'}</div></div>`;
}); }};

Pages.TrainingProviders = { async render() { await renderWithError(async () => {
  const app = document.getElementById('app');
  const providers = await DB.getTrainingProviders();
  app.innerHTML = `${Utils.renderPageHero({ title: 'Providers', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;">${providers.map((p)=>`<div>${esc(p.name)}</div>`).join('')}</div></div>`;
}); }};

Pages.TrainingAdmin = { async render() { await renderWithError(async () => {
  const app = document.getElementById('app');
  const [providers, levels, songs] = await Promise.all([DB.getTrainingProviders(), DB.getTrainingLevels(), DB.getTrainingSongs()]);
  app.innerHTML = `${Utils.renderPageHero({ title: 'Training Admin', actions: '<a href="#/training" class="df-btn df-btn--outline">Back</a>' })}
  <div class="page-wrap" style="padding:24px;display:grid;gap:16px;">
    <div id="training-admin-error" class="card" style="padding:12px;color:var(--danger);display:none;"></div>
    <div class="card" style="padding:16px;"><h3>Create Provider</h3><form id="provider-form" style="display:grid;gap:8px;"><input class="df-input" name="name" placeholder="Name" required><input class="df-input" name="slug" placeholder="Slug"><input class="df-input" name="url" placeholder="URL"><button class="df-btn df-btn--primary">Save Provider</button></form><button id="seed-levels" class="df-btn df-btn--outline" style="margin-top:8px;">Create 9 Levels for first provider</button></div>
    <div class="card" style="padding:16px;"><h3>Create Module</h3><form id="module-form" style="display:grid;gap:8px;"><select class="df-input" name="level_id">${levels.map((l)=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select><input class="df-input" name="title" placeholder="Title" required><input class="df-input" name="description" placeholder="Description"><input class="df-input" name="module_num" type="number" value="0"><input class="df-input" name="sort_order" type="number" value="0"><button class="df-btn df-btn--primary">Save Module</button></form></div>
    <div class="card" style="padding:16px;"><h3>Create Lesson</h3><form id="lesson-form" style="display:grid;gap:8px;"><select class="df-input" name="module_id"><option value="">(optional module)</option></select><input class="df-input" name="title" placeholder="Title"><textarea class="df-input" name="description" placeholder="Description"></textarea><input class="df-input" name="video_url" placeholder="YouTube URL"><input class="df-input" name="thumb_url" placeholder="Thumb URL"><input class="df-input" name="duration_sec" type="number" placeholder="Duration sec"><select class="df-input" name="lesson_kind"><option value="lesson">lesson</option><option value="song">song</option></select><button type="button" id="oembed-btn" class="df-btn df-btn--ghost">Autofill via oEmbed</button><button class="df-btn df-btn--primary">Save Lesson</button></form></div>
    <div class="card" style="padding:16px;"><h3>Create Song</h3><form id="song-form" style="display:grid;gap:8px;"><select class="df-input" name="provider_id">${providers.map((p)=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><input class="df-input" name="title" placeholder="Title" required><input class="df-input" name="artist" placeholder="Artist"><input class="df-input" name="level_hint" placeholder="Level hint"><button class="df-btn df-btn--primary">Save Song</button></form></div>
  </div>`;

  const showError = (msg) => { const el = app.querySelector('#training-admin-error'); el.textContent = msg; el.style.display = 'block'; };
  const modules = await DB.getTrainingModules(levels[0]?.id);
  const modSelect = app.querySelector('select[name="module_id"]');
  const allModules = [...modules];
  modSelect.innerHTML = '<option value="">(optional module)</option>' + allModules.map((m)=>`<option value="${m.id}">${esc(m.title)}</option>`).join('');

  app.querySelector('#provider-form').addEventListener('submit', async (e)=>{ e.preventDefault(); try { await DB.saveTrainingProvider(Object.fromEntries(new FormData(e.target).entries())); go('#/training/admin'); } catch (err) { showError(err.message); } });
  app.querySelector('#seed-levels').addEventListener('click', async ()=>{ try { if (!providers[0]) throw new Error('Create provider first'); await DB.createTrainingDefaultLevels(providers[0].id); go('#/training/admin'); } catch (err) { showError(err.message); } });
  app.querySelector('#module-form').addEventListener('submit', async (e)=>{ e.preventDefault(); try { const d=Object.fromEntries(new FormData(e.target).entries()); await DB.saveTrainingModule(d); go('#/training/admin'); } catch (err) { showError(err.message); } });
  app.querySelector('#oembed-btn').addEventListener('click', async ()=>{ try { const form=app.querySelector('#lesson-form'); const meta=await DB.fetchOEmbed(form.video_url.value); if (!form.title.value) form.title.value = meta.title || ''; if (!form.thumb_url.value) form.thumb_url.value = meta.thumb_url || ''; } catch (err) { showError(err.message); } });
  app.querySelector('#lesson-form').addEventListener('submit', async (e)=>{ e.preventDefault(); try { await DB.saveTrainingLesson(Object.fromEntries(new FormData(e.target).entries())); go('#/training/admin'); } catch (err) { showError(err.message); } });
  app.querySelector('#song-form').addEventListener('submit', async (e)=>{ e.preventDefault(); try { await DB.saveTrainingSong(Object.fromEntries(new FormData(e.target).entries())); go('#/training/admin'); } catch (err) { showError(err.message); } });
}); }};
