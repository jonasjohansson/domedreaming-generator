/**
 * 2D Canvas viewport for rendering unwrapped geodesic mesh faces.
 * Supports pan (mouse drag) and zoom (mouse wheel).
 */

import { drawFaceMedia, computeUVs } from './media.js';
import { getFaceColor } from './colors.js';

let canvas, ctx, container;
let transform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let lastUnwrapData = null;
let mediaElement = null;
let mediaMesh = null;
let mediaUVs = null;
let videoAnimFrameId = null;
let unfoldT = 1;
let meshData = null; // 3D mesh for projection

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

export function setUnfold(t, mesh) {
  unfoldT = t;
  meshData = mesh;
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

/**
 * Project 3D mesh faces to 2D (top-down view) scaled to match unwrap bounds.
 * Returns a map from faceIndex to projected 2D vertices.
 */
function buildProjectedFaces(faces2D) {
  if (!meshData) return null;
  const { vertices, faces } = meshData;

  // Project 3D to 2D via top-down (XZ plane)
  const projected = {};
  for (const face2D of faces2D) {
    const fi = face2D.faceIndex;
    if (fi == null || fi >= faces.length) continue;
    const [ai, bi, ci] = faces[fi];
    // Top-down: x → x, z → y (negated so north faces up)
    projected[fi] = [
      [vertices[ai][0], -vertices[ai][2]],
      [vertices[bi][0], -vertices[bi][2]],
      [vertices[ci][0], -vertices[ci][2]],
    ];
  }

  // Scale projected coords to match unwrap bounds
  const { bounds } = lastUnwrapData;
  let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
  for (const verts of Object.values(projected)) {
    for (const [x, y] of verts) {
      if (x < pMinX) pMinX = x;
      if (y < pMinY) pMinY = y;
      if (x > pMaxX) pMaxX = x;
      if (y > pMaxY) pMaxY = y;
    }
  }
  const pW = pMaxX - pMinX || 1;
  const pH = pMaxY - pMinY || 1;
  const bCx = bounds.minX + bounds.width / 2;
  const bCy = bounds.minY + bounds.height / 2;
  const scale = Math.min(bounds.width / pW, bounds.height / pH);

  for (const fi of Object.keys(projected)) {
    const verts = projected[fi];
    for (const v of verts) {
      v[0] = bCx + (v[0] - (pMinX + pW / 2)) * scale;
      v[1] = bCy + (v[1] - (pMinY + pH / 2)) * scale;
    }
  }

  return projected;
}

function lerp2D(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
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

  // Build projected 3D positions when animating
  const t = unfoldT;
  const proj = (t < 1 && meshData) ? buildProjectedFaces(faces2D) : null;

  for (const face of faces2D) {
    let verts = face.vertices;

    // Interpolate between projected 3D and unwrap 2D
    if (proj && face.faceIndex != null && proj[face.faceIndex]) {
      const p = proj[face.faceIndex];
      verts = [
        lerp2D(p[0], verts[0], t),
        lerp2D(p[1], verts[1], t),
        lerp2D(p[2], verts[2], t),
      ];
    }

    const [[x0, y0], [x1, y1], [x2, y2]] = verts;

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

      ctx.fillStyle = getFaceColor(face.groupId);
      ctx.fill();
    }

    // Wireframe stroke
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5 / transform.scale;
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
