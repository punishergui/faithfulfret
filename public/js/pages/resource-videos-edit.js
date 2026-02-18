window.Pages = window.Pages || {};

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
}

function escapeToParagraphs(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return `<p>${escHtml(raw).replace(/\n/g, '<br>')}</p>`;
}

function normalizeEditorSeed(data = {}) {
  if (String(data.description_html || '').trim()) return String(data.description_html);
  const legacy = String(data.description_text || data.notes || '').trim();
  return escapeToParagraphs(legacy);
}

function stripHtmlToText(html = '') {
  return String(html || '')
    .replace(/<br\s*\/?\>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderVideoForm(video, options = {}) {
  const isEdit = !!options.isEdit;
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  const data = video || { url: '', title: '', author: '', thumbUrl: '', tags: '', category: 'general', difficulty_track: '', difficulty_level: '', notes: '' };

  return `
    <form id="video-form" class="df-panel df-panel--wide" style="padding:16px;">
      <div id="video-form-status" class="df-panel" style="padding:10px;display:none;margin-bottom:10px;"></div>
      <div class="df-field">
        <label class="df-label" for="video-url">YouTube URL *</label>
        <div style="display:flex;gap:8px;">
          <input id="video-url" class="df-input" name="url" value="${escHtml(data.url || '')}" required>
          <button type="button" id="fetch-meta" class="df-btn df-btn--outline">Fetch Details</button>
        </div>
      </div>
      <div class="df-field"><label class="df-label">Title *</label><input name="title" class="df-input" value="${escHtml(data.title || '')}" required></div>
      <div class="df-field"><label class="df-label">Author</label><input name="author" class="df-input" value="${escHtml(data.author || '')}"></div>
      <div class="df-field"><label class="df-label">Thumbnail URL</label><input name="thumbUrl" class="df-input" value="${escHtml(data.thumbUrl || data.thumb_url || '')}"></div>
      <div id="thumb-preview" style="margin-bottom:10px;${(data.thumbUrl || data.thumb_url) ? '' : 'display:none;'}"><img src="${escHtml(data.thumbUrl || data.thumb_url || '')}" alt="Thumbnail preview" style="max-width:320px;border-radius:10px;border:1px solid var(--line);"></div>
      <div class="df-field"><label class="df-label">Category</label><select class="df-input" name="category"><option value="general" ${data.category === 'general' ? 'selected' : ''}>General</option><option value="skill" ${data.category === 'skill' ? 'selected' : ''}>Skill</option><option value="song" ${data.category === 'song' ? 'selected' : ''}>Song</option></select></div>
      <div class="df-field"><label class="df-label">Difficulty Track</label><select class="df-input" name="difficulty_track"><option value="">Select track</option>${['Beginner', 'Intermediate', 'Advanced'].map((item) => `<option value="${item}" ${data.difficulty_track === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
      <div class="df-field"><label class="df-label">Difficulty Level</label><select class="df-input" name="difficulty_level"><option value="">Select level</option>${[1,2,3].map((item) => `<option value="${item}" ${Number(data.difficulty_level) === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
      <div class="df-field"><label class="df-label">Tags</label><input name="tags" class="df-input" value="${escHtml(data.tags || '')}" placeholder="technique,beginner,warmup"></div>
      <div class="df-field">
        <label class="df-label">Description</label>
        <div class="training-rich-editor">
          <div class="training-rich-editor__toolbar" role="toolbar" aria-label="Description formatting">
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="bold">Bold</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="italic">Italic</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="underline">Underline</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="insertUnorderedList">Bullet List</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="insertOrderedList">Numbered List</button>
            <button type="button" class="training-rich-editor__btn" data-rich-link="1">Link</button>
            <button type="button" class="training-rich-editor__btn" data-rich-clear="1">Clear</button>
          </div>
          <div id="video-description-editor" class="training-rich-editor__surface" contenteditable="true" data-placeholder="Add a description...">${normalizeEditorSeed(data)}</div>
        </div>
        <input type="hidden" name="description_html" value="">
        <input type="hidden" name="description_text" value="">
      </div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button type="submit" class="df-btn df-btn--primary">${isEdit ? 'Save Changes' : 'Save Video'}</button>
        <a href="#/training/videos" class="df-btn df-btn--outline">Cancel</a>
        ${isEdit ? '<button type="button" id="delete-video" class="df-btn df-btn--danger">Delete</button>' : ''}
      </div>
    </form>

    <div class="df-panel df-panel--wide" style="padding:16px;margin-top:12px;">
      <h3 style="margin-top:0;">Attachments</h3>
      ${isEdit ? `
      <form id="attachment-link-form" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:10px;">
        <input name="title" class="df-input" placeholder="Link title">
        <input name="url" class="df-input" placeholder="https://..." required>
        <button class="df-btn df-btn--outline">Add Link</button>
      </form>
      <form id="attachment-file-form" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;">
        <input type="file" name="file" class="df-input" accept="application/pdf,image/png,image/jpeg,image/webp" required>
        <button class="df-btn df-btn--outline">Upload PDF/Image</button>
      </form>
      <div id="attachment-list">${attachments.map((row) => `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding:8px 0;"><a href="${escHtml(row.url)}" target="_blank" rel="noopener">${escHtml(row.title || row.filename || row.url)}</a><button class="df-btn df-btn--danger" style="padding:4px 8px;" data-del-attachment="${row.id}">Delete</button></div>`).join('') || '<div style="color:var(--text3);">No attachments yet.</div>'}</div>` : '<div style="color:var(--text3);">Save the video first to add attachments.</div>'}
    </div>
  `;
}

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
    const attachments = isEdit ? await DB.getVideoAttachments(id) : [];

    app.innerHTML = `
      ${Utils.renderPageHero({ title: isEdit ? 'Edit Video' : 'New Video', leftExtra: Utils.renderBreadcrumbs([{ label: 'Training', href: '#/training' }, { label: 'Videos', href: '#/training/videos' }, { label: isEdit ? (video?.title || 'Video') : 'New Video' }]) })}
      <div class="page-wrap" style="padding:24px 24px 60px;">
        ${renderVideoForm(video, { isEdit, attachments })}
      </div>
    `;

    const showStatus = (message) => {
      const el = app.querySelector('#video-form-status');
      if (!el) return;
      el.textContent = message;
      el.style.display = 'block';
    };

    const updateThumbPreview = () => {
      const wrap = app.querySelector('#thumb-preview');
      const input = app.querySelector('[name="thumbUrl"]');
      if (!wrap || !input) return;
      const url = input.value.trim();
      if (!url) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = 'block';
      wrap.querySelector('img').src = url;
    };

    app.querySelector('[name="thumbUrl"]')?.addEventListener('input', updateThumbPreview);

    const editor = app.querySelector('#video-description-editor');
    const applyCmd = (cmd) => {
      if (!editor) return;
      editor.focus();
      document.execCommand(cmd, false, null);
    };

    const sanitizeDescriptionHtml = (html = '') => {
      const allowed = new Set(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a']);
      const wrap = document.createElement('div');
      wrap.innerHTML = String(html || '');
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return;
        if (node.nodeType !== Node.ELEMENT_NODE) {
          node.remove();
          return;
        }
        const tag = node.tagName.toLowerCase();
        if (!allowed.has(tag)) {
          const parent = node.parentNode;
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
          return;
        }
        [...node.attributes].forEach((attr) => node.removeAttribute(attr.name));
        if (tag === 'a') {
          const href = String(node.getAttribute('href') || '').trim();
          if (!/^https?:\/\//i.test(href)) {
            const textNode = document.createTextNode(node.textContent || '');
            node.replaceWith(textNode);
            return;
          }
          node.setAttribute('href', href);
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
        [...node.childNodes].forEach(walk);
      };
      [...wrap.childNodes].forEach(walk);
      return wrap.innerHTML.trim();
    };

    app.querySelectorAll('[data-rich-cmd]').forEach((button) => {
      button.addEventListener('click', () => applyCmd(button.dataset.richCmd));
    });
    app.querySelector('[data-rich-link]')?.addEventListener('click', () => {
      if (!editor) return;
      const raw = prompt('Enter URL (https://...)');
      if (!raw) return;
      const url = String(raw).trim();
      if (!/^https?:\/\//i.test(url)) {
        showStatus('Links must start with http:// or https://');
        return;
      }
      editor.focus();
      document.execCommand('createLink', false, url);
    });
    app.querySelector('[data-rich-clear]')?.addEventListener('click', () => applyCmd('removeFormat'));
    editor?.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand('insertText', false, text);
    });

    app.querySelector('#fetch-meta')?.addEventListener('click', async () => {
      const urlInput = app.querySelector('[name="url"]');
      const rawUrl = urlInput.value.trim();
      if (!rawUrl) {
        showStatus('Enter a URL first.');
        return;
      }
      try {
        const meta = await DB.fetchOEmbed(rawUrl);
        if (meta.title) app.querySelector('[name="title"]').value = meta.title;
        if (meta.author_name) app.querySelector('[name="author"]').value = meta.author_name;
        if (meta.thumbnail_url) app.querySelector('[name="thumbUrl"]').value = meta.thumbnail_url;
        updateThumbPreview();
        showStatus('Fetched video details.');
      } catch (error) {
        showStatus(error.message || 'Could not fetch metadata.');
      }
    });

    app.querySelector('#video-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const payload = Object.fromEntries(formData.entries());
      payload.tags = String(payload.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).join(',');
      const html = sanitizeDescriptionHtml(editor?.innerHTML || '');
      payload.description_html = html;
      payload.description_text = stripHtmlToText(html);
      payload.notes = payload.description_text;
      if (!payload.url) {
        showStatus('URL is required.');
        return;
      }
      if (isEdit) payload.id = video.id;
      try {
        const saved = await DB.saveTrainingVideo(payload);
        go(`#/training/videos/${saved.id}`);
      } catch (error) {
        showStatus(error.message || 'Unable to save video.');
      }
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
