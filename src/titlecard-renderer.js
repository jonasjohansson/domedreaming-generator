/**
 * Title-card renderer — polar grid + curved text.
 * Text is laid out in cells (each character occupies one sector slot on a ring),
 * or along a smooth arc with letter spacing in radians.
 */

import { getColorMode } from './colors.js';

export function drawTitlecardAt(ctx, cx, cy, radius, config) {
  if (radius <= 0) return;
  const {
    radialLines = 9,
    rings = 5,
    lineThickness = 2,
    gridOpacity = 1,
    bgTransparent = false,
    texts = [],
  } = config || {};

  const bw = getColorMode() === 'bw';
  const fg = bw ? '#000000' : '#ffffff';
  const bg = bw ? '#ffffff' : '#000000';

  if (!bgTransparent) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  ctx.globalAlpha = gridOpacity;
  ctx.lineWidth = lineThickness;

  for (let i = 1; i <= rings; i++) {
    const r = (radius * i) / rings;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < radialLines; i++) {
    const angle = (i / radialLines) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 1;
  for (const t of texts) {
    if (!t || !t.content) continue;
    drawTextOnRing(ctx, cx, cy, radius, rings, radialLines, t, fg);
  }
  ctx.restore();
}

function drawTextOnRing(ctx, cx, cy, radius, rings, numSectors, t, color) {
  const {
    content,
    ring = 1,
    sector: startSector = 0,
    fontSize = 100,
    font = 'OffBit',
    cellMode = true,
    charsPerCell = 1,
    flipX = false,
    flipY = false,
  } = t;

  const ringStep = radius / rings;
  const r = Math.max(1, Math.min(rings, ring));

  if (cellMode) {
    drawTextInCells(ctx, content, cx, cy, ringStep, r, startSector, numSectors, fontSize, color, flipX, flipY, charsPerCell, font);
  } else {
    const arcRadius = ringStep * (r - 0.5);
    const startAngle = (startSector / numSectors) * Math.PI * 2 - Math.PI / 2;
    const cellSize = ringStep;
    const px = (cellSize * fontSize) / 100 * 0.7;
    drawTextOnArc(ctx, content, cx, cy, arcRadius, startAngle, px, color, 0.08, flipX, flipY, font);
  }
}

function drawTextInCells(ctx, text, cx, cy, ringStep, row, startSector, numSectors, fontSizePercent, color, flipX, flipY, charsPerCell, font) {
  const chars = text.split('');
  const cpc = Math.max(1, charsPerCell || 1);

  const innerRadius = ringStep * (row - 1);
  const outerRadius = ringStep * row;
  const cellHeight = outerRadius - innerRadius;
  const midRadius = innerRadius + cellHeight * 0.5;

  const sectorAngle = (2 * Math.PI) / numSectors;
  const charAngle = sectorAngle / cpc;

  const fontScale = cpc > 1 ? 1 / cpc : 1;
  const px = (cellHeight * fontSizePercent / 100) * 0.8 * Math.min(1, fontScale * 1.5);

  ctx.font = `${px}px '${font}', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;

  const direction = flipX ? -1 : 1;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') continue;

    const cellIndex = Math.floor(i / cpc);
    const posInCell = i % cpc;
    const sectorIndex = ((startSector + cellIndex * direction) % numSectors + numSectors) % numSectors;
    const subOffset = (posInCell + 0.5) * charAngle - sectorAngle / 2;
    const angle = sectorIndex * sectorAngle - Math.PI / 2 + sectorAngle / 2 + subOffset * direction;

    const x = cx + Math.cos(angle) * midRadius;
    const y = cy + Math.sin(angle) * midRadius;

    ctx.save();
    ctx.translate(x, y);
    let rot = angle + Math.PI / 2;
    if (flipY) rot += Math.PI;
    ctx.rotate(rot);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
}

function drawTextOnArc(ctx, text, cx, cy, radius, startAngle, fontSize, color, letterSpacing, flipX, flipY, font) {
  ctx.font = `${fontSize}px '${font}', monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const chars = text.split('');
  const totalAngle = chars.length * letterSpacing;
  const direction = flipX ? -1 : 1;
  let angle = startAngle - (totalAngle / 2) * direction;

  for (const ch of chars) {
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.save();
    ctx.translate(x, y);
    let rot = angle + Math.PI / 2;
    if (flipY) rot += Math.PI;
    ctx.rotate(rot);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += letterSpacing * direction;
  }
}
