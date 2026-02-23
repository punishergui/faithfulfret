window.Pages = window.Pages || {};

window.Pages.ScanReport = {
  state: {
    status: null,
    reason: '',
    ext: '',
    q: '',
    offset: 0,
    limit: 50,
    total: 0,
    items: [],
    extensions: [],
  },

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<section class="panel"><h1>Scan Report</h1><p>Loading…</p></section>';
    await this.refreshStatus();
    await this.refreshExtensions();
    await this.refreshItems();
    this.paint();
  },

  async refreshStatus() {
    try {
      const res = await fetch('/api/scan/status');
      this.state.status = await res.json();
      window.AppScan?.setStatus(this.state.status);
    } catch {
      this.state.status = { status: 'unknown' };
    }
  },

  async refreshExtensions() {
    try {
      const res = await fetch('/api/scan/skipped/extensions?reason=unsupported_extension&limit=20');
      const data = await res.json();
      this.state.extensions = data.items || [];
    } catch { this.state.extensions = []; }
  },

  async refreshItems() {
    const params = new URLSearchParams({ limit: this.state.limit, offset: this.state.offset });
    if (this.state.reason) params.set('reason', this.state.reason);
    const res = await fetch(`/api/scan/skipped?${params.toString()}`);
    const data = await res.json();
    this.state.total = data.total || 0;
    this.state.items = data.items || [];
  },

  paint() {
    const s = this.state.status || {};
    const breakdown = s.skippedReasonsBreakdown || {};
    const reasons = ['missing_tags', 'tag_mismatch', 'unsupported_extension', 'hidden_path', 'permission_denied', 'unreadable'];
    const filtered = this.state.items.filter((item) => {
      if (this.state.ext && item.ext !== this.state.ext) return false;
      if (!this.state.q) return true;
      const hay = `${item.path || ''} ${item.message || ''}`.toLowerCase();
      return hay.includes(this.state.q.toLowerCase());
    });

    document.getElementById('app').innerHTML = `
      <section class="panel">
        <h1>Scan Report</h1>
        <p>Status: <strong>${s.status || 'unknown'}</strong> · Last finished: ${s.finishedAt || '—'}</p>
        <p>Files: ${s.scannedFiles || 0} · Albums: ${s.scannedAlbums || 0} · Artists: ${s.scannedArtists || 0}</p>
        <button class="btn" id="start-scan-btn">Start Scan</button>
      </section>
      <section class="panel">
        <h2>Skipped Summary</h2>
        <div class="chips">
          <button class="chip ${!this.state.reason ? 'active' : ''}" data-reason="">all (${s.skippedFiles || 0})</button>
          ${reasons.map((r) => `<button class="chip ${this.state.reason === r ? 'active' : ''}" data-reason="${r}">${r} (${breakdown[r] || 0})</button>`).join('')}
        </div>
      </section>
      <section class="panel">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <select id="reason-filter"><option value="">All reasons</option>${reasons.map((r) => `<option value="${r}" ${this.state.reason===r?'selected':''}>${r}</option>`).join('')}</select>
          <select id="ext-filter"><option value="">All extensions</option>${this.state.extensions.map((e) => `<option value="${e.ext}" ${this.state.ext===e.ext?'selected':''}>${e.ext} (${e.count})</option>`).join('')}</select>
          <input id="text-filter" class="search-input" style="max-width:260px" value="${this.state.q}" placeholder="Search path/message">
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Reason</th><th>Ext</th><th>Path</th><th>Message</th><th>Actions</th></tr></thead>
            <tbody>
            ${filtered.map((it, idx) => `<tr>
              <td>${it.at || ''}</td><td>${it.reason || ''}</td><td>${it.ext || ''}</td><td>${it.path || ''}</td><td>${it.message || ''}</td>
              <td><button class="btn ghost" data-details="${idx}">Details</button></td>
            </tr>`).join('') || '<tr><td colspan="6">No skipped items for this filter.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button class="btn ghost" id="prev-page" ${this.state.offset <= 0 ? 'disabled' : ''}>Prev</button>
          <button class="btn ghost" id="next-page" ${(this.state.offset + this.state.limit) >= this.state.total ? 'disabled' : ''}>Next</button>
        </div>
      </section>
      <div class="modal" id="details-modal" aria-hidden="true"></div>
    `;
    this.bind(filtered);
  },

  bind(filtered) {
    document.getElementById('start-scan-btn')?.addEventListener('click', async () => {
      await fetch('/api/scan/start', { method: 'POST' });
      await this.refreshStatus();
      this.paint();
    });
    document.querySelectorAll('[data-reason]').forEach((el) => el.addEventListener('click', async () => {
      this.state.reason = el.dataset.reason;
      this.state.offset = 0;
      await this.refreshItems();
      this.paint();
    }));
    document.getElementById('reason-filter')?.addEventListener('change', async (e) => {
      this.state.reason = e.target.value;
      this.state.offset = 0;
      await this.refreshItems();
      this.paint();
    });
    document.getElementById('ext-filter')?.addEventListener('change', (e) => { this.state.ext = e.target.value; this.paint(); });
    document.getElementById('text-filter')?.addEventListener('input', (e) => { this.state.q = e.target.value; });
    document.getElementById('text-filter')?.addEventListener('change', () => this.paint());
    document.getElementById('prev-page')?.addEventListener('click', async () => { this.state.offset = Math.max(0, this.state.offset - this.state.limit); await this.refreshItems(); this.paint(); });
    document.getElementById('next-page')?.addEventListener('click', async () => { this.state.offset += this.state.limit; await this.refreshItems(); this.paint(); });

    this._searchHandler = (e) => { this.state.q = e.detail || ''; this.paint(); };
    window.removeEventListener('global-search', this._searchHandler);
    window.addEventListener('global-search', this._searchHandler);

    document.querySelectorAll('[data-details]').forEach((btn) => btn.addEventListener('click', () => {
      const item = filtered[Number(btn.dataset.details)];
      let details = {};
      try { details = item.detailsJson ? JSON.parse(item.detailsJson) : {}; } catch { details = { raw: item.detailsJson }; }
      const modal = document.getElementById('details-modal');
      modal.innerHTML = `
        <div class="modal-card">
          <h3>Skipped Item Details</h3>
          <p><strong>Path:</strong> ${item.path || ''} <button class="btn ghost" data-copy="${encodeURIComponent(item.path || '')}">Copy Path</button></p>
          <p><strong>Reason:</strong> ${item.reason || ''}</p>
          <p><strong>Ext:</strong> ${item.ext || ''}</p>
          <p><strong>Message:</strong> ${item.message || ''}</p>
          <p><strong>At:</strong> ${item.at || ''}</p>
          <p><button class="btn ghost" data-copy="${encodeURIComponent(JSON.stringify(details, null, 2))}">Copy Tags JSON</button></p>
          <pre>${JSON.stringify(details, null, 2)}</pre>
          <button class="btn" id="close-modal">Close</button>
        </div>`;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
      modal.querySelector('#close-modal')?.addEventListener('click', () => modal.classList.remove('open'));
      modal.querySelectorAll('[data-copy]').forEach((copyBtn) => copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(decodeURIComponent(copyBtn.dataset.copy || ''));
      }));
    }));
  }
};
