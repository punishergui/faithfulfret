window.Pages = window.Pages || {};

Pages.ManualArticle = {
  async render(slug) {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="manual-page"><div class="manual-loading">Loading article...</div></div>';

    try {
      const safeSlug = ManualData.normalizeSlug(slug);
      const [toc, index, md, customDoc] = await Promise.all([
        ManualData.loadToc(true),
        ManualData.loadMergedIndex(),
        ManualData.loadPage(safeSlug),
        ManualData.getCustomPage(safeSlug),
      ]);

      const doc = index.docs.find(d => d.slug === safeSlug) || { title: safeSlug, slug: safeSlug };
      const html = ManualMarkdown.render(md);

      app.innerHTML = `
        <div class="manual-page">
          <div class="manual-topbar">
            <button class="manual-drawer-btn" id="manual-drawer-btn">☰</button>
            <a href="#/manual" class="manual-title">Wiki</a>
            <a href="#/manual/edit/${safeSlug}" class="manual-toplink">Edit</a>
          </div>

          <div class="manual-layout manual-layout--wiki">
            <aside class="manual-sidebar">${Pages.ManualHome._toc(toc)}</aside>
            <section class="manual-main">
              <div class="manual-breadcrumb">Wiki / ${doc.slug}</div>
              <h1>${doc.title}</h1>
              <div class="manual-toolbar">
                <a class="df-btn" href="#/manual/edit/${safeSlug}">Edit page</a>
                <a class="df-btn df-btn--outline" href="#/manual/new">New page</a>
                ${customDoc ? '<button class="df-btn df-btn--outline" id="wiki-delete-page">Delete</button>' : ''}
              </div>
              <div class="manual-content" id="manual-content">${html}</div>
            </section>
          </div>
        </div>
      `;

      await ManualMarkdown.hydrateWikiAssets(app.querySelector('#manual-content'));

      app.querySelector('#manual-drawer-btn')?.addEventListener('click', () => {
        app.querySelector('.manual-sidebar')?.classList.toggle('open');
      });

      app.querySelector('#wiki-delete-page')?.addEventListener('click', async () => {
        if (!confirm('Delete this page?')) return;
        await ManualData.deleteCustomPage(safeSlug);
        go('#/manual');
      });
    } catch (e) {
      app.innerHTML = '<div class="manual-page"><div class="manual-error">Article not found.</div></div>';
    }
  },
};
