window.Pages = window.Pages || {};

function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(sec) { const n = Number(sec) || 0; return `${Math.floor(n / 60)}m`; }
function formatDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return '';
  const n = Math.floor(total);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function formatDurationWithUnknown(seconds, unknownCount) {
  const base = formatDuration(seconds);
  if (!base) return unknownCount > 0 ? '— (partial)' : '—';
  return unknownCount > 0 ? `${base} (+?)` : base;
}
function qv(name) { return new URLSearchParams(location.hash.split('?')[1] || '').get(name) || ''; }

function getDurSec(obj) {
  if (!obj) return null;

  const direct =
    obj.duration_seconds ??
    obj.durationSeconds ??
    obj.duration_sec ??
    obj.durationSec ??
    obj.video_duration_seconds ??
    obj.videoDurationSeconds;

  if (direct != null && direct !== '') {
    const n = Number(direct);
    return Number.isFinite(n) ? n : null;
  }

  const nested = obj.video;
  if (!nested) return null;

  const nestedDur =
    nested.duration_seconds ??
    nested.durationSeconds ??
    nested.duration_sec ??
    nested.durationSec;

  if (nestedDur == null || nestedDur === '') return null;

  const n = Number(nestedDur);
  return Number.isFinite(n) ? n : null;
}

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
  const status = sessionStorage.getItem('trainingPlaylistStatus') || '';
  sessionStorage.removeItem('trainingPlaylistStatus');
  const sort = qv('sort') || 'updated';
  const scope = qv('scope') || 'top';
  const q = (qv('q') || '').trim();
  const activeScope = ['top', 'all', 'nested'].includes(scope) ? scope : 'top';

  const [playlists, groups] = await Promise.all([
    DB.getVideoPlaylists({ scope: activeScope, q }),
    DB.getVideoPlaylistGroups(),
  ]);

  const sortRows = (rows = []) => rows.slice().sort((a, b) => {
    if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    if (sort === 'videos') return (Number(b.video_count) || 0) - (Number(a.video_count) || 0);
    return (Number(a.order_index ?? a.sort_order) || 0) - (Number(b.order_index ?? b.sort_order) || 0);
  });

  const renderCard = (playlist) => {
    const videoCount = Number(playlist.totalVideoCount ?? playlist.video_count_rollup ?? playlist.video_count) || 0;
    const thumb = playlist.preview_thumbnail_url || '';
    const name = esc(playlist.name || `Playlist ${playlist.id}`);
    const description = esc(playlist.description || '');
    const metaCount = videoCount === 0 ? '0 videos' : `${videoCount} videos`;
    const totalDur = Number(playlist.deepDurationSeconds ?? playlist.deep_stats?.deepDurationSeconds) || 0;
    const unknownDur = Number(playlist.unknownDurationCount ?? playlist.deep_stats?.unknownDurationCount) || 0;
    const durationLabel = formatDurationWithUnknown(totalDur, unknownDur);
    const nested = Number(playlist.is_nested) === 1;
    return `<a class="training-playlist-list-card" href="#/training/playlists/${playlist.id}">
      <div>${thumb ? `<img src="${thumb}" alt="${name}" class="training-playlist-preview-lead">` : '<div class="training-thumb-fallback training-playlist-preview-lead">🎬</div>'}</div>
      <div class="training-playlist-list-copy">
        <div class="training-row-title" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span>${name}</span>
          ${nested ? '<span class="df-btn df-btn--ghost" style="pointer-events:none;height:auto;padding:2px 8px;font-size:11px;">Nested</span>' : ''}
        </div>
        <div class="training-playlist-list-description">${description || '—'}</div>
        <div style="color:var(--text2);font-size:12px;">${metaCount} • ${durationLabel} · ${esc(playlist.playlist_type || 'General')} · ${esc(playlist.difficulty_label || 'No difficulty')}</div>
      </div>
    </a>`;
  };

  const groupedPlaylists = new Map();
  playlists.forEach((playlist) => {
    const key = Number(playlist.group_id) || 0;
    if (!groupedPlaylists.has(key)) groupedPlaylists.set(key, []);
    groupedPlaylists.get(key).push(playlist);
  });

  const sections = [
    ...groups.map((group) => ({
      id: Number(group.id),
      title: group.name || 'Group',
      description: group.description || '',
      rows: sortRows(groupedPlaylists.get(Number(group.id)) || []),
    })),
    {
      id: 0,
      title: 'General',
      description: 'Ungrouped playlists',
      rows: sortRows(groupedPlaylists.get(0) || []),
    },
  ];

  const filteredSections = sections.filter((section) => section.rows.length > 0);

  app.innerHTML = `${Utils.renderPageHero({ title: 'Video Playlists', leftExtra: trainingCrumbs([{ label: 'Training', href: '#/training' }, { label: 'Playlists' }]), actions: '<a href="#/training/videos" class="df-btn df-btn--outline">Videos</a>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:12px;">
      <div id="playlist-status" class="df-panel" style="padding:10px;${status ? '' : 'display:none;'}">${esc(status)}</div>
      <div class="df-panel" style="padding:12px;display:grid;gap:10px;">
        <input id="playlist-search" class="df-input" value="${esc(q)}" placeholder="Search playlists...">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${[
    { id: 'top', label: 'Top-level' },
    { id: 'all', label: 'All' },
    { id: 'nested', label: 'Nested' },
  ].map((opt) => `<button type="button" class="df-btn ${activeScope === opt.id ? 'df-btn--primary' : 'df-btn--outline'}" data-scope="${opt.id}">${opt.label}</button>`).join('')}
        </div>
        ${q ? '<div style="color:var(--text2);font-size:12px;">Search is showing matches across all playlists.</div>' : ''}
      </div>
      <div class="training-playlists-layout">
        <div class="training-playlists-main">
          <div style="display:grid;gap:10px;">
            ${q
      ? (sortRows(playlists).map(renderCard).join('') || '<div class="df-panel" style="padding:12px;color:var(--text3);">No playlists match your search.</div>')
      : (filteredSections.map((section) => {
        const collapseKey = `trainingPlaylistGroupCollapsed:${section.id}`;
        const collapsed = readLocalJson(collapseKey, false);
        return `<section class="df-panel training-playlist-group-card" style="padding:12px;display:grid;gap:10px;">
                    <button class="training-playlist-group-header" type="button" data-group-toggle="${section.id}" aria-expanded="${collapsed ? 'false' : 'true'}">
                      <div>
                        <div class="training-row-title">${esc(section.title)}</div>
                        <div style="color:var(--text2);font-size:12px;">${esc(section.description || '')}</div>
                      </div>
                      <div style="color:var(--text2);font-size:12px;">${collapsed ? 'Expand' : 'Collapse'}</div>
                    </button>
                    <div data-group-content="${section.id}" style="display:${collapsed ? 'none' : 'grid'};gap:10px;">
                      ${section.rows.map(renderCard).join('')}
                    </div>
                  </section>`;
      }).join('') || '<div class="df-panel" style="padding:12px;color:var(--text3);">No playlists yet.</div>')}
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

  const buildHash = ({ nextScope = activeScope, nextSort = sort, nextQ = q } = {}) => {
    const params = new URLSearchParams();
    if (nextScope && nextScope !== 'top') params.set('scope', nextScope);
    if (nextSort && nextSort !== 'updated') params.set('sort', nextSort);
    if (nextQ) params.set('q', nextQ);
    const query = params.toString();
    return `#/training/playlists${query ? `?${query}` : ''}`;
  };

  app.querySelector('#playlist-sort')?.addEventListener('change', (event) => {
    go(buildHash({ nextSort: event.target.value || 'updated' }));
  });

  app.querySelector('#playlist-search')?.addEventListener('input', (event) => {
    const value = String(event.target.value || '').trim();
    go(buildHash({ nextQ: value }));
  });

  app.querySelectorAll('[data-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      go(buildHash({ nextScope: btn.dataset.scope || 'top' }));
    });
  });

  app.querySelector('#playlist-create')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.sort_order = playlists.length ? ((Number(playlists[playlists.length - 1].sort_order) || 0) + 10) : 10;
    await DB.saveVideoPlaylist(data);
    sessionStorage.setItem('trainingPlaylistStatus', 'Playlist created.');
    go('#/training/playlists');
  });

  app.querySelectorAll('[data-group-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.groupToggle;
      const content = app.querySelector(`[data-group-content="${id}"]`);
      if (!content) return;
      const nextCollapsed = content.style.display !== 'none';
      content.style.display = nextCollapsed ? 'none' : 'grid';
      btn.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
      btn.lastElementChild.textContent = nextCollapsed ? 'Expand' : 'Collapse';
      writeLocalJson(`trainingPlaylistGroupCollapsed:${id}`, nextCollapsed);
    });
  });
}); }};


Pages.TrainingPlaylistEdit = { async render(id) { await renderWithError(async () => {
  const app = document.getElementById('app');
  const parentId = Number(qv('parentId') || 0);
  const [playlist, videos, allPlaylists, videoAssignments] = await Promise.all([
    DB.getTrainingPlaylistDetail(id),
    DB.getAllTrainingVideos({ includeProgress: 1 }),
    DB.getVideoPlaylists({ scope: 'all' }),
    DB.getTrainingPlaylistVideoAssignments(),
  ]);
  if (!playlist) { app.innerHTML = '<div class="page-wrap" style="padding:24px;">Playlist not found.</div>'; return; }

  const state = {
    playlist,
    items: Array.isArray(playlist.items)
      ? playlist.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0))
      : [],
    saving: false,
    lastSavedAt: Number(playlist.updatedAt || playlist.updated_at || Date.now()),
    deepVideoIds: new Set((playlist.deep_video_ids || []).map((id) => Number(id)).filter(Boolean)),
    deepStats: playlist.deep_stats || { deepVideoCount: 0, deepDurationSeconds: 0, unknownDurationCount: 0 },
    videoAssignments: Object.fromEntries(Object.entries(videoAssignments || {}).map(([videoId, playlistId]) => [Number(videoId), Number(playlistId)])),
  };
  const videosMap = new Map(videos.map((v) => [Number(v.id), v]));
  const idToPlaylist = new Map(allPlaylists.map((p) => [Number(p.id), p]));
  const getDescendantIds = (playlistId) => {
    const directByParent = new Map();
    allPlaylists.forEach((entry) => {
      const parentPlaylistId = Number(entry.parent_playlist_id || 0);
      const childId = Number(entry.id || 0);
      if (!parentPlaylistId || !childId) return;
      if (!directByParent.has(parentPlaylistId)) directByParent.set(parentPlaylistId, []);
      directByParent.get(parentPlaylistId).push(childId);
    });
    const descendants = new Set();
    const stack = [Number(playlistId) || 0];
    while (stack.length) {
      const currentId = stack.pop();
      const children = directByParent.get(currentId) || [];
      children.forEach((childId) => {
        if (descendants.has(childId)) return;
        descendants.add(childId);
        stack.push(childId);
      });
    }
    return descendants;
  };
  const progress = readLocalJson('df_playlist_progress', null);
  const resumeId = Number(qv('resumeVideoId') || 0) || Number(progress?.lastVideoId || 0);
  const canResume = Number(progress?.playlistId) === Number(id) && Number(progress?.lastVideoId);
  const crumbs = [{ label: 'Training', href: '#/training' }, { label: 'Playlists', href: '#/training/playlists' }, { label: playlist.name || `Playlist ${id}` }];

  pushRecentPlaylist(playlist);

  const getSelectableIds = () => ({
    existingVideoIds: new Set(state.items
      .filter((item) => String(item.item_type || 'video') === 'video')
      .map((item) => Number(item.video_id || item.videoId))
      .filter(Boolean)),
    existingPlaylistIds: new Set(state.items
      .filter((item) => String(item.item_type || 'video') === 'playlist')
      .map((item) => Number(item.child_playlist_id || item.childPlaylistId || item.child_playlist?.id))
      .filter(Boolean)),
  });

  app.innerHTML = `${Utils.renderPageHero({ title: playlist.name || 'Playlist', leftExtra: trainingCrumbs(crumbs), actions: '<a href="#/training/playlists" class="df-btn df-btn--outline">Back</a><button id="delete-playlist" class="df-btn df-btn--danger" style="margin-left:8px;" type="button">Delete Playlist</button>' })}
    <div class="page-wrap" style="padding:24px;display:grid;gap:12px;">
      <div class="training-playlist-detail-layout">
        <div style="display:grid;gap:12px;min-width:0;">
          <div class="df-panel" style="padding:12px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
            <div style="color:var(--text2);font-size:12px;" id="playlist-last-saved">${canResume ? `Last saved video: #${Number(progress.lastVideoId)}` : 'No saved playlist progress yet.'}</div>
            <button id="resume-playlist" class="df-btn df-btn--outline" type="button" ${canResume ? '' : 'disabled'}>Resume Playlist</button>
          </div>
          <div id="playlist-items" class="df-panel" style="padding:12px;display:grid;gap:8px;"></div>
          <div class="df-panel" style="padding:12px;display:grid;gap:8px;grid-template-columns:1fr auto;">
            <select class="df-input" id="playlist-add-video"></select>
            <button id="add-video" class="df-btn df-btn--primary" type="button">Add Video</button>
          </div>
          <div class="df-panel" style="padding:12px;display:grid;gap:8px;grid-template-columns:1fr auto;">
            <select class="df-input" id="playlist-add-child"></select>
            <button id="add-playlist" class="df-btn df-btn--outline" type="button">Add Playlist</button>
          </div>
        </div>
        <aside class="training-playlists-sidebar"><div class="df-panel" style="padding:12px;display:grid;gap:8px;align-content:start;"><div style="font-weight:700;">Playlist</div><div style="color:var(--text2);font-size:12px;" id="playlist-video-count"></div><div style="color:var(--text2);font-size:12px;" id="playlist-total-time"></div><div style="color:var(--text2);font-size:12px;" id="playlist-nested-count"></div><div style="color:var(--text2);font-size:12px;">Type: ${esc(playlist.playlist_type || 'General')}</div><div style="color:var(--text2);font-size:12px;">Difficulty: ${esc(playlist.difficulty_label || 'No difficulty')}</div><div style="color:var(--text2);font-size:12px;">Group: ${esc(playlist.group_name || 'General')}</div><button id="edit-playlist" class="df-btn df-btn--primary" type="button">Edit Playlist</button>${Number(playlist.parent_playlist_id) ? '<button id="unnest-self" class="df-btn df-btn--outline" type="button">Unnest Playlist</button>' : ''}</div></aside>
      </div>
    </div>`;

  const route = `#/training/playlists/${id}${parentId ? `?parentId=${parentId}` : ''}`;
  const refreshDeepData = async () => {
    const [refreshed, assignments] = await Promise.all([
      DB.getTrainingPlaylistDetail(id),
      DB.getTrainingPlaylistVideoAssignments(),
    ]);
    if (!refreshed) return;
    state.deepVideoIds = new Set((refreshed.deep_video_ids || []).map((entryId) => Number(entryId)).filter(Boolean));
    state.deepStats = refreshed.deep_stats || { deepVideoCount: 0, deepDurationSeconds: 0, unknownDurationCount: 0 };
    state.videoAssignments = Object.fromEntries(Object.entries(assignments || {}).map(([videoId, playlistId]) => [Number(videoId), Number(playlistId)]));
    state.items = Array.isArray(refreshed.items)
      ? refreshed.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0))
      : state.items;
  };
  const getLastSavedLabel = () => {
    const when = state.lastSavedAt ? new Date(Number(state.lastSavedAt)).toLocaleTimeString() : 'just now';
    return `Last saved: ${when}`;
  };
  const updateSidebarStats = () => {
    const nestedCount = state.items.filter((item) => String(item.item_type || 'video') === 'playlist').length;
    const deepVideoCount = Number(state.deepStats?.deepVideoCount) || 0;
    const deepDurationSeconds = Number(state.deepStats?.deepDurationSeconds) || 0;
    const unknownDurationCount = Number(state.deepStats?.unknownDurationCount) || 0;
    const videoEl = app.querySelector('#playlist-video-count');
    const totalTimeEl = app.querySelector('#playlist-total-time');
    const nestedEl = app.querySelector('#playlist-nested-count');
    const savedEl = app.querySelector('#playlist-last-saved');
    if (videoEl) videoEl.textContent = `Videos: ${deepVideoCount}`;
    if (totalTimeEl) totalTimeEl.textContent = `Total time: ${formatDurationWithUnknown(deepDurationSeconds, unknownDurationCount)}`;
    if (nestedEl) nestedEl.textContent = `${nestedCount} nested playlists`;
    if (savedEl) savedEl.textContent = getLastSavedLabel();
  };

  const rowHtml = (item, idx) => {
    const itemType = String(item.item_type || 'video');
    if (itemType === 'playlist') {
      const child = item.child_playlist || idToPlaylist.get(Number(item.child_playlist_id));
      const childId = Number(item.child_playlist_id || child?.id);
      const thumb = child?.thumbnail || child?.preview_thumbnail_url || '';
      const deepStats = item.deep_stats || child?.deep_stats || {};
      const deepVideoCount = Number(deepStats.deepVideoCount) || 0;
      const deepDurationSeconds = Number(child?.deepDurationSeconds ?? deepStats.deepDurationSeconds) || 0;
      const unknownDurationCount = Number(child?.unknownDurationCount ?? deepStats.unknownDurationCount) || 0;
      const nestedMeta = `${deepVideoCount} videos • ${formatDurationWithUnknown(deepDurationSeconds, unknownDurationCount)}`;
      return `<div class="training-playlist-row" data-open-playlist="${childId}" data-item-id="${item.id}">
        ${thumb ? `<img src="${thumb}" alt="${esc(child?.name || '')}" class="training-playlist-thumb training-playlist-thumb-xl">` : '<div class="training-thumb-fallback training-playlist-thumb-xl">📁</div>'}
        <div class="training-playlist-row-copy"><div class="training-row-title training-row-title-clamp">${esc(child?.name || `Playlist ${childId}`)}</div><div style="color:var(--text2);font-size:12px;margin-top:6px;">${nestedMeta}</div></div>
        <div class="training-playlist-row-controls"><button class="df-btn df-btn--ghost training-compact-btn playlist-item-action" data-up="${idx}" type="button">Move up</button><button class="df-btn df-btn--ghost training-compact-btn playlist-item-action" data-down="${idx}" type="button">Move down</button><button class="df-btn df-btn--ghost training-compact-btn playlist-item-action" data-remove-id="${item.id}" type="button">Remove</button><button class="df-btn df-btn--outline training-compact-btn playlist-item-action" data-unnest-id="${childId}" type="button">Unnest</button></div>
      </div>`;
    }
    const videoId = Number(item.video_id || item.videoId);
    const video = item.video || videosMap.get(videoId);
    const watched = video?.watched_at;
    const mastered = video?.mastered_at;
    const thumb = video?.thumbnail_url || video?.thumb_url || video?.thumbUrl || '';
    return `<div id="playlist-video-${videoId}" class="training-playlist-row" data-open-video="${videoId}" data-item-id="${item.id}">
      ${thumb ? `<img src="${thumb}" alt="${esc(video?.title || '')}" class="training-playlist-thumb training-playlist-thumb-xl">` : '<div class="training-thumb-fallback training-playlist-thumb-xl">🎬</div>'}
      <div class="training-playlist-row-copy"><div class="training-row-title training-row-title-clamp">${esc(video?.title || `Video ${videoId}`)}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${(() => { const sec = getDurSec(video); if (sec == null) return `<span style=\"color:var(--text3);font-size:12px;\">—</span>`; const label = formatDuration(sec) || '00:00'; return `<span style=\"color:var(--text3);font-size:12px;\">${label}</span>`; })()}${watched ? '<span class="training-status-badge">WATCHED</span>' : ''}${mastered ? '<span class="training-status-badge is-mastered">MASTERED</span>' : ''}</div></div>
      <div class="training-playlist-row-controls"><button class="df-btn df-btn--ghost training-compact-btn playlist-item-action" data-up="${idx}" type="button">Move up</button><button class="df-btn df-btn--ghost training-compact-btn playlist-item-action" data-down="${idx}" type="button">Move down</button><button class="df-btn df-btn--ghost training-compact-btn playlist-item-action" data-remove-id="${item.id}" type="button">Remove</button></div>
    </div>`;
  };

  const renderAddSelectors = () => {
    const addVideoSelect = app.querySelector('#playlist-add-video');
    const addPlaylistSelect = app.querySelector('#playlist-add-child');
    if (!addVideoSelect || !addPlaylistSelect) return;
    const { existingVideoIds, existingPlaylistIds } = getSelectableIds();
    const selectableVideos = videos.filter((video) => {
      const videoId = Number(video.id);
      if (!videoId || existingVideoIds.has(videoId) || state.deepVideoIds.has(videoId)) return false;
      const assignedPlaylistId = Number(state.videoAssignments?.[videoId] || 0);
      return !assignedPlaylistId || assignedPlaylistId === Number(id);
    });
    const blockedByCycle = getDescendantIds(id);
    const selectablePlaylists = allPlaylists.filter((entry) => {
      const playlistId = Number(entry.id);
      if (!playlistId || playlistId === Number(id) || existingPlaylistIds.has(playlistId)) return false;
      if (blockedByCycle.has(playlistId)) return false;
      return !Number(entry.parent_playlist_id || 0);
    });
    addVideoSelect.innerHTML = selectableVideos.length
      ? selectableVideos.map((video) => `<option value="${video.id}">${esc(video.title || `Video ${video.id}`)}</option>`).join('')
      : '<option value="">All videos already added</option>';
    addPlaylistSelect.innerHTML = selectablePlaylists.length
      ? selectablePlaylists.map((entry) => `<option value="${entry.id}">${esc(entry.name || `Playlist ${entry.id}`)}</option>`).join('')
      : '<option value="">No playlists available</option>';
  };

  const setBusy = (nextBusy) => {
    state.saving = Boolean(nextBusy);
    app.querySelectorAll('#add-video,#add-playlist,#unnest-self,[data-up],[data-down],[data-remove-id],[data-unnest-id]').forEach((el) => { el.disabled = state.saving; });
  };

  const renderPlaylistItems = (items) => {
    const container = app.querySelector('#playlist-items');
    if (!container) return;
    container.innerHTML = items.length ? items.map(rowHtml).join('') : '<div style="color:var(--text3);">No items yet.</div>';
    renderAddSelectors();
    updateSidebarStats();
    bindListEvents();
    setBusy(state.saving);
  };

  const showErr = (message) => {
    const status = app.querySelector('#playlist-last-saved');
    if (!status) return;
    status.textContent = message || 'Could not save changes.';
  };

  const syncAfterMutation = async () => {
    state.lastSavedAt = Date.now();
    await refreshDeepData();
    updateSidebarStats();
  };

  const saveOrder = async () => {
    await DB.replaceVideoPlaylistItems(id, state.items.map((it, index) => ({
      item_type: String(it.item_type || 'video'),
      video_id: Number(it.video_id || it.videoId) || null,
      child_playlist_id: Number(it.child_playlist_id) || null,
      order_index: index + 1,
    })));
    await syncAfterMutation();
  };

  const bindListEvents = () => {
    app.querySelectorAll('.training-playlist-row').forEach((row) => row.addEventListener('click', (event) => {
      if (event.target.closest('button[data-up],button[data-down],button[data-remove-id],button[data-unnest-id],.training-playlist-row-controls')) return;
      const nestedId = Number(row.dataset.openPlaylist);
      if (nestedId) return go(`#/training/playlists/${nestedId}?parentId=${id}`);
      const videoId = Number(row.dataset.openVideo);
      if (!videoId) return;
      savePlaylistProgress(id, videoId);
      pushRecentPlaylist(playlist);
      go(`#/training/videos/${videoId}?fromPlaylist=${encodeURIComponent(id)}`);
    }));

    app.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (state.saving) return;
      const idx = Number(b.dataset.up);
      if (idx < 1) return;
      const previous = state.items.slice();
      [state.items[idx - 1], state.items[idx]] = [state.items[idx], state.items[idx - 1]];
      renderPlaylistItems(state.items);
      setBusy(true);
      try { await saveOrder(); } catch (error) { state.items = previous; renderPlaylistItems(state.items); showErr(error.message || 'Move failed.'); }
      setBusy(false);
    }));

    app.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (state.saving) return;
      const idx = Number(b.dataset.down);
      if (idx >= state.items.length - 1) return;
      const previous = state.items.slice();
      [state.items[idx + 1], state.items[idx]] = [state.items[idx], state.items[idx + 1]];
      renderPlaylistItems(state.items);
      setBusy(true);
      try { await saveOrder(); } catch (error) { state.items = previous; renderPlaylistItems(state.items); showErr(error.message || 'Move failed.'); }
      setBusy(false);
    }));

    app.querySelectorAll('[data-remove-id]').forEach((b) => b.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (state.saving) return;
      const itemId = Number(b.dataset.removeId);
      const idx = state.items.findIndex((item) => Number(item.id) === itemId);
      if (idx < 0) return;
      const removed = state.items[idx];
      state.items.splice(idx, 1);
      renderPlaylistItems(state.items);
      setBusy(true);
      try {
        const response = await DB.deleteTrainingPlaylistItem(id, itemId);
        if (Array.isArray(response?.items)) state.items = response.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0));
        await syncAfterMutation();
        renderPlaylistItems(state.items);
      } catch (error) {
        state.items.splice(idx, 0, removed);
        renderPlaylistItems(state.items);
        showErr(error.message || 'Remove failed.');
      }
      setBusy(false);
    }));

    app.querySelectorAll('[data-unnest-id]').forEach((b) => b.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (state.saving) return;
      const childPlaylistId = Number(b.dataset.unnestId || 0);
      if (!childPlaylistId) return;
      setBusy(true);
      try {
        await DB.unnestTrainingPlaylist(id, childPlaylistId);
        const response = await DB.getTrainingPlaylistDetail(id);
        state.items = Array.isArray(response?.items) ? response.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0)) : state.items;
        await syncAfterMutation();
        renderPlaylistItems(state.items);
        showErr('Playlist moved to top-level');
      } catch (error) {
        showErr(error.message || 'Unnest failed.');
      }
      setBusy(false);
    }));
  };

  renderPlaylistItems(state.items);

  const scrollToVideo = (videoId) => {
    const target = app.querySelector(`#playlist-video-${Number(videoId)}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.style.boxShadow = '0 0 0 1px var(--accent) inset';
    setTimeout(() => { target.style.boxShadow = ''; }, 1500);
  };

  app.querySelector('#resume-playlist')?.addEventListener('click', () => { if (canResume) scrollToVideo(progress.lastVideoId); });

  app.querySelector('#unnest-self')?.addEventListener('click', async () => {
    if (state.saving) return;
    const parentPlaylistId = Number(playlist.parent_playlist_id || 0);
    if (!parentPlaylistId) return;
    setBusy(true);
    try {
      await DB.unnestTrainingPlaylist(parentPlaylistId, id);
      showErr('Playlist moved to top-level');
      go(`#/training/playlists/${id}`);
    } catch (error) {
      showErr(error.message || 'Unnest failed.');
    }
    setBusy(false);
  });

  app.querySelector('#add-video')?.addEventListener('click', async () => {
    if (state.saving) return;
    const videoId = Number(app.querySelector('#playlist-add-video')?.value || 0);
    if (!videoId) return;
    setBusy(true);
    try {
      const response = await DB.addTrainingPlaylistItem(id, { item_type: 'video', video_id: videoId });
      if (Array.isArray(response?.items)) {
        state.items = response.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0));
      } else {
        const refreshed = await DB.getTrainingPlaylistDetail(id);
        state.items = Array.isArray(refreshed?.items) ? refreshed.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0)) : state.items;
      }
      await syncAfterMutation();
      renderPlaylistItems(state.items);
    } catch (error) {
      if (String(error.message || '').includes('409')) {
        showErr('Video already assigned to another playlist.');
      } else {
        showErr(error.message || 'Add video failed.');
      }
    }
    setBusy(false);
  });

  app.querySelector('#add-playlist')?.addEventListener('click', async () => {
    if (state.saving) return;
    const childPlaylistId = Number(app.querySelector('#playlist-add-child')?.value || 0);
    if (!childPlaylistId) return;
    setBusy(true);
    try {
      const response = await DB.addTrainingPlaylistItem(id, { item_type: 'playlist', child_playlist_id: childPlaylistId });
      if (Array.isArray(response?.items)) {
        state.items = response.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0));
      } else {
        const refreshed = await DB.getTrainingPlaylistDetail(id);
        state.items = Array.isArray(refreshed?.items) ? refreshed.items.slice().sort((a, b) => (Number(a.order_index ?? a.position) || 0) - (Number(b.order_index ?? b.position) || 0)) : state.items;
      }
      await syncAfterMutation();
      renderPlaylistItems(state.items);
    } catch (error) {
      if (String(error.message || '').includes('409')) {
        showErr('Playlist already nested in another playlist.');
      } else {
        showErr(error.message || 'Unable to add playlist');
      }
    }
    setBusy(false);
  });

  app.querySelector('#delete-playlist')?.addEventListener('click', async ()=>{ if (!confirm('Delete this playlist?')) return; await DB.deleteVideoPlaylist(id); sessionStorage.setItem('trainingPlaylistStatus', 'Playlist deleted.'); go('#/training/playlists'); });
  app.querySelector('#edit-playlist')?.addEventListener('click', () => {
    const groups = (new Set(['', ...allPlaylists.map((p) => p.group_name || ''), playlist.group_name || '']));
    const groupOptions = Array.from(groups).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const modal = document.createElement('div');
    modal.className = 'sync-help-modal open';
    modal.innerHTML = `<div class="sync-help-modal__card" role="dialog" aria-modal="true" aria-label="Edit Playlist" style="max-width:560px;"><div class="sync-help-modal__head"><strong>Edit Playlist</strong><button type="button" id="close-edit-playlist" class="df-btn df-btn--ghost" aria-label="Close">×</button></div><form id="playlist-edit-form" style="display:grid;gap:8px;"><input class="df-input" name="name" required value="${esc(playlist.name || '')}" placeholder="Playlist name"><textarea class="df-input" name="description" rows="3" placeholder="Description">${esc(playlist.description || '')}</textarea><input class="df-input" name="difficulty_label" value="${esc(playlist.difficulty_label || '')}" placeholder="Difficulty label"><select class="df-input" name="playlist_type">${['Skill','Song','Course','General'].map((type) => `<option value="${type}" ${String(playlist.playlist_type || 'General') === type ? 'selected' : ''}>${type}</option>`).join('')}</select><input class="df-input" name="group_name" list="playlist-group-list" value="${esc(playlist.group_name || '')}" placeholder="Group name (blank = General)"><datalist id="playlist-group-list">${groupOptions.map((name) => `<option value="${esc(name)}"></option>`).join('')}</datalist><input class="df-input" name="order_index" type="number" value="${Number(playlist.order_index ?? playlist.sort_order) || 0}" placeholder="Order within group"><div style="display:flex;gap:8px;justify-content:flex-end;"><button type="button" id="cancel-edit-playlist" class="df-btn df-btn--outline">Cancel</button><button class="df-btn df-btn--primary">Save</button></div></form></div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('#close-edit-playlist')?.addEventListener('click', close);
    modal.querySelector('#cancel-edit-playlist')?.addEventListener('click', close);
    modal.querySelector('#playlist-edit-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      await DB.patchTrainingPlaylist(id, { name: data.name, description: data.description, difficulty_label: data.difficulty_label, playlist_type: data.playlist_type, group_name: data.group_name, order_index: Number(data.order_index) || 0 });
      close();
      go(route);
    });
  });
}); }};
