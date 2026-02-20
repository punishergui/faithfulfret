// Daily Fret — Dashboard Page

window.Pages = window.Pages || {};

Pages.Dashboard = {
  _feedRefreshTimer: null,
  _onDataChanged: null,

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    let stats;
    let sessions;
    let heatmapDays;

    try {
      [stats, sessions, heatmapDays] = await Promise.all([
        DB.getStats(),
        DB.getAllSess(),
        DB.getSessionHeatmap(),
      ]);
    } catch (error) {
      app.innerHTML = `
        <div class="page-wrap" style="padding:32px 24px;">
          <div class="card" style="border:1px solid #b91c1c;background:rgba(185,28,28,0.12);padding:16px;">
            <div style="font-family:var(--f-mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#fecaca;margin-bottom:8px;">Dashboard failed to load</div>
            <div style="color:#fee2e2;font-family:var(--f-mono);font-size:12px;line-height:1.5;">${String(error?.message || error).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))}</div>
            <div style="margin-top:12px;"><button class="df-btn" onclick="Pages.Dashboard.render()">Retry</button></div>
          </div>
        </div>
      `;
      return;
    }

    const today = Utils.today();
    const recent = sessions.slice(0, 8);
    const progressSummary = window.progressMem?.getSummary?.() || null;

    let feedItems = [];
    let feedFacets = null;
    let feedFailed = false;
    let initialFeedTotal = 0;
    try {
      const feedResponse = await DB.getFeed(10, 0, null);
      feedItems = Array.isArray(feedResponse?.items) ? feedResponse.items : [];
      feedFacets = feedResponse?.facets || null;
      initialFeedTotal = Number(feedResponse?.total) || feedItems.length;
      if (window.DF_DEBUG_FEED) {
        console.log('[DF feed]', feedItems);
        console.log('[DF feed countsByType]', feedFacets?.countsByType || this._countByType(feedItems));
      }
    } catch (error) {
      console.error('feed load failed', error);
      feedFailed = true;
    }

    const fallbackFeedItems = recent.map((s) => ({
      id: `sess:${s.id}`,
      type: 'session',
      ts: this._sessionTimestamp(s),
      title: s.title || s.focus || s.focusTag || `Session ${s.id}`,
      subtitle: s.notes || s.win || 'Practice session',
      meta: {
        minutes: Number(s.minutes) || Number(s.durationMinutes) || null,
        bpm: Number(s.bpm) || null,
        tool: s.focus || s.focusTag || null,
        tags: [s.focus, s.focusTag].filter(Boolean).slice(0, 3),
      },
      href: `#/session/${s.id}`,
      accent: 'accent',
    }));

    const timelineItems = feedItems.length ? feedItems : fallbackFeedItems;

    app.innerHTML = `
      ${this._renderHero(stats)}
      <div class="page-wrap dashboard-layout-wrap" style="padding:28px 24px;">
        <div class="dashboard-grid dash-grid" style="align-items:start;">
          <div class="dashboard-main-col timeline">
            ${this._renderTimeline(timelineItems, feedFacets, feedFailed, initialFeedTotal)}
            ${!timelineItems.length ? this._renderRecentSessions(recent, today) : ''}
          </div>
          <aside class="dashboard-side-col dash-side">
            ${this._renderProgressMemory(progressSummary, stats)}
            ${this._renderQuickLog(today)}
            ${this._renderCompactHeatmap(heatmapDays, today)}
          </aside>
        </div>
      </div>
    `;

    this._initStatCounters(app, stats);
    this._initTimelineFilters(app, timelineItems, feedFacets, feedFailed, initialFeedTotal);
    this._initQuickLog(app, today);
    this._initDashboardHeatmap(app);
    // Smoke checklist:
    // 1) Dashboard loads 10 feed items by default.
    // 2) Show More appends 10 without duplicates.
    // 3) Filters reset to first page and Show More keeps filter.
    // 4) Stats panel shows metrics, not a primary Start Practice CTA.
    // 5) Empty DB shows no-practice message with zeros and no crash.
    this._bindDataChanged();
  },

  _bindDataChanged() {
    if (this._onDataChanged) return;
    this._onDataChanged = () => {
      if (this._feedRefreshTimer) clearTimeout(this._feedRefreshTimer);
      this._feedRefreshTimer = setTimeout(() => {
        if (location.hash.startsWith('#/dashboard')) this.render();
      }, 250);
    };
    window.addEventListener('ff:data-changed', this._onDataChanged);
  },

  _countByType(items = []) {
    const counts = { session: 0, gear: 0, training: 0, video: 0, playlist: 0, resource: 0, preset: 0 };
    items.forEach((item) => {
      if (counts[item?.type] != null) counts[item.type] += 1;
    });
    return counts;
  },

  _readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },

  _readQuickStart() {
    const lastVideoId = Number(localStorage.getItem('df_last_video_id') || 0);
    const playlistProgress = this._readJson('df_playlist_progress', null);
    const recentPlaylistsRaw = this._readJson('df_recent_playlists', []);
    const recentVideosRaw = this._readJson('df_recent_videos', []);
    const recentPlaylists = (Array.isArray(recentPlaylistsRaw) ? recentPlaylistsRaw : []).slice(0, 3);
    const recentVideos = (Array.isArray(recentVideosRaw) ? recentVideosRaw : []).slice(0, 5);
    return { lastVideoId, playlistProgress, recentPlaylists, recentVideos };
  },


  _formatProgId(progId) {
    if (!progId) return null;
    return String(progId).split('-').filter(Boolean).join('–');
  },

  _buildRecentActivityItems(data, lastPractice) {
    const items = [];
    (data.recentVideos || []).forEach((item) => {
      items.push({
        id: `video-${Number(item.id)}`,
        title: item.title || `Video ${item.id}`,
        type: 'Video',
        when: item.lastPracticedAt || item.watchedAt,
        href: `#/training/videos/${Number(item.id)}`,
      });
    });

    (data.recentPlaylists || []).forEach((item) => {
      items.push({
        id: `playlist-${Number(item.id)}`,
        title: item.name || `Playlist ${item.id}`,
        type: 'Playlist',
        when: item.at || item.usedAt,
        href: `#/training/playlists/${Number(item.id)}`,
      });
    });

    if (lastPractice?.tool) {
      items.push({
        id: 'practice-last',
        title: `${this._toolLabel(lastPractice.tool)} Practice`,
        type: 'Training',
        when: Number(lastPractice.updated_at || lastPractice.started_at || 0),
        href: '#/tools/progressions?resume=1',
      });
    }

    return items
      .filter((item) => item.href)
      .sort((a, b) => this._activityTime(b.when) - this._activityTime(a.when))
      .slice(0, 8);
  },

  _activityTime(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  },

  _sessionTimestamp(session = {}) {
    const dateValue = session?.date ? new Date(`${session.date}T12:00:00`).getTime() : 0;
    return Number(dateValue) || Number(session?.createdAt) || 0;
  },

  _renderTimeline(items = [], feedFacets = null, feedFailed = false, totalItems = 0) {
    const counts = feedFacets?.countsByType || this._countByType(items);
    const filters = [
      { key: 'all', label: 'All', count: Number(totalItems) || items.length },
      { key: 'session', label: 'Sessions', count: counts.session || 0 },
      { key: 'gear', label: 'Gear', count: counts.gear || 0 },
      { key: 'training', label: 'Training', count: counts.training || 0 },
      { key: 'video', label: 'Videos', count: counts.video || 0 },
      { key: 'playlist', label: 'Playlists', count: counts.playlist || 0 },
      { key: 'resource', label: 'Resources', count: counts.resource || 0 },
      { key: 'preset', label: 'Presets', count: counts.preset || 0 },
    ];
    return `
      <section id="dashboard-timeline" data-feed='${JSON.stringify(items).replace(/'/g, '&#39;')}' data-facets='${JSON.stringify(counts).replace(/'/g, '&#39;')}' data-feed-failed="${feedFailed ? '1' : '0'}" data-feed-total="${Number(totalItems) || items.length}">
        <div class="timeline-header">
          <div class="section-header">
            <span class="section-header__label">Timeline</span>
          </div>
          <div class="timeline-filters" aria-label="Timeline filters">
            ${filters.map((filter) => `<button type="button" class="timeline-chip ${filter.key === 'all' ? 'is-active' : ''}" data-filter="${filter.key}">${filter.label} <span class="timeline-chip__count">${filter.count}</span></button>`).join('')}
          </div>
        </div>
        <div class="timeline-list" data-timeline-list>
          ${items.length
            ? items.map((item) => this._renderTimelineCard(item)).join('')
            : `<div class="timeline-card timeline-card--empty"><div class="empty-state__title">No activity yet</div><div class="empty-state__text">Log your first session.</div>${feedFailed ? '<div class="empty-state__text">Feed is temporarily unavailable, showing fallback modules below.</div>' : ''}</div>`}
        </div>
        <div class="timeline-more" data-timeline-more-wrap style="display:${items.length < (Number(totalItems) || items.length) ? 'flex' : 'none'};">
          <button type="button" class="df-btn timeline-more__btn" data-timeline-more>Show More</button>
        </div>
      </section>
    `;
  },

  _renderTimelineCard(item = {}) {
    const iconKey = item?.thumb?.icon || item?.type || 'session';
    const icon = `<span class="timeline-icon" aria-hidden="true">${this._iconForType(iconKey)}</span>`;
    const chips = [];
    if (item?.meta?.minutes) chips.push(`<span class="timeline-chip">${item.meta.minutes}m</span>`);
    if (item?.meta?.bpm) chips.push(`<span class="timeline-chip">${item.meta.bpm} bpm</span>`);
    if (item?.meta?.tool) chips.push(`<span class="timeline-chip">${item.meta.tool}</span>`);
    (Array.isArray(item?.meta?.tags) ? item.meta.tags : []).slice(0, 3).forEach((tag) => chips.push(`<span class="timeline-chip">${tag}</span>`));
    const href = item.href || '';
    const thumb = item?.thumb?.kind === 'image' && item?.thumb?.src
      ? `<img class="timeline-thumb__img" src="${item.thumb.src}" alt="" loading="lazy" decoding="async">`
      : `<div class="timeline-thumb__icon">${icon}</div>`;
    const cardAttrs = href
      ? `onclick="go('${href}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'){go('${href}')}"`
      : '';
    const cardClass = `timeline-card${href ? ' timeline-card--clickable' : ''}`;
    return `
      <article class="${cardClass}" ${cardAttrs}>
        <div class="timeline-thumb">${thumb}</div>
        <div class="timeline-card__body">
          <div class="timeline-card__title">${item.title || 'Session'}</div>
          <div class="timeline-card__subtitle">${item.subtitle || 'Practice session'}</div>
          <div class="timeline-meta">${chips.join('')}</div>
        </div>
        <div class="timeline-card__side">
          <div class="timeline-card__time">${this._formatTimelineTime(item.ts)}</div>
          ${href ? `<a href="${href}" class="df-btn df-btn--outline">View</a>` : ''}
        </div>
      </article>
    `;
  },

  _initTimelineFilters(container, items = [], feedFacets = null, feedFailed = false, initialTotal = 0) {
    const timeline = container.querySelector('#dashboard-timeline');
    if (!timeline) return;
    const list = timeline.querySelector('[data-timeline-list]');
    if (!list) return;

    const moreWrap = timeline.querySelector('[data-timeline-more-wrap]');
    const moreBtn = timeline.querySelector('[data-timeline-more]');
    const PAGE_SIZE = 10;
    let activeFilter = 'all';
    let loadingMore = false;
    let feedItems = Array.isArray(items) ? [...items] : [];
    let currentOffset = feedItems.length;
    let total = Number(initialTotal) || feedItems.length;

    const dedupe = (rows = []) => {
      const known = new Set(feedItems.map((item) => item.id));
      const fresh = [];
      rows.forEach((row) => {
        if (!row?.id || known.has(row.id)) return;
        known.add(row.id);
        fresh.push(row);
      });
      return fresh;
    };

    const setMoreState = () => {
      if (!moreWrap || !moreBtn) return;
      const hasMore = currentOffset < total;
      moreWrap.style.display = hasMore ? 'flex' : 'none';
      moreBtn.disabled = loadingMore || !hasMore;
      moreBtn.textContent = loadingMore ? 'Loading…' : 'Show More';
    };

    const renderList = () => {
      const filtered = activeFilter === 'all' ? feedItems : feedItems.filter((item) => item?.type === activeFilter);
      list.innerHTML = filtered.length
        ? filtered.map((item) => this._renderTimelineCard(item)).join('')
        : `<div class="timeline-card timeline-card--empty"><div class="empty-state__title">No activity for this filter</div><div class="empty-state__text">Try a different feed type.</div>${feedFailed ? '<div class="empty-state__text">Feed is temporarily unavailable.</div>' : ''}</div>`;
      setMoreState();
    };

    const loadFeedPage = async (reset = false) => {
      if (loadingMore) return;
      if (reset) {
        feedItems = [];
        currentOffset = 0;
        total = 0;
      }
      loadingMore = true;
      setMoreState();
      try {
        const type = activeFilter === 'all' ? null : activeFilter;
        const response = await DB.getFeed(PAGE_SIZE, currentOffset, type);
        const received = Array.isArray(response?.items) ? response.items : [];
        total = Number(response?.total) || 0;
        const fresh = dedupe(received);
        if (reset) {
          feedItems = fresh;
        } else {
          feedItems.push(...fresh);
        }
        currentOffset += received.length;
      } catch (error) {
        console.error('timeline page load failed', error);
      } finally {
        loadingMore = false;
        renderList();
      }
    };

    timeline.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.filter || 'all';
        if (next === activeFilter && feedItems.length) return;
        activeFilter = next;
        timeline.querySelectorAll('[data-filter]').forEach((chip) => chip.classList.toggle('is-active', chip === button));
        loadFeedPage(true);
      });
    });

    moreBtn?.addEventListener('click', () => {
      if (loadingMore) return;
      loadFeedPage(false);
    });

    const counts = feedFacets?.countsByType || this._countByType(items);
    if (window.DF_DEBUG_FEED) console.log('[DF dashboard filters]', counts);
    renderList();
  },


  _iconForType(type) {
    const iconMap = {
      metronome: '🎵',
      session: '🎵',
      gear: '🎸',
      guitar: '🎸',
      training: '▶',
      play: '▶',
      video: '🎬',
      playlist: '☰',
      list: '☰',
      resource: '🔗',
      link: '🔗',
      preset: '🎛',
      knob: '🎛',
    };
    return iconMap[String(type || '').toLowerCase()] || '♪';
  },

  _formatTimelineTime(ts) {
    const stamp = Number(ts) || 0;
    if (!stamp) return '—';
    const diff = Date.now() - stamp;
    if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 172800000) return 'Yesterday';
    return new Date(stamp).toLocaleDateString();
  },

  _renderProgressMemory(summary, stats) {
    const hasStatsData = Number(stats?.count || 0) > 0 || Number(stats?.totalMinutes || 0) > 0;
    const topKey = summary?.topKeyWeek?.name || '—';
    const topProg = summary?.topProgWeek?.name ? this._formatProgId(summary.topProgWeek.name) : '—';
    const rows = [
      { label: 'Current streak', value: `${Number(stats?.currentStreak) || 0} day${(Number(stats?.currentStreak) || 0) === 1 ? '' : 's'}` },
      { label: 'Longest streak', value: Number(stats?.longestStreak) || 0 },
      { label: 'Minutes this week', value: Number(stats?.minutesThisWeek) || 0 },
      { label: 'Sessions this week', value: Number(stats?.sessionsThisWeek) || 0 },
      { label: 'Total sessions', value: Number(stats?.count) || 0 },
      { label: 'Total practice minutes', value: Number(stats?.totalMinutes) || 0 },
    ];

    return `
      <div class="df-panel df-panel--wide dashboard-panel dashboard-panel--stats" style="padding:14px;margin-bottom:16px;">
        <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Progress Memory</div>
        <div style="display:grid;gap:8px;">
          ${rows.map((row) => this._renderMetricRow(row.label, row.value)).join('')}
          ${this._renderMetricRow('Top key (week)', topKey)}
          ${this._renderMetricRow('Top progression (week)', topProg)}
        </div>
        ${hasStatsData ? '' : '<div style="margin-top:10px;color:var(--text3);font-size:12px;">No practice yet. Stats will appear after your first session. <a href="#/session/new" class="df-link" style="margin-left:4px;">Log a session</a>.</div>'}
      </div>
    `;
  },


  _renderMetricRow(label, value) {
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--line2);border-radius:8px;padding:8px 10px;background:var(--bg2);font-size:12px;">
        <span style="color:var(--text2);">${label}</span>
        <strong style="font-family:var(--f-mono);font-size:12px;color:var(--text);text-align:right;">${value}</strong>
      </div>
    `;
  },

  _renderStartPractice(data) {
    const hasVideo = Number(data.lastVideoId) > 0;
    const hasPlaylist = Number(data.playlistProgress?.playlistId) > 0;
    const hasRecentPlaylists = data.recentPlaylists.length > 0;
    return `
      <div class="df-panel df-panel--wide" id="start-practice-card" style="padding:14px;margin-bottom:16px;">
        <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Start Practice</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <button type="button" class="df-btn df-btn--primary" data-action="continue-last-video" ${hasVideo ? '' : 'disabled'}>Continue Last Video</button>
          <button type="button" class="df-btn df-btn--outline" data-action="continue-last-playlist" ${hasPlaylist ? '' : 'disabled'}>Continue Last Playlist</button>
          <select id="sp-playlist-select" class="df-input" style="max-width:260px;" ${hasRecentPlaylists ? '' : 'disabled'}>
            <option value="">Quick Start Playlist…</option>
            ${data.recentPlaylists.map((item) => `<option value="${Number(item.id)}">${item.name || `Playlist ${item.id}`}</option>`).join('')}
          </select>
          <a href="#/training/videos" class="df-btn df-btn--outline">Browse Training</a>
        </div>
        <div style="margin-top:8px;display:grid;gap:4px;">
          ${hasVideo ? '' : '<div style="color:var(--text3);font-size:12px;">Open a video first.</div>'}
          ${hasPlaylist ? '' : '<div style="color:var(--text3);font-size:12px;">Open a playlist first.</div>'}
          ${hasRecentPlaylists ? '' : '<div style="color:var(--text3);font-size:12px;">Open a playlist first.</div>'}
        </div>
        <div id="sp-message" style="display:none;margin-top:8px;color:#fecaca;background:rgba(185,28,28,.16);border:1px solid rgba(185,28,28,.4);padding:8px;border-radius:8px;font-size:12px;"></div>
      </div>
    `;
  },



  _formatLastPracticeWhen(timestamp) {
    if (!timestamp) return '—';
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return '—';
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((startToday - startTarget) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  },

  _toolLabel(tool) {
    return {
      progressions: 'Progressions',
      scales: 'Scales',
      chords: 'Chords',
      metronome: 'Metronome',
      tunings: 'Tunings',
      training: 'Training',
    }[tool] || 'Practice';
  },

  _renderLastPracticeSnapshot(lastPractice) {
    if (!lastPractice) {
      return `
        <div class="df-panel df-panel--wide" style="padding:14px;margin-bottom:16px;">
          <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Last Practice</div>
          <div style="color:var(--text3);font-size:13px;">Start a practice loop and we’ll remember it here.</div>
          <div style="margin-top:10px;color:var(--text3);font-size:12px;">Continue Last Practice unlocks after your first loop.</div>
          <button type="button" class="df-btn df-btn--primary" disabled style="margin-top:10px;">Continue Last Practice</button>
        </div>
      `;
    }

    const keyLabel = lastPractice.key_root && lastPractice.key_mode
      ? `${lastPractice.key_root} ${String(lastPractice.key_mode).charAt(0).toUpperCase()}${String(lastPractice.key_mode).slice(1)}`
      : null;
    const itemLabel = lastPractice.progression_id || lastPractice.scale_id || lastPractice.chord_id || null;
    const bpmLabel = Number.isFinite(Number(lastPractice.bpm)) ? `${Number(lastPractice.bpm)} BPM` : null;
    const whenLabel = this._formatLastPracticeWhen(lastPractice.updated_at || lastPractice.started_at);

    return `
      <div class="df-panel df-panel--wide" id="last-practice-card" style="padding:14px;margin-bottom:16px;">
        <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Last Practice</div>
        <div style="display:grid;gap:4px;font-size:13px;">
          <div><strong>Tool:</strong> ${this._toolLabel(lastPractice.tool)}</div>
          ${keyLabel ? `<div><strong>Key:</strong> ${keyLabel}</div>` : ''}
          ${itemLabel ? `<div><strong>Item:</strong> ${itemLabel}</div>` : ''}
          ${bpmLabel ? `<div><strong>BPM:</strong> ${bpmLabel}</div>` : ''}
          <div><strong>When:</strong> ${whenLabel}</div>
        </div>
        <button type="button" class="df-btn df-btn--primary" data-action="continue-last-practice" style="margin-top:10px;">Continue Last Practice</button>
      </div>
    `;
  },

  _renderNextUp(lastPractice) {
    if (!lastPractice) return '';
    const step = Utils.getBpmStep();
    const bpm = Number(lastPractice.bpm);
    const hasBpm = Number.isFinite(bpm) && bpm > 0;
    const suggestion = this._buildNextUpSuggestion(lastPractice, step);
    if (!suggestion) return '';

    return `
      <div class="df-panel df-panel--wide" id="next-up-card" style="padding:14px;margin-bottom:16px;">
        <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Next Up</div>
        <div style="font-size:13px;color:var(--text2);">${suggestion.primaryText}</div>
        ${suggestion.primaryAction ? `<button type="button" class="df-btn df-btn--primary" data-next-action="${suggestion.primaryAction.type}" data-next-value="${suggestion.primaryAction.value}" style="margin-top:10px;">${suggestion.primaryAction.label}</button>` : ''}
        ${suggestion.secondaryText ? `<div style="font-size:12px;color:var(--text3);margin-top:8px;">${suggestion.secondaryText}</div>` : ''}
        ${suggestion.secondaryAction ? `<button type="button" class="df-btn df-btn--outline" data-next-action="${suggestion.secondaryAction.type}" data-next-value="${suggestion.secondaryAction.value}" style="margin-top:8px;">${suggestion.secondaryAction.label}</button>` : ''}
      </div>
    `;
  },

  _buildNextUpSuggestion(lastPractice, step) {
    const bpm = Number(lastPractice.bpm);
    const hasBpm = Number.isFinite(bpm) && bpm > 0;
    if (lastPractice.tool === 'progressions' && hasBpm) {
      const progressionMap = {
        'I-V-vi-IV': 'I-IV-V',
        'I-IV-V': 'vi-IV-I-V',
      };
      const current = (lastPractice.progression_id || '').replace(/\s+/g, '');
      const alt = progressionMap[current] || 'I-V-vi-IV';
      return {
        primaryText: `Keep momentum: try +${step} BPM.`,
        primaryAction: {
          type: 'set-bpm',
          value: String(Math.min(240, bpm + step)),
          label: `Set BPM to ${Math.min(240, bpm + step)}`
        },
        secondaryText: 'Or switch progression for variety.',
        secondaryAction: {
          type: 'try-progression',
          value: alt,
          label: `Try ${alt}`
        },
      };
    }

    if (lastPractice.tool === 'scales' && hasBpm) {
      return {
        primaryText: `Keep momentum: try +${step} BPM.`,
        primaryAction: {
          type: 'set-bpm',
          value: String(Math.min(240, bpm + step)),
          label: `Set BPM to ${Math.min(240, bpm + step)}`
        },
        secondaryText: 'Secondary: try this same scale in a nearby key.',
      };
    }

    return null;
  },

  _initLastPractice(container, lastPractice) {
    const lastCard = container.querySelector('#last-practice-card');
    lastCard?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action="continue-last-practice"]');
      if (!btn) return;
      const state = Utils.getLastPractice();
      if (!state?.tool) return;
      const routeMap = {
        progressions: '#/tools/progressions?resume=1',
        scales: '#/tools/scales?resume=1',
        chords: '#/tools/chords?resume=1',
      };
      const nextRoute = routeMap[state.tool];
      if (nextRoute) go(nextRoute);
    });

    const nextCard = container.querySelector('#next-up-card');
    nextCard?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-next-action]');
      if (!btn) return;
      const action = btn.dataset.nextAction;
      const value = btn.dataset.nextValue;
      const state = Utils.getLastPractice();
      if (!state) return;

      if (action === 'set-bpm') {
        const nextBpm = Math.max(30, Math.min(240, parseInt(value, 10) || 80));
        localStorage.setItem('df_last_bpm', String(nextBpm));
        Utils.setLastPractice({ bpm: nextBpm });
        btn.textContent = `BPM set to ${nextBpm}`;
        btn.disabled = true;
        return;
      }

      if (action === 'try-progression') {
        const progressionId = String(value || 'I-V-vi-IV');
        Utils.setLastPractice({ progression_id: progressionId, tool: 'progressions' });
        go('#/tools/progressions?resume=1');
      }
    });
  },

  _renderRecentActivity(items = []) {
    const fmt = (iso) => {
      if (!iso) return '—';
      const d = new Date(typeof iso === 'number' ? Number(iso) : iso);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString();
    };

    if (!items.length) {
      return `<div class="empty-state"><div class="empty-state__title">No recent activity</div><div class="empty-state__text">Watch a video, open a playlist, or resume training to populate this feed.</div></div>`;
    }

    return `
      <div>
        ${items.map((item) => `
          <div class="session-row card-reveal" onclick="go('${item.href}')">
            <div class="session-row__date">
              <div class="session-row__dow">${item.type}</div>
              <div class="session-row__date-val">${fmt(item.when)}</div>
            </div>
            <div class="session-row__middle">
              <div style="min-width:0;">
                <div class="session-row__focus">${item.title}</div>
                <div class="session-row__win">Resume where you left off.</div>
              </div>
            </div>
            <div class="session-row__chips">
              <span class="df-badge df-badge--muted">${item.type}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _initStartPractice(container, data) {
    const card = container.querySelector('#start-practice-card');
    if (!card) return;
    const messageEl = card.querySelector('#sp-message');
    const showMessage = (message) => {
      if (!messageEl) return;
      messageEl.textContent = message;
      messageEl.style.display = 'block';
    };

    card.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'continue-last-video') {
        if (!Number(data.lastVideoId)) {
          showMessage('Open a video first.');
          return;
        }
        go(`#/training/videos/${Number(data.lastVideoId)}`);
        return;
      }
      if (action === 'continue-last-playlist') {
        const progress = data.playlistProgress || {};
        if (!Number(progress.playlistId)) {
          showMessage('Open a playlist first.');
          return;
        }
        const query = Number(progress.lastVideoId) ? `?resumeVideoId=${Number(progress.lastVideoId)}` : '';
        go(`#/training/playlists/${Number(progress.playlistId)}${query}`);
      }
    });

    const select = card.querySelector('#sp-playlist-select');
    select?.addEventListener('change', (event) => {
      const playlistId = Number(event.target.value || 0);
      if (!playlistId) {
        showMessage('Open a playlist first.');
        event.target.value = '';
        return;
      }
      const exists = (data.recentPlaylists || []).some((item) => Number(item?.id) === playlistId);
      if (!exists) {
        showMessage('Selected playlist is unavailable.');
        event.target.value = '';
        return;
      }
      go(`#/training/playlists/${playlistId}`);
      event.target.value = '';
    });
  },


  _renderHero(stats) {
    const greeting = Utils.greeting();
    const awayText = stats.daysSinceLastSession == null
      ? 'No sessions logged yet.'
      : stats.daysSinceLastSession === 0
        ? 'Practiced today.'
        : `${stats.daysSinceLastSession} day${stats.daysSinceLastSession === 1 ? '' : 's'} since last session.`;

    return Utils.renderPageHero({
      title: greeting,
      subtitle: awayText,
    });
  },

  _renderRecentSessions(sessions, today) {
    if (!sessions.length) {
      return `
        <div class="empty-state">
          <div class="empty-state__title">No sessions yet</div>
          <div class="empty-state__text">Log your first practice session to get started.</div>
        </div>
      `;
    }

    return `<div>
      ${sessions.map(s => {
        const thumb = s.videoId ? Utils.ytThumb(s.videoId) : null;
        const dow = Utils.formatDate(s.date, 'day');
        const dateShort = Utils.formatDate(s.date, 'short');
        return `
          <div class="session-row card-reveal" onclick="go('#/session/${s.id}')">
            <div class="session-row__date">
              <div class="session-row__dow">${dow}</div>
              <div class="session-row__date-val">${dateShort}</div>
            </div>
            <div class="session-row__middle">
              ${thumb ? `<img class="session-row__thumb" src="${thumb}" alt="" loading="lazy">` : ''}
              <div style="min-width:0;">
                ${s.focus ? `<div class="session-row__focus">${s.focus}</div>` : ''}
                ${s.win ? `<div class="session-row__win">${Utils.truncate(s.win, 60)}</div>` : ''}
              </div>
            </div>
            <div class="session-row__chips">
              ${s.minutes ? `<span class="df-badge df-badge--muted">${s.minutes}m</span>` : ''}
              ${s.bpm ? `<span class="df-badge df-badge--accent">${s.bpm}bpm</span>` : ''}
              ${s.videoId ? `<span class="df-badge df-badge--red">&#9654;</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  },
  _renderQuickLog(today) {
    let lastFocus = '';
    let lastMinutes = 20;
    try { lastFocus = (localStorage.getItem('df:lastFocus') || '').trim(); } catch (e) {}
    try { lastMinutes = parseInt(localStorage.getItem('df:lastMinutes') || '20', 10) || 20; } catch (e) {}
    if (![10, 20, 30, 45, 60].includes(lastMinutes)) lastMinutes = 20;

    const focuses = ['Chords','Scales','Strumming','Picking','Worship Set','Metronome','Song Practice','Technique','Ear Training'];

    return `
      <div class="df-panel df-panel--wide dashboard-panel dashboard-panel--stats">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);">Quick Log</div>
          <div style="font-family:var(--f-mono);font-size:10px;color:var(--text3);">${today}</div>
        </div>

        <div class="df-field" style="margin-bottom:12px;">
          <label class="df-label">Minutes</label>
          <input type="hidden" id="ql-minutes" value="${lastMinutes}">
          <div class="df-pillrow" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;" aria-label="Quick minutes">
            ${[10,20,30,45,'60+'].map(m => {
              const val = m === '60+' ? 60 : m;
              return `
                <button type="button" class="ql-pill ${val === lastMinutes ? 'is-active' : ''}" data-ql-min="${m}">
                  ${m}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="df-field" style="margin-bottom:12px;">
          <label class="df-label">Tool</label>
          <select id="ql-focus" class="df-input">
            <option value="">Choose tool</option>
            ${focuses.map(f => `<option value="${f}" ${f===lastFocus?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>

        <div class="df-field" style="margin-bottom:12px;">
          <label class="df-label">YouTube URL (optional)</label>
          <input id="ql-yt" class="df-input" placeholder="Paste YouTube URL or ID">
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" id="ql-save" class="df-btn df-btn--primary">Start Practice</button>
        </div>

        <div id="ql-msg" style="display:none;margin-top:10px;color:var(--text3);font-size:12px;font-family:var(--f-mono);"></div>
      </div>
    `;
  },

  _initQuickLog(container, today) {
    const root = container;
    const msg = root.querySelector('#ql-msg');
    const minutesEl = root.querySelector('#ql-minutes');
    const focusEl = root.querySelector('#ql-focus');
    const ytEl = root.querySelector('#ql-yt');

    const updatePillState = (value) => {
      root.querySelectorAll('[data-ql-min]').forEach((btn) => {
        let pillValue = btn.getAttribute('data-ql-min');
        if (pillValue === '60+') pillValue = '60';
        btn.classList.toggle('is-active', String(value) === String(pillValue));
      });
    };

    if (minutesEl?.value) updatePillState(minutesEl.value);

    root.querySelectorAll('[data-ql-min]').forEach(btn => {
      btn.addEventListener('click', () => {
        let m = btn.getAttribute('data-ql-min');
        if (m === '60+') m = '60';
        if (minutesEl) minutesEl.value = m;
        updatePillState(m);
        try { localStorage.setItem('df:lastMinutes', String(m)); } catch(e) {}
      });
    });

    root.querySelector('#ql-save')?.addEventListener('click', async () => {
      const minutes = parseInt((minutesEl?.value || '0'), 10) || 0;
      if (!minutes) return Utils.toast?.('Pick minutes first', 'error');

      const data = { date: today, minutes };

      const focus = (focusEl?.value || '').trim();
      if (focus) data.focus = focus;

      const yt = (ytEl?.value || '').trim();
      if (yt) {
        const extracted = Utils.extractYouTubeId?.(yt);
        data.videoId = extracted || yt;
      }

      try {
        const saved = await DB.saveSess(data);
        if (focus) { try { localStorage.setItem('df:lastFocus', focus); } catch(e) {} }
        Utils.toast?.('Saved quick session ✅');
        if (msg) {
          msg.style.display = 'block';
          msg.innerHTML = `Saved — <button type="button" class="ql-msg-link">Edit →</button>`;
          msg.querySelector('.ql-msg-link')?.addEventListener('click', () => go(`#/log/${saved.id}`));
        }
      } catch (e) {
        console.error(e);
        Utils.toast?.('Failed to save quick session', 'error');
      }
    });
  },

  _renderCompactHeatmap(rows = [], today, initialMetric = 'minutes') {
    const safeRows = Array.isArray(rows) ? rows : [];
    return `
        <div class="df-panel df-panel--wide dashboard-panel dashboard-panel--heatmap">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="font-family:var(--f-mono);font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:var(--text3);">Practice Pulse · 90 Days</div>
          <div class="heatmap-toggle" data-heatmap-toggle>
            <button type="button" class="is-active" data-hm-metric="minutes">Minutes</button>
            <button type="button" data-hm-metric="sessions">Sessions</button>
          </div>
        </div>
        <div id="dashboard-heatmap" data-hm-days='${JSON.stringify(safeRows).replace(/'/g, '&#39;')}' data-hm-today="${today}" data-hm-range="90" data-hm-metric="${initialMetric}"></div>
      </div>
    `;
  },

  _initDashboardHeatmap(container) {
    const mount = container.querySelector('#dashboard-heatmap');
    if (!mount) return;

    const raw = mount.getAttribute('data-hm-days') || '[]';
    let rows = [];
    try { rows = JSON.parse(raw); } catch (e) { rows = []; }
    const byDate = new Map(rows.map((row) => [row.date, row]));

    const draw = () => {
      const metric = mount.getAttribute('data-hm-metric') || 'minutes';
      const today = new Date(`${mount.getAttribute('data-hm-today')}T12:00:00`);
      const range = parseInt(mount.getAttribute('data-hm-range') || '90', 10);
      const cells = [];
      const values = [];

      for (let i = range - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const date = d.toISOString().slice(0, 10);
        const row = byDate.get(date);
        const minutes = Number(row?.totalMinutes || 0);
        const sessionCount = Number(row?.sessionCount || 0);
        const value = metric === 'sessions' ? sessionCount : minutes;
        if (value > 0) values.push(value);
        cells.push({ date, value, minutes, sessionCount, sessionId: row?.sessionId || '' });
      }

      const max = values.length ? Math.max(...values) : 0;
      mount.innerHTML = `
        <div class="ff-heatmap ff-heatmap--compact">
          ${cells.map((cell) => {
            const level = this._heatLevel(cell.value, max);
            const title = `${cell.date} • ${cell.minutes}m • ${cell.sessionCount} session${cell.sessionCount === 1 ? '' : 's'}`;
            return `<button type="button" class="heatmap-cell level-${level}" ${cell.sessionId ? `data-session-id="${cell.sessionId}"` : 'disabled'} title="${title}" aria-label="${title}"></button>`;
          }).join('')}
        </div>
      `;

      mount.querySelectorAll('[data-session-id]').forEach((btn) => {
        btn.addEventListener('click', () => go(`#/session/${btn.getAttribute('data-session-id')}`));
      });
    };

    container.querySelectorAll('[data-hm-metric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mount.setAttribute('data-hm-metric', btn.getAttribute('data-hm-metric'));
        container.querySelectorAll('[data-hm-metric]').forEach((el) => el.classList.toggle('is-active', el === btn));
        draw();
      });
    });

    draw();
  },

  _heatLevel(value, max) {
    if (!value || !max) return 0;
    const ratio = value / max;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  },

  _renderCalendar(allDates, year, month) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth();

    const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayStr = Utils.today();

    const dateSet = new Set(allDates);

    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    let cells = '';

    // Day-of-week headers
    cells += dayLabels.map(d => `<div class="calendar__day-label">${d}</div>`).join('');

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells += '<div></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const hasSession = dateSet.has(dateStr);

      let cls = 'calendar__day';
      if (isToday) cls += ' calendar__day--today';
      if (hasSession) cls += ' calendar__day--active';

      const onclick = hasSession ? `onclick="DB.getSessByDate('${dateStr}').then(s=>s&&go('#/session/'+s.id))"` : '';
      cells += `<div class="${cls}" ${onclick}>${d}</div>`;
    }

    return `
      <div class="calendar dashboard-panel dashboard-panel--calendar" data-cal-year="${y}" data-cal-month="${m}" style="margin-bottom:24px;">
        <div class="calendar__header">
          <button class="calendar__nav" id="cal-prev">&lsaquo;</button>
          <span class="calendar__month">${monthName}</span>
          <button class="calendar__nav" id="cal-next">&rsaquo;</button>
        </div>
        <div class="calendar__grid">${cells}</div>
      </div>
    `;
  },

  _initStatCounters(container) {
    // Animate count-up in hero
    container.querySelectorAll('.count-target[data-target]').forEach(el => {
      const target = parseFloat(el.dataset.target);
      const isFloat = el.dataset.type === 'float';
      if (!isNaN(target)) {
        Utils.animateCount(el, target);
      }
    });
  },

  _initCalendarNav(container, allDates) {
    const cal = container.querySelector('.calendar');
    if (!cal) return;

    let year = parseInt(cal.dataset.calYear);
    let month = parseInt(cal.dataset.calMonth);

    const rebuildCal = () => {
      const parent = cal.parentNode;
      const newCal = document.createElement('div');
      newCal.innerHTML = this._renderCalendar(allDates, year, month);
      const newCalEl = newCal.firstElementChild;
      parent.replaceChild(newCalEl, cal);
      this._initCalendarNav(container, allDates);
    };

    container.querySelector('#cal-prev')?.addEventListener('click', () => {
      month--;
      if (month < 0) { month = 11; year--; }
      rebuildCal();
    });

    container.querySelector('#cal-next')?.addEventListener('click', () => {
      month++;
      if (month > 11) { month = 0; year++; }
      rebuildCal();
    });
  },
};
