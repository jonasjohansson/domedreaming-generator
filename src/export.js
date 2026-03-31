/**
 * High-resolution PNG export for the 2D unwrap view.
 * Matches the on-screen render exactly.
 */

import { drawFaceMedia, computeUVs } from './media.js';

// Match viewport-2d.js palette exactly
const colorPalette = Array.from({ length: 20 }, (_, i) => {
  const hue = (i / 20) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

export async function exportPNG(unwrapData, config, mediaElement, mesh) {
  if (!unwrapData) return;

  const { width, height } = config.export;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Dark background matching the site
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, width, height);

  const padding = Math.min(width, height) * 0.05;
  const { bounds } = unwrapData;
  if (bounds.width === 0 || bounds.height === 0) return;

  const scaleX = (width - padding * 2) / bounds.width;
  const scaleY = (height - padding * 2) / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  // For video: capture current frame to static canvas
  let mediaSource = mediaElement;
  if (mediaElement && mediaElement.tagName === 'VIDEO') {
    const vidW = mediaElement.videoWidth;
    const vidH = mediaElement.videoHeight;
    if (vidW && vidH) {
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = vidW;
      frameCanvas.height = vidH;
      frameCanvas.getContext('2d').drawImage(mediaElement, 0, 0);
      mediaSource = frameCanvas;
    }
  }

  // Compute UVs if media is available
  let mediaUVs = null;
  if (mediaSource && mesh) {
    mediaUVs = computeUVs(mesh.vertices, mesh.faces);
  }

  // Use canvas transform (like viewport-2d.js) so drawFaceMedia works correctly
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
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5 / scale;
    ctx.stroke();
  }

  ctx.restore();

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
