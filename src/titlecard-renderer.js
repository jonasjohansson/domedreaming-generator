/**
 * Title-card renderer — polar grid + image-card cells + curved text.
 * Image cards are placed randomly within the grid using a seeded RNG so the
 * same {seed, count, image set} produces the same layout every render
 * (viewport and PNG export stay in sync).
 */

import { getColorMode } from './colors.js';
import { getImages, makeRng } from './titlecard-images.js';

export function drawTitlecardAt(ctx, cx, cy, radius, config) {
  if (radius <= 0) return;
  const {
    radialLines = 9,
    rings = 5,
    lineThickness = 2,
    gridOpacity = 1,
    bgTransparent = false,
    imageCards = {},
    texts = [],
    flipX = true,
    flipY = true,
    invertText = true,
  } = config || {};

  const bw = getColorMode() === 'bw';
  const fg = bw ? '#000000' : '#ffffff';
  const bg = bw ? '#ffffff' : '#000000';

  // Background circle
  if (!bgTransparent) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();
  }

  // Image cards (clipped to grid circle)
  if (imageCards && imageCards.enabled !== false) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    drawImageCards(ctx, cx, cy, radius, rings, radialLines, imageCards);
    ctx.restore();
  }

  // Grid
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

  // Text — when invertText is on, draw with white source + 'difference' op
  // so the text inverts polarity against whatever it overlaps (B&W image
  // cards, grid lines, background). Black image area → white text;
  // white image area → black text.
  ctx.save();
  ctx.globalAlpha = 1;
  const textColor = invertText ? '#ffffff' : fg;
  if (invertText) ctx.globalCompositeOperation = 'difference';
  for (const t of texts) {
    if (!t || !t.content) continue;
    drawTextOnRing(ctx, cx, cy, radius, rings, radialLines, t, textColor, flipX, flipY);
  }
  ctx.restore();
}

function drawImageCards(ctx, cx, cy, radius, rings, numSectors, imageCardsCfg) {
  const images = getImages();
  if (!images.length) return;

  const {
    count = 8,
    seed = 1,
    threshold = false,
    thresholdLevel = 0.5,
    blackToAlpha = false,
  } = imageCardsCfg;

  const rng = makeRng(seed);
  // Shuffle image list deterministically
  const order = images.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const ringStep = radius / rings;
  const sectorAngle = (2 * Math.PI) / numSectors;
  const target = Math.min(count, images.length);
  const used = new Set();

  for (let placed = 0; placed < target;) {
    const imgEntry = images[order[placed % order.length]];
    if (!imgEntry || !imgEntry.img.complete) { placed++; continue; }

    const sizeRoll = rng();
    let ringSpan, sectorSpan;
    if (sizeRoll > 0.7) {
      ringSpan = Math.min(3, rings);
      sectorSpan = 4 + Math.floor(rng() * 2);
    } else if (sizeRoll > 0.4) {
      ringSpan = Math.min(2 + Math.floor(rng() * 2), rings);
      sectorSpan = 3 + Math.floor(rng() * 2);
    } else {
      ringSpan = Math.min(2, rings);
      sectorSpan = 2 + Math.floor(rng() * 2);
    }

    let attempts = 0;
    let success = false;
    while (attempts < 80 && !success) {
      const ring = 1 + Math.floor(rng() * Math.max(1, rings - ringSpan + 1));
      const sector = Math.floor(rng() * numSectors);
      if (ring + ringSpan - 1 > rings) { attempts++; continue; }

      let conflict = false;
      for (let r = 0; r < ringSpan && !conflict; r++) {
        for (let s = 0; s < sectorSpan && !conflict; s++) {
          const k = `${ring + r}-${(sector + s) % numSectors}`;
          if (used.has(k)) conflict = true;
        }
      }
      if (conflict) { attempts++; continue; }

      for (let r = 0; r < ringSpan; r++) {
        for (let s = 0; s < sectorSpan; s++) {
          used.add(`${ring + r}-${(sector + s) % numSectors}`);
        }
      }

      const innerRadius = ringStep * (ring - 1);
      const outerRadius = ringStep * (ring + ringSpan - 1);
      const startAngle = sector * sectorAngle - Math.PI / 2;
      const endAngle = startAngle + sectorSpan * sectorAngle;

      drawImageInCell(ctx, imgEntry.img, cx, cy, innerRadius, outerRadius, startAngle, endAngle, threshold, thresholdLevel, blackToAlpha);

      success = true;
    }
    placed++;
  }
}

function drawImageInCell(ctx, img, cx, cy, innerR, outerR, startAngle, endAngle, applyThreshold, thresholdLevel, blackToAlpha) {
  if (!img || !img.complete || !img.naturalWidth) return;

  ctx.save();

  // Clip to the polar wedge
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, startAngle, endAngle);
  ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
  ctx.closePath();
  ctx.clip();

  const midAngle = (startAngle + endAngle) / 2;
  const midRadius = (innerR + outerR) / 2;
  const cellHeight = outerR - innerR;
  const cellWidth = (endAngle - startAngle) * midRadius;

  const ccx = cx + Math.cos(midAngle) * midRadius;
  const ccy = cy + Math.sin(midAngle) * midRadius;

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const cellAspect = cellWidth / cellHeight;
  let drawW, drawH;
  if (imgAspect > cellAspect) {
    drawH = cellHeight * 1.4;
    drawW = drawH * imgAspect;
  } else {
    drawW = cellWidth * 1.4;
    drawH = drawW / imgAspect;
  }

  ctx.translate(ccx, ccy);
  ctx.rotate(midAngle - Math.PI / 2);
  ctx.scale(1, -1);

  if (applyThreshold) {
    const tempSize = Math.max(drawW, drawH) * 1.5;
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(2, Math.round(tempSize));
    tmp.height = Math.max(2, Math.round(tempSize));
    const tctx = tmp.getContext('2d');
    tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
    const id = tctx.getImageData(0, 0, tmp.width, tmp.height);
    const d = id.data;
    const t = thresholdLevel * 255;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const v = gray > t ? 255 : 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
      if (blackToAlpha && v === 0) d[i + 3] = 0;
    }
    tctx.putImageData(id, 0, 0);
    ctx.drawImage(tmp, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  }

  ctx.restore();
}

function drawTextOnRing(ctx, cx, cy, radius, rings, numSectors, t, color, flipX, flipY) {
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

  if (cellMode) {
    drawTextInCells(ctx, content, cx, cy, ringStep, r, anchorSector, numSectors, fontSize, color, flipX, flipY, charsPerCell, font);
  } else {
    const arcRadius = ringStep * (r - 0.5);
    const anchorAngle = (anchorSector / numSectors) * Math.PI * 2 - Math.PI / 2;
    const cellSize = ringStep;
    const px = (cellSize * fontSize) / 100 * 0.7;
    drawTextOnArc(ctx, content, cx, cy, arcRadius, anchorAngle, px, color, 0.08, flipX, flipY, font);
  }
}

function drawTextInCells(ctx, text, cx, cy, ringStep, row, anchorSector, numSectors, fontSizePercent, color, flipX, flipY, charsPerCell, font) {
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
  // anchorSector is the *center* sector of the text. Compute the start
  // sector so the text extends symmetrically around it. With flipX the
  // text walks counterclockwise, so the start lands on the opposite side.
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
