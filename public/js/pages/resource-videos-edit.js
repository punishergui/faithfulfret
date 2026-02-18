window.Pages = window.Pages || {};

const TRAINING_TEXT_COLORS = Object.freeze([
  { key: 'text', label: 'Text', value: 'var(--text)' },
  { key: 'muted', label: 'Muted', value: 'var(--text2)' },
  { key: 'accent', label: 'Accent', value: 'var(--accent)' },
  { key: 'accent2', label: 'Accent 2', value: 'var(--accent2, var(--accent))' },
  { key: 'good', label: 'Good', value: 'var(--good, var(--success, color-mix(in srgb, var(--accent) 65%, #22c55e 35%)))' },
  { key: 'warn', label: 'Warn', value: 'var(--warn, color-mix(in srgb, var(--accent) 45%, #f59e0b 55%))' },
  { key: 'bad', label: 'Bad', value: 'var(--bad, var(--danger, color-mix(in srgb, var(--accent) 30%, #ef4444 70%)))' },
]);

const TRAINING_ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a', 'span']);
const TRAINING_ALLOWED_COLORS = new Set(TRAINING_TEXT_COLORS.map((item) => item.key));

const TRAINING_EMOJI_CATEGORIES = Object.freeze([
  {
    key: 'frequent',
    label: 'Frequently Used',
    items: [
      ['🎸', ['guitar', 'music', 'practice']], ['🎶', ['music', 'notes']], ['🎵', ['music', 'melody']], ['🎧', ['headphones', 'listen']], ['🥁', ['drums', 'rhythm']],
      ['🎤', ['sing', 'microphone']], ['🎼', ['sheet', 'music']], ['⏱️', ['timer', 'speed']], ['⏲️', ['timer', 'clock']], ['✅', ['done', 'complete']],
      ['☑️', ['checkbox', 'done']], ['⭐', ['star', 'favorite']], ['🌟', ['star', 'highlight']], ['🔥', ['fire', 'hot']], ['💪', ['strength', 'effort']],
      ['🤘', ['rock', 'guitar']], ['🙌', ['celebrate', 'hands']], ['👌', ['okay', 'good']], ['👍', ['thumbs up', 'yes']], ['👎', ['thumbs down', 'no']],
      ['✍️', ['write', 'notes']], ['🧠', ['brain', 'learn']], ['📌', ['pin', 'important']], ['📎', ['paperclip', 'attach']], ['📚', ['books', 'study']],
      ['🗒️', ['notepad', 'notes']], ['📝', ['memo', 'write']], ['💡', ['idea', 'tip']], ['🎯', ['target', 'goal']], ['📈', ['progress', 'growth']],
    ],
  },
  {
    key: 'smileys',
    label: 'Smileys',
    items: [
      ['😀', ['grin', 'happy']], ['😁', ['grin', 'smile']], ['😂', ['laugh', 'funny']], ['🤣', ['laugh', 'rolling']], ['😊', ['smile', 'warm']],
      ['🙂', ['smile', 'calm']], ['🙃', ['upside down', 'silly']], ['😉', ['wink']], ['😍', ['love', 'eyes']], ['🥰', ['love', 'hearts']],
      ['😎', ['cool', 'sunglasses']], ['🤩', ['starstruck', 'excited']], ['🥳', ['party', 'celebrate']], ['😇', ['angel', 'innocent']], ['😌', ['relief', 'calm']],
      ['🤔', ['thinking']], ['🫡', ['salute', 'respect']], ['😅', ['sweat', 'nervous']], ['😤', ['determined', 'effort']], ['😴', ['sleepy', 'tired']],
      ['😵', ['dizzy', 'overwhelmed']], ['🤯', ['mind blown']], ['🥶', ['cold']], ['🥵', ['hot']], ['😬', ['awkward']],
      ['😮', ['surprised']], ['😢', ['sad', 'cry']], ['😭', ['cry', 'tears']], ['😡', ['angry']], ['🤬', ['angry', 'swear']],
      ['😈', ['mischief']], ['👻', ['ghost', 'fun']], ['🤖', ['robot', 'tech']], ['💀', ['dead', 'metal']], ['✨', ['sparkles']],
    ],
  },
  {
    key: 'hands',
    label: 'Hands',
    items: [
      ['👍', ['thumbs up']], ['👎', ['thumbs down']], ['👌', ['okay']], ['✌️', ['peace', 'victory']], ['🤞', ['crossed fingers', 'luck']],
      ['🤟', ['love you', 'rock']], ['🤘', ['rock on']], ['🤙', ['call me']], ['👏', ['clap']], ['🙌', ['raise hands']],
      ['👐', ['open hands']], ['🤲', ['palms up']], ['🙏', ['pray', 'thanks']], ['✍️', ['write']], ['🫶', ['heart hands']],
      ['🫰', ['money', 'finger heart']], ['🫱', ['right hand']], ['🫲', ['left hand']], ['🫳', ['palm down']], ['🫴', ['palm up']],
      ['☝️', ['point up']], ['👇', ['point down']], ['👉', ['point right']], ['👈', ['point left']], ['👆', ['point up back']],
      ['🖕', ['middle finger']], ['✊', ['fist']], ['👊', ['fist bump']], ['🤛', ['left punch']], ['🤜', ['right punch']],
      ['💪', ['muscle']], ['🦾', ['mechanical arm']], ['🤝', ['handshake']], ['🫂', ['hug']], ['🙋', ['raise hand']],
    ],
  },
  {
    key: 'music',
    label: 'Music',
    items: [
      ['🎸', ['guitar']], ['🎶', ['notes']], ['🎵', ['note']], ['🎼', ['score']], ['🎹', ['keyboard', 'piano']],
      ['🥁', ['drums']], ['🎤', ['mic', 'sing']], ['🎧', ['headphones']], ['🎺', ['trumpet']], ['🎷', ['saxophone']],
      ['🎻', ['violin']], ['🪕', ['banjo']], ['🪘', ['drum']], ['🪈', ['flute']], ['📻', ['radio']],
      ['🔊', ['loudspeaker']], ['🔉', ['volume']], ['🔈', ['quiet']], ['🔇', ['mute']], ['🎚️', ['level slider']],
      ['🎛️', ['control knobs']], ['🎙️', ['studio mic']], ['📀', ['disc']], ['💿', ['cd']], ['📼', ['cassette']],
      ['⏱️', ['timer']], ['⏲️', ['countdown']], ['⌛', ['hourglass']], ['🕒', ['clock']], ['🎯', ['goal']],
      ['🏆', ['trophy']], ['🥇', ['gold medal']], ['🥈', ['silver medal']], ['🥉', ['bronze medal']], ['🎬', ['recording']],
    ],
  },
  {
    key: 'objects',
    label: 'Objects',
    items: [
      ['🧠', ['brain']], ['💡', ['idea']], ['📌', ['pin']], ['📎', ['paperclip']], ['📚', ['books']],
      ['📖', ['book open']], ['🗒️', ['notepad']], ['📝', ['memo']], ['📒', ['ledger']], ['📓', ['notebook']],
      ['📔', ['decorative notebook']], ['📕', ['red book']], ['📗', ['green book']], ['📘', ['blue book']], ['📙', ['orange book']],
      ['🧾', ['receipt']], ['📋', ['clipboard']], ['📁', ['folder']], ['📂', ['open folder']], ['🗂️', ['index dividers']],
      ['📅', ['calendar']], ['🗓️', ['spiral calendar']], ['📍', ['location']], ['📐', ['triangle ruler']], ['📏', ['ruler']],
      ['✂️', ['scissors']], ['🖊️', ['pen']], ['🖋️', ['fountain pen']], ['🖌️', ['paintbrush']], ['🧮', ['abacus']],
      ['💻', ['laptop']], ['📱', ['phone']], ['🖥️', ['desktop']], ['🧰', ['toolbox']], ['🧱', ['brick']],
    ],
  },
  {
    key: 'symbols',
    label: 'Symbols',
    items: [
      ['✅', ['check']], ['☑️', ['checkbox']], ['✔️', ['checkmark']], ['❌', ['x', 'no']], ['⚠️', ['warning']],
      ['❗', ['exclamation']], ['❓', ['question']], ['⭐', ['star']], ['🌟', ['glowing star']], ['✨', ['sparkles']],
      ['🔥', ['fire']], ['💯', ['100']], ['🎯', ['target']], ['🏁', ['finish']], ['🔁', ['repeat']],
      ['🔂', ['repeat one']], ['🔄', ['refresh']], ['♻️', ['recycle']], ['➕', ['plus']], ['➖', ['minus']],
      ['➗', ['divide']], ['✖️', ['multiply']], ['🟢', ['green circle']], ['🟡', ['yellow circle']], ['🔴', ['red circle']],
      ['🟠', ['orange circle']], ['🟣', ['purple circle']], ['⚫', ['black circle']], ['⚪', ['white circle']], ['🟥', ['red square']],
      ['🟦', ['blue square']], ['🟩', ['green square']], ['🟨', ['yellow square']], ['🔷', ['diamond']], ['🔶', ['orange diamond']],
    ],
  },
]);

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
  const data = video || { youtube_url: '', url: '', title: '', author: '', thumbUrl: '', thumbnail_url: '', tags: '', category: 'general', difficulty_track: '', difficulty_level: '', notes: '' };
  const colorButtons = TRAINING_TEXT_COLORS.map((item) => `<button type="button" class="training-rich-editor__btn training-rich-editor__color" data-rich-color="${item.key}" title="${item.label}"><span style="background:${item.value};"></span></button>`).join('');

  return `
    <form id="video-form" class="df-panel df-panel--wide" style="padding:16px;">
      <div id="video-form-status" class="df-panel" style="padding:10px;display:none;margin-bottom:10px;"></div>
      <div class="df-field">
        <label class="df-label" for="video-url">YouTube URL *</label>
        <div style="display:flex;gap:8px;">
          <input id="video-url" class="df-input" name="youtube_url" value="${escHtml(data.youtube_url || data.url || '')}">
          <button type="button" id="fetch-meta" class="df-btn df-btn--outline">Fetch Details</button>
        </div>
      </div>
      <div class="df-field"><label class="df-label">Title *</label><input name="title" class="df-input" value="${escHtml(data.title || '')}" required></div>
      <div class="df-field"><label class="df-label">Author</label><input name="author" class="df-input" value="${escHtml(data.author || '')}"></div>
      <div class="df-field"><label class="df-label">Thumbnail URL</label><input name="thumbUrl" class="df-input" value="${escHtml(data.thumbnail_url || data.thumbUrl || data.thumb_url || '')}"></div>
      <div id="thumb-preview" style="margin-bottom:10px;${(data.thumbnail_url || data.thumbUrl || data.thumb_url) ? '' : 'display:none;'}"><img src="${escHtml(data.thumbnail_url || data.thumbUrl || data.thumb_url || '')}" alt="Thumbnail preview" style="max-width:320px;border-radius:10px;border:1px solid var(--line);"></div>
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
          <div id="video-description-editor" class="training-rich-editor__surface rt-editor" contenteditable="true" data-placeholder="Add a description...">${normalizeEditorSeed(data)}</div>
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
    this._cleanupEditorHooks?.();
    this._cleanupEditorHooks = null;
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
    let savedRange = null;
    let emojiPopover = null;

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

    const BLOCK_TAGS = new Set(['p', 'div', 'h2', 'h3', 'li', 'blockquote', 'pre']);

    const findBlockNode = (node) => {
      let current = node?.nodeType === Node.TEXT_NODE ? node.parentNode : node;
      while (current && current !== editor) {
        if (current.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(current.tagName.toLowerCase())) return current;
        current = current.parentNode;
      }
      return null;
    };

    const renameBlockTag = (block, tagName) => {
      if (!block || block.tagName.toLowerCase() === tagName) return block;
      const next = document.createElement(tagName);
      [...block.attributes].forEach((attr) => {
        next.setAttribute(attr.name, attr.value);
      });
      while (block.firstChild) next.appendChild(block.firstChild);
      block.replaceWith(next);
      return next;
    };

    const applyHeadingTag = (tagName) => {
      if (!editor) return;
      editor.focus();
      restoreSelection();
      const range = getRangeInEditor();
      if (!range) return;

      const blocks = [];
      const blockSet = new Set();
      const addBlock = (node) => {
        const block = findBlockNode(node);
        if (!block || blockSet.has(block)) return;
        blockSet.add(block);
        blocks.push(block);
      };

      addBlock(range.startContainer);
      addBlock(range.endContainer);

      if (!range.collapsed) {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ELEMENT, {
          acceptNode(node) {
            if (!BLOCK_TAGS.has(node.tagName?.toLowerCase?.())) return NodeFilter.FILTER_SKIP;
            return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          },
        });
        let node = walker.nextNode();
        while (node) {
          addBlock(node);
          node = walker.nextNode();
        }
      }

      if (!blocks.length) {
        const fallback = document.createElement(tagName);
        fallback.textContent = '\u00a0';
        range.insertNode(fallback);
        selectNodeContents(fallback, true);
        return;
      }

      const renamed = blocks.map((block) => renameBlockTag(block, tagName));
      selectNodeContents(renamed[renamed.length - 1], true);
      saveSelection();
    };

    const normalizeColorSpans = () => {
      if (!editor) return;
      editor.querySelectorAll('span[data-color]').forEach((span) => {
        const color = String(span.getAttribute('data-color') || '').trim();
        if (!TRAINING_ALLOWED_COLORS.has(color)) {
          while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
          span.remove();
          return;
        }
        if (!span.textContent || !span.textContent.trim()) {
          span.remove();
          return;
        }
        const parent = span.parentElement;
        if (parent?.matches('span[data-color]') && parent.getAttribute('data-color') === color) {
          while (span.firstChild) parent.insertBefore(span.firstChild, span);
          span.remove();
        }
      });
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

    editor?.addEventListener('keyup', saveSelection);
    editor?.addEventListener('mouseup', saveSelection);
    editor?.addEventListener('input', saveSelection);

    app.querySelectorAll('[data-rich-cmd]').forEach((button) => {
      button.addEventListener('click', () => applyCmd(button.dataset.richCmd));
    });

    app.querySelectorAll('[data-rich-block]').forEach((button) => {
      button.addEventListener('click', () => {
        const tagName = String(button.dataset.richBlock || '').toLowerCase();
        if (!['h2', 'h3'].includes(tagName)) return;
        applyHeadingTag(tagName);
      });
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
        editor?.focus();
        restoreSelection();
        const range = getRangeInEditor();
        if (!range) return;
        const span = document.createElement('span');
        span.setAttribute('data-color', color);
        if (range.collapsed) {
          span.textContent = 'text';
        } else {
          span.appendChild(range.extractContents());
        }
        range.insertNode(span);
        selectNodeContents(span, true);
        normalizeColorSpans();
      });
    });

    app.querySelector('[data-rich-color-reset]')?.addEventListener('click', () => {
      const raw = selectionText();
      if (!raw) return;
      wrapSelectionWithHtml(escHtml(raw));
    });

    const emojiData = TRAINING_EMOJI_CATEGORIES.map((category) => ({
      ...category,
      items: category.items.map(([emoji, keywords]) => ({
        emoji,
        keywords: keywords || [],
      })),
    }));
    const emojiLookup = emojiData.reduce((map, category) => {
      category.items.forEach((entry) => {
        if (!map.has(entry.emoji)) map.set(entry.emoji, new Set());
        entry.keywords.forEach((word) => map.get(entry.emoji).add(String(word || '').toLowerCase()));
        map.get(entry.emoji).add(category.key);
        map.get(entry.emoji).add(category.label.toLowerCase());
      });
      return map;
    }, new Map());
    let activeEmojiCategory = 'frequent';

    const renderEmojiPanel = (searchTerm = '') => {
      if (!emojiPopover) return;
      const panel = emojiPopover.querySelector('.training-emoji-popover__panel');
      const query = String(searchTerm || '').trim().toLowerCase();
      if (!panel) return;
      const category = emojiData.find((item) => item.key === activeEmojiCategory) || emojiData[0];
      const baseItems = category?.items || [];
      const list = query
        ? [...emojiLookup.entries()]
            .filter(([emoji, words]) => emoji.includes(query) || [...words].some((word) => word.includes(query)))
            .map(([emoji]) => emoji)
        : baseItems.map((item) => item.emoji);
      panel.innerHTML = list.length
        ? list.map((emoji) => `<button type="button" class="training-emoji-popover__item" data-emoji="${emoji}" aria-label="Insert ${emoji}">${emoji}</button>`).join('')
        : '<div class="training-emoji-popover__empty">No emoji found.</div>';
      panel.querySelectorAll('[data-emoji]').forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
      });
    };

    const renderEmojiTabs = () => {
      if (!emojiPopover) return;
      const tabs = emojiPopover.querySelector('.training-emoji-popover__tabs');
      if (!tabs) return;
      tabs.innerHTML = emojiData.map((category) => `<button type="button" class="training-emoji-popover__tab ${category.key === activeEmojiCategory ? 'is-active' : ''}" data-emoji-tab="${category.key}">${category.label}</button>`).join('');
    };

    const buildEmojiPopover = () => {
      if (emojiPopover) return emojiPopover;
      const pop = document.createElement('div');
      pop.className = 'training-emoji-popover';
      pop.hidden = true;
      pop.innerHTML = `
        <input type="search" class="df-input training-emoji-popover__search" placeholder="Search emoji" aria-label="Search emoji">
        <div class="training-emoji-popover__tabs"></div>
        <div class="training-emoji-popover__panel"></div>
      `;
      document.body.appendChild(pop);
      emojiPopover = pop;
      renderEmojiTabs();
      renderEmojiPanel('');
      return pop;
    };

    const positionEmojiPopover = () => {
      if (!emojiPopover || !emojiToggleBtn) return;
      const rect = emojiToggleBtn.getBoundingClientRect();
      emojiPopover.hidden = false;
      const popRect = emojiPopover.getBoundingClientRect();
      const gap = 8;
      const maxLeft = window.innerWidth - popRect.width - gap;
      const left = Math.min(Math.max(gap, rect.left), Math.max(gap, maxLeft));
      let top = rect.bottom + gap;
      if (top + popRect.height > window.innerHeight - gap) {
        top = Math.max(gap, rect.top - popRect.height - gap);
      }
      emojiPopover.style.left = `${left}px`;
      emojiPopover.style.top = `${top}px`;
    };

    const onDocKeydown = (event) => {
      if (event.key === 'Escape') togglePopover(false);
    };

    const onDocClick = (event) => {
      if (!emojiPopover || emojiPopover.hidden) return;
      if (emojiPopover.contains(event.target) || emojiToggleBtn?.contains(event.target)) return;
      togglePopover(false);
    };

    const onEmojiSearch = (event) => {
      renderEmojiPanel(event.target.value || '');
    };

    emojiToggleBtn?.addEventListener('click', () => {
      saveSelection();
      const nextOpen = !emojiPopover || emojiPopover.hidden;
      togglePopover(nextOpen);
    });

    const togglePopover = (show) => {
      if (!emojiToggleBtn) return;
      const open = Boolean(show);
      const pop = buildEmojiPopover();
      pop.hidden = !open;
      emojiToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) return;
      positionEmojiPopover();
      pop.querySelector('.training-emoji-popover__search')?.focus();
    };

    const onPopoverClick = (event) => {
      const tab = event.target.closest('[data-emoji-tab]');
      if (tab) {
        activeEmojiCategory = String(tab.dataset.emojiTab || 'frequent');
        renderEmojiTabs();
        const q = emojiPopover?.querySelector('.training-emoji-popover__search')?.value || '';
        renderEmojiPanel(q);
        return;
      }
      const button = event.target.closest('[data-emoji]');
      if (!button) return;
      insertTextAtRange(button.dataset.emoji || '');
      togglePopover(false);
    };

    const pop = buildEmojiPopover();
    pop.addEventListener('click', onPopoverClick);
    pop.querySelector('.training-emoji-popover__search')?.addEventListener('input', onEmojiSearch);
    document.addEventListener('keydown', onDocKeydown);
    document.addEventListener('click', onDocClick);
    window.addEventListener('resize', positionEmojiPopover);

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
      const urlInput = app.querySelector('[name="youtube_url"]');
      const rawUrl = urlInput?.value.trim();
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
      payload.source_type = 'youtube';
      payload.url = String(payload.youtube_url || '').trim();
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

    this._cleanupEditorHooks = () => {
      document.removeEventListener('keydown', onDocKeydown);
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('resize', positionEmojiPopover);
      emojiPopover?.remove();
      emojiPopover = null;
    };
  },
};
