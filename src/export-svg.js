/**
 * SVG export for the 2D unwrap view.
 * Outputs filled triangles with wireframe strokes.
 */

const colorPalette = Array.from({ length: 20 }, (_, i) => {
  const hue = (i / 20) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

export function exportSVG(unwrapData) {
  if (!unwrapData) return;

  const { faces2D, bounds } = unwrapData;
  if (bounds.width === 0 || bounds.height === 0) return;

  const padding = Math.min(bounds.width, bounds.height) * 0.05;
  const svgW = bounds.width + padding * 2;
  const svgH = bounds.height + padding * 2;
  const ox = -bounds.minX + padding;
  const oy = -bounds.minY + padding;

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW.toFixed(4)} ${svgH.toFixed(4)}">`);
  lines.push(`<rect width="100%" height="100%" fill="#1a1a1a"/>`);
  lines.push(`<g transform="translate(${ox.toFixed(4)},${oy.toFixed(4)})">`);

  for (const face of faces2D) {
    const [[x0, y0], [x1, y1], [x2, y2]] = face.vertices;
    const colorIndex = face.groupId % colorPalette.length;
    const points = `${x0.toFixed(4)},${y0.toFixed(4)} ${x1.toFixed(4)},${y1.toFixed(4)} ${x2.toFixed(4)},${y2.toFixed(4)}`;
    lines.push(`  <polygon points="${points}" fill="${colorPalette[colorIndex]}" stroke="#222" stroke-width="0.005"/>`);
  }

  lines.push(`</g>`);
  lines.push(`</svg>`);

  const svgContent = lines.join('\n');
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `domedreaming-${Date.now()}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
