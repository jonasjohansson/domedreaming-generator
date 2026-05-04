/**
 * Title-card viewport — polar grid with curved text overlays.
 * Mirrors viewport-polar.js lifecycle.
 */

import { drawTitlecardAt } from './titlecard-renderer.js';
import { getColorMode } from './colors.js';

let canvas, ctx, container;
let titlecardConfig = null;

export function initViewportTitlecard() {
  canvas = document.getElementById('canvas-titlecard');
  if (!canvas) return;
  container = canvas.parentElement;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', onResize);
  window.addEventListener('split-resize', onResize);
}

export function setTitlecardConfig(cfg) {
  titlecardConfig = cfg;
}

export function renderTitlecard() {
  draw();
}

function draw() {
  if (!ctx || !canvas || !titlecardConfig) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = getColorMode() === 'bw' ? '#fafafa' : '#000';
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const padding = 20;
  const radius = Math.max(1, Math.min(w, h) / 2 - padding);

  drawTitlecardAt(ctx, cx, cy, radius, titlecardConfig);
  ctx.restore();
}

function resizeCanvas() {
  if (!canvas || !container) return;
  const dpr = window.devicePixelRatio || 1;
  const w = container.clientWidth;
  const h = container.clientHeight;
  canvas.width = Math.max(1, w * dpr);
  canvas.height = Math.max(1, h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}

function onResize() {
  resizeCanvas();
  draw();
}
