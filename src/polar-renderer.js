/**
 * Draw a polar grid (image inside a circle + radial/concentric grid overlay)
 * at an arbitrary canvas position, radius, and rotation.
 */

import { getColorMode } from './colors.js';

export function drawPolarAt(ctx, cx, cy, radius, mediaElement, polarConfig, rotation = 0) {
  if (radius <= 0) return;
  const {
    radialLines = 24,
    rings = 8,
    lineThickness = 1,
    showLabels = false,
    gridOpacity = 0.8,
    mask = false,
  } = polarConfig || {};

  const bwMode = getColorMode() === 'bw';

  // Circle background
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = bwMode ? '#ffffff' : '#000000';
  ctx.fill();
  ctx.restore();

  // Image + grid rotate together inside the circle clip.
  // Scale-to-cover uses the bounding-rect of the rotated circle, so rotation
  // never reveals an empty corner.
  if (mediaElement) {
    const mw = mediaElement.videoWidth || mediaElement.naturalWidth || mediaElement.width;
    const mh = mediaElement.videoHeight || mediaElement.naturalHeight || mediaElement.height;
    if (mw && mh) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      const scale = Math.max((radius * 2) / mw, (radius * 2) / mh);
      const dw = mw * scale;
      const dh = mh * scale;
      ctx.drawImage(mediaElement, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  // Grid (rotated)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  const gridColor = bwMode ? '#000000' : '#ffffff';
  ctx.strokeStyle = gridColor;
  ctx.fillStyle = gridColor;
  ctx.globalAlpha = gridOpacity;
  ctx.lineWidth = lineThickness;
  if (mask) ctx.globalCompositeOperation = 'destination-out';

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

  // Degree labels (rotate with grid)
  if (showLabels && radialLines > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.globalCompositeOperation = 'source-over';
    const fontSize = Math.max(8, Math.min(18, radius / 25));
    ctx.font = `${fontSize}px 'OffBit', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = gridColor;
    const labelR = radius + fontSize * 0.9;
    for (let i = 0; i < radialLines; i++) {
      const frac = i / radialLines;
      const angle = frac * Math.PI * 2 - Math.PI / 2;
      const deg = Math.round(frac * 360);
      ctx.fillText(String(deg), Math.cos(angle) * labelR, Math.sin(angle) * labelR);
    }
    ctx.restore();
  }
}
