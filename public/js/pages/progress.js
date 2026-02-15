// Daily Fret — Progress Page

window.Pages = window.Pages || {};

Pages.Progress = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const [sessions, stats] = await Promise.all([
      DB.getAllSess(),
      DB.getStats(),
    ]);

    // Reverse for chronological order (charts)
    const chrono = [...sessions].reverse();

    app.innerHTML = `
      <div class="page-hero vert-texture">
        <div class="page-hero__inner">
          <div class="page-title">Progress</div>
        </div>
        <div class="fret-line"></div>
      </div>

      ${this._renderStatBar(stats)}

      <div class="page-wrap" style="padding:32px 24px 60px;">
        ${sessions.length >= 2 ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:32px;">
            <div class="df-chart">
              <div class="df-chart__title">BPM Over Time</div>
              <div id="bpm-chart"></div>
            </div>
            <div class="df-chart">
              <div class="df-chart__title">Minutes Per Session</div>
              <div id="min-chart"></div>
            </div>
          </div>
        ` : ''}

        ${this._renderExportImport()}

        ${sessions.length ? `
          <div style="margin-top:32px;">
            <div class="section-header"><span class="section-header__label">Session History</span></div>
            <div style="overflow-x:auto;">
              ${this._renderTable(sessions)}
            </div>
          </div>
        ` : this._renderEmpty()}
      </div>
    `;

    if (sessions.length >= 2) {
      const bpmData = chrono.map(s => ({
        label: Utils.formatDate(s.date, 'short'),
        value: s.bpm || 0,
        id: s.id,
      })).filter(d => d.value);

      const minData = chrono.map(s => ({
        label: Utils.formatDate(s.date, 'short'),
        value: s.minutes || 0,
        id: s.id,
      })).filter(d => d.value);

      if (bpmData.length) this._renderBarChart(app.querySelector('#bpm-chart'), bpmData);
      if (minData.length) this._renderBarChart(app.querySelector('#min-chart'), minData);
    }

    this._initExportImport(app);
  },

  _renderStatBar(stats) {
    const items = [
      { key: 'Sessions', val: stats.count },
      { key: 'Total Hours', val: stats.totalHours },
      { key: 'Peak BPM', val: stats.maxBPM || '—' },
      { key: 'Avg BPM', val: stats.avgBPM || '—' },
      { key: 'Streak', val: stats.streak ? `${stats.streak}d` : '0d' },
    ];
    return `
      <div class="df-statbar">
        ${items.map(item => `
          <div class="df-statbar__item">
            <div class="df-statbar__key">${item.key}</div>
            <div class="df-statbar__val">${item.val}</div>
          </div>
        `).join('')}
      </div>
    `;
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
      <div style="display:flex;gap:12px;flex-wrap:wrap;padding:20px;background:var(--bg1);border:1px solid var(--line2);margin-bottom:24px;">
        <div style="flex:1;">
          <div style="font-family:var(--f-mono);font-size:9px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">Data Management</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button id="export-btn" class="df-btn df-btn--outline">Export All Data</button>
            <div style="position:relative;">
              <input type="file" id="import-file" accept=".json" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
              <button class="df-btn df-btn--outline">Import Data</button>
            </div>
          </div>
          <div id="import-status" style="margin-top:10px;font-family:var(--f-mono);font-size:10px;color:var(--green);display:none;"></div>
        </div>
      </div>
    `;
  },

  _initExportImport(container) {
    // Export
    const exportBtn = container.querySelector('#export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const data = await DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `daily-fret-backup-${Utils.today()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Import
    const importFile = container.querySelector('#import-file');
    const importStatus = container.querySelector('#import-status');
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

            if (!confirm(`Import backup? This will REPLACE all existing data.\n\n${sessionCount} sessions, ${gearCount} gear items, ${resourceCount} resources.`)) {
              importFile.value = '';
              return;
            }

            await DB.importAll(data);

            importStatus.style.display = 'block';
            importStatus.textContent = `✓ Imported ${sessionCount} sessions, ${gearCount} gear, ${resourceCount} resources.`;

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
