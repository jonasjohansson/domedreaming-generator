/**
 * High-resolution PNG export for the 2D unwrap view.
 * Creates an offscreen canvas at the configured resolution,
 * re-renders the unwrap with media or colored fills, and triggers download.
 */

import { drawFaceMedia, computeUVs } from './media.js';

// 20-color HSL palette matching viewport-2d.js
const colorPalette = Array.from({ length: 20 }, (_, i) => {
  const hue = (i / 20) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

/**
 * Export the 2D unwrap as a high-resolution PNG.
 *
 * @param {object} unwrapData - Output from unwrapMesh() with faces2D and bounds
 * @param {object} config - App config with export.width and export.height
 * @param {HTMLImageElement|HTMLVideoElement|null} mediaElement - Current media element
 * @param {object|null} mesh - Geodesic mesh with vertices and faces
 */
export async function exportPNG(unwrapData, config, mediaElement, mesh) {
  if (!unwrapData) {
    console.warn('No unwrap data available for export');
    return;
  }

  const { width, height } = config.export;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Clear with dark background
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  // Compute scale to fit unwrap bounds into canvas with padding
  const padding = Math.min(width, height) * 0.05;
  const { bounds } = unwrapData;

  if (bounds.width === 0 || bounds.height === 0) {
    console.warn('Unwrap bounds have zero size');
    return;
  }

  const scaleX = (width - padding * 2) / bounds.width;
  const scaleY = (height - padding * 2) / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  // Compute UVs if media is available
  let mediaUVs = null;
  if (mediaElement && mesh) {
    mediaUVs = computeUVs(mesh.vertices, mesh.faces);
  }

  // Draw each face
  for (const face of unwrapData.faces2D) {
    // Transform vertices to canvas coords
    const pts = face.vertices.map(([x, y]) => [
      x * scale + offsetX,
      y * scale + offsetY,
    ]);

    const [[x0, y0], [x1, y1], [x2, y2]] = pts;
    const colorIndex = face.groupId % colorPalette.length;

    // Try media rendering if available
    let mediaDrawn = false;
    if (mediaElement && mediaUVs && face.faceIndex != null) {
      const fi = face.faceIndex;
      const uvOffset = fi * 3 * 2;
      const faceUVArray = [
        [mediaUVs[uvOffset], mediaUVs[uvOffset + 1]],
        [mediaUVs[uvOffset + 2], mediaUVs[uvOffset + 3]],
        [mediaUVs[uvOffset + 4], mediaUVs[uvOffset + 5]],
      ];

      ctx.save();
      drawFaceMedia(ctx, pts, mediaElement, faceUVArray);
      ctx.restore();
      mediaDrawn = true;
    }

    if (!mediaDrawn) {
      // Draw colored fill
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fillStyle = colorPalette[colorIndex];
      ctx.fill();
    }

    // Wireframe stroke
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = Math.max(1, scale * 0.5);
    ctx.stroke();
  }

  // Trigger download
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
