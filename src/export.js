/**
 * High-resolution PNG export for the 2D unwrap view.
 * Renders with media (image/video current frame) when present,
 * falls back to colored fills otherwise.
 */

import { drawFaceMedia, computeUVs } from './media.js';

const MAX_COLORS = 64;
const colorPalette = Array.from({ length: MAX_COLORS }, (_, i) => {
  const hue = (i / MAX_COLORS) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

/**
 * Export the 2D unwrap as a high-resolution PNG.
 * Captures the current video frame if video media is loaded.
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

  // Transparent background (let the faces define the shape)
  ctx.clearRect(0, 0, width, height);

  const padding = Math.min(width, height) * 0.05;
  const { bounds } = unwrapData;

  if (bounds.width === 0 || bounds.height === 0) return;

  const scaleX = (width - padding * 2) / bounds.width;
  const scaleY = (height - padding * 2) / bounds.height;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  // For video: ensure we have a current frame to draw
  // (pause briefly if needed so drawImage captures the frame)
  let mediaSource = mediaElement;
  if (mediaElement && mediaElement.tagName === 'VIDEO') {
    // Capture current video frame to a static canvas for reliable export
    const vidW = mediaElement.videoWidth;
    const vidH = mediaElement.videoHeight;
    if (vidW && vidH) {
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = vidW;
      frameCanvas.height = vidH;
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.drawImage(mediaElement, 0, 0);
      // Use the frame canvas as the media source (static snapshot)
      mediaSource = frameCanvas;
    }
  }

  // Compute UVs if media is available
  let mediaUVs = null;
  if (mediaSource && mesh) {
    mediaUVs = computeUVs(mesh.vertices, mesh.faces);
  }

  // Draw each face
  for (const face of unwrapData.faces2D) {
    const pts = face.vertices.map(([x, y]) => [
      x * scale + offsetX,
      y * scale + offsetY,
    ]);

    const [[x0, y0], [x1, y1], [x2, y2]] = pts;

    // Media rendering
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
        drawFaceMedia(ctx, pts, mediaSource, faceUVArray);
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
      ctx.fillStyle = colorPalette[face.groupId % colorPalette.length];
      ctx.fill();
    }

    // Wireframe
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(0.5, scale * 0.3);
    ctx.stroke();
  }

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
