/**
 * Export the title-card viewport as PNG or SVG.
 * Size is driven by `titlecard.exportSize`. Honors the `bgTransparent` flag.
 */

import { drawTitlecardAt } from './titlecard-renderer.js';
import { getColorMode } from './colors.js';

const FONT_FILES = {
  OffBit: 'fonts/OffBit-Regular.woff2',
  'OffBit-101': 'fonts/OffBit-101.woff2',
  'OffBit-Dot': 'fonts/OffBit-Dot.woff2',
  'OffBit-Bar': 'fonts/OffBit-Bar.woff2',
  OPSPastPerfect: 'fonts/OPSPastPerfect-Regular.woff2',
};

async function downloadCanvas(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTitlecardPNG(config) {
  const tc = config && config.titlecard;
  const size = Math.round(Number(tc && tc.exportSize) || 2048);
  if (!size || size < 1) return;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  // Scale stroke and font sizes proportionally to the export resolution.
  // The viewport renders at ~1024px reference; scale-up keeps the look consistent.
  const scaledCfg = { ...tc, lineThickness: (tc.lineThickness || 1) * (size / 1024) };
  drawTitlecardAt(ctx, cx, cy, radius, scaledCfg);

  await downloadCanvas(canvas, 'domedreaming-titlecard');
}

export async function exportTitlecardSVG(config) {
  const tc = config && config.titlecard;
  const size = Math.round(Number(tc && tc.exportSize) || 2048);
  if (!size || size < 1) return;

  const {
    radialLines = 9,
    rings = 5,
    lineThickness = 1,
    gridOpacity = 1,
    bgTransparent = true,
    texts = [],
    flipX = true,
    flipY = true,
    invertText = true,
  } = tc || {};

  const bw = getColorMode() === 'bw';
  const fg = bw ? '#000000' : '#ffffff';
  const bg = bw ? '#ffffff' : '#000000';

  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 1024;
  const sw = (lineThickness * scale).toFixed(3);
  const radius = size / 2 - (lineThickness * scale) / 2;

  // Embed fonts as base64 so the SVG is self-contained.
  const fontFaces = await Promise.all(
    Object.entries(FONT_FILES).map(async ([name, path]) => {
      try {
        const res = await fetch(path);
        const buf = await res.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        return `@font-face{font-family:"${name}";src:url("data:font/woff2;base64,${b64}") format("woff2");}`;
      } catch {
        return '';
      }
    })
  );

  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`);
  lines.push(`<defs><style>${fontFaces.join('')}</style></defs>`);

  if (!bgTransparent) {
    lines.push(`<circle cx="${cx}" cy="${cy}" r="${(size / 2).toFixed(3)}" fill="${bg}"/>`);
  }

  // Grid
  lines.push(`<g fill="none" stroke="${fg}" stroke-width="${sw}" opacity="${gridOpacity}">`);
  lines.push(`<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(3)}"/>`);
  for (let i = 1; i < rings; i++) {
    const r = ((size / 2) * i) / rings;
    lines.push(`<circle cx="${cx}" cy="${cy}" r="${r.toFixed(3)}"/>`);
  }
  for (let i = 0; i < radialLines; i++) {
    const angle = (i / radialLines) * Math.PI * 2 - Math.PI / 2;
    const x = (cx + Math.cos(angle) * (size / 2)).toFixed(3);
    const y = (cy + Math.sin(angle) * (size / 2)).toFixed(3);
    lines.push(`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`);
  }
  lines.push(`</g>`);

  // Text — when inverting, use white source + mix-blend-mode:difference
  // so the text flips polarity against image cards (matches canvas renderer)
  const textColor = invertText ? '#ffffff' : fg;
  const textGroupAttr = invertText ? ' style="mix-blend-mode:difference"' : '';
  if (texts.some((t) => t && t.content)) {
    lines.push(`<g${textGroupAttr}>`);
    for (const t of texts) {
      if (!t || !t.content) continue;
      appendTextSVG(lines, t, cx, cy, size / 2, rings, radialLines, textColor, flipX, flipY);
    }
    lines.push(`</g>`);
  }

  lines.push(`</svg>`);

  const blob = new Blob([lines.join('\n')], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-titlecard-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

function appendTextSVG(lines, t, cx, cy, radius, rings, numSectors, color, flipX, flipY) {
  const {
    content,
    ring = 1,
    sector: anchorSector = 0,
    fontSize = 100,
    font = 'OffBit',
    cellMode = true,
    charsPerCell = 1,
  } = t;

  const ringStep = radius / rings;
  const r = Math.max(1, Math.min(rings, ring));
  const innerRadius = ringStep * (r - 1);
  const outerRadius = ringStep * r;
  const cellHeight = outerRadius - innerRadius;
  const midRadius = innerRadius + cellHeight * 0.5;

  const sectorAngle = (2 * Math.PI) / numSectors;
  const cpc = Math.max(1, charsPerCell || 1);
  const charAngle = sectorAngle / cpc;
  const fontScale = cpc > 1 ? 1 / cpc : 1;
  const px = (cellHeight * fontSize / 100) * 0.8 * Math.min(1, fontScale * 1.5);

  const direction = flipX ? -1 : 1;
  const chars = content.split('');

  if (cellMode) {
    // anchorSector is the *center* of the text — extend symmetrically.
    const cellCount = Math.max(1, Math.ceil(chars.length / cpc));
    const startSector = anchorSector - direction * (cellCount - 1) / 2;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === ' ') continue;
      const cellIndex = Math.floor(i / cpc);
      const posInCell = i % cpc;
      const rawSector = startSector + cellIndex * direction;
      const sectorIndex = ((Math.round(rawSector) % numSectors) + numSectors) % numSectors;
      const subOffset = (posInCell + 0.5) * charAngle - sectorAngle / 2;
      const angle = sectorIndex * sectorAngle - Math.PI / 2 + sectorAngle / 2 + subOffset * direction;
      emitChar(lines, ch, cx, cy, midRadius, angle, px, font, color, flipY);
    }
  } else {
    const arcRadius = midRadius;
    const anchorAngle = (anchorSector / numSectors) * Math.PI * 2 - Math.PI / 2;
    const letterSpacing = 0.08;
    const totalAngle = chars.length * letterSpacing;
    let angle = anchorAngle - (totalAngle / 2) * direction;
    for (const ch of chars) {
      emitChar(lines, ch, cx, cy, arcRadius, angle, px, font, color, flipY);
      angle += letterSpacing * direction;
    }
  }
}

function emitChar(lines, ch, cx, cy, radius, angle, px, font, color, flipY) {
  const x = cx + Math.cos(angle) * radius;
  const y = cy + Math.sin(angle) * radius;
  let rot = (angle + Math.PI / 2) * 180 / Math.PI;
  if (flipY) rot += 180;
  const safe = ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  lines.push(
    `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-family="'${font}',monospace" font-size="${px.toFixed(2)}" fill="${color}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot.toFixed(2)} ${x.toFixed(3)} ${y.toFixed(3)})">${safe}</text>`
  );
}

function arrayBufferToBase64(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
