const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function ensureParentDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function statSafe(targetPath) {
  try {
    return fs.statSync(targetPath);
  } catch {
    return null;
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args);
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      return reject(new Error(stderr || `ffmpeg exited ${code}`));
    });
  });
}

async function generateVideoThumbnail({ inputPath, outputPath, outputUrl, seekSeconds = 2 }) {
  if (!inputPath || !outputPath) {
    return { ok: false, skipped: true, error: 'input and output paths are required' };
  }
  const inputStat = statSafe(inputPath);
  if (!inputStat || !inputStat.isFile()) {
    return { ok: false, skipped: true, error: 'input file missing' };
  }

  const outputStat = statSafe(outputPath);
  if (outputStat && outputStat.mtimeMs >= inputStat.mtimeMs) {
    return { ok: true, skipped: true, thumbnailUrl: outputUrl || null };
  }

  try {
    ensureParentDir(outputPath);
    const args = [
      '-y',
      '-ss',
      String(Number.isFinite(Number(seekSeconds)) ? Number(seekSeconds) : 2),
      '-i',
      inputPath,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      '-vf',
      'scale=640:-1',
      outputPath,
    ];
    await runFfmpeg(args);
    return { ok: true, skipped: false, thumbnailUrl: outputUrl || null };
  } catch (error) {
    return { ok: false, skipped: false, error: error.message || String(error) };
  }
}

module.exports = { generateVideoThumbnail };
