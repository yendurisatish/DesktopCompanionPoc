#!/usr/bin/env node
// Turns a green-screen video (or a still image) into a transparent WebM clip the companion can play.
//
//   node tools/make-clip.js <input> <motion-name> [options]
//
//   --key <color|none>     chroma-key color (default 0x00FF00); "none" if the input already has alpha
//   --similarity <0-1>     how close to the key color counts as background (default 0.28)
//   --blend <0-1>          edge softness (default 0.08)
//   --start <seconds>      trim: start time
//   --duration <seconds>   trim: length (for a still image: how long the clip lasts, default 2)
//   --height <px>          output height (default 600)
//   --out-dir <dir>        default assets/character
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let ffmpeg = 'ffmpeg';
try {
  ffmpeg = require('ffmpeg-static');
} catch {
  // fall back to an ffmpeg on PATH
}

const positional = [];
const opts = { key: '0x00FF00', similarity: '0.28', blend: '0.08', height: '600', 'out-dir': path.join(__dirname, '..', 'assets', 'character') };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const [input, name] = positional;
if (!input || !name) {
  console.error('Usage: node tools/make-clip.js <input> <motion-name> [--key 0x00FF00|none] [--start s] [--duration s] [--height px]');
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(1);
}

const isImage = /\.(png|jpe?g|webp)$/i.test(input);
const filters = [];
if (opts.key !== 'none') {
  filters.push(`chromakey=${opts.key}:${opts.similarity}:${opts.blend}`);
  if (/^0x00ff00$/i.test(opts.key) || /^green$/i.test(opts.key)) filters.push('despill=type=green');
}
filters.push(`scale=-2:${opts.height}:flags=lanczos`, 'format=yuva420p');

const out = path.join(opts['out-dir'], `${name}.webm`);
fs.mkdirSync(opts['out-dir'], { recursive: true });
const args = [
  '-hide_banner', '-loglevel', 'error', '-y',
  ...(opts.start ? ['-ss', opts.start] : []),
  ...(isImage ? ['-loop', '1', '-t', opts.duration || '2'] : []),
  '-i', input,
  ...(!isImage && opts.duration ? ['-t', opts.duration] : []),
  '-vf', filters.join(','),
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-row-mt', '1',
  '-an', out,
];
const result = spawnSync(ffmpeg, args, { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('ffmpeg failed; see the message above.');
  process.exit(result.status || 1);
}
console.log(`Wrote ${out}`);
console.log(`Add it to assets/character/manifest.json:  "${name}": { "src": "${name}.webm" }`);
