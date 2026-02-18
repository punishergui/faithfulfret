window.Pages = window.Pages || {};

const TRAINING_TEXT_COLORS = Object.freeze([
  { key: 'text', label: 'Text', value: 'var(--text)' },
  { key: 'muted', label: 'Muted', value: 'var(--text2)' },
  { key: 'accent', label: 'Accent', value: 'var(--accent)' },
  { key: 'accent2', label: 'Accent 2', value: 'var(--accent2, var(--accent))' },
  { key: 'success', label: 'Success', value: 'var(--good, var(--success, color-mix(in srgb, var(--accent) 65%, #22c55e 35%)))' },
  { key: 'warn', label: 'Warn', value: 'var(--warn, color-mix(in srgb, var(--accent) 45%, #f59e0b 55%))' },
  { key: 'danger', label: 'Danger', value: 'var(--bad, var(--danger, color-mix(in srgb, var(--accent) 30%, #ef4444 70%)))' },
  { key: 'soft', label: 'Soft', value: 'var(--text3)' },
  { key: 'neutral', label: 'Neutral', value: 'color-mix(in srgb, var(--text) 70%, var(--bg) 30%)' },
]);

const TRAINING_ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a', 'span']);
const TRAINING_ALLOWED_COLORS = new Set(TRAINING_TEXT_COLORS.map((item) => item.key));

const TRAINING_EMOJI_CATEGORIES = [
  { key: 'smileys', label: 'Smileys', items: ['😀', '😄', '😁', '😎', '🤩', '🥳', '😌', '🤔', '🔥', '🎯'] },
  { key: 'hands', label: 'Hands', items: ['👍', '👎', '👏', '🙌', '🤟', '✌️', '🤘', '🙏', '👊', '🤝'] },
  { key: 'music', label: 'Music', items: ['🎸', '🎵', '🎶', '🎼', '🥁', '🎤', '🎧', '🎹', '🎺', '🎷'] },
  { key: 'objects', label: 'Objects', items: ['📘', '📝', '📌', '📎', '🎬', '📷', '💡', '✅', '⏱️', '🧠'] },
  { key: 'symbols', label: 'Symbols', items: ['⭐', '✅', '❌', '⚡', '💯', '➕', '➖', '➡️', '⬅️', '🔁'] },
];

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
    .replace(/<\/h[23]>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<hr\s*\/?\>/gi, '\n---\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeTrainingDescriptionHtml(input = '') {
  const wrap = document.createElement('div');
  wrap.innerHTML = String(input || '');

  const sanitizeLink = (node) => {
    const href = String(node.getAttribute('href') || '').trim();
    if (!/^https?:\/\//i.test(href)) {
      node.replaceWith(document.createTextNode(node.textContent || ''));
      return;
    }
    node.setAttribute('href', href);
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  };

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.remove();
      return;
    }
    const tag = node.tagName.toLowerCase();
    if (!TRAINING_ALLOWED_TAGS.has(tag)) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }

    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        node.removeAttribute(attr.name);
        return;
      }
      if (tag === 'a' && ['href', 'target', 'rel'].includes(name)) return;
      if (tag === 'span' && name === 'data-color') return;
      node.removeAttribute(attr.name);
    });

    if (tag === 'a') sanitizeLink(node);
    if (tag === 'span') {
      const color = String(node.getAttribute('data-color') || '').trim();
      if (!TRAINING_ALLOWED_COLORS.has(color)) {
        const parent = node.parentNode;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        return;
      }
    }

    [...node.childNodes].forEach(walk);
  };

  [...wrap.childNodes].forEach(walk);
  return wrap.innerHTML.trim();
}

window.TrainingDescription = window.TrainingDescription || {
  sanitizeHtml: sanitizeTrainingDescriptionHtml,
  stripHtmlToText,
  colors: TRAINING_TEXT_COLORS,
};

function renderVideoForm(video, options = {}) {
  const isEdit = !!options.isEdit;
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  const data = video || { url: '', title: '', author: '', thumbUrl: '', tags: '', category: 'general', difficulty_track: '', difficulty_level: '', notes: '' };
  const colorButtons = TRAINING_TEXT_COLORS.map((item) => `<button type="button" class="training-rich-editor__btn training-rich-editor__color" data-rich-color="${item.key}" title="${item.label}"><span style="background:${item.value};"></span></button>`).join('');

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
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="strikeThrough">Strike</button>
            <button type="button" class="training-rich-editor__btn" data-rich-block="h2">H2</button>
            <button type="button" class="training-rich-editor__btn" data-rich-block="h3">H3</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="insertUnorderedList">Bullets</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="insertOrderedList">Numbered</button>
            <button type="button" class="training-rich-editor__btn" data-rich-quote="1">Quote</button>
            <button type="button" class="training-rich-editor__btn" data-rich-inline-code="1">Inline code</button>
            <button type="button" class="training-rich-editor__btn" data-rich-code-block="1">Code block</button>
            <button type="button" class="training-rich-editor__btn" data-rich-link="1">Link</button>
            <button type="button" class="training-rich-editor__btn" data-rich-hr="1">HR</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="undo">Undo</button>
            <button type="button" class="training-rich-editor__btn" data-rich-cmd="redo">Redo</button>
            <button type="button" class="training-rich-editor__btn" data-rich-clear="1">Clear</button>
            <span class="training-rich-editor__group">${colorButtons}<button type="button" class="training-rich-editor__btn" data-rich-color-reset="1">Reset color</button></span>
            <button type="button" class="training-rich-editor__btn" data-rich-emoji-toggle="1" aria-expanded="false">😀 Emoji</button>
          </div>
          <div id="video-description-editor" class="training-rich-editor__surface" contenteditable="true" data-placeholder="Add a description...">${normalizeEditorSeed(data)}</div>
          <div id="video-emoji-popover" class="training-emoji-popover" hidden>
            <input type="search" class="df-input training-emoji-popover__search" placeholder="Search emoji" aria-label="Search emoji">
            <div class="training-emoji-popover__tabs">${TRAINING_EMOJI_CATEGORIES.map((cat, idx) => `<button type="button" class="training-rich-editor__btn ${idx === 0 ? 'is-active' : ''}" data-emoji-tab="${cat.key}">${cat.label}</button>`).join('')}</div>
            ${TRAINING_EMOJI_CATEGORIES.map((cat, idx) => `<div class="training-emoji-popover__panel" data-emoji-panel="${cat.key}" ${idx === 0 ? '' : 'hidden'}>${cat.items.map((emoji) => `<button type="button" class="training-emoji-popover__item" data-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`).join('')}</div>`).join('')}
          </div>
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
        <button type="submit" class="df-btn df-btn--outline">Add Link</button>
      </form>
      <form id="attachment-file-form" style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;">
        <input name="file" type="file" class="df-input" accept="application/pdf,image/*" required>
        <button type="submit" class="df-btn df-btn--outline">Upload</button>
      </form>
      ` : '<p style="color:var(--text3);">Save the video first to add attachments.</p>'}
      <div style="display:grid;gap:8px;">
        ${attachments.length ? attachments.map((item) => `<div class="df-panel" style="padding:8px;display:flex;align-items:center;justify-content:space-between;gap:8px;"><a href="${escHtml(item.url || '')}" target="_blank" rel="noopener">${escHtml(item.title || item.kind || 'Attachment')}</a>${isEdit ? `<button type="button" class="df-btn df-btn--outline" data-del-attachment="${item.id}">Delete</button>` : ''}</div>`).join('') : '<p style="color:var(--text3);margin:0;">No attachments yet.</p>'}
      </div>
    </div>
  `;
}

Pages.ResourceVideosEdit = {
  async render(id) {
    const app = document.getElementById('app');
    const isEdit = Boolean(id);
    const [video, attachments] = await Promise.all([
      isEdit ? DB.getTrainingVideo(id) : Promise.resolve(null),
      isEdit ? DB.getVideoAttachments(id) : Promise.resolve([]),
    ]);
    if (isEdit && !video) {
      app.innerHTML = '<div class="page-wrap" style="padding:24px;color:var(--text2);">Video not found.</div>';
      return;
    }

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
    const emojiToggleBtn = app.querySelector('[data-rich-emoji-toggle]');
    const emojiPopover = app.querySelector('#video-emoji-popover');
    const emojiSearch = app.querySelector('.training-emoji-popover__search');
    let savedRange = null;

    const saveSelection = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (editor?.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
    };

    const restoreSelection = () => {
      if (!savedRange) return;
      const selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(savedRange);
    };

    const getRangeInEditor = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !editor) return null;
      const range = selection.getRangeAt(0);
      return editor.contains(range.commonAncestorContainer) ? range : null;
    };

    const selectNodeContents = (node, collapseToEnd = false) => {
      const selection = window.getSelection();
      if (!selection || !node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(collapseToEnd);
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
    };

    const insertTextAtRange = (text) => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      const range = getRangeInEditor();
      if (!range) return;
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      const selection = window.getSelection();
      if (!selection) return;
      selection.removeAllRanges();
      selection.addRange(range);
      savedRange = range.cloneRange();
    };

    const wrapInlineTag = (tagName, fallbackText = tagName) => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      const range = getRangeInEditor();
      if (!range) return;
      const text = range.toString();
      const wrapper = document.createElement(tagName);
      wrapper.textContent = text || fallbackText;
      range.deleteContents();
      range.insertNode(wrapper);
      selectNodeContents(wrapper, true);
    };

    const wrapCodeBlock = () => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      const range = getRangeInEditor();
      if (!range) return;
      const selectedText = range.toString();
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      const blockText = selectedText || '\n\n';
      code.textContent = blockText;
      pre.appendChild(code);
      range.deleteContents();
      range.insertNode(pre);

      if (selectedText) {
        selectNodeContents(code, true);
      } else {
        const selection = window.getSelection();
        const caret = document.createRange();
        caret.setStart(code.firstChild || code, 1);
        caret.collapse(true);
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(caret);
        savedRange = caret.cloneRange();
      }
    };

    const applyCmd = (cmd, value = null) => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      document.execCommand(cmd, false, value);
      saveSelection();
    };

    const wrapSelectionWithHtml = (html) => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      document.execCommand('insertHTML', false, html);
      saveSelection();
    };

    const selectionText = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return '';
      return String(selection.toString() || '');
    };

    const togglePopover = (show) => {
      if (!emojiPopover || !emojiToggleBtn) return;
      const open = Boolean(show);
      emojiPopover.hidden = !open;
      emojiToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        const rect = emojiToggleBtn.getBoundingClientRect();
        const parentRect = emojiToggleBtn.closest('.training-rich-editor').getBoundingClientRect();
        emojiPopover.style.left = `${Math.max(8, rect.left - parentRect.left)}px`;
      }
    };

    editor?.addEventListener('keyup', saveSelection);
    editor?.addEventListener('mouseup', saveSelection);
    editor?.addEventListener('input', saveSelection);

    app.querySelectorAll('[data-rich-cmd]').forEach((button) => {
      button.addEventListener('click', () => applyCmd(button.dataset.richCmd));
    });

    app.querySelectorAll('[data-rich-block]').forEach((button) => {
      button.addEventListener('click', () => applyCmd('formatBlock', button.dataset.richBlock));
    });

    app.querySelector('[data-rich-quote]')?.addEventListener('click', () => applyCmd('formatBlock', 'blockquote'));
    app.querySelector('[data-rich-hr]')?.addEventListener('click', () => applyCmd('insertHorizontalRule'));

    app.querySelector('[data-rich-inline-code]')?.addEventListener('click', () => {
      wrapInlineTag('code', 'code');
    });

    app.querySelector('[data-rich-code-block]')?.addEventListener('click', () => {
      wrapCodeBlock();
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
      applyCmd('createLink', url);
    });

    app.querySelector('[data-rich-clear]')?.addEventListener('click', () => {
      applyCmd('removeFormat');
      applyCmd('unlink');
    });

    app.querySelectorAll('[data-rich-color]').forEach((button) => {
      button.addEventListener('click', () => {
        const color = button.dataset.richColor;
        if (!TRAINING_ALLOWED_COLORS.has(color)) return;
        const raw = selectionText();
        const text = raw || 'text';
        wrapSelectionWithHtml(`<span data-color="${color}">${escHtml(text)}</span>`);
      });
    });

    app.querySelector('[data-rich-color-reset]')?.addEventListener('click', () => {
      const raw = selectionText();
      if (!raw) return;
      wrapSelectionWithHtml(escHtml(raw));
    });

    emojiToggleBtn?.addEventListener('click', () => {
      saveSelection();
      togglePopover(emojiPopover.hidden);
    });

    app.querySelectorAll('[data-emoji-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        app.querySelectorAll('[data-emoji-tab]').forEach((tab) => tab.classList.remove('is-active'));
        button.classList.add('is-active');
        const key = button.dataset.emojiTab;
        app.querySelectorAll('[data-emoji-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.emojiPanel !== key;
        });
      });
    });

    app.querySelectorAll('[data-emoji]').forEach((button) => {
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        insertTextAtRange(button.dataset.emoji || '');
        togglePopover(false);
      });
    });

    emojiSearch?.addEventListener('input', () => {
      const q = String(emojiSearch.value || '').trim().toLowerCase();
      app.querySelectorAll('[data-emoji]').forEach((button) => {
        const value = String(button.dataset.emoji || '').toLowerCase();
        button.hidden = q && !value.includes(q);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') togglePopover(false);
    });

    document.addEventListener('click', (event) => {
      if (emojiPopover.hidden) return;
      if (emojiPopover.contains(event.target) || emojiToggleBtn.contains(event.target)) return;
      togglePopover(false);
    });

    editor?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        applyCmd('insertLineBreak');
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        applyCmd('insertParagraph');
      }
    });

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
      const html = sanitizeTrainingDescriptionHtml(editor?.innerHTML || '');
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
