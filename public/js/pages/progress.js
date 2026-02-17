// Daily Fret — Stats Page

window.Pages = window.Pages || {};

Pages.Progress = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const activeTab = this._getActiveTab();
    const [sessions, stats, heatmapDays, gear, presets] = await Promise.all([
      DB.getAllSess(),
      DB.getStats(),
      DB.getSessionHeatmap(),
      DB.getAllGear(),
      DB.getAllPresets(),
    ]);
    const gearStats = this._computeGearStats(gear);
    const chrono = [...sessions].reverse();

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Stats</div>
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
            ${this._renderTabs(activeTab)}
          </div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:24px 24px 60px;display:grid;gap:16px;">
        ${activeTab === 'overview' ? `
          <div class="df-panel df-panel--wide" style="padding:16px;">${this._renderStatBar(stats)}</div>
          <div class="df-panel df-panel--wide" style="padding:16px;">${this._renderInsightCards(sessions, stats)}</div>
        ` : ''}

        ${activeTab === 'practice' ? `
          <div class="df-panel df-panel--wide" style="padding:16px;">${this._renderYearHeatmap(heatmapDays, stats)}</div>
          ${sessions.length >= 2 ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="df-chart"><div class="df-chart__title">BPM Over Time</div><div id="bpm-chart"></div></div>
              <div class="df-chart"><div class="df-chart__title">Minutes Per Session</div><div id="min-chart"></div></div>
            </div>
          ` : ''}
        ` : ''}

        ${activeTab === 'gear' ? `<div class="df-panel df-panel--wide" style="padding:16px;">${this._renderGearStats(gearStats)}</div>` : ''}

        ${activeTab === 'presets' ? `
          <div class="df-panel df-panel--wide" style="padding:16px;">
            <div class="section-header"><span class="section-header__label">Preset Summary</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
              <div class="df-statbar__item"><div class="df-statbar__key">Total presets</div><div class="df-statbar__val">${presets.length}</div></div>
              <div class="df-statbar__item"><div class="df-statbar__key">Tagged presets</div><div class="df-statbar__val">${presets.filter((p) => (p.tags || '').trim()).length}</div></div>
              <div class="df-statbar__item"><div class="df-statbar__key">Amp models</div><div class="df-statbar__val">${new Set(presets.map((p) => p.ampModel).filter(Boolean)).size}</div></div>
            </div>
          </div>
        ` : ''}

        <div class="df-panel df-panel--wide" style="padding:16px;">${this._renderExportImport()}</div>

        ${sessions.length ? `<div class="df-panel df-panel--wide" style="padding:16px;">${this._renderTable(sessions)}</div>` : this._renderEmpty()}
      </div>
    `;

    app.querySelectorAll('[data-stats-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-stats-tab');
        location.hash = `#/progress?tab=${tab}`;
      });
    });

    if (activeTab === 'practice' && sessions.length >= 2) {
      const bpmData = chrono.map((row) => ({ label: Utils.formatDate(row.date, 'short'), value: row.bpm || 0, id: row.id })).filter((row) => row.value);
      const minData = chrono.map((row) => ({ label: Utils.formatDate(row.date, 'short'), value: row.minutes || 0, id: row.id })).filter((row) => row.value);
      if (bpmData.length) this._renderBarChart(app.querySelector('#bpm-chart'), bpmData);
      if (minData.length) this._renderBarChart(app.querySelector('#min-chart'), minData);
      this._initYearHeatmap(app);
    }

    this._initExportImport(app);
  },

  _getActiveTab() {
    const match = String(location.hash || '').match(/tab=([^&]+)/);
    const tab = match ? decodeURIComponent(match[1]).toLowerCase() : 'overview';
    return ['overview', 'practice', 'gear', 'presets'].includes(tab) ? tab : 'overview';
  },

  _renderTabs(activeTab) {
    return ['overview', 'practice', 'gear', 'presets'].map((tab) => `<button type="button" class="df-btn ${activeTab === tab ? 'df-btn--primary' : 'df-btn--outline'}" data-stats-tab="${tab}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join('');
  },

  _renderStatBar(stats) {
    const items = [
      { key: 'Sessions', val: stats.count },
      { key: 'Total Hours', val: stats.totalHours },
      { key: 'Peak BPM', val: stats.maxBPM || '—' },
      { key: 'Avg BPM', val: stats.avgBPM || '—' },
      { key: 'Current Streak', val: stats.currentStreak ? `${stats.currentStreak}d` : '0d' },
      { key: 'Best Streak', val: stats.longestStreak ? `${stats.longestStreak}d` : '0d' },
      { key: 'Last Session', val: stats.daysSinceLastSession == null ? '—' : `${stats.daysSinceLastSession}d ago` },
    ];
    return `
      <div class="df-statbar" style="margin:0;">
        ${items.map(item => `
          <div class="df-statbar__item">
            <div class="df-statbar__key">${item.key}</div>
            <div class="df-statbar__val">${item.val}</div>
          </div>
        `).join('')}
      </div>
    `;
  },


  _computeGearStats(gear = []) {
    return Utils.computeGearStats(gear || []);
  },

  _renderGearStats(stats) {
    const formatCurrency = (value) => Utils.formatPrice(Number(value) || 0);
    const flipLabel = (flip, prefix) => {
      if (!flip) return `${prefix}: —`;
      return `${prefix}: ${flip.item.name || 'Unnamed'} (${formatCurrency(flip.profit)})`;
    };
    const items = [
      { key: 'Owned count', val: stats.ownedCount },
      { key: 'Wishlist count', val: stats.wishlistCount },
      { key: 'Sold count', val: stats.soldCount },
      { key: 'Total invested', val: formatCurrency(stats.totalInvested) },
      { key: 'Total recovered net', val: formatCurrency(stats.totalRecoveredNet) },
      { key: 'Cost basis', val: formatCurrency(stats.soldCostBasis) },
      { key: 'Net P/L', val: formatCurrency(stats.soldNetPL) },
    ];

    return `
        <div>
          <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Gear Stats</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
            ${items.map((item) => `
              <div class="df-statbar__item">
                <div class="df-statbar__key">${item.key}</div>
                <div class="df-statbar__val">${item.val}</div>
              </div>
            `).join('')}
          </div>
          <div style="display:grid;gap:6px;margin-top:10px;color:var(--text2);font-size:12px;">
            <span>${flipLabel(stats.bestFlip, 'Best flip')}</span>
            <span>${flipLabel(stats.worstFlip, 'Worst flip')}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
            <div>
              <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">Top Categories</div>
              <div style="display:grid;gap:4px;">
                ${(stats.topCategories || []).map((row) => `<div style="display:flex;justify-content:space-between;font-size:12px;"><span>${row.label}</span><strong>${row.count}</strong></div>`).join('') || '<div style="font-size:12px;color:var(--text3);">—</div>'}
              </div>
            </div>
            <div>
              <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">Top Brands</div>
              <div style="display:grid;gap:4px;">
                ${(stats.topBrands || []).map((row) => `<div style="display:flex;justify-content:space-between;font-size:12px;"><span>${row.label}</span><strong>${row.count}</strong></div>`).join('') || '<div style="font-size:12px;color:var(--text3);">—</div>'}
              </div>
            </div>
          </div>
        </div>
    `;
  },


  _renderYearHeatmap(rows = [], stats) {
    const year = new Date().getFullYear();
    const years = [...new Set((rows || []).map((row) => Number(String(row.date || '').slice(0, 4))).filter(Boolean))].sort((a, b) => b - a);
    if (!years.length) years.push(year);
    if (!years.includes(year)) years.unshift(year);

    const totalMinutes = (rows || []).reduce((sum, row) => sum + Number(row.totalMinutes || 0), 0);
    const totalSessions = (rows || []).reduce((sum, row) => sum + Number(row.sessionCount || 0), 0);

    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <div class="df-chart__title" style="margin-bottom:0;">Practice Activity Heatmap</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <select id="progress-hm-year" class="df-input" style="width:auto;min-width:96px;padding:8px 10px;">
              ${years.map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
            <div class="heatmap-toggle" data-progress-toggle>
              <button type="button" class="is-active" data-progress-metric="minutes">Minutes</button>
              <button type="button" data-progress-metric="sessions">Sessions</button>
            </div>
          </div>
        </div>

        <div id="progress-heatmap" data-hm-days='${JSON.stringify(rows || []).replace(/'/g, '&#39;')}' data-progress-year="${year}" data-progress-metric="minutes"></div>

        <div class="heatmap-legend" style="margin-top:10px;">
          <span>Less</span>
          <i class="heatmap-cell level-0"></i>
          <i class="heatmap-cell level-1"></i>
          <i class="heatmap-cell level-2"></i>
          <i class="heatmap-cell level-3"></i>
          <i class="heatmap-cell level-4"></i>
          <span>More</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:12px;">
          <div class="heatmap-stat"><span>Total Minutes</span><strong>${totalMinutes}</strong></div>
          <div class="heatmap-stat"><span>Total Sessions</span><strong>${totalSessions}</strong></div>
          <div class="heatmap-stat"><span>Current Streak</span><strong>${stats.currentStreak || 0}d</strong></div>
          <div class="heatmap-stat"><span>Longest Streak</span><strong>${stats.longestStreak || 0}d</strong></div>
        </div>
      </div>
    `;
  },

  _initYearHeatmap(container) {
    const mount = container.querySelector('#progress-heatmap');
    if (!mount) return;

    const yearSelect = container.querySelector('#progress-hm-year');
    const parseRows = () => {
      try { return JSON.parse(mount.getAttribute('data-hm-days') || '[]'); } catch (e) { return []; }
    };

    const draw = () => {
      const rows = parseRows();
      const byDate = new Map(rows.map((row) => [row.date, row]));
      const year = Number(mount.getAttribute('data-progress-year'));
      const metric = mount.getAttribute('data-progress-metric') || 'minutes';
      const start = new Date(`${year}-01-01T12:00:00`);
      const end = new Date(`${year}-12-31T12:00:00`);
      const totalDays = Math.floor((end - start) / 86400000) + 1;
      const cells = [];
      const values = [];

      for (let i = 0; i < totalDays; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
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
        <div class="ff-heatmap ff-heatmap--year">
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

    yearSelect?.addEventListener('change', () => {
      mount.setAttribute('data-progress-year', yearSelect.value);
      draw();
    });

    container.querySelectorAll('[data-progress-metric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mount.setAttribute('data-progress-metric', btn.getAttribute('data-progress-metric'));
        container.querySelectorAll('[data-progress-metric]').forEach((el) => el.classList.toggle('is-active', el === btn));
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

  _renderBarChart(container, data) {
    if (!container || !data.length) return;

    const maxVal = Math.max(...data.map(d => d.value));

    container.innerHTML = `
      <div class="df-chart__bars">
        ${data.map(d => {
          const pct = Math.max((d.value / maxVal) * 100, 2);
          const isPeak = d.value === maxVal;
          return `
            <div class="df-chart__bar-wrap" onclick="go('#/session/${d.id}')">
              <div class="df-chart__tooltip">${d.label}: ${d.value}</div>
              <div class="df-chart__bar ${isPeak ? 'df-chart__bar--peak' : ''}" style="height:${pct}%;"></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _renderExportImport() {
    return `
      <div style="display:flex;gap:12px;flex-wrap:wrap;padding:20px;margin-bottom:24px;">
        <div style="flex:1;">
          <div style="font-family:var(--f-mono);font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Data Management</div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:10px;">Before any server update, export a backup file. Changing browser profile, domain, or port can hide local IndexedDB data.</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="export-btn" class="df-btn df-btn--outline">Export All Data</button>
            <div style="position:relative;">
              <input type="file" id="import-zip-file" accept=".zip" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
              <button class="df-btn df-btn--outline">Import Backup ZIP</button>
            </div>
            <div style="position:relative;">
              <input type="file" id="import-file" accept=".json" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
              <button class="df-btn df-btn--outline">Import JSON</button>
            </div>
          </div>
          <div id="import-status" style="margin-top:10px;font-family:var(--f-mono);font-size:10px;color:var(--green);display:none;"></div>
        </div>
      </div>
    `;
  },

  _renderInsightCards(sessions, stats) {
    if (!sessions.length) return '';

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
    const withMinutes = sessions.filter(s => s.minutes);
    const avgMinutes = withMinutes.length ? Math.round(totalMinutes / withMinutes.length) : 0;
    const topMinutes = sessions.reduce((best, s) => ((s.minutes || 0) > (best.minutes || 0) ? s : best), sessions[0]);
    const topBpm = sessions.reduce((best, s) => ((s.bpm || 0) > (best.bpm || 0) ? s : best), sessions[0]);

    const cards = [
      { k: 'Average Minutes / Session', v: avgMinutes ? `${avgMinutes}m` : '—' },
      { k: 'Longest Session', v: topMinutes?.minutes ? `${topMinutes.minutes}m` : '—', hint: topMinutes?.date ? Utils.formatDate(topMinutes.date, 'short') : '' },
      { k: 'Highest BPM Session', v: topBpm?.bpm || '—', hint: topBpm?.date ? Utils.formatDate(topBpm.date, 'short') : '' },
      { k: 'Days Since Last Session', v: stats.daysSinceLastSession == null ? '—' : stats.daysSinceLastSession },
    ];

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:24px;">
        ${cards.map(c => `
          <div class="df-panel df-panel--wide" style="padding:14px;">
            <div style="font-family:var(--f-mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:6px;">${c.k}</div>
            <div style="font-family:var(--f-hero);font-size:30px;line-height:1;color:var(--accent);">${c.v}</div>
            ${c.hint ? `<div style="font-size:12px;color:var(--text2);margin-top:6px;">${c.hint}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  },

  _initExportImport(container) {
    // Export
    const exportBtn = container.querySelector('#export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const blob = await DB.exportAllZip();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `faithfulfret-backup-${Utils.today()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    const importZipFile = container.querySelector('#import-zip-file');
    const importStatus = container.querySelector('#import-status');
    if (importZipFile) {
      importZipFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          if (!confirm('Import backup ZIP? This will REPLACE all existing data.')) {
            importZipFile.value = '';
            return;
          }
          const result = await DB.importZip(file);
          const dbInfo = result?.dbInfo || await DB.getDbInfo();
          importStatus.style.display = 'block';
          importStatus.textContent = `✓ ZIP restore complete. Sessions: ${dbInfo.sessions || 0}, Gear: ${dbInfo.gear || 0}, Presets: ${dbInfo.presets || 0}.`;
          setTimeout(() => { importZipFile.value = ''; this.render(); }, 1200);
        } catch (err) {
          alert('Failed to import ZIP backup.\n' + err.message);
          importZipFile.value = '';
        }
      });
    }

    // Import JSON
    const importFile = container.querySelector('#import-file');
    if (importFile) {
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            const sessionCount = (data.sessions || []).length;
            const gearCount = (data.gear || []).length;
            const resourceCount = (data.resources || []).length;
            const presetCount = (data.presets || []).length;

            if (!confirm(`Import backup? This will REPLACE all existing data.\n\n${sessionCount} sessions, ${gearCount} gear items, ${resourceCount} resources, ${presetCount} presets.`)) {
              importFile.value = '';
              return;
            }

            const result = await DB.importAll(data);
            const counts = result?.counts || {};

            importStatus.style.display = 'block';
            importStatus.textContent = `✓ Imported ${counts.sessions ?? sessionCount} sessions, ${counts.gear ?? gearCount} gear, ${counts.resources ?? resourceCount} resources, ${counts.presets ?? (data.presets || []).length} presets.`;

            setTimeout(() => {
              importFile.value = '';
              go('#/dashboard');
            }, 2000);
          } catch (err) {
            alert('Failed to import: invalid JSON file.\n' + err.message);
            importFile.value = '';
          }
        };
        reader.readAsText(file);
      });
    }
  },

  _renderTable(sessions) {
    return `
      <table class="df-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Focus</th>
            <th>Duration</th>
            <th>BPM</th>
            <th>Mood</th>
            <th>Win</th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map(s => `
            <tr onclick="go('#/session/${s.id}')">
              <td style="font-family:var(--f-mono);font-size:12px;white-space:nowrap;">${Utils.formatDate(s.date, 'short')}</td>
              <td style="color:var(--text);">${s.focus || ''}</td>
              <td style="font-family:var(--f-mono);">${s.minutes ? s.minutes + 'm' : ''}</td>
              <td style="font-family:var(--f-mono);color:var(--accent);">${s.bpm || ''}</td>
              <td>${s.mood || ''}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.win ? Utils.truncate(s.win, 60) : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  _renderEmpty() {
    return `
      <div class="empty-state" style="padding:80px 0;">
        <div class="empty-state__title">No data yet</div>
        <div class="empty-state__text">Log some sessions to see your progress charts.</div>
        <a href="#/log" class="df-btn df-btn--primary">+ Log Session</a>
      </div>
    `;
  },
};
