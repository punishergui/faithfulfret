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

function parseDay(value) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatCurrency(v) {
  return Utils.formatPrice(Number(v) || 0);
}

Pages.Gear = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const gear = (await DB.getAllGear()).map((g) => ({ ...g, status: normalizeGearStatus(g.status) }));
    const filterStorageKey = 'df:gearStatusFilter';
    const sortStorageKey = 'df:gearSort';
    const wishlistOnlyStorageKey = 'df:gearWishlistOnly';
    const filters = ['All', 'Owned', 'Wishlist', 'Sold'];
    const storedFilter = normalizeGearStatus(localStorage.getItem(filterStorageKey) || '');
    const selectedFilter = filters.includes(this._selectedFilter)
      ? this._selectedFilter
      : (filters.includes(storedFilter) ? storedFilter : 'All');
    const selectedSort = this._selectedSort || localStorage.getItem(sortStorageKey) || 'Newest';
    const wishlistOnly = this._wishlistOnly ?? (localStorage.getItem(wishlistOnlyStorageKey) === '1');
    this._selectedFilter = selectedFilter;
    this._selectedSort = selectedSort;
    this._wishlistOnly = wishlistOnly;

    const stats = this._computeStats(gear);
    const visible = this._sortGear(this._filterGear(gear, selectedFilter, wishlistOnly), selectedSort);
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

      ${this._renderStats(stats)}

      <div class="page-wrap" style="padding:24px 24px 60px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
          ${filters.map((f) => `<button type="button" class="df-btn ${selectedFilter === f ? 'df-btn--primary' : 'df-btn--outline'}" data-status-filter="${f}">${f}</button>`).join('')}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;align-items:center;">
          <label class="df-label" style="margin:0;">Sort</label>
          <select class="df-input" id="gear-sort" style="max-width:220px;">
            ${['Newest', 'Price low->high', 'Priority', 'Brand', 'Type'].map((opt) => `<option value="${opt}" ${selectedSort === opt ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
          <button type="button" class="df-btn ${wishlistOnly ? 'df-btn--primary' : 'df-btn--outline'}" id="gear-wishlist-only">Wishlist only</button>
        </div>
        ${visible.length ? this._renderByCategory(byCategory) : this._renderEmpty(selectedFilter, wishlistOnly)}
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

    app.querySelector('#gear-sort')?.addEventListener('change', (e) => {
      this._selectedSort = e.target.value;
      localStorage.setItem(sortStorageKey, this._selectedSort);
      this.render();
    });

    app.querySelector('#gear-wishlist-only')?.addEventListener('click', () => {
      this._wishlistOnly = !this._wishlistOnly;
      localStorage.setItem(wishlistOnlyStorageKey, this._wishlistOnly ? '1' : '0');
      this.render();
    });

    app.querySelectorAll('[data-link-inline-save]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const gearId = btn.getAttribute('data-gear-id');
        const linkId = btn.getAttribute('data-link-id');
        const row = app.querySelector(`[data-link-inline-row="${linkId}"]`);
        if (!row) return;
        const price = row.querySelector('[name="linkInlinePrice"]')?.value || '';
        const lastChecked = row.querySelector('[name="linkInlineLastChecked"]')?.value || '';
        await DB.saveGearLink(gearId, { id: linkId, price, lastChecked });
        Utils.toast?.('Link updated');
        this.render();
      });
    });

    setTimeout(() => Utils.staggerReveal(app, '.gear-card', 0), 50);
  },

  _filterGear(gear, selectedFilter, wishlistOnly) {
    let visible = selectedFilter === 'All' ? gear : gear.filter((g) => g.status === selectedFilter);
    if (wishlistOnly) visible = visible.filter((g) => g.status === 'Wishlist');
    return visible;
  },

  _sortGear(items, selectedSort) {
    const priorityRank = { Dream: 0, High: 1, Medium: 2, Low: 3 };
    const sorted = [...items];
    sorted.sort((a, b) => {
      if (selectedSort === 'Price low->high') {
        return this._bestPrice(a) - this._bestPrice(b);
      }
      if (selectedSort === 'Priority') {
        const ra = priorityRank[a.priority] ?? 99;
        const rb = priorityRank[b.priority] ?? 99;
        if (ra !== rb) return ra - rb;
      }
      if (selectedSort === 'Brand') {
        return String(a.brand || '').localeCompare(String(b.brand || ''));
      }
      if (selectedSort === 'Type') {
        return String(a.category || a.type || '').localeCompare(String(b.category || b.type || ''));
      }
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
    return sorted;
  },

  _bestPrice(gearItem) {
    const prices = (gearItem.linksList || []).map((l) => money(l.price)).filter((v) => Number.isFinite(v) && v > 0);
    return prices.length ? Math.min(...prices) : Number.POSITIVE_INFINITY;
  },

  _computeStats(gear) {
    const owned = gear.filter((g) => g.status === 'Owned');
    const sold = gear.filter((g) => g.status === 'Sold');
    const wishlist = gear.filter((g) => g.status === 'Wishlist');

    const ownedInvested = owned.reduce((sum, g) => sum + money(g.boughtPrice) + money(g.tax) + money(g.shipping), 0);
    const ownedAvgPurchase = (() => {
      const withPrice = owned.filter((g) => Number.isFinite(Number(g.boughtPrice)));
      if (!withPrice.length) return null;
      const total = withPrice.reduce((sum, g) => sum + money(g.boughtPrice), 0);
      return total / withPrice.length;
    })();

    const soldRecoveredNet = sold.reduce((sum, g) => sum + money(g.soldPrice) - money(g.soldFees) - money(g.soldShipping), 0);
    const soldCostBasis = sold.reduce((sum, g) => sum + money(g.boughtPrice) + money(g.tax) + money(g.shipping), 0);
    const soldNetPL = soldRecoveredNet - soldCostBasis;

    const soldWithProfit = sold.map((g) => {
      const recovered = money(g.soldPrice) - money(g.soldFees) - money(g.soldShipping);
      const basis = money(g.boughtPrice) + money(g.tax) + money(g.shipping);
      return { item: g, profit: recovered - basis };
    });

    const bestFlip = soldWithProfit.length
      ? soldWithProfit.reduce((best, row) => (row.profit > best.profit ? row : best), soldWithProfit[0])
      : null;
    const worstFlip = soldWithProfit.length
      ? soldWithProfit.reduce((worst, row) => (row.profit < worst.profit ? row : worst), soldWithProfit[0])
      : null;

    const soldHoldDays = sold
      .map((g) => {
        const start = parseDay(g.boughtDate);
        const end = parseDay(g.soldDate);
        if (!start || !end) return null;
        return Math.max(0, Math.round((end - start) / 86400000));
      })
      .filter((v) => v != null);

    const avgHoldDays = soldHoldDays.length
      ? Math.round((soldHoldDays.reduce((a, b) => a + b, 0) / soldHoldDays.length) * 10) / 10
      : null;

    const wishlistTargetTotal = wishlist.reduce((sum, g) => sum + money(g.targetPrice), 0);

    return {
      ownedCount: owned.length,
      ownedInvested,
      ownedAvgPurchase,
      soldCount: sold.length,
      soldRecoveredNet,
      soldCostBasis,
      soldNetPL,
      bestFlip,
      worstFlip,
      avgHoldDays,
      wishlistCount: wishlist.length,
      wishlistTargetTotal,
    };
  },

  _renderStats(stats) {
    const flipLabel = (flip, prefix) => {
      if (!flip) return `${prefix}: —`;
      return `${prefix}: ${flip.item.name || 'Unnamed'} (${formatCurrency(flip.profit)})`;
    };
    return `
      <div class="page-wrap" style="padding:14px 24px 8px;">
        <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">Gear Stats</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
          <div class="df-statbar__item"><div class="df-statbar__key">Owned count</div><div class="df-statbar__val">${stats.ownedCount}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Total invested</div><div class="df-statbar__val">${formatCurrency(stats.ownedInvested)}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Avg purchase</div><div class="df-statbar__val">${stats.ownedAvgPurchase == null ? '—' : formatCurrency(stats.ownedAvgPurchase)}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Sold count</div><div class="df-statbar__val">${stats.soldCount}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Recovered net</div><div class="df-statbar__val">${formatCurrency(stats.soldRecoveredNet)}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Cost basis</div><div class="df-statbar__val">${formatCurrency(stats.soldCostBasis)}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Net P/L</div><div class="df-statbar__val">${formatCurrency(stats.soldNetPL)}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Avg hold days</div><div class="df-statbar__val">${stats.avgHoldDays == null ? '—' : stats.avgHoldDays}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Wishlist count</div><div class="df-statbar__val">${stats.wishlistCount}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Wishlist target total</div><div class="df-statbar__val">${formatCurrency(stats.wishlistTargetTotal)}</div></div>
        </div>
        <div style="color:var(--text2);font-size:12px;margin-top:8px;display:flex;flex-wrap:wrap;gap:12px;">
          <span>${flipLabel(stats.bestFlip, 'Best flip')}</span>
          <span>${flipLabel(stats.worstFlip, 'Worst flip')}</span>
        </div>
      </div>
    `;
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
    const sortedLinks = [...(g.linksList || [])].sort((a, b) => Number(b.isPrimary ?? b.primary) - Number(a.isPrimary ?? a.primary));
    const topLink = sortedLinks.find((l) => l.url);

    let wishlistMeta = '';
    if (g.status === 'Wishlist') {
      const bestPrice = this._bestPrice(g);
      const bestLink = sortedLinks.find((l) => money(l.price) === bestPrice);
      const targetPrice = Number(g.targetPrice);
      const hasTarget = Number.isFinite(targetPrice);
      const delta = hasTarget && Number.isFinite(bestPrice) ? bestPrice - targetPrice : null;
      const linkDates = sortedLinks.map((l) => l.lastChecked).filter(Boolean).sort().reverse();
      const lastChecked = linkDates[0] || '';
      wishlistMeta = `
        <div style="margin-top:8px;color:var(--text2);font-size:12px;display:grid;gap:4px;">
          <div>Best price: ${Number.isFinite(bestPrice) ? formatCurrency(bestPrice) : '—'} ${bestLink?.label ? `· ${bestLink.label}` : ''}</div>
          <div>Target: ${hasTarget ? formatCurrency(targetPrice) : '—'} ${delta == null ? '' : `· ${delta <= 0 ? 'Under target' : 'Over target'} (${formatCurrency(delta)})`}</div>
          <div>Last checked: ${lastChecked ? Utils.formatDate(lastChecked, 'short') : '—'}</div>
        </div>
      `;
    }

    return `
      <div class="gear-card card-reveal" onclick="go('#/gear/edit/${g.id}')">
        <div class="gear-card__bg" style="background-image:url('${imgUrl}');"></div>
        <div class="gear-card__body">
          <div class="gear-card__category">${g.category || ''}</div>
          <div class="gear-card__name">${g.name || 'Unnamed'}</div>
          ${(g.brand || g.model) ? `<div class="gear-card__sub">${[g.brand, g.model].filter(Boolean).join(' · ')}</div>` : ''}
          ${g.boughtDate || g.dateAcquired ? `<div class="gear-card__date">${Utils.formatDate(g.boughtDate || g.dateAcquired, 'short')}</div>` : ''}
          ${g.notes ? `<div class="gear-card__notes">${Utils.truncate(g.notes, 100)}</div>` : ''}
          ${wishlistMeta}
          <div class="gear-card__footer">
            ${g.boughtPrice || g.price ? `<span class="gear-card__price">${Utils.formatPrice(g.boughtPrice || g.price)}</span>` : ''}
            ${g.status ? `<span class="df-badge ${statusBadge}">${g.status}</span>` : ''}
            <div class="gear-card__links">
              ${topLink ? `<a href="${topLink.url}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">${topLink.label || 'Link'}</a>` : ''}
              ${g.buyUrl ? `<a href="${g.buyUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Buy</a>` : ''}
              <a href="${manualUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Manual</a>
            </div>
          </div>
          ${sortedLinks.slice(0, 3).map((link) => `
            <div data-link-inline-row="${link.id}" onclick="event.stopPropagation()" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line2);display:grid;grid-template-columns:1fr 120px 140px auto;gap:6px;align-items:end;">
              <div style="font-size:12px;color:var(--text2);">${(link.isPrimary ?? link.primary) ? '★ Primary' : ''} ${link.label || 'Link'}</div>
              <input class="df-input" name="linkInlinePrice" type="number" step="0.01" value="${link.price ?? ''}" placeholder="Price">
              <input class="df-input" name="linkInlineLastChecked" type="date" value="${link.lastChecked || ''}">
              <button type="button" class="df-btn df-btn--outline" data-link-inline-save="1" data-gear-id="${g.id}" data-link-id="${link.id}">Save</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  _renderEmpty(filterLabel, wishlistOnly) {
    return `
      <div class="empty-state" style="padding:80px 0;">
        <div class="empty-state__title">No ${(wishlistOnly ? 'wishlist ' : '') + (filterLabel === 'All' ? '' : filterLabel.toLowerCase() + ' ')}gear found</div>
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
    const priorities = ['Low', 'Medium', 'High', 'Dream'];
    const desiredConditions = ['Any', 'New', 'Used'];
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

            <div class="df-field"><label class="df-label" for="g-target-price">Target Price ($)</label><input type="number" id="g-target-price" name="targetPrice" class="df-input" min="0" step="0.01" value="${gear.targetPrice ?? ''}"></div>
            <div class="df-field"><label class="df-label" for="g-priority">Priority</label><select id="g-priority" name="priority" class="df-input"><option value="">— Select —</option>${priorities.map((p) => `<option value="${p}" ${gear.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
            <div class="df-field"><label class="df-label" for="g-desired-condition">Desired Condition</label><select id="g-desired-condition" name="desiredCondition" class="df-input"><option value="">— Select —</option>${desiredConditions.map((p) => `<option value="${p}" ${gear.desiredCondition === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>

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

      ['boughtPrice', 'tax', 'shipping', 'soldPrice', 'soldFees', 'soldShipping', 'targetPrice'].forEach((k) => {
        if (data[k]) data[k] = parseFloat(data[k]);
      });

      const links = [...app.querySelectorAll('[data-link-row]')].map((row) => ({
        id: row.getAttribute('data-link-id') || undefined,
        label: row.querySelector('[name="linkLabel"]')?.value || '',
        url: row.querySelector('[name="linkUrl"]')?.value || '',
        price: row.querySelector('[name="linkPrice"]')?.value || '',
        lastChecked: row.querySelector('[name="linkLastChecked"]')?.value || '',
        isPrimary: row.querySelector('[name="linkPrimary"]')?.checked ? 1 : 0,
      })).filter((l) => l.label || l.url || l.price || l.lastChecked || l.isPrimary);

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

  _renderLinkRow(link) {
    return `
      <div data-link-row="1" data-link-id="${link.id || ''}" style="display:grid;grid-template-columns:1fr 1fr 120px 160px 90px auto;gap:8px;align-items:end;">
        <div><label class="df-label">Label</label><input class="df-input" name="linkLabel" value="${link.label || ''}" placeholder="Store"></div>
        <div><label class="df-label">URL</label><input class="df-input" name="linkUrl" value="${link.url || ''}" placeholder="https://..."></div>
        <div><label class="df-label">Price</label><input class="df-input" name="linkPrice" value="${link.price ?? ''}" type="number" step="0.01"></div>
        <div><label class="df-label">Last Checked</label><input class="df-input" name="linkLastChecked" value="${link.lastChecked || ''}" type="date"></div>
        <div><label class="df-label">Primary</label><input name="linkPrimary" type="checkbox" ${Number(link.isPrimary ?? link.primary) ? 'checked' : ''}></div>
        <button type="button" data-remove-link="1" class="df-btn df-btn--outline" style="height:40px;">Remove</button>
      </div>
    `;
  },
};
