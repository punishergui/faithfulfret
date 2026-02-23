window.Pages = window.Pages || {};

window.Pages.Settings = {
  render() {
    const active = window.ThemeManager.getTheme();
    const cards = window.ThemeManager.THEMES.map((theme) => `
      <article class="theme-card">
        <h3>${theme.name}</h3>
        <div class="swatches">${theme.swatches.map((sw) => `<span style="background:${sw}"></span>`).join('')}</div>
        <p>Theme ID: <code>${theme.id}</code>${active === theme.id ? ' (active)' : ''}</p>
        <button class="btn" data-theme-apply="${theme.id}">Apply</button>
      </article>
    `).join('');

    document.getElementById('app').innerHTML = `
      <section class="panel">
        <h1>Settings · Themes</h1>
        <p>Choose an app skin. Saved to localStorage key <code>crate.theme</code>.</p>
      </section>
      <section class="theme-grid">${cards}</section>
    `;

    document.querySelectorAll('[data-theme-apply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.ThemeManager.applyTheme(btn.dataset.themeApply);
        this.render();
      });
    });
  }
};
