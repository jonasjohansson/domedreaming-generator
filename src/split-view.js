/**
 * Split-view module — N draggable dividers between N+1 viewports.
 * Panel ratios sum to 1; dragging divider i only adjusts ratios[i] and ratios[i+1].
 */

const PANEL_IDS = ['viewport-3d', 'viewport-2d', 'viewport-polar'];
const DIVIDER_IDS = ['divider', 'divider-2'];
const MIN = 0.06;

let ratios = new Array(PANEL_IDS.length).fill(1 / PANEL_IDS.length);

export function getSplitRatios() {
  return ratios.slice();
}

export function initSplitView() {
  const panels = PANEL_IDS.map((id) => document.getElementById(id));
  const dividers = DIVIDER_IDS.map((id) => document.getElementById(id));
  const app = document.getElementById('app');

  if (panels.some((p) => !p) || dividers.some((d) => !d) || !app) {
    console.warn('split-view: required DOM elements not found');
    return;
  }

  applyRatios(panels);

  let dragIdx = -1;

  const onDown = (i) => (e) => {
    e.preventDefault();
    dragIdx = i;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onMove = (e) => {
    if (dragIdx < 0) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const appRect = app.getBoundingClientRect();
    const dividerWidth = dividers[0].offsetWidth;
    const dividerTotal = dividers.reduce((s, d) => s + d.offsetWidth, 0);
    const usable = appRect.width - dividerTotal;
    if (usable <= 0) return;

    // leftSum = sum(ratios[0..dragIdx]); recover from clientX
    const leftSum = (clientX - appRect.left - dragIdx * dividerWidth) / usable;

    const leftSumBefore = ratios.slice(0, dragIdx + 1).reduce((a, b) => a + b, 0);
    const leftSumMin = leftSumBefore - ratios[dragIdx] + MIN;
    const leftSumMax = leftSumBefore + ratios[dragIdx + 1] - MIN;

    const newLeftSum = Math.max(leftSumMin, Math.min(leftSumMax, leftSum));
    const delta = newLeftSum - leftSumBefore;
    ratios[dragIdx] += delta;
    ratios[dragIdx + 1] -= delta;

    applyRatios(panels);
    window.dispatchEvent(new CustomEvent('split-resize', { detail: { ratios: ratios.slice() } }));
  };

  const onUp = () => {
    if (dragIdx < 0) return;
    dragIdx = -1;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  dividers.forEach((d, i) => {
    d.addEventListener('mousedown', onDown(i));
    d.addEventListener('touchstart', onDown(i), { passive: false });
  });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
}

function applyRatios(panels) {
  panels.forEach((p, i) => {
    p.style.flex = `${ratios[i]} 1 0%`;
  });
}
