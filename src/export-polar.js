/**
 * Export the polar viewport as a square PNG — just the circle graphic,
 * transparent outside. Size is driven by `polar.exportSize`, independent
 * of the Export tab's preset dimensions.
 */

import { drawPolarAt } from './polar-renderer.js';

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

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-polar-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
