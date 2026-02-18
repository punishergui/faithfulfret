window.Pages = window.Pages || {};

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(sec) { const n = Number(sec) || 0; return `${Math.floor(n / 60)}m`; }
function qv(name) { return new URLSearchParams(location.hash.split('?')[1] || '').get(name) || ''; }

function trainingCrumbs(items) { return Utils.renderBreadcrumbs(items); }

function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}


function setLastPracticeTraining({ playlistId = null, videoId = null } = {}) {
  Utils.setLastPractice({
    tool: 'training',
    key_root: null,
    key_mode: null,
    progression_id: null,
    scale_id: null,
    chord_id: null,
    bpm: null,
    beats_per_chord: null,
    countin_enabled: null,
    countin_bars: null,
    playlist_id: Number.isFinite(Number(playlistId)) ? Number(playlistId) : null,
    video_id: Number.isFinite(Number(videoId)) ? Number(videoId) : null,
  });
}

function pushRecentPlaylist(playlist) {
  const list = readLocalJson('df_recent_playlists', []);
  const safe = Array.isArray(list) ? list : [];
  const next = [{ id: Number(playlist.id), name: playlist.name || `Playlist ${playlist.id}`, at: Date.now() }, ...safe.filter((item) => Number(item?.id) !== Number(playlist.id))].slice(0, 3);
  writeLocalJson('df_recent_playlists', next);
}

function savePlaylistProgress(playlistId, lastVideoId) {
  setLastPracticeTraining({ playlistId, videoId: lastVideoId });
  writeLocalJson('df_playlist_progress', {
    playlistId: Number(playlistId),
    lastVideoId: Number(lastVideoId),
    updatedAt: Date.now(),
  });
}


async function renderWithError(renderFn) {
  const app = document.getElementById('app');
  try { await renderFn(); } catch (e) {
    app.innerHTML = `<div class="page-wrap" style="padding:24px;"><div class="card" style="padding:16px;color:var(--danger);">${esc(e.message || e)}</div></div>`;
  }
}

Pages.TrainingHome = { async render() { await renderWithError(async () => {
  const app = document.getElementById('app');
  const [videos, playlists] = await Promise.all([DB.getAllTrainingVideos(), DB.getVideoPlaylists()]);
  app.innerHTML = `${Utils.renderPageHero({ title: 'Training', subtitle: 'Video library with playlists, difficulty, and attachments.', leftExtra: trainingCrumbs([{ label: 'Training' }]), actions: '<a href="#/training/videos/new" class="df-btn df-btn--primary">+ New Video</a>' })}
    <div class="page-wrap" style="padding:24px;">
      <div class="training-home-tiles">
        <a class="training-home-tile" href="#/training/videos" role="link" tabindex="0" aria-label="Open Video Library">
          <div><h3 style="margin:0 0 6px;">Video Library</h3><div style="color:var(--text2);">${videos.length} videos saved</div></div>
          <div class="training-home-tile__hint" aria-hidden="true">›</div>
        </a>
        <a class="training-home-tile" href="#/training/playlists" role="link" tabindex="0" aria-label="Open Playlists">
          <div><h3 style="margin:0 0 6px;">Playlists</h3><div style="color:var(--text2);">${playlists.length} playlists</div></div>
          <div class="training-home-tile__hint" aria-hidden="true">›</div>
        </a>
      </div>
    </div>`;
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


Pages.TrainingPlaylists = { async render() { await renderWithError(async () => {
  const app = document.getElementById('app');
  const playlists = await DB.getVideoPlaylists();
  const status = sessionStorage.getItem('trainingPlaylistStatus') || '';
  sessionStorage.removeItem('trainingPlaylistStatus');
  const sort = qv('sort') || 'updated';

  const sorted = playlists.slice().sort((a, b) => {
    if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    if (sort === 'videos') return (Number(b.video_count) || 0) - (Number(a.video_count) || 0);
    return (Number(b.updatedAt || b.updated_at) || 0) - (Number(a.updatedAt || a.updated_at) || 0);
  });

  const updatedLabel = (playlist) => {
    const updatedAt = Number(playlist.updatedAt || playlist.updated_at) || 0;
    if (!updatedAt) return 'Updated today';
    const days = Math.max(0, Math.floor((Date.now() - updatedAt) / 86400000));
    if (days === 0) return 'Updated today';
    if (days === 1) return 'Updated 1 day ago';
    return `Updated ${days} days ago`;
  };

  app.innerHTML = `${Utils.renderPageHero({ title: 'Video Playlists', leftExtra: trainingCrumbs([{ label: 'Training', href: '#/training' }, { label: 'Playlists' }]), actions: '<a href="#/training/videos" class="df-btn df-btn--outline">Videos</a>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:12px;">
      <div id="playlist-status" class="df-panel" style="padding:10px;${status ? '' : 'display:none;'}">${esc(status)}</div>
      <div class="training-playlists-layout">
        <div class="training-playlists-main">
          <div class="df-panel" style="padding:12px;display:grid;gap:10px;">
            <div style="display:grid;gap:10px;">
              ${sorted.map((p) => {
                const videoCount = Number(p.video_count) || 0;
                const thumb = p.preview_thumbnail_url || '';
                const name = esc(p.name || `Playlist ${p.id}`);
                const description = esc(p.description || '');
                const metaCount = videoCount === 0 ? '0 videos' : `${videoCount} videos`;
                return `<a class="training-playlist-list-card" href="#/training/playlists/${p.id}">
                  <div>${thumb ? `<img src="${thumb}" alt="${name}" class="training-playlist-preview-lead">` : '<div class="training-thumb-fallback training-playlist-preview-lead">Thumbnail pending / ffmpeg not installed</div>'}</div>
                  <div class="training-playlist-list-copy">
                    <div class="training-row-title">${name}</div>
                    <div class="training-playlist-list-description">${description || '—'}</div>
                    <div style="color:var(--text2);font-size:12px;">${metaCount} · ${updatedLabel(p)}</div>
                  </div>
                </a>`;
              }).join('') || '<div style="color:var(--text3);">No playlists yet.</div>'}
            </div>
          </div>
        </div>

        <aside class="training-playlists-sidebar">
          <form id="playlist-create" class="df-panel" style="padding:12px;display:grid;gap:8px;">
            <div style="font-weight:700;">Create Playlist</div>
            <input class="df-input" name="name" placeholder="Playlist name" required>
            <textarea class="df-input" name="description" rows="2" placeholder="Description"></textarea>
            <button class="df-btn df-btn--primary" style="justify-self:start;">Create</button>
          </form>

          <div class="df-panel" style="padding:12px;display:grid;gap:8px;">
            <label for="playlist-sort" style="font-size:12px;color:var(--text2);">Sort by:</label>
            <select id="playlist-sort" class="df-input">
              <option value="name" ${sort === 'name' ? 'selected' : ''}>Name</option>
              <option value="updated" ${sort === 'updated' ? 'selected' : ''}>Recently Updated</option>
              <option value="videos" ${sort === 'videos' ? 'selected' : ''}>Most Videos</option>
            </select>
          </div>
        </aside>
      </div>
    </div>`;

  app.querySelector('#playlist-sort')?.addEventListener('change', (event) => {
    const params = new URLSearchParams();
    if (event.target.value && event.target.value !== 'updated') params.set('sort', event.target.value);
    const query = params.toString();
    go(`#/training/playlists${query ? `?${query}` : ''}`);
  });

  app.querySelector('#playlist-create')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.sort_order = playlists.length ? ((Number(playlists[playlists.length - 1].sort_order) || 0) + 10) : 10;
    await DB.saveVideoPlaylist(data);
    sessionStorage.setItem('trainingPlaylistStatus', 'Playlist created.');
    go('#/training/playlists');
  });
}); }};

Pages.TrainingPlaylistEdit = { async render(id) { await renderWithError(async () => {
  const app = document.getElementById('app');
  const [playlist, videos] = await Promise.all([DB.getVideoPlaylist(id), DB.getAllTrainingVideos({ includeProgress: 1 })]);
  if (!playlist) { app.innerHTML = '<div class="page-wrap" style="padding:24px;">Playlist not found.</div>'; return; }
  const items = Array.isArray(playlist.items) ? playlist.items.slice().sort((a,b)=>(a.position||0)-(b.position||0)) : [];
  const map = new Map(videos.map((v)=>[Number(v.id), v]));
  const available = videos.filter((v)=>!items.find((i)=>Number(i.videoId || i.video_id)===Number(v.id)));
  const progress = readLocalJson('df_playlist_progress', null);
  const resumeId = Number(qv('resumeVideoId') || 0) || Number(progress?.lastVideoId || 0);
  const canResume = Number(progress?.playlistId) === Number(id) && Number(progress?.lastVideoId);

  pushRecentPlaylist(playlist);

  app.innerHTML = `${Utils.renderPageHero({ title: playlist.name || 'Playlist', leftExtra: trainingCrumbs([{ label: 'Training', href: '#/training' }, { label: 'Playlists', href: '#/training/playlists' }, { label: playlist.name || 'Playlist' }]), actions: '<a href="#/training/playlists" class="df-btn df-btn--outline">Back</a><button id="delete-playlist" class="df-btn df-btn--danger" style="margin-left:8px;" type="button">Delete Playlist</button>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:12px;">
      <div class="df-panel" style="padding:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div style="color:var(--text2);font-size:12px;">${canResume ? `Last saved video: #${Number(progress.lastVideoId)}` : 'No saved playlist progress yet.'}</div>
        <button id="resume-playlist" class="df-btn df-btn--outline" type="button" ${canResume ? '' : 'disabled'}>Resume Playlist</button>
      </div>
      <div class="df-panel" style="padding:12px;display:grid;gap:8px;">${items.map((item,idx)=>{ const video=map.get(Number(item.videoId || item.video_id)); const videoId = Number(item.videoId || item.video_id); const watched = video?.watched_at; const mastered = video?.mastered_at; const thumb = video?.thumbnail_url || video?.thumb_url || video?.thumbUrl || '';
      const isUpload = video?.source_type === 'upload'; return `<div id="playlist-video-${videoId}" class="training-playlist-row" data-open-video="${videoId}">${thumb ? `<img src="${thumb}" alt="${esc(video?.title || '')}" class="training-playlist-thumb training-playlist-thumb-xl">` : `<div class="training-thumb-fallback training-playlist-thumb-xl">${isUpload ? 'Thumbnail pending / ffmpeg not installed' : '🎬'}</div>`}<div class="training-playlist-row-copy"><div class="training-row-title training-row-title-clamp">${esc(video?.title || `Video ${videoId}`)}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${video?.duration_sec ? `<span style="color:var(--text3);font-size:12px;">${fmt(video.duration_sec)}</span>` : ''}${watched ? '<span class="training-status-badge">WATCHED</span>' : ''}${mastered ? '<span class="training-status-badge is-mastered">MASTERED</span>' : ''}</div></div><div class="training-playlist-row-controls"><button class="df-btn df-btn--ghost training-compact-btn" data-up="${idx}" type="button" aria-label="Move up">Move up</button><button class="df-btn df-btn--ghost training-compact-btn" data-down="${idx}" type="button" aria-label="Move down">Move down</button><button class="df-btn df-btn--ghost training-compact-btn" data-remove="${idx}" type="button">Remove</button></div></div>`; }).join('') || '<div style="color:var(--text3);">No videos yet.</div>'}</div>
      <form id="playlist-add" class="df-panel" style="padding:12px;display:grid;grid-template-columns:1fr auto;gap:8px;">
        <select class="df-input" name="videoId">${available.map((v)=>`<option value="${v.id}">${esc(v.title || `Video ${v.id}`)}</option>`).join('')}</select>
        <button class="df-btn df-btn--primary">Add Video</button>
      </form>
    </div>`;

  async function save(nextItems) {
    await DB.replaceVideoPlaylistItems(id, nextItems.map((it, index) => ({ videoId: Number(it.videoId || it.video_id), position: index + 1 })));
    go(`#/training/playlists/${id}`);
  }

  const scrollToVideo = (videoId) => {
    const target = app.querySelector(`#playlist-video-${Number(videoId)}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.boxShadow = '0 0 0 1px var(--accent) inset';
    setTimeout(() => { target.style.boxShadow = ''; }, 1500);
  };

  app.querySelector('#resume-playlist')?.addEventListener('click', () => {
    if (!canResume) return;
    scrollToVideo(progress.lastVideoId);
  });

  app.querySelectorAll('.training-playlist-row').forEach((row)=>row.addEventListener('click', (event)=>{
    if (event.target.closest('button[data-up],button[data-down],button[data-remove],.training-playlist-row-controls')) return;
    const videoId = Number(row.dataset.openVideo);
    if (!videoId) return;
    savePlaylistProgress(id, videoId);
    pushRecentPlaylist(playlist);
    go(`#/training/videos/${videoId}?fromPlaylist=${encodeURIComponent(id)}`);
  }));

  app.querySelector('#playlist-add')?.addEventListener('submit', async (e)=>{ e.preventDefault(); const videoId=Number(new FormData(e.target).get('videoId')); if (!videoId) return; await save([...items, { videoId }]); });
  app.querySelectorAll('[data-remove]').forEach((b)=>b.addEventListener('click', async (event)=>{ event.stopPropagation(); const idx=Number(b.dataset.remove); const next=items.filter((_,i)=>i!==idx); await save(next); }));
  app.querySelectorAll('[data-up]').forEach((b)=>b.addEventListener('click', async (event)=>{ event.stopPropagation(); const idx=Number(b.dataset.up); if (idx<1) return; const next=items.slice(); [next[idx-1], next[idx]]=[next[idx], next[idx-1]]; await save(next); }));
  app.querySelectorAll('[data-down]').forEach((b)=>b.addEventListener('click', async (event)=>{ event.stopPropagation(); const idx=Number(b.dataset.down); if (idx>=items.length-1) return; const next=items.slice(); [next[idx+1], next[idx]]=[next[idx], next[idx+1]]; await save(next); }));
  app.querySelector('#delete-playlist')?.addEventListener('click', async ()=>{ if (!confirm('Delete this playlist?')) return; await DB.deleteVideoPlaylist(id); sessionStorage.setItem('trainingPlaylistStatus', 'Playlist deleted.'); go('#/training/playlists'); });

  if (resumeId) {
    setTimeout(() => scrollToVideo(resumeId), 120);
  }
}); }};
