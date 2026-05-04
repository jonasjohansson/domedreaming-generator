/**
 * Split-view module — N draggable dividers between N+1 viewports.
 * Panel ratios sum to 1; dragging divider i only adjusts ratios[i] and ratios[i+1].
 *
 * Panels can be individually hidden via .panel-hidden — the divider before
 * the hidden panel is also hidden, and ratios are renormalized over the
 * remaining visible panels. Tabs at the bottom restore hidden panels.
 */

const PANEL_LABELS = {
  'viewport-3d': '3D',
  'viewport-2d': '2D Net',
  'viewport-polar': 'Polar',
  'viewport-titlecard': 'Title Card',
};
const PANEL_IDS = ['viewport-3d', 'viewport-2d', 'viewport-polar', 'viewport-titlecard'];
const DIVIDER_IDS = ['divider', 'divider-2', 'divider-3'];
const MIN = 0.06;
const STORE_KEY = 'domedreaming-split-view';

let ratios = new Array(PANEL_IDS.length).fill(1 / PANEL_IDS.length);
let hiddenSet = new Set();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.ratios) && data.ratios.length === PANEL_IDS.length) {
      const sum = data.ratios.reduce((a, b) => a + b, 0);
      if (sum > 0) ratios = data.ratios.map((r) => r / sum);
    }
    if (Array.isArray(data.hidden)) hiddenSet = new Set(data.hidden);
  } catch { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      ratios,
      hidden: Array.from(hiddenSet),
    }));
  } catch { /* ignore */ }
}

export function getSplitRatios() {
  return ratios.slice();
}

export function initSplitView() {
  const panels = PANEL_IDS.map((id) => document.getElementById(id));
  const dividers = DIVIDER_IDS.map((id) => document.getElementById(id));
  const app = document.getElementById('app');
  const tabsContainer = document.getElementById('panel-tabs');

  if (panels.some((p) => !p) || dividers.some((d) => !d) || !app) {
    console.warn('split-view: required DOM elements not found');
    return;
  }

  loadState();
  // Apply persisted hidden state to DOM
  panels.forEach((p, i) => {
    p.classList.toggle('panel-hidden', hiddenSet.has(PANEL_IDS[i]));
  });

  applyLayout(panels, dividers, tabsContainer);

  // Wire collapse buttons
  document.querySelectorAll('.panel-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-panel');
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('panel-hidden');
      hiddenSet.add(id);
      saveState();
      applyLayout(panels, dividers, tabsContainer);
      window.dispatchEvent(new CustomEvent('split-resize'));
    });
  });

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

    const visibleIdx = panels
      .map((p, i) => (p.classList.contains('panel-hidden') ? -1 : i))
      .filter((i) => i >= 0);
    const visibleDividers = dividers.filter((d) => !d.classList.contains('panel-hidden'));
    const dividerWidth = visibleDividers[0] ? visibleDividers[0].offsetWidth : 6;
    const dividerTotal = visibleDividers.reduce((s, d) => s + d.offsetWidth, 0);
    const usable = appRect.width - dividerTotal;
    if (usable <= 0) return;

    // dragIdx is the divider's index among ALL dividers; map to visible-index
    const visibleDividerIdx = visibleDividers.indexOf(dividers[dragIdx]);
    if (visibleDividerIdx < 0) return;

    // Sum of visible-panel ratios up to and including the panel left of this divider
    const leftPanels = visibleIdx.slice(0, visibleDividerIdx + 1);
    const rightPanel = visibleIdx[visibleDividerIdx + 1];
    if (rightPanel === undefined) return;

    const leftSumBefore = leftPanels.reduce((a, i) => a + ratios[i], 0);
    const leftRatio = ratios[leftPanels[leftPanels.length - 1]];
    const rightRatio = ratios[rightPanel];

    const visibleSum = visibleIdx.reduce((a, i) => a + ratios[i], 0);
    const leftSumNorm = (clientX - appRect.left - visibleDividerIdx * dividerWidth) / usable;
    const targetLeftSum = leftSumNorm * visibleSum;

    const minLeftSum = leftSumBefore - leftRatio + MIN * visibleSum;
    const maxLeftSum = leftSumBefore + rightRatio - MIN * visibleSum;
    const newLeftSum = Math.max(minLeftSum, Math.min(maxLeftSum, targetLeftSum));
    const delta = newLeftSum - leftSumBefore;

    ratios[leftPanels[leftPanels.length - 1]] += delta;
    ratios[rightPanel] -= delta;

    applyLayout(panels, dividers, tabsContainer);
    window.dispatchEvent(new CustomEvent('split-resize', { detail: { ratios: ratios.slice() } }));
  };

  const onUp = () => {
    if (dragIdx < 0) return;
    dragIdx = -1;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    saveState();
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

function showPanel(panels, dividers, tabsContainer, panelId) {
  const el = document.getElementById(panelId);
  if (!el) return;
  el.classList.remove('panel-hidden');
  hiddenSet.delete(panelId);
  saveState();
  applyLayout(panels, dividers, tabsContainer);
  window.dispatchEvent(new CustomEvent('split-resize'));
}

function applyLayout(panels, dividers, tabsContainer) {
  const visible = panels.map((p) => !p.classList.contains('panel-hidden'));
  const visibleSum = visible.reduce((s, v, i) => s + (v ? ratios[i] : 0), 0) || 1;

  panels.forEach((p, i) => {
    if (visible[i]) {
      const r = ratios[i] / visibleSum;
      p.style.flex = `${r} 1 0%`;
    } else {
      p.style.flex = '0 0 0';
    }
  });

  // A divider is shown only if there is at least one visible panel on each side.
  dividers.forEach((d, i) => {
    const leftVisible = visible.slice(0, i + 1).some(Boolean);
    const rightVisible = visible.slice(i + 1).some(Boolean);
    d.classList.toggle('panel-hidden', !(leftVisible && rightVisible));
  });

  // Rebuild tabs for hidden panels
  if (tabsContainer) {
    tabsContainer.innerHTML = '';
    panels.forEach((p, i) => {
      if (visible[i]) return;
      const btn = document.createElement('button');
      btn.textContent = `Show ${PANEL_LABELS[PANEL_IDS[i]] || PANEL_IDS[i]}`;
      btn.addEventListener('click', () => showPanel(panels, dividers, tabsContainer, PANEL_IDS[i]));
      tabsContainer.appendChild(btn);
    });
  }
}
