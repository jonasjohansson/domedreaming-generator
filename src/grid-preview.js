/**
 * Grid preview panel — renders a scaled-down view of all cells
 * in a 3-column grid, with per-cell images inside dome triangles
 * and seamless wireframe overlay.
 */

const colorPalette = Array.from({ length: 20 }, (_, i) => {
  const hue = (i / 20) * 360;
  return `hsl(${hue}, 65%, 55%)`;
});

let canvas, ctx, container;
let lastUnwrapData = null;
let lastConfig = null;
let visible = false;

// Per-cell images: Map<"row,col", HTMLImageElement>
const cellImages = new Map();

// Grid layout state (updated each draw, used for hit-testing drops)
let gridLayout = { gridX: 0, gridY: 0, cellW: 0, cellH: 0, cols: 3, rows: 3 };
let hoverCell = null; // { row, col } during drag
let onCloseCallback = null;

export function initGridPreview(callbacks = {}) {
  container = document.getElementById('grid-preview');
  canvas = document.getElementById('canvas-grid');
  if (!canvas || !container) return;
  ctx = canvas.getContext('2d');
  onCloseCallback = callbacks.onClose || null;

  // Close button
  const closeBtn = document.getElementById('grid-preview-close');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    hideGridPreview();
    if (onCloseCallback) onCloseCallback();
  });

  // Drag-and-drop onto cells
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    document.body.classList.remove('drag-over');

    // Highlight hovered cell
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { gridX, gridY, cellW, cellH, cols, rows } = gridLayout;
    const col = Math.floor((mx - gridX) / cellW);
    const row = Math.floor((my - gridY) / cellH);
    const validCell = col >= 0 && col < cols && row >= 0 && row < rows;
    const prev = hoverCell;
    hoverCell = validCell ? { row, col } : null;
    if (hoverCell?.row !== prev?.row || hoverCell?.col !== prev?.col) {
      resizeAndDraw();
    }
  });
  container.addEventListener('dragleave', () => {
    hoverCell = null;
    resizeAndDraw();
  });
  container.addEventListener('drop', onDrop);

  window.addEventListener('resize', () => { if (visible) resizeAndDraw(); });
  window.addEventListener('split-resize', () => { if (visible) resizeAndDraw(); });
}

function onDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.body.classList.remove('drag-over');
  hoverCell = null;

  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;

  // Determine which cell was dropped on
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const { gridX, gridY, cellW, cellH, cols, rows } = gridLayout;
  const col = Math.floor((mx - gridX) / cellW);
  const row = Math.floor((my - gridY) / cellH);

  if (col < 0 || col >= cols || row < 0 || row >= rows) return;

  const key = `${row + 1},${col + 1}`;

  const img = new Image();
  img.onload = () => {
    cellImages.set(key, img);
    resizeAndDraw();
  };
  img.src = URL.createObjectURL(file);
}

export function getCellImages() {
  return cellImages;
}

export function showGridPreview() {
  if (!container) return;
  visible = true;
  container.classList.remove('hidden');
  resizeAndDraw();
}

export function hideGridPreview() {
  if (!container) return;
  visible = false;
  container.classList.add('hidden');
}

export function isGridPreviewVisible() {
  return visible;
}

export function updateGridPreview(unwrapData, config) {
  lastUnwrapData = unwrapData;
  lastConfig = config;
  if (visible) resizeAndDraw();
}

function resizeAndDraw() {
  if (!canvas || !container) return;
  const dpr = window.devicePixelRatio || 1;
  const w = container.clientWidth;
  const h = container.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  draw();
}

/**
 * Draw image cover-fitted to a rectangle.
 */
export function drawCoverFit(ctx, image, x, y, w, h) {
  const imgAspect = image.naturalWidth / image.naturalHeight;
  const rectAspect = w / h;
  let sw, sh, sx, sy;
  if (imgAspect > rectAspect) {
    sh = image.naturalHeight;
    sw = sh * rectAspect;
    sx = (image.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = image.naturalWidth;
    sh = sw / rectAspect;
    sx = 0;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function draw() {
  if (!ctx || !lastUnwrapData || !lastConfig) return;

  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.width / dpr;
  const ch = canvas.height / dpr;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  const cols = 3;
  const rows = lastConfig.grid?.rows ?? 3;
  const cellAspect = 1080 / 1350;
  const gridAspect = (cols * cellAspect) / rows;

  const pad = 20;
  const availW = cw - pad * 2;
  const availH = ch - pad * 2;
  const containerAspect = availW / availH;

  let gridW, gridH;
  if (containerAspect > gridAspect) {
    gridH = availH;
    gridW = gridH * gridAspect;
  } else {
    gridW = availW;
    gridH = gridW / gridAspect;
  }

  const gridX = (cw - gridW) / 2;
  const gridY = (ch - gridH) / 2;
  const cellW = gridW / cols;
  const cellH = gridH / rows;

  // Store for hit-testing
  gridLayout = { gridX, gridY, cellW, cellH, cols, rows };

  const { faces2D, bounds } = lastUnwrapData;
  if (bounds.width === 0 || bounds.height === 0) { ctx.restore(); return; }

  const lineWidth = lastConfig.wireframe?.lineWidth ?? 0.5;
  const lineColor = lastConfig.wireframe?.lineColor ?? '#222';
  const patternScale = lastConfig.grid?.patternScale ?? 1;
  const userOffsetX = lastConfig.grid?.offsetX ?? 0;
  const userOffsetY = lastConfig.grid?.offsetY ?? 0;

  // Fit unwrap to grid, then apply user scale
  const baseScaleX = gridW / bounds.width;
  const baseScaleY = gridH / bounds.height;
  const baseScale = Math.min(baseScaleX, baseScaleY);
  const scale = baseScale * patternScale;

  // Center the pattern, then apply user offset
  const offsetX = gridX + (gridW - bounds.width * scale) / 2 - bounds.minX * scale + userOffsetX * gridW;
  const offsetY = gridY + (gridH - bounds.height * scale) / 2 - bounds.minY * scale + userOffsetY * gridH;

  // Clip to grid area
  ctx.save();
  ctx.beginPath();
  ctx.rect(gridX, gridY, gridW, gridH);
  ctx.clip();

  // Draw faces — one shared unwrap across the grid
  for (const face of faces2D) {
    const [[x0, y0], [x1, y1], [x2, y2]] = face.vertices;

    const sx0 = offsetX + x0 * scale;
    const sy0 = offsetY + y0 * scale;
    const sx1 = offsetX + x1 * scale;
    const sy1 = offsetY + y1 * scale;
    const sx2 = offsetX + x2 * scale;
    const sy2 = offsetY + y2 * scale;

    // Centroid to determine which cell this face belongs to
    const cx = (sx0 + sx1 + sx2) / 3;
    const cy = (sy0 + sy1 + sy2) / 3;
    const col = Math.floor((cx - gridX) / cellW);
    const row = Math.floor((cy - gridY) / cellH);
    const cellKey = `${row + 1},${col + 1}`;
    const cellImg = cellImages.get(cellKey);

    if (cellImg) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.closePath();
      ctx.clip();
      const cellRectX = gridX + col * cellW;
      const cellRectY = gridY + row * cellH;
      drawCoverFit(ctx, cellImg, cellRectX, cellRectY, cellW, cellH);
      ctx.restore();
    } else {
      const colorIndex = face.groupId % colorPalette.length;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.closePath();
      ctx.fillStyle = colorPalette[colorIndex];
      ctx.fill();
    }

    // Wireframe
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.closePath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  ctx.restore(); // undo clip

  // Draw cell divider lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let c = 1; c < cols; c++) {
    const x = gridX + c * cellW;
    ctx.beginPath();
    ctx.moveTo(x, gridY);
    ctx.lineTo(x, gridY + gridH);
    ctx.stroke();
  }

  for (let r = 1; r < rows; r++) {
    const y = gridY + r * cellH;
    ctx.beginPath();
    ctx.moveTo(gridX, y);
    ctx.lineTo(gridX + gridW, y);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // Grid border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(gridX, gridY, gridW, gridH);

  // Selected cell highlight
  const selectedCell = lastConfig.grid?.selectedCell ?? '1,1';
  const [selR, selC] = selectedCell.split(',').map(Number);
  if (selR >= 1 && selR <= rows && selC >= 1 && selC <= cols) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      gridX + (selC - 1) * cellW,
      gridY + (selR - 1) * cellH,
      cellW,
      cellH,
    );
  }

  // Drag hover highlight
  if (hoverCell) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(
      gridX + hoverCell.col * cellW,
      gridY + hoverCell.row * cellH,
      cellW,
      cellH,
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(
      gridX + hoverCell.col * cellW,
      gridY + hoverCell.row * cellH,
      cellW,
      cellH,
    );
    ctx.setLineDash([]);
  }

  ctx.restore(); // undo dpr scale
}
