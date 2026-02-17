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
    const data = video || { url: '', title: '', author: '', thumbUrl: '', tags: '', category: 'general', difficulty_track: '', difficulty_level: '', notes: '' };
    const attachments = isEdit ? await DB.getVideoAttachments(id) : [];

    app.innerHTML = `
      ${Utils.renderPageHero({ title: isEdit ? 'Edit Video' : 'New Video' })}
      <div class="page-wrap" style="padding:24px 24px 60px;">
        <form id="video-form" class="df-panel df-panel--wide" style="padding:16px;">
          <div class="df-field">
            <label class="df-label" for="video-url">YouTube URL *</label>
            <div style="display:flex;gap:8px;">
              <input id="video-url" class="df-input" name="url" value="${data.url || ''}" required>
              <button type="button" id="fetch-meta" class="df-btn df-btn--outline">Fetch Details</button>
            </div>
          </div>
          <div class="df-field"><label class="df-label">Title *</label><input name="title" class="df-input" value="${data.title || ''}" required></div>
          <div class="df-field"><label class="df-label">Author</label><input name="author" class="df-input" value="${data.author || ''}"></div>
          <div class="df-field"><label class="df-label">Thumbnail URL</label><input name="thumbUrl" class="df-input" value="${data.thumbUrl || data.thumb_url || ''}"></div>
          <div class="df-field"><label class="df-label">Category</label><select class="df-input" name="category"><option value="general" ${data.category === 'general' ? 'selected' : ''}>General</option><option value="skill" ${data.category === 'skill' ? 'selected' : ''}>Skill</option><option value="song" ${data.category === 'song' ? 'selected' : ''}>Song</option></select></div>
          <div class="df-field"><label class="df-label">Difficulty Track</label><select class="df-input" name="difficulty_track"><option value="">Select track</option>${['Beginner', 'Intermediate', 'Advanced'].map((item) => `<option value="${item}" ${data.difficulty_track === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
          <div class="df-field"><label class="df-label">Difficulty Level</label><select class="df-input" name="difficulty_level"><option value="">Select level</option>${[1,2,3].map((item) => `<option value="${item}" ${Number(data.difficulty_level) === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
          <div class="df-field"><label class="df-label">Tags</label><input name="tags" class="df-input" value="${data.tags || ''}" placeholder="technique,beginner,warmup"></div>
          <div class="df-field"><label class="df-label">Notes</label><textarea name="notes" class="df-input" rows="4">${data.notes || ''}</textarea></div>
          <div style="display:flex;gap:10px;margin-top:12px;">
            <button type="submit" class="df-btn df-btn--primary">${isEdit ? 'Save Changes' : 'Save Video'}</button>
            <a href="#/training/videos" class="df-btn df-btn--outline">Cancel</a>
            ${isEdit ? '<button type="button" id="delete-video" class="df-btn df-btn--danger">Delete</button>' : ''}
          </div>
        </form>

        ${isEdit ? `<div class="df-panel df-panel--wide" style="padding:16px;margin-top:12px;">
          <h3 style="margin-top:0;">Attachments</h3>
          <form id="attachment-link-form" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:10px;">
            <input name="title" class="df-input" placeholder="Link title">
            <input name="url" class="df-input" placeholder="https://..." required>
            <button class="df-btn df-btn--outline">Add Link</button>
          </form>
          <form id="attachment-file-form" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;">
            <input type="file" name="file" class="df-input" accept="application/pdf,image/png,image/jpeg,image/webp" required>
            <button class="df-btn df-btn--outline">Upload PDF/Image</button>
          </form>
          <div id="attachment-list">${attachments.map((row) => `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding:8px 0;"><a href="${row.url}" target="_blank" rel="noopener">${row.title || row.filename || row.url}</a><button class="df-btn df-btn--danger" style="padding:4px 8px;" data-del-attachment="${row.id}">Delete</button></div>`).join('') || '<div style="color:var(--text3);">No attachments yet.</div>'}</div>
        </div>` : ''}
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
      if (!payload.url) {
        alert('URL is required.');
        return;
      }
      if (isEdit) payload.id = video.id;
      const saved = await DB.saveTrainingVideo(payload);
      go(`#/training/videos/${saved.id}`);
    });

    app.querySelector('#delete-video')?.addEventListener('click', async () => {
      if (!confirm('Delete this video?')) return;
      await DB.deleteTrainingVideo(video.id);
      go('#/training/videos');
    });

    app.querySelector('#attachment-link-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      await DB.saveVideoAttachment(video.id, data);
      this.render(video.id);
    });

    app.querySelector('#attachment-file-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = event.target.file.files?.[0];
      if (!file) return;
      await DB.saveVideoAttachment(video.id, { file, title: file.name });
      this.render(video.id);
    });

    app.querySelectorAll('[data-del-attachment]').forEach((button) => {
      button.addEventListener('click', async () => {
        await DB.deleteVideoAttachment(button.dataset.delAttachment);
        this.render(video.id);
      });
    });
  },
};
