window.ManualMarkdown = {
  slugifyTitle(title) {
    return String(title || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  },

  escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  inline(text) {
    if (!text) return '';
    let s = this.escapeHtml(text);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t) => `<a href="#/manual/${this.slugifyTitle(t)}">${t}</a>`);
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return s;
  },

  render(md) {
    const blocks = this._extractBlocks(md);
    let html = '';

    for (const block of blocks) {
      if (block.type === 'hotspots') {
        html += this.renderHotspots(block.data);
        continue;
      }
      if (block.type === 'callout') {
        html += `<div class="manual-callout manual-callout--${block.kind}">${this.inline(block.body)}</div>`;
        continue;
      }

      const lines = block.text.split('\n');
      let inList = false;
      for (const lineRaw of lines) {
        const line = lineRaw.trim();
        if (!line) {
          if (inList) { html += '</ul>'; inList = false; }
          continue;
        }

        if (line.startsWith('# ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h1>${this.inline(line.slice(2))}</h1>`;
        } else if (line.startsWith('## ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h2>${this.inline(line.slice(3))}</h2>`;
        } else if (/^\d+\.\s+/.test(line)) {
          if (!inList) { html += '<ol>'; inList = 'ol'; }
          else if (inList !== 'ol') { html += '</ul><ol>'; inList = 'ol'; }
          html += `<li>${this.inline(line.replace(/^\d+\.\s+/, ''))}</li>`;
        } else if (line.startsWith('- ')) {
          if (!inList) { html += '<ul>'; inList = 'ul'; }
          else if (inList !== 'ul') { html += '</ol><ul>'; inList = 'ul'; }
          html += `<li>${this.inline(line.slice(2))}</li>`;
        } else {
          if (inList === 'ul') { html += '</ul>'; inList = false; }
          if (inList === 'ol') { html += '</ol>'; inList = false; }
          html += `<p>${this.inline(line)}</p>`;
        }
      }
      if (inList === 'ul') html += '</ul>';
      if (inList === 'ol') html += '</ol>';
    }

    return html;
  },

  _extractBlocks(md) {
    const blocks = [];
    let text = md;

    text = text.replace(/:::([a-zA-Z]+)\n([\s\S]*?):::/g, (_, kind, body) => {
      blocks.push({ type: 'callout', kind: kind.toLowerCase(), body: body.trim() });
      return `\n@@BLOCK_${blocks.length - 1}@@\n`;
    });

    text = text.replace(/```hotspots\n([\s\S]*?)```/g, (_, json) => {
      let data = null;
      try { data = JSON.parse(json); } catch { data = null; }
      blocks.push({ type: 'hotspots', data });
      return `\n@@BLOCK_${blocks.length - 1}@@\n`;
    });

    return text.split(/@@BLOCK_(\d+)@@/).filter(Boolean).map((chunk, i) => {
      if (i % 2 === 1) return blocks[parseInt(chunk, 10)];
      return { type: 'markdown', text: chunk };
    });
  },

  renderHotspots(data) {
    if (!data || !data.image || !Array.isArray(data.points)) {
      return '<div class="manual-error">Invalid hotspots block.</div>';
    }

    const points = data.points
      .map(p => `<button type="button" class="manual-hotspot-dot" data-target="callout-${p.n}" style="left:${p.x}%;top:${p.y}%">${p.n}</button>`)
      .join('');

    const list = data.points
      .map(p => `<li id="callout-${p.n}"><strong>${p.n}. ${this.inline(p.title || '')}</strong><span>${this.inline(p.text || '')}</span></li>`)
      .join('');

    return `
      <div class="manual-hotspots" data-hotspots>
        <div class="manual-hotspots__image-wrap">
          <img src="${data.image}" alt="Manual diagram" class="manual-hotspots__image">
          ${points}
        </div>
        <ol class="manual-hotspots__list">${list}</ol>
      </div>
    `;
  },

  bindHotspots(container) {
    container.querySelectorAll('.manual-hotspot-dot[data-target]').forEach(dot => {
      dot.addEventListener('click', () => {
        const target = container.querySelector(`#${dot.dataset.target}`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('manual-hotspots__item--active');
        setTimeout(() => target.classList.remove('manual-hotspots__item--active'), 900);
      });
    });
  },
};
