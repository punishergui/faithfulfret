window.renderHelpCard = function renderHelpCard({ title, description, bullets = [], storageKey }) {
  const key = storageKey || `df_help_${String(title || 'tool').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  const collapsed = localStorage.getItem(key) === 'collapsed';
  const bulletHtml = bullets.map((bullet) => `<li>${bullet}</li>`).join('');

  return `
    <section class="help-card" data-help-card data-storage-key="${key}">
      <button type="button" class="help-card__toggle" aria-expanded="${collapsed ? 'false' : 'true'}">
        <span>${title}</span>
        <span class="help-card__chevron">${collapsed ? '▸' : '▾'}</span>
      </button>
      <div class="help-card__body${collapsed ? ' is-collapsed' : ''}">
        <p class="help-card__desc">${description || ''}</p>
        ${bulletHtml ? `<ul class="help-card__list">${bulletHtml}</ul>` : ''}
      </div>
    </section>
  `;
};

window.bindHelpCards = function bindHelpCards(container) {
  container.querySelectorAll('[data-help-card]').forEach((card) => {
    const toggle = card.querySelector('.help-card__toggle');
    const body = card.querySelector('.help-card__body');
    const chevron = card.querySelector('.help-card__chevron');
    const key = card.dataset.storageKey;

    if (!toggle || !body || !key) return;

    toggle.addEventListener('click', () => {
      const hidden = body.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
      chevron.textContent = hidden ? '▸' : '▾';
      localStorage.setItem(key, hidden ? 'collapsed' : 'open');
    });
  });
};
