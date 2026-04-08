/**
 * High-resolution PNG export for the 2D unwrap view.
 * Matches the on-screen render exactly.
 */

import { drawFaceMedia, computeUVs } from './media.js';
import { getCellImages, drawCoverFit } from './grid-preview.js';

// Match viewport-2d.js palette exactly
const colorPalette = Array.from({ length: 20 }, (_, i) => {
  const hue = (i / 20) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

function prepareMediaSource(mediaElement) {
  if (mediaElement && mediaElement.tagName === 'VIDEO') {
    const vidW = mediaElement.videoWidth;
    const vidH = mediaElement.videoHeight;
    if (vidW && vidH) {
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = vidW;
      frameCanvas.height = vidH;
      frameCanvas.getContext('2d').drawImage(mediaElement, 0, 0);
      return frameCanvas;
    }
  }
  return mediaElement;
}

function renderUnwrapToCanvas(ctx, unwrapData, config, mediaSource, mesh, width, height) {
  const padding = Math.min(width, height) * 0.05;
  const { bounds } = unwrapData;
  if (bounds.width === 0 || bounds.height === 0) return;

  const scaleX = (width - padding * 2) / bounds.width;
  const scaleY = (height - padding * 2) / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  let mediaUVs = null;
  if (mediaSource && mesh) {
    mediaUVs = computeUVs(mesh.vertices, mesh.faces);
  }

  const lineWidth = config.wireframe?.lineWidth ?? 0.5;
  const lineColor = config.wireframe?.lineColor ?? '#222';

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  for (const face of unwrapData.faces2D) {
    const [[x0, y0], [x1, y1], [x2, y2]] = face.vertices;
    const colorIndex = face.groupId % colorPalette.length;

    let mediaDrawn = false;
    if (mediaSource && mediaUVs && face.faceIndex != null) {
      const fi = face.faceIndex;
      const uvOffset = fi * 3 * 2;
      if (uvOffset + 5 < mediaUVs.length) {
        const faceUVArray = [
          [mediaUVs[uvOffset], mediaUVs[uvOffset + 1]],
          [mediaUVs[uvOffset + 2], mediaUVs[uvOffset + 3]],
          [mediaUVs[uvOffset + 4], mediaUVs[uvOffset + 5]],
        ];
        ctx.save();
        drawFaceMedia(ctx, face.vertices, mediaSource, faceUVArray);
        ctx.restore();
        mediaDrawn = true;
      }
    }

    if (!mediaDrawn) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fillStyle = colorPalette[colorIndex];
      ctx.fill();
    }

    // Wireframe
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth / scale;
    ctx.stroke();
  }

  ctx.restore();
}

export async function exportPNG(unwrapData, config, mediaElement, mesh) {
  if (!unwrapData) return;

  const { width, height } = config.export;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Dark background matching the site (skip if transparent)
  if (!config.export.transparent) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
  }

  const mediaSource = prepareMediaSource(mediaElement);
  renderUnwrapToCanvas(ctx, unwrapData, config, mediaSource, mesh, width, height);

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportGridPNGs(unwrapData, config, mediaElement, mesh) {
  if (!unwrapData) return;

  const cols = 3;
  const rows = config.grid?.rows ?? 3;
  const cellW = 1080;
  const cellH = 1350;
  const totalW = cols * cellW;
  const totalH = rows * cellH;

  const { bounds } = unwrapData;
  if (bounds.width === 0 || bounds.height === 0) return;

  const lineWidth = config.wireframe?.lineWidth ?? 0.5;
  const lineColor = config.wireframe?.lineColor ?? '#222';
  const patternScale = config.grid?.patternScale ?? 1;
  const userOffsetX = config.grid?.offsetX ?? 0;
  const userOffsetY = config.grid?.offsetY ?? 0;
  const images = getCellImages();

  // Fit unwrap to full grid, then apply user scale
  const baseScaleX = totalW / bounds.width;
  const baseScaleY = totalH / bounds.height;
  const baseScale = Math.min(baseScaleX, baseScaleY);
  const scale = baseScale * patternScale;

  const offsetX = (totalW - bounds.width * scale) / 2 - bounds.minX * scale + userOffsetX * totalW;
  const offsetY = (totalH - bounds.height * scale) / 2 - bounds.minY * scale + userOffsetY * totalH;

  // Render full grid onto big canvas
  const bigCanvas = document.createElement('canvas');
  bigCanvas.width = totalW;
  bigCanvas.height = totalH;
  const bigCtx = bigCanvas.getContext('2d');

  for (const face of unwrapData.faces2D) {
    const [[x0, y0], [x1, y1], [x2, y2]] = face.vertices;

    const sx0 = offsetX + x0 * scale;
    const sy0 = offsetY + y0 * scale;
    const sx1 = offsetX + x1 * scale;
    const sy1 = offsetY + y1 * scale;
    const sx2 = offsetX + x2 * scale;
    const sy2 = offsetY + y2 * scale;

    const cx = (sx0 + sx1 + sx2) / 3;
    const cy = (sy0 + sy1 + sy2) / 3;
    const col = Math.floor(cx / cellW);
    const row = Math.floor(cy / cellH);
    const cellKey = `${row + 1},${col + 1}`;
    const cellImg = images.get(cellKey);

    if (cellImg) {
      bigCtx.save();
      bigCtx.beginPath();
      bigCtx.moveTo(sx0, sy0);
      bigCtx.lineTo(sx1, sy1);
      bigCtx.lineTo(sx2, sy2);
      bigCtx.closePath();
      bigCtx.clip();
      drawCoverFit(bigCtx, cellImg, col * cellW, row * cellH, cellW, cellH);
      bigCtx.restore();
    } else {
      const colorIndex = face.groupId % colorPalette.length;
      bigCtx.beginPath();
      bigCtx.moveTo(sx0, sy0);
      bigCtx.lineTo(sx1, sy1);
      bigCtx.lineTo(sx2, sy2);
      bigCtx.closePath();
      bigCtx.fillStyle = colorPalette[colorIndex];
      bigCtx.fill();
    }

    bigCtx.beginPath();
    bigCtx.moveTo(sx0, sy0);
    bigCtx.lineTo(sx1, sy1);
    bigCtx.lineTo(sx2, sy2);
    bigCtx.closePath();
    bigCtx.strokeStyle = lineColor;
    bigCtx.lineWidth = lineWidth;
    bigCtx.stroke();
  }

  // Slice into cells and download
  const totalCells = rows * cols;
  const pad = String(totalCells).length;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellIndex = row * cols + col + 1;
      const cellCanvas = document.createElement('canvas');
      cellCanvas.width = cellW;
      cellCanvas.height = cellH;
      const cellCtx = cellCanvas.getContext('2d');

      cellCtx.drawImage(
        bigCanvas,
        col * cellW, row * cellH, cellW, cellH,
        0, 0, cellW, cellH,
      );

      const blob = await new Promise((r) => cellCanvas.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `domedreaming-grid-${String(cellIndex).padStart(pad, '0')}.png`;
      a.click();
      URL.revokeObjectURL(url);

      if (cellIndex < totalCells) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
}
