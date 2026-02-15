window.Pages = window.Pages || {};

Pages.Presets = {
  async render() {
    const app = document.getElementById('app');
    const presets = await DB.getAllPresets();

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;">
          <div class="page-title">Presets</div>
          <button id="new-preset-btn" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Add Preset</button>
        </div>
        <div class="fret-line"></div>
      </div>
      <div class="page-wrap" style="padding:24px;">
        <div id="preset-form-wrap" style="display:none;margin-bottom:16px;border:1px solid var(--line2);padding:14px;background:var(--bg1);"></div>
        ${presets.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">${presets.map(this.card).join('')}</div>` : '<div class="empty-state"><div class="empty-state__title">No presets yet</div><div class="empty-state__text">Save amp settings you want to reuse.</div></div>'}
      </div>
    `;

    app.querySelector('#new-preset-btn')?.addEventListener('click', () => this.showForm());
    app.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.del;
      if (confirm('Delete preset?')) {
        await DB.deletePreset(id);
        this.render();
      }
    }));
  },

  card(p) {
    return `<div style="border:1px solid var(--line2);padding:14px;background:var(--bg1);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
        <strong>${p.name}</strong>
        <button class="df-btn df-btn--danger" data-del="${p.id}" style="padding:4px 8px;font-size:10px;">Delete</button>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Amp: ${p.ampModel || '—'}</div>
      <div style="font-size:12px;color:var(--text2);margin-top:6px;">Tags: ${p.tags || '—'}</div>
      <pre style="white-space:pre-wrap;color:var(--text3);font-size:11px;margin-top:8px;">${p.settings || '{}'}</pre>
    </div>`;
  },

  showForm() {
    const wrap = document.getElementById('preset-form-wrap');
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <form id="preset-form">
        <div class="form-grid">
          <div class="df-field"><label class="df-label">Name</label><input name="name" class="df-input" required></div>
          <div class="df-field"><label class="df-label">Amp Model</label><input name="ampModel" class="df-input"></div>
          <div class="df-field full-width"><label class="df-label">Tags (comma separated)</label><input name="tags" class="df-input"></div>
          <div class="df-field full-width"><label class="df-label">Settings JSON</label><textarea name="settings" class="df-input" rows="4">{"gain":5,"bass":5,"mid":5,"treble":5}</textarea></div>
        </div>
        <button class="df-btn df-btn--primary" type="submit">Save Preset</button>
      </form>
    `;
    wrap.querySelector('#preset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      await DB.savePreset(data);
      this.render();
    });
  },
};
