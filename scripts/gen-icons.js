#!/usr/bin/env node
// Daily Fret — Icon Generator
// Generates icon-192.png and icon-512.png
// Run: node scripts/gen-icons.js

const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Try to use canvas, fall back to raw PNG generation
let canvas;
try {
  canvas = require('canvas');
} catch (e) {
  console.log('canvas not available — generating minimal PNG files instead');
  generateFallbackIcons();
  process.exit(0);
}

const { createCanvas } = canvas;

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a08';
  ctx.fillRect(0, 0, size, size);

  // Orange accent border
  const bw = size * 0.025;
  ctx.strokeStyle = '#ff6a00';
  ctx.lineWidth = bw;
  ctx.strokeRect(bw / 2, bw / 2, size - bw, size - bw);

  // Guitar pick silhouette (simplified as "DF" text)
  const fontSize = size * 0.38;
  ctx.font = `bold ${fontSize}px Arial Black, Arial, sans-serif`;
  ctx.fillStyle = '#ff6a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Glow effect
  ctx.shadowColor = 'rgba(255,106,0,0.6)';
  ctx.shadowBlur = size * 0.06;
  ctx.fillText('DF', size / 2, size * 0.46);

  // Sub text
  ctx.shadowBlur = 0;
  const subSize = size * 0.08;
  ctx.font = `${subSize}px 'Courier New', monospace`;
  ctx.fillStyle = 'rgba(255,106,0,0.5)';
  ctx.fillText('DAILY FRET', size / 2, size * 0.72);

  // Fret lines decoration
  ctx.strokeStyle = 'rgba(255,106,0,0.15)';
  ctx.lineWidth = 1;
  const lineCount = 8;
  for (let i = 1; i < lineCount; i++) {
    const x = (size / lineCount) * i;
    ctx.beginPath();
    ctx.moveTo(x, size * 0.1);
    ctx.lineTo(x, size * 0.9);
    ctx.stroke();
  }

  return c;
}

try {
  [192, 512].forEach(size => {
    const c = drawIcon(size);
    const buf = c.toBuffer('image/png');
    const outPath = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`Generated ${outPath} (${buf.length} bytes)`);
  });
  console.log('Icons generated successfully.');
} catch (e) {
  console.error('Failed to generate icons:', e.message);
  generateFallbackIcons();
}

// Minimal 1x1 PNG fallback if canvas fails
function generateFallbackIcons() {
  // Minimal valid PNG: 1x1 pixel, dark background
  // This is a hand-crafted minimal PNG
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth, color type, etc.
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x60, 0x00,
    0x00, 0x00, 0x04, 0x00, 0x01, 0xE2, 0x21, 0xBC,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  [192, 512].forEach(size => {
    const outPath = path.join(outDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, minimalPNG);
    console.log(`Generated fallback icon: ${outPath}`);
  });
  console.log('Fallback icons generated. Install "canvas" package for proper icons: npm install canvas');
}
