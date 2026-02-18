window.renderChordSvg = function renderChordSvg(shape, options = {}) {
  if (!shape) return '<div style="color:var(--text2);">Chord diagram unavailable.</div>';

  const {
    leftHanded = false,
    showStringLabels = true,
    width = 300,
    height = 250,
    markerRadius = 8,
  } = options;

  const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
  const stringGap = 40;
  const fretGap = 32;
  const leftPad = 44;
  const topPad = 28;

  const numericFrets = shape.frets.filter((f) => typeof f === 'number' && f > 0);
  const minFret = numericFrets.length ? Math.min(...numericFrets) : 1;
  const maxFret = numericFrets.length ? Math.max(...numericFrets) : 4;
  const baseFret = minFret > 4 ? minFret : 1;
  const fretCount = Math.max(4, Math.min(5, maxFret - baseFret + 2));

  const yForStringIndex = (stringIdx) => topPad + (5 - stringIdx) * fretGap;
  const xForFret = (fretValue) => leftPad + (fretValue - baseFret + 0.5) * stringGap;

  const stringLines = strings.map((_, i) => {
    const y = yForStringIndex(i);
    return `<line x1="${leftPad}" y1="${y}" x2="${leftPad + stringGap * fretCount}" y2="${y}" stroke="var(--line2)" stroke-width="2" />`;
  }).join('');

  const fretLines = Array.from({ length: fretCount + 1 }, (_, i) => {
    const x = leftPad + i * stringGap;
    const thickness = i === 0 && baseFret === 1 ? 4 : 2;
    return `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + fretGap * 5}" stroke="var(--line2)" stroke-width="${thickness}" />`;
  }).join('');

  const markers = shape.frets.map((fret, i) => {
    const stringIndex = leftHanded ? 5 - i : i;
    const y = yForStringIndex(stringIndex);

    if (fret === 'x') return `<text x="20" y="${y + 4}" text-anchor="middle" fill="var(--text2)" font-size="13">X</text>`;
    if (fret === 0) return `<text x="20" y="${y + 4}" text-anchor="middle" fill="var(--text2)" font-size="13">O</text>`;
    return `<circle cx="${xForFret(fret)}" cy="${y}" r="${markerRadius}" fill="var(--accent)" />`;
  }).join('');

  const labels = showStringLabels
    ? strings.map((name, i) => `<text x="${leftPad - 18}" y="${yForStringIndex(i) + 4}" text-anchor="middle" fill="var(--text3)" font-size="12">${name}</text>`).join('')
    : '';

  const fretLabel = baseFret > 1
    ? `<text x="${leftPad + stringGap * fretCount + 8}" y="${topPad + 12}" fill="var(--text3)" font-size="11">${baseFret}fr</text>`
    : '';

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${shape.name} chord diagram">
      ${stringLines}
      ${fretLines}
      ${markers}
      ${labels}
      ${fretLabel}
    </svg>
  `;
};
