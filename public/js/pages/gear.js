// Daily Fret — Gear Page + Gear Form

window.Pages = window.Pages || {};

Pages.Gear = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const gear = await DB.getAllGear();

    // Stats
    const owned = gear.filter(g => g.status === 'Own it').length;
    const sold = gear.filter(g => g.status === 'Sold').length;
    const wishlist = gear.filter(g => g.status === 'Wish List').length;
    const invested = gear.filter(g => g.status === 'Own it' && g.price).reduce((s, g) => s + Number(g.price), 0);

    // Group by category
    const byCategory = {};
    gear.forEach(g => {
      const cat = g.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(g);
    });

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;">
          <div class="page-title">Gear</div>
          <a href="#/gear/add" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Add Gear</a>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="df-statbar">
        <div class="df-statbar__item"><div class="df-statbar__key">Own</div><div class="df-statbar__val">${owned}</div></div>
        <div class="df-statbar__item"><div class="df-statbar__key">Sold</div><div class="df-statbar__val">${sold}</div></div>
        <div class="df-statbar__item"><div class="df-statbar__key">Wish List</div><div class="df-statbar__val">${wishlist}</div></div>
        <div class="df-statbar__item"><div class="df-statbar__key">Invested</div><div class="df-statbar__val">${invested ? '$' + Number(invested).toLocaleString() : '$0'}</div></div>
      </div>

      <div class="page-wrap" style="padding:24px 24px 60px;">
        ${gear.length ? this._renderByCategory(byCategory) : this._renderEmpty()}
      </div>
    `;

    setTimeout(() => Utils.staggerReveal(app, '.gear-card', 0), 50);
  },

  _renderByCategory(byCategory) {
    return Object.entries(byCategory).map(([cat, items]) => `
      <div class="cat-header">${cat} <span style="color:var(--text2);">(${items.length})</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1px;background:var(--line);margin-bottom:32px;">
        ${items.map(g => this._renderCard(g)).join('')}
      </div>
    `).join('');
  },

  _renderCard(g) {
    // Use uploaded photo if available, otherwise fall back to category Unsplash image
    const imgUrl = g.imageData || Utils.gearImage(g.category);
    const statusBadge = {
      'Own it':    'df-badge--green',
      'Sold':      'df-badge--red',
      'Wish List': 'df-badge--orange',
      'On Loan':   'df-badge--yellow',
    }[g.status] || 'df-badge--muted';

    return `
      <div class="gear-card card-reveal" onclick="go('#/gear/edit/${g.id}')">
        <div class="gear-card__bg" style="background-image:url('${imgUrl}');"></div>
        <div class="gear-card__body">
          <div class="gear-card__category">${g.category || ''}</div>
          <div class="gear-card__name">${g.name || 'Unnamed'}</div>
          ${(g.brand || g.model) ? `<div class="gear-card__sub">${[g.brand, g.model].filter(Boolean).join(' · ')}</div>` : ''}
          ${g.dateAcquired ? `<div class="gear-card__date">${Utils.formatDate(g.dateAcquired, 'short')}</div>` : ''}
          ${g.notes ? `<div class="gear-card__notes">${Utils.truncate(g.notes, 100)}</div>` : ''}
          <div class="gear-card__footer">
            ${g.price ? `<span class="gear-card__price">${Utils.formatPrice(g.price)}</span>` : ''}
            ${g.status ? `<span class="df-badge ${statusBadge}">${g.status}</span>` : ''}
            <div class="gear-card__links">
              ${g.buyUrl ? `<a href="${g.buyUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Buy</a>` : ''}
              ${g.mfrUrl ? `<a href="${g.mfrUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Mfr</a>` : ''}
              ${g.manualUrl ? `<a href="${g.manualUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Manual</a>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _renderEmpty() {
    return `
      <div class="empty-state" style="padding:80px 0;">
        <div class="empty-state__title">No gear added yet</div>
        <div class="empty-state__text">Start tracking your guitars, amps, and accessories.</div>
        <a href="#/gear/add" class="df-btn df-btn--primary">+ Add Your First Item</a>
      </div>
    `;
  },
};

Pages.GearForm = {
  async render(id) {
    const app = document.getElementById('app');
    const isEdit = !!id;
    let gear = {};

    if (isEdit) {
      gear = await DB.getGear(id) || {};
    }

    const categories = ['Guitar', 'Amp', 'Pedal', 'Strings', 'Interface', 'Picks', 'Tuner', 'Cable', 'Case', 'DAW', 'Strap', 'Other'];
    const statuses = ['Own it', 'Sold', 'Wish List', 'On Loan'];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1568218234742-f0df6cd67c9a?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">${isEdit ? 'Edit Gear' : 'Add Gear'}</div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:32px 24px 60px;">
        <form id="gear-form" novalidate>
          <div class="form-grid">
            <div class="df-field full-width">
              <label class="df-label" for="g-name">Name *</label>
              <input type="text" id="g-name" name="name" class="df-input" value="${gear.name || ''}" placeholder="e.g. Schecter C-6 Elite" required>
            </div>
            <div class="df-field">
              <label class="df-label" for="g-category">Category</label>
              <select id="g-category" name="category" class="df-input">
                <option value="">— Select —</option>
                ${categories.map(c => `<option value="${c}" ${gear.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div class="df-field">
              <label class="df-label" for="g-status">Status</label>
              <select id="g-status" name="status" class="df-input">
                <option value="">— Select —</option>
                ${statuses.map(s => `<option value="${s}" ${gear.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="df-field">
              <label class="df-label" for="g-brand">Brand</label>
              <input type="text" id="g-brand" name="brand" class="df-input" value="${gear.brand || ''}" placeholder="e.g. Schecter">
            </div>
            <div class="df-field">
              <label class="df-label" for="g-model">Model</label>
              <input type="text" id="g-model" name="model" class="df-input" value="${gear.model || ''}" placeholder="e.g. C-6 Elite">
            </div>
            <div class="df-field">
              <label class="df-label" for="g-price">Price ($)</label>
              <input type="number" id="g-price" name="price" class="df-input" value="${gear.price || ''}" min="0" step="0.01" placeholder="e.g. 249">
            </div>
            <div class="df-field">
              <label class="df-label" for="g-date">Date Acquired</label>
              <input type="date" id="g-date" name="dateAcquired" class="df-input" value="${gear.dateAcquired || ''}">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="g-buy">Buy URL</label>
              <input type="url" id="g-buy" name="buyUrl" class="df-input" value="${gear.buyUrl || ''}" placeholder="https://...">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="g-mfr">Manufacturer URL</label>
              <input type="url" id="g-mfr" name="mfrUrl" class="df-input" value="${gear.mfrUrl || ''}" placeholder="https://...">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="g-manual">Manual URL</label>
              <input type="url" id="g-manual" name="manualUrl" class="df-input" value="${gear.manualUrl || ''}" placeholder="https://...">
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="g-notes">Notes</label>
              <textarea id="g-notes" name="notes" class="df-input" rows="4" placeholder="Serial number, mods, thoughts...">${gear.notes || ''}</textarea>
            </div>
            <div class="df-field full-width">
              <label class="df-label" for="g-image">Photo</label>
              <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                <label style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg2);border:1px solid var(--line2);cursor:pointer;font-family:var(--f-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text2);transition:border-color 0.15s;" id="g-image-label">
                  <input type="file" id="g-image" accept="image/*" style="display:none;">
                  <span id="g-image-text">${gear.imageData ? 'Change Photo' : '+ Upload Photo'}</span>
                </label>
                ${gear.imageData ? `<img id="g-image-preview" src="${gear.imageData}" style="height:60px;width:80px;object-fit:cover;border:1px solid var(--line2);filter:brightness(0.85);" alt="Current photo">` : `<span id="g-image-preview" style="display:none;"></span>`}
                ${gear.imageData ? `<button type="button" id="g-image-clear" style="font-family:var(--f-mono);font-size:9px;color:var(--red);background:none;border:1px solid rgba(255,45,85,.3);padding:4px 10px;cursor:pointer;letter-spacing:0.06em;">Remove</button>` : ''}
              </div>
              <div style="font-family:var(--f-mono);font-size:8px;color:var(--text3);margin-top:6px;letter-spacing:0.06em;">JPG/PNG/WEBP · auto-resized to 800px · stored in browser</div>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;gap:12px;">
            <button type="submit" class="df-btn df-btn--primary df-btn--full">${isEdit ? 'Save Changes' : 'Add Gear'}</button>
            <a href="#/gear" class="df-btn df-btn--outline">Cancel</a>
          </div>

          ${isEdit ? `
            <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;">
              <button type="button" id="delete-gear-btn" class="df-btn df-btn--danger df-btn--full">Delete Item</button>
            </div>
          ` : ''}
        </form>
      </div>
    `;

    // ── Image upload handling ───────────────────────────────────────
    let pendingImageData = gear.imageData || null;  // holds base64 or null

    const imageInput   = app.querySelector('#g-image');
    const imagePreview = app.querySelector('#g-image-preview');
    const imageText    = app.querySelector('#g-image-text');
    const imageClear   = app.querySelector('#g-image-clear');

    // Resize and convert uploaded file to base64 JPEG (max 800px)
    function resizeToBase64(file, maxPx = 800) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (imageInput) {
      imageInput.addEventListener('change', async () => {
        const file = imageInput.files[0];
        if (!file) return;
        imageText.textContent = 'Processing...';
        pendingImageData = await resizeToBase64(file);
        if (imagePreview) {
          imagePreview.src   = pendingImageData;
          imagePreview.style.display = 'inline-block';
        }
        imageText.textContent = 'Change Photo';
      });
    }

    if (imageClear) {
      imageClear.addEventListener('click', () => {
        pendingImageData = null;
        if (imagePreview) imagePreview.style.display = 'none';
        if (imageText) imageText.textContent = '+ Upload Photo';
        imageClear.style.display = 'none';
      });
    }

    // ── Form submit ─────────────────────────────────────────────────
    const form = app.querySelector('#gear-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      // FormData captures the file input as a File object — remove it,
      // we handle imageData separately via pendingImageData.
      delete data['g-image'];
      if (data.price) data.price = parseFloat(data.price);
      Object.keys(data).forEach(k => { if (data[k] === '') delete data[k]; });
      if (!data.name) { alert('Name is required.'); return; }
      if (isEdit) { data.id = gear.id; data.createdAt = gear.createdAt; }
      // Attach image (base64 string or null to clear)
      if (pendingImageData) data.imageData = pendingImageData;
      await DB.saveGear(data);
      go('#/gear');
    });

    // ── Delete ──────────────────────────────────────────────────────
    const deleteBtn = app.querySelector('#delete-gear-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm('Delete this gear item?')) {
          await DB.deleteGear(gear.id);
          go('#/gear');
        }
      });
    }
  },
};
