window.Pages = window.Pages || {};

Pages.ResourceVideosEdit = {
  async render(id) {
    const isEdit = !!id;
    const app = document.getElementById('app');
    app.innerHTML = '<div class="page-wrap" style="padding:60px 24px;text-align:center;"><p style="color:var(--text3);font-family:var(--f-mono);">Loading...</p></div>';
    const video = isEdit ? await DB.getTrainingVideo(id) : null;
    if (isEdit && !video) {
      app.innerHTML = '<div class="page-wrap" style="padding:24px;color:var(--text2);">Video not found.</div>';
      return;
    }
    const data = video || { url: '', title: '', author: '', thumbUrl: '', tags: '', difficulty: '', notes: '' };

    app.innerHTML = `
      ${Utils.renderPageHero({ title: isEdit ? 'Edit Video' : 'New Video' })}
      <div class="page-wrap" style="padding:24px 24px 60px;">
        <form id="video-form" class="df-panel df-panel--wide" style="padding:16px;">
          <div class="df-field">
            <label class="df-label" for="video-url">YouTube URL *</label>
            <div style="display:flex;gap:8px;">
              <input id="video-url" class="df-input" name="url" value="${data.url || ''}" required>
              <button type="button" id="fetch-meta" class="df-btn df-btn--outline">Fetch</button>
            </div>
          </div>
          <div class="df-field"><label class="df-label">Title *</label><input name="title" class="df-input" value="${data.title || ''}" required></div>
          <div class="df-field"><label class="df-label">Author</label><input name="author" class="df-input" value="${data.author || ''}"></div>
          <div class="df-field"><label class="df-label">Thumbnail URL</label><input name="thumbUrl" class="df-input" value="${data.thumbUrl || ''}"></div>
          <div class="df-field"><label class="df-label">Tags</label><input name="tags" class="df-input" value="${data.tags || ''}" placeholder="technique,beginner,warmup"></div>
          <div class="df-field">
            <label class="df-label">Difficulty</label>
            <select name="difficulty" class="df-input">
              <option value="">Select difficulty</option>
              ${['Beginner', 'Intermediate', 'Advanced'].map((item) => `<option value="${item}" ${data.difficulty === item ? 'selected' : ''}>${item}</option>`).join('')}
            </select>
          </div>
          <div class="df-field"><label class="df-label">Notes</label><textarea name="notes" class="df-input" rows="4">${data.notes || ''}</textarea></div>
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button type="submit" class="df-btn df-btn--primary">${isEdit ? 'Save Changes' : 'Save Video'}</button>
            <a href="#/resources/videos" class="df-btn df-btn--outline">Cancel</a>
            ${isEdit ? '<button type="button" id="delete-video" class="df-btn df-btn--danger">Delete</button>' : ''}
          </div>
        </form>
      </div>
    `;

    app.querySelector('#fetch-meta')?.addEventListener('click', async () => {
      const urlInput = app.querySelector('[name="url"]');
      const rawUrl = urlInput.value.trim();
      if (!rawUrl) return;
      try {
        const meta = await DB.fetchOEmbed(rawUrl);
        if (meta.title) app.querySelector('[name="title"]').value = meta.title;
        if (meta.author_name) app.querySelector('[name="author"]').value = meta.author_name;
        if (meta.thumbnail_url) app.querySelector('[name="thumbUrl"]').value = meta.thumbnail_url;
      } catch (error) {
        alert(error.message || 'Could not fetch metadata');
      }
    });

    app.querySelector('#video-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const payload = Object.fromEntries(formData.entries());
      payload.tags = String(payload.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).join(',');
      if (!payload.url || !payload.title) {
        alert('URL and title are required.');
        return;
      }
      if (isEdit) payload.id = video.id;
      const saved = await DB.saveTrainingVideo(payload);
      go(`#/resources/videos/${saved.id}`);
    });

    app.querySelector('#delete-video')?.addEventListener('click', async () => {
      if (!confirm('Delete this video?')) return;
      await DB.deleteTrainingVideo(video.id);
      go('#/resources/videos');
    });
  },
};
