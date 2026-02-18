window.FF_CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
window.FF_CHORD_ALIASES = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

window.FF_CHORD_TYPES = [
  { id: 'major', label: 'Major', suffix: '' },
  { id: 'minor', label: 'Minor', suffix: 'm' },
  { id: '6', label: '6', suffix: '6' },
  { id: '7', label: '7', suffix: '7' },
  { id: '9', label: '9', suffix: '9' },
  { id: 'm6', label: 'm6', suffix: 'm6' },
  { id: 'm7', label: 'm7', suffix: 'm7' },
  { id: 'maj7', label: 'maj7', suffix: 'maj7' },
  { id: 'dim', label: 'dim', suffix: 'dim' },
  { id: 'aug', label: 'aug', suffix: 'aug' },
  { id: 'sus', label: 'sus', suffix: 'sus4' },
];

const LOW_E_ROOT_FRETS = {
  E: 0, F: 1, 'F#': 2, G: 3, 'G#': 4, A: 5, 'A#': 6, B: 7, C: 8, 'C#': 9, D: 10, 'D#': 11,
};

const MOVABLE_SHAPES = {
  major: [0, 2, 2, 1, 0, 0],
  minor: [0, 2, 2, 0, 0, 0],
  '6': [0, 2, 0, 1, 2, 0],
  '7': [0, 2, 0, 1, 0, 0],
  '9': [0, 2, 0, 1, 0, 2],
  m6: [0, 2, 0, 0, 2, 0],
  m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  dim: [0, 1, 2, 0, 2, 0],
  aug: [0, 3, 2, 1, 1, 0],
  sus: [0, 2, 2, 2, 0, 0],
};

const OPEN_OVERRIDES = {
  C: {
    major: { frets: ['x', 3, 2, 0, 1, 0], fingers: ['x', 3, 2, 0, 1, 0], barre: false },
    minor: { frets: ['x', 3, 5, 5, 4, 3], fingers: ['x', 1, 3, 4, 2, 1], barre: true },
    '7': { frets: ['x', 3, 2, 3, 1, 0], fingers: ['x', 3, 2, 4, 1, 0], barre: false },
  },
  D: {
    major: { frets: ['x', 'x', 0, 2, 3, 2], fingers: ['x', 'x', 0, 1, 3, 2], barre: false },
    minor: { frets: ['x', 'x', 0, 2, 3, 1], fingers: ['x', 'x', 0, 2, 3, 1], barre: false },
    '7': { frets: ['x', 'x', 0, 2, 1, 2], fingers: ['x', 'x', 0, 2, 1, 3], barre: false },
  },
  E: {
    major: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barre: false },
    minor: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barre: false },
    '7': { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], barre: false },
  },
  G: {
    major: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barre: false },
    minor: { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: true },
    '7': { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], barre: false },
  },
  A: {
    major: { frets: ['x', 0, 2, 2, 2, 0], fingers: ['x', 0, 1, 2, 3, 0], barre: false },
    minor: { frets: ['x', 0, 2, 2, 1, 0], fingers: ['x', 0, 2, 3, 1, 0], barre: false },
    '7': { frets: ['x', 0, 2, 0, 2, 0], fingers: ['x', 0, 2, 0, 3, 0], barre: false },
  },
};

function normalizeRoot(root) {
  return window.FF_CHORD_ALIASES[root] || root;
}

function getTypeMeta(type) {
  return (window.FF_CHORD_TYPES || []).find((item) => item.id === type) || { suffix: type };
}

function buildMovableShape(root, type) {
  const normalizedRoot = normalizeRoot(root);
  const rootFret = LOW_E_ROOT_FRETS[normalizedRoot];
  const pattern = MOVABLE_SHAPES[type];
  if (typeof rootFret !== 'number' || !pattern) return null;

  const frets = pattern.map((offset) => rootFret + offset);
  const minPressed = Math.min(...frets.filter((fret) => typeof fret === 'number' && fret > 0));
  const fingers = frets.map((fret) => {
    if (fret === 0) return 0;
    if (fret === minPressed) return 1;
    if (fret === minPressed + 1) return 2;
    if (fret === minPressed + 2) return 3;
    return 4;
  });

  return {
    frets,
    fingers,
    barre: rootFret > 0,
  };
}

window.FF_getChordShape = function FF_getChordShape(root, type) {
  const normalizedRoot = normalizeRoot(root);
  const typeMeta = getTypeMeta(type);
  const openOverride = OPEN_OVERRIDES[normalizedRoot] && OPEN_OVERRIDES[normalizedRoot][type];
  const fallback = buildMovableShape(normalizedRoot, type);
  const shape = openOverride || fallback;

  if (!shape) return null;

  return {
    root: normalizedRoot,
    type,
    name: `${normalizedRoot}${typeMeta.suffix || ''}`,
    frets: shape.frets,
    fingers: shape.fingers || [],
    barre: !!shape.barre,
  };
};
