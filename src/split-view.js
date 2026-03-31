/**
 * Split-view module — draggable divider between 3D and 2D viewports.
 */

let splitRatio = 0.5; // 0..1, fraction for the left (3D) panel

export function getSplitRatio() {
  return splitRatio;
}

export function initSplitView() {
  const viewport3d = document.getElementById('viewport-3d');
  const divider = document.getElementById('divider');
  const viewport2d = document.getElementById('viewport-2d');
  const app = document.getElementById('app');

  if (!viewport3d || !divider || !viewport2d || !app) {
    console.warn('split-view: required DOM elements not found');
    return;
  }

  applyRatio(viewport3d, viewport2d);

  let dragging = false;

  function onPointerDown(e) {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onPointerMove(e) {
    if (!dragging) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const appRect = app.getBoundingClientRect();
    const dividerWidth = divider.offsetWidth;

    // Compute ratio, accounting for divider width
    let ratio = (clientX - appRect.left) / (appRect.width - dividerWidth);
    ratio = Math.max(0.2, Math.min(0.8, ratio)); // clamp 20%–80%

    splitRatio = ratio;
    applyRatio(viewport3d, viewport2d);

    window.dispatchEvent(new CustomEvent('split-resize', { detail: { ratio: splitRatio } }));
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  // Mouse events
  divider.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  // Touch events
  divider.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);
}

function applyRatio(left, right) {
  left.style.flex = `${splitRatio} 1 0%`;
  right.style.flex = `${1 - splitRatio} 1 0%`;
}
