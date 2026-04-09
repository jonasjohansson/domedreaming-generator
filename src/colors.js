/**
 * Centralized color palette for all viewports and export.
 * Supports 'color' and 'bw' (black & white) modes.
 */

let mode = 'color';

export function setColorMode(m) {
  mode = m;
}

export function getColorMode() {
  return mode;
}

/**
 * Get stroke color for wireframe edges.
 */
export function getStrokeColor() {
  return mode === 'bw' ? '#000000' : '#222222';
}

/**
 * Get CSS color string for a face group index.
 */
export function getFaceColor(groupId, totalGroups = 20) {
  if (mode === 'bw') {
    return '#ffffff';
  }
  const n = Math.max(totalGroups, 20);
  const hue = ((groupId % n) / n) * 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Get RGB [0-1] values for Three.js vertex colors.
 */
export function getFaceColorRGB(groupId, totalGroups = 20) {
  if (mode === 'bw') {
    return [1, 1, 1];
  }
  const n = Math.max(totalGroups, 20);
  const hue = (groupId % n) / n;
  return hslToRgb(hue, 0.65, 0.55);
}

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
