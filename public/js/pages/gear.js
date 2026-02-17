// Daily Fret — Gear Page + Gear Form

window.Pages = window.Pages || {};

function normalizeGearStatus(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!normalizedStatus || normalizedStatus === 'owned' || normalizedStatus === 'own' || normalizedStatus === 'own it') return 'owned';
  if (normalizedStatus === 'wishlist' || normalizedStatus === 'wish list' || normalizedStatus === 'wanted' || normalizedStatus === 'watching' || normalizedStatus === 'on loan') return 'wishlist';
  if (normalizedStatus === 'sold') return 'sold';
  return 'owned';
}

function gearStatusLabel(status) {
  return {
    owned: 'Owned',
    wishlist: 'Wishlist',
    sold: 'Sold',
  }[normalizeGearStatus(status)] || 'Owned';
}

function normalizeStatusFilterValue(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'all' || raw === 'owned' || raw === 'wishlist' || raw === 'sold') return raw;
  if (!raw) return 'all';
  return normalizeGearStatus(value);
}

function toNum(value) {
  const text = String(value ?? '').trim();
  if (!text) return Number.NaN;
  return Number(text);
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

function normalizeSortValue(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  return value;
}

function compareValues(aValue, bValue, direction = 'asc') {
  const a = normalizeSortValue(aValue);
  const b = normalizeSortValue(bValue);
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'string' || typeof b === 'string') {
    const result = String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    return direction === 'desc' ? -result : result;
  }
  if (a === b) return 0;
  const result = a < b ? -1 : 1;
  return direction === 'desc' ? -result : result;
}

function formatCurrency(v) {
  return Utils.formatPrice(Number(v) || 0);
}

Pages.Gear = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';

    const [gearRows, usageByGear] = await Promise.all([
      DB.getAllGear(),
      DB.getGearUsage().catch(() => ({})),
    ]);
    const gear = gearRows.map((g) => {
      const type = (g.type || '').trim();
      const brand = (g.brand || g.vendor || '').trim();
      const rawImages = Array.isArray(g.imagesList) ? g.imagesList : [];
      const imagesList = rawImages.length
        ? rawImages.filter((row) => row?.filePath).map((row) => ({ ...row, filePath: row.filePath }))
        : (g.imageData ? [{ id: `legacy-${g.id}`, filePath: g.imageData }] : []);
      return {
        ...g,
        type,
        brand,
        displayType: type || '(Uncategorized)',
        status: normalizeGearStatus(g.status),
        usage: usageByGear[g.id] || { usedCount: 0, lastUsed: '' },
        imagesList,
      };
    });

    const filterStorageKey = 'df:gearStatusFilter';
    const sortStorageKey = 'df:gearSort';
    const advancedStorageKey = 'df:gearAdvancedFilters';
    const searchStorageKey = 'df:gearSearch';
    const filters = ['all', 'owned', 'wishlist', 'sold'];
    if (!this._filtersInitialized) {
      this._selectedFilter = 'all';
      this._searchTerm = '';
      this._advancedFilters = {
        category: 'All',
        brand: 'All',
        minPrice: '',
        maxPrice: '',
        linksOnly: false,
        hasTargetPrice: false,
        missingTargetPrice: false,
        expanded: false,
      };
      localStorage.setItem(filterStorageKey, 'all');
      localStorage.setItem(searchStorageKey, '');
      localStorage.setItem(advancedStorageKey, JSON.stringify(this._advancedFilters));
      this._filtersInitialized = true;
    }
    const storedFilterRaw = String(localStorage.getItem(filterStorageKey) || '').trim();
    const storedFilter = normalizeStatusFilterValue(storedFilterRaw);
    const activeStatusFilter = filters.includes(this._selectedFilter) ? this._selectedFilter : (filters.includes(storedFilter) ? storedFilter : 'all');
    const selectedSort = this._selectedSort || localStorage.getItem(sortStorageKey) || 'Newest';
    const searchTerm = this._searchTerm ?? (localStorage.getItem(searchStorageKey) || '');
    const advanced = this._advancedFilters || JSON.parse(localStorage.getItem(advancedStorageKey) || '{}');
    this._selectedFilter = activeStatusFilter;
    this._selectedSort = selectedSort;
    this._searchTerm = searchTerm;
    this._advancedFilters = {
      category: advanced.category || 'All',
      brand: advanced.brand || 'All',
      minPrice: advanced.minPrice || '',
      maxPrice: advanced.maxPrice || '',
      linksOnly: !!advanced.linksOnly,
      hasTargetPrice: !!advanced.hasTargetPrice,
      missingTargetPrice: !!advanced.missingTargetPrice,
      expanded: !!advanced.expanded,
    };

    const stats = Utils.computeGearStats(gear);
    const filtered = this._filterGear(gear, activeStatusFilter, searchTerm, this._advancedFilters);
    const isDefaultFilterState = activeStatusFilter === 'all'
      && !String(searchTerm || '').trim()
      && (this._advancedFilters.category || 'All') === 'All'
      && (this._advancedFilters.brand || 'All') === 'All'
      && !this._advancedFilters.linksOnly
      && !this._advancedFilters.hasTargetPrice
      && !this._advancedFilters.missingTargetPrice
      && !this._advancedFilters.minPrice
      && !this._advancedFilters.maxPrice;
    const visibleList = (gear.length > 0 && filtered.length === 0 && isDefaultFilterState) ? gear : filtered;
    const visible = this._sortGear(visibleList, selectedSort);
    const byCategory = {};
    visible.forEach((g) => {
      const cat = g.category || g.displayType;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(g);
    });
    const categories = ['All', ...new Set(gear.map((g) => g.category || g.displayType).filter(Boolean).sort())];
    const brands = ['All', ...new Set(gear.map((g) => g.brand).filter(Boolean).sort())];

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80');">
        <div class="page-hero__inner" style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;">
          <div>
            <div class="page-title">Gear</div>
            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
              ${filters.map((f) => `<button type="button" class="df-btn ${activeStatusFilter === f ? 'df-btn--primary' : 'df-btn--outline'}" data-status-filter="${f}">${f === 'all' ? 'All' : gearStatusLabel(f)}</button>`).join('')}
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <a href="#/gear/add" class="df-btn df-btn--primary" style="margin-bottom:4px;">+ Add Gear</a>
          </div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:24px 24px 60px;">
        <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;">
          <div style="flex:1 1 760px;min-width:0;">
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:12px;align-items:center;">
              <input class="df-input" id="gear-search" placeholder="Quick search: name, brand, type, notes, tags" value="${searchTerm.replace(/"/g, '&quot;')}">
              <button type="button" class="df-btn df-btn--outline" id="gear-advanced-toggle">${this._advancedFilters.expanded ? 'Hide' : 'Show'} filters</button>
            </div>
            <div id="gear-advanced" style="display:${this._advancedFilters.expanded ? 'grid' : 'none'};grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:12px;">
              <select class="df-input" id="gear-filter-category">${['All', ...categories.filter((cat) => cat !== 'All')].map((cat) => `<option value="${cat}" ${this._advancedFilters.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}</select>
              <select class="df-input" id="gear-filter-brand">${['All', ...brands.filter((brand) => brand !== 'All')].map((brand) => `<option value="${brand}" ${this._advancedFilters.brand === brand ? 'selected' : ''}>${brand}</option>`).join('')}</select>
              <input class="df-input" id="gear-filter-min" type="number" step="0.01" placeholder="Min wishlist price" value="${this._advancedFilters.minPrice}">
              <input class="df-input" id="gear-filter-max" type="number" step="0.01" placeholder="Max wishlist price" value="${this._advancedFilters.maxPrice}">
              <label><input type="checkbox" id="gear-filter-links" ${this._advancedFilters.linksOnly ? 'checked' : ''}> With links</label>
              <label><input type="checkbox" id="gear-filter-target" ${this._advancedFilters.hasTargetPrice ? 'checked' : ''}> With target price</label>
              <label><input type="checkbox" id="gear-filter-missing-target" ${this._advancedFilters.missingTargetPrice ? 'checked' : ''}> Missing target price</label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;align-items:center;">
              <label class="df-label" style="margin:0;">Sort</label>
              <select class="df-input" id="gear-sort" style="max-width:240px;">
                ${['Newest', 'Oldest', 'Name A-Z', 'Price low->high', 'Priority', 'Most used', 'Recently used'].map((opt) => `<option value="${opt}" ${selectedSort === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>
            ${visible.length ? this._renderByCategory(byCategory) : this._renderEmpty()}
          </div>

          <aside style="flex:0 0 290px;max-width:330px;width:100%;position:sticky;top:84px;">
            ${this._renderStatsCompact(stats)}
          </aside>
        </div>
      </div>
    `;

    const saveAdvanced = () => localStorage.setItem(advancedStorageKey, JSON.stringify(this._advancedFilters));
    app.querySelectorAll('[data-status-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const status = btn.getAttribute('data-status-filter');
        this._selectedFilter = normalizeStatusFilterValue(status);
        localStorage.setItem(filterStorageKey, this._selectedFilter);
        this.render();
      });
    });

    app.querySelector('#gear-search')?.addEventListener('input', (e) => {
      this._searchTerm = e.target.value || '';
      localStorage.setItem(searchStorageKey, this._searchTerm);
      this.render();
    });

    app.querySelector('#gear-advanced-toggle')?.addEventListener('click', () => {
      this._advancedFilters.expanded = !this._advancedFilters.expanded;
      saveAdvanced();
      this.render();
    });

    [['#gear-filter-category', 'category'], ['#gear-filter-brand', 'brand'], ['#gear-filter-min', 'minPrice'], ['#gear-filter-max', 'maxPrice']].forEach(([selector, key]) => {
      app.querySelector(selector)?.addEventListener('input', (e) => {
        this._advancedFilters[key] = e.target.value;
        saveAdvanced();
        this.render();
      });
    });

    [['#gear-filter-links', 'linksOnly'], ['#gear-filter-target', 'hasTargetPrice'], ['#gear-filter-missing-target', 'missingTargetPrice']].forEach(([selector, key]) => {
      app.querySelector(selector)?.addEventListener('change', (e) => {
        this._advancedFilters[key] = !!e.target.checked;
        saveAdvanced();
        this.render();
      });
    });

    app.querySelector('#gear-sort')?.addEventListener('change', (e) => {
      this._selectedSort = e.target.value;
      localStorage.setItem(sortStorageKey, this._selectedSort);
      this.render();
    });

    app.querySelector('#gear-reset-filters')?.addEventListener('click', () => {
      this._selectedFilter = 'all';
      this._searchTerm = '';
      this._advancedFilters = {
        ...this._advancedFilters,
        category: 'All',
        brand: 'All',
        minPrice: '',
        maxPrice: '',
        linksOnly: false,
        hasTargetPrice: false,
        missingTargetPrice: false,
      };
      localStorage.setItem(filterStorageKey, 'all');
      localStorage.setItem(searchStorageKey, '');
      saveAdvanced();
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
        const isPrimary = row.querySelector('[name="linkInlinePrimary"]')?.checked ? 1 : 0;
        if (isPrimary) {
          const gearItem = gear.find((g) => g.id === gearId);
          await Promise.all((gearItem?.linksList || []).filter((l) => l.id !== linkId && Number(l.isPrimary)).map((l) => DB.saveGearLink(gearId, { id: l.id, isPrimary: 0 })));
        }
        await DB.saveGearLink(gearId, { id: linkId, price, lastChecked, isPrimary });
        Utils.toast?.('Link updated');
        this.render();
      });
    });

    app.querySelectorAll('[data-link-checked-today]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await DB.saveGearLink(btn.getAttribute('data-gear-id'), { id: btn.getAttribute('data-link-id'), lastChecked: Utils.today() });
        Utils.toast?.('Checked today');
        this.render();
      });
    });

    this._initCarousels(app);
    setTimeout(() => Utils.staggerReveal(app, '.gear-card', 0), 50);
  },


  _renderCardMedia(g, fallbackImage) {
    const images = (g.imagesList || []).map((row) => row.filePath).filter(Boolean);
    if (!images.length) {
      return `<div class="gear-card__bg" style="background-image:url('${fallbackImage}');"></div>`;
    }
    if (images.length === 1) {
      return `<img class="gear-card__photo" src="${images[0]}" alt="${g.name || 'Gear photo'}" loading="lazy">`;
    }
    return `
      <div class="gear-carousel" data-gear-carousel="${g.id}" data-count="${images.length}">
        ${images.map((src, index) => `<img class="gear-card__photo ${index === 0 ? 'is-active' : ''}" src="${src}" alt="${g.name || 'Gear photo'} ${index + 1}" loading="lazy" data-gear-slide="${index}">`).join('')}
      </div>
    `;
  },

  _initCarousels(container) {
    container.querySelectorAll('[data-gear-carousel]').forEach((el) => {
      const slides = [...el.querySelectorAll('[data-gear-slide]')];
      if (slides.length < 2) return;
      let index = 0;
      let interval = null;
      const setIndex = (next) => {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === index));
      };
      const start = () => {
        if (interval) clearInterval(interval);
        interval = setInterval(() => setIndex(index + 1), 4000);
      };
      const stop = () => {
        if (interval) clearInterval(interval);
        interval = null;
      };
      el.addEventListener('mouseenter', stop);
      el.addEventListener('mouseleave', start);
      start();
    });
  },

  _filterGear(gear, activeStatusFilter, searchTerm, advanced) {
    const selectedFilter = normalizeStatusFilterValue(activeStatusFilter);
    let visible = selectedFilter === 'all' ? gear : gear.filter((g) => normalizeGearStatus(g.status) === selectedFilter);
    const isWishlistView = selectedFilter === 'wishlist';
    const needle = String(searchTerm || '').trim().toLowerCase();
    if (needle) {
      visible = visible.filter((g) => {
        const tags = Array.isArray(g.tags) ? g.tags.join(' ') : String(g.tags || '');
        const haystack = [g.name, g.brand, g.type, g.category, g.notes, tags].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(needle);
      });
    }
    if (advanced.category && advanced.category !== 'All') visible = visible.filter((g) => (g.category || g.displayType) === advanced.category);
    if (advanced.brand && advanced.brand !== 'All') visible = visible.filter((g) => g.brand === advanced.brand);
    if (advanced.linksOnly) visible = visible.filter((g) => (g.linksList || []).some((l) => l.url));
    if (isWishlistView && advanced.hasTargetPrice) visible = visible.filter((g) => Number.isFinite(toNum(g.targetPrice)));
    if (isWishlistView && advanced.missingTargetPrice) visible = visible.filter((g) => !Number.isFinite(toNum(g.targetPrice)));
    const min = toNum(advanced.minPrice);
    const max = toNum(advanced.maxPrice);
    if (isWishlistView && (Number.isFinite(min) || Number.isFinite(max))) {
      visible = visible.filter((g) => {
        const best = this._bestPrice(g);
        const target = toNum(g.targetPrice);
        const p = Number.isFinite(best) ? best : target;
        if (!Number.isFinite(p)) return false;
        if (Number.isFinite(min) && p < min) return false;
        if (Number.isFinite(max) && p > max) return false;
        return true;
      });
    }
    return visible;
  },

  _sortGear(items, selectedSort) {
    const priorityRank = { Dream: 0, High: 1, Medium: 2, Low: 3 };
    const sorted = items.map((item, idx) => ({ item, idx }));
    sorted.sort((aEntry, bEntry) => {
      const a = aEntry.item;
      const b = bEntry.item;
      if (selectedSort === 'Oldest') {
        const cmp = compareValues(a.createdAt, b.createdAt, 'asc');
        return cmp || (aEntry.idx - bEntry.idx);
      }
      if (selectedSort === 'Name A-Z') {
        const cmp = compareValues(a.name, b.name, 'asc');
        return cmp || (aEntry.idx - bEntry.idx);
      }
      if (selectedSort === 'Price low->high') {
        const cmp = compareValues(this._bestPrice(a), this._bestPrice(b), 'asc');
        return cmp || (aEntry.idx - bEntry.idx);
      }
      if (selectedSort === 'Priority') {
        const ra = priorityRank[a.priority] ?? 99;
        const rb = priorityRank[b.priority] ?? 99;
        const cmp = compareValues(ra === 99 ? null : ra, rb === 99 ? null : rb, 'asc');
        if (cmp) return cmp;
      }
      if (selectedSort === 'Most used') {
        const cmp = compareValues(a.usage?.usedCount, b.usage?.usedCount, 'desc');
        return cmp || (aEntry.idx - bEntry.idx);
      }
      if (selectedSort === 'Recently used') {
        const cmp = compareValues(parseDay(a.usage?.lastUsed)?.getTime(), parseDay(b.usage?.lastUsed)?.getTime(), 'desc');
        return cmp || (aEntry.idx - bEntry.idx);
      }
      const cmp = compareValues(a.createdAt, b.createdAt, 'desc');
      return cmp || (aEntry.idx - bEntry.idx);
    });
    return sorted.map((entry) => entry.item);
  },

  _bestPrice(gearItem) {
    const prices = (gearItem.linksList || []).map((l) => money(l.price)).filter((v) => Number.isFinite(v) && v > 0);
    if (Number.isFinite(Number(gearItem.targetPrice))) prices.push(Number(gearItem.targetPrice));
    return prices.length ? Math.min(...prices) : null;
  },

  _computeStats(gear) {
    return Utils.computeGearStats(gear || []);
  },

  _renderStatsCompact(stats) {
    const flipLabel = (flip, prefix) => {
      if (!flip) return `${prefix}: —`;
      return `${prefix}: ${flip.item.name || 'Unnamed'} (${formatCurrency(flip.profit)})`;
    };
    return `
      <div class="df-panel" style="padding:14px;">
        <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;">Gear Stats</div>
        <div style="display:grid;grid-template-columns:1fr;gap:8px;">
          <div class="df-statbar__item"><div class="df-statbar__key">Owned count</div><div class="df-statbar__val">${stats.ownedCount}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Wishlist count</div><div class="df-statbar__val">${stats.wishlistCount}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Sold count</div><div class="df-statbar__val">${stats.soldCount}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Total invested</div><div class="df-statbar__val">${formatCurrency(stats.ownedInvested)}</div></div>
          <div class="df-statbar__item"><div class="df-statbar__key">Net P/L</div><div class="df-statbar__val">${formatCurrency(stats.soldNetPL)}</div></div>
        </div>
        <div style="color:var(--text2);font-size:12px;margin-top:10px;display:grid;gap:6px;">
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
    const fallbackImage = Utils.gearImage(g.category);
    const manualUrl = g.manualUrl || '/manual.pdf';
    const primaryUrl = g.primaryUrl || g.primaryLink || g.primary || g.buyUrl || '';
    const statusBadge = {
      owned: 'df-badge--green',
      sold: 'df-badge--red',
      wishlist: 'df-badge--orange',
    }[normalizeGearStatus(g.status)] || 'df-badge--muted';
    const sortedLinks = [...(g.linksList || [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    const topLink = sortedLinks.find((l) => l.url);

    let wishlistMeta = '';
    if (normalizeGearStatus(g.status) === 'wishlist') {
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
        ${this._renderCardMedia(g, fallbackImage)}
        <div class="gear-card__body">
          <div class="gear-card__category">${g.category || ''}</div>
          <div class="gear-card__name">${g.name || 'Unnamed'}</div>
          ${(g.brand || g.model) ? `<div class="gear-card__sub">${[g.brand, g.model].filter(Boolean).join(' · ')}</div>` : ''}
          ${g.boughtDate || g.dateAcquired ? `<div class="gear-card__date">${Utils.formatDate(g.boughtDate || g.dateAcquired, 'short')}</div>` : ''}
          ${g.notes ? `<div class="gear-card__notes">${Utils.truncate(g.notes, 100)}</div>` : ''}
          ${wishlistMeta}
          ${normalizeGearStatus(g.status) === 'owned' ? `<div style="margin-top:8px;color:var(--text2);font-size:12px;display:grid;gap:4px;">
            <div>Used in sessions: ${Number(g.usage?.usedCount || 0)}</div>
            <div>Last used: ${g.usage?.lastUsed ? Utils.formatDate(g.usage.lastUsed, 'short') : '—'}</div>
          </div>` : ''}
          <div class="gear-card__footer">
            ${g.boughtPrice || g.price ? `<span class="gear-card__price">${Utils.formatPrice(g.boughtPrice || g.price)}</span>` : ''}
            ${g.status ? `<span class="df-badge ${statusBadge}">${gearStatusLabel(g.status)}</span>` : ''}
            <div class="gear-card__links">
              ${topLink ? `<a href="${topLink.url}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">${topLink.label || 'Link'}</a>` : ''}
              ${primaryUrl ? `<a href="${primaryUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Buy</a>` : ''}
              <a href="${manualUrl}" target="_blank" rel="noopener" class="gear-card__link" onclick="event.stopPropagation()">Manual</a>
            </div>
          </div>
          ${sortedLinks.slice(0, 3).map((link) => `
            <div data-link-inline-row="${link.id}" onclick="event.stopPropagation()" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line2);display:grid;grid-template-columns:1fr 120px 140px auto auto;gap:6px;align-items:end;">
              <div style="font-size:12px;color:var(--text2);">${link.isPrimary ? '★ Primary' : ''} ${link.label || 'Link'}</div>
              <input class="df-input" name="linkInlinePrice" type="number" step="0.01" value="${link.price ?? ''}" placeholder="Price">
              <input class="df-input" name="linkInlineLastChecked" type="date" value="${link.lastChecked || ''}">
              <label style="font-size:12px;color:var(--text2);display:flex;gap:4px;align-items:center;"><input type="checkbox" name="linkInlinePrimary" ${Number(link.isPrimary) ? 'checked' : ''}>Primary</label>
              <div style="display:flex;gap:4px;">
                <button type="button" class="df-btn df-btn--outline" data-link-checked-today="1" data-gear-id="${g.id}" data-link-id="${link.id}">Checked today</button>
                <button type="button" class="df-btn df-btn--outline" data-link-inline-save="1" data-gear-id="${g.id}" data-link-id="${link.id}">Save</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  _renderEmpty() {
    return `
      <div class="empty-state" style="padding:80px 0;">
        <div class="empty-state__title">No matches — clear filters</div>
        <div class="empty-state__text">Try resetting filters to see all gear items again.</div>
        <button type="button" id="gear-reset-filters" class="df-btn df-btn--outline">Reset filters</button>
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
            <div class="df-field"><label class="df-label" for="g-status">Status</label><select id="g-status" name="status" class="df-input"><option value="">— Select —</option>${statuses.map((s) => `<option value="${s}" ${gearStatusLabel(gear.status) === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
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
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                <label class="df-label" for="g-image" style="margin-bottom:0;">Images</label>
                <label class="df-btn df-btn--outline" style="cursor:pointer;">
                  <input type="file" id="g-image" accept="image/*" multiple style="display:none;">+ Upload Images
                </label>
              </div>
              <div id="g-images-wrap" style="display:flex;gap:10px;flex-wrap:wrap;"></div>
              <div style="font-size:12px;color:var(--text3);margin-top:6px;">Optional. Images are stored at /data/gear and served from /media/gear.</div>
            </div>
          </div>

          <div style="margin-top:24px;display:flex;gap:12px;"><button type="submit" class="df-btn df-btn--primary df-btn--full">${isEdit ? 'Save Changes' : 'Add Gear'}</button><a href="#/gear" class="df-btn df-btn--outline">Cancel</a></div>
          ${isEdit ? '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:16px;"><button type="button" id="delete-gear-btn" class="df-btn df-btn--danger df-btn--full">Delete Item</button></div>' : ''}
        </form>
      </div>
    `;

    const currentImages = [...(Array.isArray(gear.imagesList) ? gear.imagesList : [])];
    const pendingUploads = [];
    const pendingDeletes = new Set();
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
    const imagesWrap = app.querySelector('#g-images-wrap');

    function resizeToBase64(file, maxPx = 1200) {
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
            resolve(canvas.toDataURL('image/jpeg', 0.84));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function renderImages() {
      const existing = currentImages.filter((row) => !pendingDeletes.has(row.id));
      const uploads = pendingUploads.map((row, index) => ({ ...row, id: `pending-${index}`, pending: true }));
      const rows = [...existing, ...uploads];
      if (!rows.length) {
        imagesWrap.innerHTML = '<div style="color:var(--text3);font-size:12px;">No images yet.</div>';
        return;
      }
      imagesWrap.innerHTML = rows.map((row) => `
        <div data-image-id="${row.id}" style="position:relative;">
          <img src="${row.filePath}" alt="Gear image" style="width:100px;height:72px;object-fit:cover;border:1px solid var(--line2);background:var(--bg1);" loading="lazy">
          <button type="button" data-remove-image="${row.id}" class="df-btn df-btn--outline" style="margin-top:6px;width:100%;">Remove</button>
        </div>
      `).join('');
      imagesWrap.querySelectorAll('[data-remove-image]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const imageId = btn.getAttribute('data-remove-image');
          if (imageId.startsWith('pending-')) {
            const idx = Number(imageId.replace('pending-', ''));
            pendingUploads.splice(idx, 1);
          } else {
            pendingDeletes.add(imageId);
          }
          renderImages();
        });
      });
    }

    renderImages();

    if (imageInput) {
      imageInput.addEventListener('change', async () => {
        const files = [...(imageInput.files || [])];
        for (const file of files) {
          const filePath = await resizeToBase64(file);
          pendingUploads.push({ filePath, fileName: file.name, mime: file.type || 'image/jpeg' });
        }
        imageInput.value = '';
        renderImages();
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
      data.primaryUrl = data.primaryUrl || data.primaryLink || data.primary || data.buyUrl || '';
      data.buyUrl = data.primaryUrl;
      if (isEdit) {
        data.id = gear.id;
        data.createdAt = gear.createdAt;
      }
      data.linksList = links;
      const saved = await DB.saveGear(data);

      await Promise.all([...pendingDeletes].map((imageId) => DB.deleteGearImage(imageId)));
      await Promise.all(pendingUploads.map((image, index) => DB.uploadGearImage({ gearId: saved.id, mime: image.mime, dataBase64: image.filePath, fileName: image.fileName, sortOrder: currentImages.length + index })));
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
        <div><label class="df-label">Primary</label><input name="linkPrimary" type="checkbox" ${Number(link.isPrimary) ? 'checked' : ''}></div>
        <button type="button" data-remove-link="1" class="df-btn df-btn--outline" style="height:40px;">Remove</button>
      </div>
    `;
  },
};
