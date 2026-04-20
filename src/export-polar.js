/**
 * Export the polar viewport as a square PNG — just the circle graphic,
 * transparent outside. Size is driven by `polar.exportSize`, independent
 * of the Export tab's preset dimensions.
 */

import { drawPolarAt } from './polar-renderer.js';

async function downloadCanvas(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPolarPNG(config, mediaElement) {
  const size = Math.round(Number(config.polar && config.polar.exportSize) || 2048);
  if (!size || size < 1) return;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // For video frames, snapshot the current frame so drawImage gets a stable source
  let source = mediaElement;
  if (mediaElement && mediaElement.tagName === 'VIDEO') {
    const vw = mediaElement.videoWidth;
    const vh = mediaElement.videoHeight;
    if (vw && vh) {
      const frame = document.createElement('canvas');
      frame.width = vw; frame.height = vh;
      frame.getContext('2d').drawImage(mediaElement, 0, 0);
      source = frame;
    }
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;
  drawPolarAt(ctx, cx, cy, radius, source, config.polar, 0);

  await downloadCanvas(canvas, 'domedreaming-polar');
}

/**
 * Export just the polar grid lines on a transparent background — for use
 * as a mask in Photoshop. Ignores mask/opacity toggles; draws solid black
 * lines at full alpha so the result is a clean, high-contrast overlay.
 */
export async function exportPolarGridPNG(config) {
  const size = Math.round(Number(config.polar && config.polar.exportSize) || 2048);
  if (!size || size < 1) return;

  const {
    radialLines = 24,
    rings = 8,
    lineThickness = 1,
  } = config.polar || {};

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;
  const scale = size / 1024;

  ctx.translate(cx, cy);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = lineThickness * scale;

  // Outer circle
  ctx.beginPath();
  ctx.arc(0, 0, radius - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 1; i < rings; i++) {
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

  await downloadCanvas(canvas, 'domedreaming-polar-grid');
}

/**
 * Export the polar grid as an SVG — transparent background, white strokes,
 * vector-clean for Photoshop / Illustrator masking.
 */
export function exportPolarGridSVG(config) {
  const size = Math.round(Number(config.polar && config.polar.exportSize) || 2048);
  if (!size || size < 1) return;

  const {
    radialLines = 24,
    rings = 8,
    lineThickness = 1,
  } = config.polar || {};

  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 1024;
  const sw = (lineThickness * scale).toFixed(4);
  const radius = size / 2 - (lineThickness * scale) / 2;

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`);
  lines.push(`<g fill="none" stroke="#ffffff" stroke-width="${sw}">`);
  lines.push(`  <circle cx="${cx}" cy="${cy}" r="${radius.toFixed(4)}"/>`);
  for (let i = 1; i < rings; i++) {
    const r = ((size / 2) * i) / rings;
    lines.push(`  <circle cx="${cx}" cy="${cy}" r="${r.toFixed(4)}"/>`);
  }
  for (let i = 0; i < radialLines; i++) {
    const angle = (i / radialLines) * Math.PI * 2 - Math.PI / 2;
    const x = (cx + Math.cos(angle) * (size / 2)).toFixed(4);
    const y = (cy + Math.sin(angle) * (size / 2)).toFixed(4);
    lines.push(`  <line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`);
  }
  lines.push(`</g>`);
  lines.push(`</svg>`);

  const blob = new Blob([lines.join('\n')], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-polar-grid-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
