window.Pages = window.Pages || {};

const CHART_ROWS = [
  { label: 'C', root: 'C' },
  { label: 'C#/Db', root: 'C#' },
  { label: 'D', root: 'D' },
  { label: 'D#/Eb', root: 'D#' },
  { label: 'E', root: 'E' },
  { label: 'F', root: 'F' },
  { label: 'F#/Gb', root: 'F#' },
  { label: 'G', root: 'G' },
  { label: 'G#/Ab', root: 'G#' },
  { label: 'A', root: 'A' },
  { label: 'A#/Bb', root: 'A#' },
  { label: 'B', root: 'B' },
];

Pages.ChordChart = {
  render() {
    const app = document.getElementById('app');
    const typeOrder = window.FF_CHORD_TYPES.map((type) => type.id);

    app.innerHTML = `
      <div class="page-hero page-hero--img vert-texture" style="background-image:url('https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1200&q=80');">
        <div class="page-hero__inner">
          <div class="page-title">Chord Chart</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a href="#/tools" class="df-btn df-btn--outline">← Tools</a>
            <button class="df-btn df-btn--outline" id="print-view-toggle">Print View</button>
          </div>
        </div>
        <div class="fret-line"></div>
      </div>

      <div class="page-wrap" style="padding:28px 24px 60px;display:grid;gap:16px;">
        ${window.renderHelpCard({
          title: 'Master chart usage',
          description: 'Use this as a poster-style reference. Each row is one root note, each column is one chord type.',
          bullets: ['Rendered in playing orientation: low E at bottom, high e at top.', 'String labels are shown once on the first column to keep layout clean.', 'Use Print View for white background handouts.'],
          storageKey: 'df_help_tool_chord_chart',
        })}

        <div class="chord-chart-wrap">
          <div class="chord-chart-header">
            <div class="chord-chart-root">Root</div>
            ${window.FF_CHORD_TYPES.map((type) => `<div class="chord-chart-col">${type.label}</div>`).join('')}
          </div>
          <div id="chart-rows"></div>
        </div>
      </div>
    `;

    this._bind(app, typeOrder);
  },

  _bind(container, typeOrder) {
    window.bindHelpCards(container);
    const rowsHost = container.querySelector('#chart-rows');
    const printBtn = container.querySelector('#print-view-toggle');
    const leftHanded = window.Utils?.isLeftHanded?.() || false;

    let renderIndex = 0;
    const renderChunk = () => {
      const chunkSize = 2;
      const slice = CHART_ROWS.slice(renderIndex, renderIndex + chunkSize);
      if (!slice.length) return;

      const html = slice.map((row) => `
        <div class="chord-chart-row">
          <div class="chord-chart-root">${row.label}</div>
          ${typeOrder.map((typeId, idx) => {
            const shape = window.FF_getChordShape(row.root, typeId);
            return `
              <div class="chord-chart-cell">
                <div class="chord-chart-name">${shape ? shape.name : `${row.root}${typeId}`}</div>
                ${window.renderChordSvg(shape, { leftHanded, showStringLabels: idx === 0, height: 130, markerRadius: 5 })}
              </div>
            `;
          }).join('')}
        </div>
      `).join('');

      rowsHost.insertAdjacentHTML('beforeend', html);
      renderIndex += chunkSize;

      if (renderIndex < CHART_ROWS.length) {
        window.requestAnimationFrame(renderChunk);
      }
    };

    renderChunk();

    printBtn.addEventListener('click', () => {
      document.body.classList.toggle('print-view');
      printBtn.textContent = document.body.classList.contains('print-view') ? 'Exit Print View' : 'Print View';
    });
  },
};
