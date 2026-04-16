/**
 * Polar grid viewport — draws a media-filled circle with a radial/concentric
 * grid overlay. Accepts a rotation angle (radians) driven by the animation clock.
 */

import { drawPolarAt } from './polar-renderer.js';
import { getColorMode } from './colors.js';

let canvas, ctx, container;
let mediaElement = null;
let polarConfig = null;
let rotation = 0;

export function initViewportPolar() {
  canvas = document.getElementById('canvas-polar');
  if (!canvas) return;
  container = canvas.parentElement;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', onResize);
  window.addEventListener('split-resize', onResize);
}

export function setPolarMedia(element) {
  mediaElement = element;
}

export function setPolarConfig(cfg) {
  polarConfig = cfg;
}

export function renderPolar(rot = rotation) {
  rotation = rot;
  draw();
}

function draw() {
  if (!ctx || !canvas || !polarConfig) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Match panel bg so mask cuts reveal the right color
  ctx.fillStyle = getColorMode() === 'bw' ? '#fafafa' : '#000';
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const padding = 20;
  const radius = Math.max(1, Math.min(w, h) / 2 - padding);

  drawPolarAt(ctx, cx, cy, radius, mediaElement, polarConfig, rotation);
  ctx.restore();
}

function resizeCanvas() {
  if (!canvas || !container) return;
  const dpr = window.devicePixelRatio || 1;
  const w = container.clientWidth;
  const h = container.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}

function onResize() {
  resizeCanvas();
  draw();
}
