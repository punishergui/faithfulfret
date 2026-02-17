// Daily Fret — Gear Page + Gear Form

window.Pages = window.Pages || {};

function normalizeGearStatus(status) {
  const normalizedStatus = typeof status === 'string' ? status.trim() : status;
  const map = {
    'Own it': 'Owned',
    owned: 'Owned',
    'Wish List': 'Wishlist',
    wishlist: 'Wishlist',
    Watching: 'Wishlist',
    watching: 'Wishlist',
    'On Loan': 'Wishlist',
    sold: 'Sold',
  };
  return map[normalizedStatus] || normalizedStatus || 'Owned';
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

Pages.Gear = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const gear = (await DB.getAllGear()).map((g) => ({ ...g, status: normalizeGearStatus(g.status) }));
    const filterStorageKey = 'df:gearStatusFilter';
    const filters = ['All', 'Owned', 'Wishlist', 'Sold'];
    const storedFilter = normalizeGearStatus(localStorage.getItem(filterStorageKey) || '');
    const selectedFilter = filters.includes(this._selectedFilter)
      ? this._selectedFilter
      : (filters.includes(storedFilter) ? storedFilter : 'All');
    this._selectedFilter = selectedFilter;

    const owned = gear.filter((g) => g.status === 'Owned').length;
    const sold = gear.filter((g) => g.status === 'Sold').length;
    const wishlist = gear.filter((g) => g.status === 'Wishlist').length;
    const invested = gear.filter((g) => g.status === 'Owned').reduce((s, g) => s + money(g.boughtPrice || g.price), 0);

    const visible = selectedFilter === 'All' ? gear : gear.filter((g) => g.status === selectedFilter);
    const byCategory = {};
    visible.forEach((g) => {
      const cat = g.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(g);
    });

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;">
          <div class="page-title">Gear</div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <a href="/manual.pdf" target="_blank" rel="noopener" class="df-btn df-btn--outline" style="margin-bottom:4px;">Open Manual PDF</a>
            <a href="#/gear/add" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Add Gear</a>
          </div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="df-statbar">
        <div class="df-statbar__item"><div class="df-statbar__key">Owned</div><div class="df-statbar__val">${owned}</div></div>
        <div class="df-statbar__item"><div class="df-statbar__key">Sold</div><div class="df-statbar__val">${sold}</div></div>
        <div class="df-statbar__item"><div class="df-statbar__key">Wishlist</div><div class="df-statbar__val">${wishlist}</div></div>
        <div class="df-statbar__item"><div class="df-statbar__key">Invested</div><div class="df-statbar__val">${invested ? '$' + Number(invested).toLocaleString() : '$0'}</div></div>
      </div>

      <div class="page-wrap" style="padding:24px 24px 60px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
          ${filters.map((f) => `<button type="button" class="df-btn ${selectedFilter === f ? 'df-btn--primary' : 'df-btn--outline'}" data-status-filter="${f}">${f}</button>`).join('')}
        </div>
        ${visible.length ? this._renderByCategory(byCategory) : this._renderEmpty(selectedFilter)}
      </div>
    `;

    app.querySelectorAll('[data-status-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = btn.getAttribute('data-status-filter');
        this._selectedFilter = status;
        localStorage.setItem(filterStorageKey, status);
        this.render();
      });
    });

    setTimeout(() => Utils.staggerReveal(app, '.gear-card', 0), 50);
  },

  _renderByCategory(byCategory) {
    return Object.entries(byCategory).map(([cat, items]) => `
      <div class="cat-header">${cat} <span style="color:var(--text2);">(${items.length})</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1px;background:var(--line);margin-bottom:32px;">
        ${items.map((g) => this._renderCard(g)).join('')}
      </div>
    `).join('');
  },

  _renderCard(g) {
    const imgUrl = g.imageData || Utils.gearImage(g.category);
    const manualUrl = g.manualUrl || '/manual.pdf';
    const statusBadge = {
      Owned: 'df-badge--green',
      Sold: 'df-badge--red',
      Wishlist: 'df-badge--orange',
    }[g.status] || 'df-badge--muted';
    const topLink = (g.linksList || []).find((l) => l.url);

    return `
      <div class="gear-card card-reveal" onclick="go('#/gear/edit/${g.id}')">
        <div class="gear-card__bg" style="background-image:url('${imgUrl}');"></div>
        <div class="gear-card__body">
          <div class="gear-card__category">${g.category || ''}</div>
          <div class="gear-card__name">${g.name || 'Unnamed'}</div>
          ${(g.brand || g.model) ? `<div class="gear-card__sub">${[g.brand, g.model].filter(Boolean).join(' · ')}</div>` : ''}
          ${g.boughtDate || g.dateAcquired ? `<div class="gear-card__date">${Utils.formatDate(g.boughtDate || g.dateAcquired, 'short')}</div>` : ''}
          ${g.notes ? `<div class="gear-card__notes">${Utils.truncate(g.notes, 100)}</div>` : ''}
          <div class="gear-card__footer">
            ${g.boughtPrice || g.price ? `<span class="gear-card__price">${Utils.formatPrice(g.boughtPrice || g.price)}</span>` : ''}
            ${g.status ? `<span class="df-badge ${statusBadge}">${g.status}</span>` : ''}
            <div class="gear-card__links">
              ${topLink ? `<a href="${topLink.url}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">${topLink.label || 'Link'}</a>` : ''}
              ${g.buyUrl ? `<a href="${g.buyUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Buy</a>` : ''}
              <a href="${manualUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Manual</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _renderEmpty(filterLabel) {
    return `
      <div class="empty-state" style="padding:80px 0;">
        <div class="empty-state__title">No ${filterLabel === 'All' ? '' : filterLabel.toLowerCase() + ' '}gear found</div>
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
      gear = (await DB.getGear(id)) || {};
    }

    const categories = ['Guitar', 'Amp', 'Pedal', 'Strings', 'Interface', 'Picks', 'Tuner', 'Cable', 'Case', 'DAW', 'Strap', 'Other'];
    const statuses = ['Owned', 'Wishlist', 'Sold'];
    const linksList = Array.isArray(gear.linksList) ? gear.linksList : [];

    const totalCost = money(gear.boughtPrice || gear.pricePaid || gear.price) + money(gear.tax) + money(gear.shipping);
    const totalSale = money(gear.soldPrice || gear.priceSold) - money(gear.soldFees) - money(gear.soldShipping);
    const pnl = (gear.soldPrice || gear.priceSold) ? (totalSale - totalCost) : null;
    const holdDays = (gear.boughtDate && gear.soldDate)
      ? Math.max(0, Math.round((new Date(`${gear.soldDate}T12:00:00`) - new Date(`${gear.boughtDate}T12:00:00`)) / 86400000))
      : null;

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1568218234742-f0df6cd67c9a?w=1200&q=80');">
        <div class="page-hero__inner"><div class="page-title">${isEdit ? 'Edit Gear' : 'Add Gear'}</div></div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:32px 24px 60px;">
        <form id="gear-form" novalidate>
          <div class="form-grid">
            <div class="df-field full-width"><label class="df-label" for="g-name">Name *</label><input type="text" id="g-name" name="name" class="df-input" value="${gear.name || ''}" required></div>
            <div class="df-field"><label class="df-label" for="g-category">Category</label><select id="g-category" name="category" class="df-input"><option value="">— Select —</option>${categories.map((c) => `<option value="${c}" ${gear.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
            <div class="df-field"><label class="df-label" for="g-status">Status</label><select id="g-status" name="status" class="df-input"><option value="">— Select —</option>${statuses.map((s) => `<option value="${s}" ${normalizeGearStatus(gear.status) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="df-field"><label class="df-label" for="g-brand">Brand</label><input type="text" id="g-brand" name="brand" class="df-input" value="${gear.brand || ''}"></div>
            <div class="df-field"><label class="df-label" for="g-model">Model</label><input type="text" id="g-model" name="model" class="df-input" value="${gear.model || ''}"></div>

            <div class="df-field"><label class="df-label" for="g-bought-date">Bought Date</label><input type="date" id="g-bought-date" name="boughtDate" class="df-input" value="${gear.boughtDate || gear.dateAcquired || ''}"></div>
            <div class="df-field"><label class="df-label" for="g-bought-price">Bought Price ($)</label><input type="number" id="g-bought-price" name="boughtPrice" class="df-input" min="0" step="0.01" value="${gear.boughtPrice ?? gear.price ?? ''}"></div>
            <div class="df-field"><label class="df-label" for="g-bought-from">Bought From</label><input type="text" id="g-bought-from" name="boughtFrom" class="df-input" value="${gear.boughtFrom || gear.vendor || ''}"></div>
            <div class="df-field"><label class="df-label" for="g-tax">Tax ($)</label><input type="number" id="g-tax" name="tax" class="df-input" min="0" step="0.01" value="${gear.tax ?? ''}"></div>
            <div class="df-field"><label class="df-label" for="g-shipping">Shipping ($)</label><input type="number" id="g-shipping" name="shipping" class="df-input" min="0" step="0.01" value="${gear.shipping ?? ''}"></div>

            <div class="df-field"><label class="df-label" for="g-sold-date">Sold Date</label><input type="date" id="g-sold-date" name="soldDate" class="df-input" value="${gear.soldDate || ''}"></div>
            <div class="df-field"><label class="df-label" for="g-sold-price">Sold Price ($)</label><input type="number" id="g-sold-price" name="soldPrice" class="df-input" min="0" step="0.01" value="${gear.soldPrice ?? ''}"></div>
            <div class="df-field"><label class="df-label" for="g-sold-fees">Sold Fees ($)</label><input type="number" id="g-sold-fees" name="soldFees" class="df-input" min="0" step="0.01" value="${gear.soldFees ?? ''}"></div>
            <div class="df-field"><label class="df-label" for="g-sold-where">Sold Where</label><input type="text" id="g-sold-where" name="soldWhere" class="df-input" value="${gear.soldWhere || ''}"></div>
            <div class="df-field"><label class="df-label" for="g-sold-shipping">Sold Shipping ($)</label><input type="number" id="g-sold-shipping" name="soldShipping" class="df-input" min="0" step="0.01" value="${gear.soldShipping ?? ''}"></div>

            <div class="df-field"><label class="df-label">Profit/Loss</label><input type="text" class="df-input" value="${pnl == null ? '—' : Utils.formatPrice(pnl)}" readonly></div>
            <div class="df-field"><label class="df-label">Hold Days</label><input type="text" class="df-input" value="${holdDays == null ? '—' : holdDays}" readonly></div>

            <div class="df-field full-width"><label class="df-label" for="g-manual">Manual URL</label><input type="url" id="g-manual" name="manualUrl" class="df-input" value="${gear.manualUrl || ''}" placeholder="https://..."></div>
            <div class="df-field full-width"><label class="df-label" for="g-notes">Notes</label><textarea id="g-notes" name="notes" class="df-input" rows="4">${gear.notes || ''}</textarea></div>

            <div class="df-field full-width">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <label class="df-label" style="margin-bottom:0;">Links</label>
                <button type="button" id="g-add-link" class="df-btn df-btn--outline">+ Add Link</button>
              </div>
              <div id="g-links-wrap" style="display:flex;flex-direction:column;gap:8px;">
                ${linksList.map((l, idx) => this._renderLinkRow(l, idx)).join('') || '<div style="color:var(--text3);font-size:12px;">No links yet.</div>'}
              </div>
            </div>

            <div class="df-field full-width">
              <label class="df-label" for="g-image">Photo</label>
              <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                <label style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg2);border:1px solid var(--line2);cursor:pointer;font-family:var(--f-mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--text2);" id="g-image-label">
                  <input type="file" id="g-image" accept="image/*" style="display:none;"><span id="g-image-text">${gear.imageData ? 'Change Photo' : '+ Upload Photo'}</span>
                </label>
                ${gear.imageData ? `<img id="g-image-preview" src="${gear.imageData}" style="height:60px;width:80px;object-fit:cover;border:1px solid var(--line2);" alt="Current photo">` : `<span id="g-image-preview" style="display:none;"></span>`}
                ${gear.imageData ? '<button type="button" id="g-image-clear" class="df-btn df-btn--outline">Remove</button>' : ''}
              </div>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;gap:12px;"><button type="submit" class="df-btn df-btn--primary df-btn--full">${isEdit ? 'Save Changes' : 'Add Gear'}</button><a href="#/gear" class="df-btn df-btn--outline">Cancel</a></div>
          ${isEdit ? '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;"><button type="button" id="delete-gear-btn" class="df-btn df-btn--danger df-btn--full">Delete Item</button></div>' : ''}
        </form>
      </div>
    `;

    let pendingImageData = gear.imageData || null;
    const linksWrap = app.querySelector('#g-links-wrap');
    const addLinkBtn = app.querySelector('#g-add-link');

    function wireLinkRow(row) {
      row.querySelector('[data-remove-link]')?.addEventListener('click', () => {
        row.remove();
        if (!linksWrap.children.length) linksWrap.innerHTML = '<div style="color:var(--text3);font-size:12px;">No links yet.</div>';
      });
    }

    linksWrap.querySelectorAll('[data-link-row]').forEach(wireLinkRow);
    addLinkBtn?.addEventListener('click', () => {
      if (linksWrap.textContent.includes('No links yet.')) linksWrap.innerHTML = '';
      const row = document.createElement('div');
      row.innerHTML = this._renderLinkRow({}, Date.now());
      const el = row.firstElementChild;
      linksWrap.appendChild(el);
      wireLinkRow(el);
    });

    const imageInput = app.querySelector('#g-image');
    const imagePreview = app.querySelector('#g-image-preview');
    const imageText = app.querySelector('#g-image-text');
    const imageClear = app.querySelector('#g-image-clear');

    function resizeToBase64(file, maxPx = 800) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * ratio);
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
          imagePreview.src = pendingImageData;
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

    const form = app.querySelector('#gear-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      delete data['g-image'];

      ['boughtPrice', 'tax', 'shipping', 'soldPrice', 'soldFees', 'soldShipping'].forEach((k) => {
        if (data[k]) data[k] = parseFloat(data[k]);
      });

      const links = [...app.querySelectorAll('[data-link-row]')].map((row) => ({
        id: row.getAttribute('data-link-id') || undefined,
        label: row.querySelector('[name="linkLabel"]')?.value || '',
        url: row.querySelector('[name="linkUrl"]')?.value || '',
        price: row.querySelector('[name="linkPrice"]')?.value || '',
        lastChecked: row.querySelector('[name="linkLastChecked"]')?.value || '',
      })).filter((l) => l.label || l.url || l.price || l.lastChecked);

      Object.keys(data).forEach((k) => {
        if (data[k] === '') delete data[k];
      });
      if (!data.name) {
        alert('Name is required.');
        return;
      }

      data.status = normalizeGearStatus(data.status);
      data.dateAcquired = data.boughtDate;
      data.price = data.boughtPrice;
      data.vendor = data.boughtFrom;
      if (isEdit) {
        data.id = gear.id;
        data.createdAt = gear.createdAt;
      }
      data.linksList = links;
      if (pendingImageData) data.imageData = pendingImageData;
      else if (pendingImageData === null) data.imageData = null;

      const saved = await DB.saveGear(data);
      await Promise.all(links.map((link) => DB.saveGearLink(saved.id, link)));
      const existingIds = new Set(links.filter((l) => l.id).map((l) => l.id));
      await Promise.all((gear.linksList || []).filter((existing) => !existingIds.has(existing.id)).map((existing) => DB.deleteGearLink(saved.id, existing.id)));
      go('#/gear');
    });

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

  _renderLinkRow(link, idx) {
    return `
      <div data-link-row="1" data-link-id="${link.id || ''}" style="display:grid;grid-template-columns:1fr 1fr 120px 160px auto;gap:8px;align-items:end;">
        <div><label class="df-label">Label</label><input class="df-input" name="linkLabel" value="${link.label || ''}" placeholder="Store"></div>
        <div><label class="df-label">URL</label><input class="df-input" name="linkUrl" value="${link.url || ''}" placeholder="https://..."></div>
        <div><label class="df-label">Price</label><input class="df-input" name="linkPrice" value="${link.price ?? ''}" type="number" step="0.01"></div>
        <div><label class="df-label">Last Checked</label><input class="df-input" name="linkLastChecked" value="${link.lastChecked || ''}" type="date"></div>
        <button type="button" data-remove-link="1" class="df-btn df-btn--outline" style="height:40px;">Remove</button>
      </div>
    `;
  },
};
