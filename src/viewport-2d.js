/**
 * 2D Canvas viewport for rendering unwrapped geodesic mesh faces.
 * Supports pan (mouse drag) and zoom (mouse wheel).
 */

import { drawFaceMedia, computeUVs } from './media.js';

let canvas, ctx, container;
let transform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let lastUnwrapData = null;
let mediaElement = null;
let mediaMesh = null;
let mediaUVs = null;
let videoAnimFrameId = null;
let currentConfig = null;

// 20-color palette matching viewport-3d.js: hue = i/20, sat 65%, light 55%
const colorPalette = Array.from({ length: 20 }, (_, i) => {
  const hue = (i / 20) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

export function setWireframeConfig(cfg) {
  currentConfig = cfg;
}

export function initViewport2D() {
  canvas = document.getElementById('canvas-2d');
  if (!canvas) return;
  container = canvas.parentElement;
  ctx = canvas.getContext('2d');

  resizeCanvas();

  // Pan
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);

  // Zoom
  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Resize
  window.addEventListener('resize', onResize);
  window.addEventListener('split-resize', onResize);
}

/**
 * Set media element and mesh data for media-mapped rendering.
 * @param {HTMLImageElement|HTMLVideoElement|null} element
 * @param {object|null} mesh - geodesic mesh with vertices and faces
 */
export function setMedia(element, mesh) {
  mediaElement = element;
  mediaMesh = mesh;
  if (element && mesh) {
    mediaUVs = computeUVs(mesh.vertices, mesh.faces);
  } else {
    mediaUVs = null;
  }

  // Start/stop video render loop
  if (videoAnimFrameId) {
    cancelAnimationFrame(videoAnimFrameId);
    videoAnimFrameId = null;
  }
  if (element && element.tagName === 'VIDEO') {
    function videoLoop() {
      draw();
      videoAnimFrameId = requestAnimationFrame(videoLoop);
    }
    videoLoop();
  } else {
    draw();
  }
}

export function render2D(unwrapData) {
  if (!ctx || !canvas) return;
  lastUnwrapData = unwrapData;

  // Auto-fit on first render (reset transform)
  if (unwrapData) {
    autoFit(unwrapData.bounds);
  }

  draw();
}

function draw() {
  if (!ctx || !lastUnwrapData) return;
  const { faces2D } = lastUnwrapData;
  const dpr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  // Apply DPR scaling then pan/zoom transform
  ctx.scale(dpr, dpr);
  ctx.translate(transform.x, transform.y);
  ctx.scale(transform.scale, transform.scale);

  for (const face of faces2D) {
    const [[x0, y0], [x1, y1], [x2, y2]] = face.vertices;
    const colorIndex = face.groupId % colorPalette.length;

    // Try media rendering if available
    let mediaDrawn = false;
    if (mediaElement && mediaUVs && face.faceIndex != null) {
      const fi = face.faceIndex;
      const uvOffset = fi * 3 * 2;
      const faceUVArray = [
        [mediaUVs[uvOffset], mediaUVs[uvOffset + 1]],
        [mediaUVs[uvOffset + 2], mediaUVs[uvOffset + 3]],
        [mediaUVs[uvOffset + 4], mediaUVs[uvOffset + 5]],
      ];

      ctx.save();
      drawFaceMedia(ctx, face.vertices, mediaElement, faceUVArray);
      ctx.restore();
      mediaDrawn = true;
    }

    if (!mediaDrawn) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();

      // Fill
      ctx.fillStyle = colorPalette[colorIndex];
      ctx.fill();
    }

    // Wireframe stroke
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.strokeStyle = currentConfig?.wireframe?.lineColor ?? '#222';
    ctx.lineWidth = (currentConfig?.wireframe?.lineWidth ?? 0.5) / transform.scale;
    ctx.stroke();
  }

  ctx.restore();
}

function autoFit(bounds) {
  if (!canvas || !container) return;
  const padding = 40;
  const cw = container.clientWidth - padding * 2;
  const ch = container.clientHeight - padding * 2;

  if (bounds.width === 0 || bounds.height === 0) return;

  const scaleX = cw / bounds.width;
  const scaleY = ch / bounds.height;
  transform.scale = Math.min(scaleX, scaleY);

  // Center the unwrap in the viewport
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;

  transform.x = container.clientWidth / 2 - centerX * transform.scale;
  transform.y = container.clientHeight / 2 - centerY * transform.scale;
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

function onMouseDown(e) {
  isDragging = true;
  dragStart.x = e.clientX - transform.x;
  dragStart.y = e.clientY - transform.y;
}

function onMouseMove(e) {
  if (!isDragging) return;
  transform.x = e.clientX - dragStart.x;
  transform.y = e.clientY - dragStart.y;
  draw();
}

function onMouseUp() {
  isDragging = false;
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const newScale = transform.scale * zoomFactor;

  // Zoom toward mouse position
  transform.x = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
  transform.y = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
  transform.scale = newScale;

  draw();
}
