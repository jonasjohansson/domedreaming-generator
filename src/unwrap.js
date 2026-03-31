/**
 * Unwraps a geodesic or arbitrary mesh into a flat 2D layout.
 *
 * Geodesic: icosahedron net with barycentric subdivision.
 * Generic: patch-based BFS edge-unfolding (connected groups of ~30 faces).
 * Both support organic randomization (scatter, jitter, spin, drift, scale variation).
 */
export function unwrapMesh(options) {
  const {
    mesh, layout = 'flower', gap = 0.1, clusterRotation = 0,
    isGeodesic = true,
    scatter = 0, jitter = 0, groupSpin = 0, scaleVar = 0, drift = 0, seed = 42,
  } = options || {};
  const { vertices, faces, faceGroups } = mesh;

  let faces2D;
  if (isGeodesic) {
    faces2D = unwrapGeodesic(vertices, faces, faceGroups, layout, gap);
  } else {
    faces2D = unwrapGenericPatches(vertices, faces, faceGroups, gap);
  }

  // --- Organic transforms (applied per face-group / patch) ---
  if (scatter > 0 || jitter > 0 || groupSpin > 0 || scaleVar > 0 || drift > 0) {
    applyOrganicTransforms(faces2D, { scatter, jitter, groupSpin, scaleVar, drift, seed });
  }

  // Apply overall rotation
  if (clusterRotation !== 0) {
    const [cx, cy] = centroid(faces2D);
    const cos = Math.cos(clusterRotation);
    const sin = Math.sin(clusterRotation);
    for (const f of faces2D) {
      f.vertices = f.vertices.map(([x, y]) => {
        const dx = x - cx, dy = y - cy;
        return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
      });
    }
  }

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of faces2D) {
    for (const [x, y] of f.vertices) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }

  return {
    faces2D,
    bounds: { width: maxX - minX, height: maxY - minY, minX, minY },
  };
}

// ============================================================
// Seeded PRNG (mulberry32)
// ============================================================

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Organic transforms
// ============================================================

function centroid(faces2D) {
  let cx = 0, cy = 0, count = 0;
  for (const f of faces2D) {
    for (const [x, y] of f.vertices) { cx += x; cy += y; count++; }
  }
  return count > 0 ? [cx / count, cy / count] : [0, 0];
}

function applyOrganicTransforms(faces2D, opts) {
  const { scatter, jitter, groupSpin, scaleVar, drift, seed } = opts;
  const rand = mulberry32(seed);

  // Group faces by groupId
  const groups = {};
  for (const f of faces2D) {
    const g = f.groupId;
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  }

  const [globalCx, globalCy] = centroid(faces2D);

  for (const gid of Object.keys(groups)) {
    const groupFaces = groups[gid];

    // Group centroid
    let gcx = 0, gcy = 0, gc = 0;
    for (const f of groupFaces) {
      for (const [x, y] of f.vertices) { gcx += x; gcy += y; gc++; }
    }
    gcx /= gc; gcy /= gc;

    // Scatter: push group away from global center
    const scatterDx = (gcx - globalCx) * scatter;
    const scatterDy = (gcy - globalCy) * scatter;

    // Jitter: random offset
    const jitterDx = (rand() - 0.5) * 2 * jitter;
    const jitterDy = (rand() - 0.5) * 2 * jitter;

    // Drift: smooth directional push based on group position (Perlin-like)
    const angle = rand() * Math.PI * 2;
    const driftDx = Math.cos(angle) * drift * 0.5;
    const driftDy = Math.sin(angle) * drift * 0.5;

    // Group spin: random rotation around group centroid
    const spinAngle = (rand() - 0.5) * 2 * Math.PI * groupSpin;
    const cos = Math.cos(spinAngle);
    const sin = Math.sin(spinAngle);

    // Scale variation
    const scaleFactor = 1 + (rand() - 0.5) * 2 * scaleVar;

    const totalDx = scatterDx + jitterDx + driftDx;
    const totalDy = scatterDy + jitterDy + driftDy;

    for (const f of groupFaces) {
      f.vertices = f.vertices.map(([x, y]) => {
        // Rotate around group centroid
        let dx = x - gcx, dy = y - gcy;
        let rx = dx * cos - dy * sin;
        let ry = dx * sin + dy * cos;
        // Scale around group centroid
        rx *= scaleFactor;
        ry *= scaleFactor;
        // Translate
        return [rx + gcx + totalDx, ry + gcy + totalDy];
      });
    }
  }
}

// ============================================================
// Geodesic unwrap (icosahedron net with barycentric subdivision)
// ============================================================

function unwrapGeodesic(vertices, faces, faceGroups, layout, gap) {
  const baseFaces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const facesByGroup = {};
  for (let i = 0; i < faces.length; i++) {
    const g = faceGroups[i];
    if (!facesByGroup[g]) facesByGroup[g] = [];
    facesByGroup[g].push(i);
  }

  const firstGroupId = Number(Object.keys(facesByGroup)[0]);
  const facesPerGroup = facesByGroup[firstGroupId].length;
  const frequency = Math.round(Math.sqrt(facesPerGroup));

  let parentTriangles;
  switch (layout) {
    case 'strip':
      parentTriangles = layoutStrip(gap);
      break;
    case 'cross':
      parentTriangles = layoutCross(gap);
      break;
    case 'flower':
    default:
      parentTriangles = layoutFlower(baseFaces, gap);
      break;
  }

  const faces2D = [];
  for (const gStr of Object.keys(facesByGroup)) {
    const g = Number(gStr);
    if (!parentTriangles[g]) continue;
    const [p0, p1, p2] = parentTriangles[g];
    const subTris = subdivideTriangle2D(p0, p1, p2, frequency);
    const groupFaceIndices = facesByGroup[g];
    for (let i = 0; i < groupFaceIndices.length && i < subTris.length; i++) {
      faces2D.push({ vertices: subTris[i], groupId: g, faceIndex: groupFaceIndices[i] });
    }
  }
  return faces2D;
}

// ============================================================
// Generic unwrap: patch-based BFS edge-unfolding
// ============================================================
// Unfolds faces in connected patches (max ~40 faces each) using edge
// reflection, then arranges patches in a grid. Produces connected "islands"
// similar to the Dome Dreaming logo aesthetic.

const MAX_PATCH_SIZE = 40;

function unwrapGenericPatches(vertices, faces, faceGroups, gap) {
  // Build face adjacency with shared edge info
  const edgeMap = {};
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    for (let e = 0; e < 3; e++) {
      const v0 = face[e];
      const v1 = face[(e + 1) % 3];
      const key = Math.min(v0, v1) + ',' + Math.max(v0, v1);
      if (!edgeMap[key]) edgeMap[key] = [];
      edgeMap[key].push(fi);
    }
  }

  const adj = Array.from({ length: faces.length }, () => []);
  for (const key of Object.keys(edgeMap)) {
    const fis = edgeMap[key];
    if (fis.length === 2) {
      const [v0, v1] = key.split(',').map(Number);
      adj[fis[0]].push({ neighbor: fis[1], sharedEdge: [v0, v1] });
      adj[fis[1]].push({ neighbor: fis[0], sharedEdge: [v0, v1] });
    }
  }

  // Create patches via BFS with size limit
  const globalVisited = new Set();
  const patches = []; // each patch = array of { corners, faceIndex, groupId }

  for (let start = 0; start < faces.length; start++) {
    if (globalVisited.has(start)) continue;

    const patch = [];
    const placed = {};
    const queue = [start];
    const patchVisited = new Set([start]);
    globalVisited.add(start);

    // Place root face
    const [ai, bi, ci] = faces[start];
    const a = vertices[ai], b = vertices[bi], c = vertices[ci];
    const dAB = dist3(a, b), dAC = dist3(a, c), dBC = dist3(b, c);
    if (dAB < 1e-10) { continue; }
    const px = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
    const py = Math.sqrt(Math.max(0, dAC * dAC - px * px));
    const rootCorners = [[0, 0], [dAB, 0], [px, py]];

    placed[start] = {
      corners: rootCorners,
      vm: { [ai]: [0, 0], [bi]: [dAB, 0], [ci]: [px, py] },
    };
    patch.push({ corners: rootCorners, faceIndex: start, groupId: faceGroups[start] });

    while (queue.length > 0 && patch.length < MAX_PATCH_SIZE) {
      const current = queue.shift();
      const currentVm = placed[current].vm;
      const currentFace = faces[current];

      for (const { neighbor, sharedEdge } of adj[current]) {
        if (patchVisited.has(neighbor)) continue;
        if (patch.length >= MAX_PATCH_SIZE) break;

        patchVisited.add(neighbor);
        globalVisited.add(neighbor);
        queue.push(neighbor);

        const [sv0, sv1] = sharedEdge;
        const edgeP0 = currentVm[sv0];
        const edgeP1 = currentVm[sv1];
        const currentThird = currentFace.find(v => v !== sv0 && v !== sv1);
        const currentThirdP = currentVm[currentThird];

        const neighborFace = faces[neighbor];
        const neighborThird = neighborFace.find(v => v !== sv0 && v !== sv1);
        const reflected = reflectAcrossLine(currentThirdP, edgeP0, edgeP1);

        const vm = { [sv0]: edgeP0, [sv1]: edgeP1, [neighborThird]: reflected };
        const corners = neighborFace.map(v => vm[v]);

        placed[neighbor] = { corners, vm };
        patch.push({ corners, faceIndex: neighbor, groupId: faceGroups[neighbor] });
      }
    }

    patches.push(patch);
  }

  // Compute bounding box of each patch, then arrange in grid
  const patchBounds = patches.map(patch => {
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
    for (const f of patch) {
      for (const [x, y] of f.corners) {
        mnX = Math.min(mnX, x); mnY = Math.min(mnY, y);
        mxX = Math.max(mxX, x); mxY = Math.max(mxY, y);
      }
    }
    return { minX: mnX, minY: mnY, width: mxX - mnX, height: mxY - mnY };
  });

  // Simple row packing
  const faces2D = [];
  let rowX = 0, rowY = 0, rowMaxH = 0;
  const totalWidth = patchBounds.reduce((s, b) => s + b.width, 0);
  const targetRowWidth = Math.sqrt(totalWidth * patchBounds.reduce((s, b) => Math.max(s, b.height), 0) * patches.length) * 0.8;

  for (let pi = 0; pi < patches.length; pi++) {
    const patch = patches[pi];
    const bounds = patchBounds[pi];
    const gapOffset = gap * 0.3;

    // Check if we need a new row
    if (rowX + bounds.width > targetRowWidth && rowX > 0) {
      rowY += rowMaxH + gapOffset;
      rowX = 0;
      rowMaxH = 0;
    }

    const offsetX = rowX - bounds.minX;
    const offsetY = rowY - bounds.minY;

    // Assign a unique groupId per patch for organic transforms
    const patchGroupId = pi;

    for (const f of patch) {
      let corners = f.corners.map(([x, y]) => [x + offsetX, y + offsetY]);
      if (gap > 0) corners = shrinkTriangle(corners, gap * 0.15);
      faces2D.push({
        vertices: corners,
        groupId: patchGroupId,
        faceIndex: f.faceIndex,
      });
    }

    rowX += bounds.width + gapOffset;
    rowMaxH = Math.max(rowMaxH, bounds.height);
  }

  return faces2D;
}

// ============================================================
// Helpers
// ============================================================

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function subdivideTriangle2D(p0, p1, p2, frequency) {
  const n = frequency;
  if (n <= 0) return [[p0, p1, p2]];
  const subTris = [];
  function vert(i, j) {
    const k = n - i - j;
    return [(p0[0] * k + p1[0] * i + p2[0] * j) / n, (p0[1] * k + p1[1] * i + p2[1] * j) / n];
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      subTris.push([vert(i, j), vert(i + 1, j), vert(i, j + 1)]);
      if (i + j + 1 < n) {
        subTris.push([vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)]);
      }
    }
  }
  return subTris;
}

function buildAdjacency(baseFaces) {
  const edgeMap = {};
  for (let fi = 0; fi < baseFaces.length; fi++) {
    const face = baseFaces[fi];
    for (let e = 0; e < 3; e++) {
      const v0 = face[e];
      const v1 = face[(e + 1) % 3];
      const key = Math.min(v0, v1) + ',' + Math.max(v0, v1);
      if (!edgeMap[key]) edgeMap[key] = [];
      edgeMap[key].push(fi);
    }
  }
  const adj = Array.from({ length: baseFaces.length }, () => []);
  for (const key of Object.keys(edgeMap)) {
    const fis = edgeMap[key];
    if (fis.length === 2) {
      const [v0, v1] = key.split(',').map(Number);
      adj[fis[0]].push({ neighbor: fis[1], sharedEdge: [v0, v1] });
      adj[fis[1]].push({ neighbor: fis[0], sharedEdge: [v0, v1] });
    }
  }
  return adj;
}

function reflectAcrossLine(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  return [2 * (a[0] + t * dx) - p[0], 2 * (a[1] + t * dy) - p[1]];
}

function shrinkTriangle(corners, amount) {
  const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
  const cy = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
  const f = 1 - amount;
  return corners.map(([x, y]) => [cx + (x - cx) * f, cy + (y - cy) * f]);
}

// --- Layout: Flower (BFS edge-unfolding from face 0) ---

function layoutFlower(baseFaces, gap) {
  const adjacency = buildAdjacency(baseFaces);
  const sideLen = 1, h = sideLen * Math.sqrt(3) / 2;
  const root = 0;
  const rootCorners = [[0, 0], [sideLen, 0], [sideLen / 2, h]];
  const rootFace = baseFaces[root];

  const placed = {};
  placed[root] = {
    corners: rootCorners,
    vm: { [rootFace[0]]: rootCorners[0], [rootFace[1]]: rootCorners[1], [rootFace[2]]: rootCorners[2] },
  };

  const queue = [root];
  const visited = new Set([root]);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentVm = placed[current].vm;
    const currentFace = baseFaces[current];
    for (const { neighbor, sharedEdge } of adjacency[current]) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
      const [sv0, sv1] = sharedEdge;
      const currentThird = currentFace.find(v => v !== sv0 && v !== sv1);
      const reflected = reflectAcrossLine(currentVm[currentThird], currentVm[sv0], currentVm[sv1]);
      const neighborFace = baseFaces[neighbor];
      const neighborThird = neighborFace.find(v => v !== sv0 && v !== sv1);
      const vm = { [sv0]: currentVm[sv0], [sv1]: currentVm[sv1], [neighborThird]: reflected };
      placed[neighbor] = { corners: neighborFace.map(v => vm[v]), vm };
    }
  }

  const result = {};
  for (const fi of Object.keys(placed)) {
    result[fi] = gap > 0 ? shrinkTriangle(placed[fi].corners, gap) : [...placed[fi].corners];
  }
  return result;
}

// --- Layout: Strip ---

function layoutStrip(gap) {
  const sideLen = 1, h = sideLen * Math.sqrt(3) / 2, result = {};
  for (let i = 0; i < 20; i++) {
    const pair = Math.floor(i / 2), isDown = i % 2 === 1;
    const corners = isDown
      ? [[(pair + 0.5) * sideLen, h], [(pair + 1) * sideLen, 0], [(pair + 1.5) * sideLen, h]]
      : [[pair * sideLen, 0], [(pair + 1) * sideLen, 0], [(pair + 0.5) * sideLen, h]];
    result[i] = gap > 0 ? shrinkTriangle(corners, gap) : corners;
  }
  return result;
}

// --- Layout: Cross ---

function layoutCross(gap) {
  const sideLen = 1, h = sideLen * Math.sqrt(3) / 2, result = {}, step = sideLen * 1.2;
  const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  for (let arm = 0; arm < 4; arm++) {
    const [dx, dy] = dirs[arm];
    for (let i = 0; i < 5; i++) {
      const gi = arm * 5 + i, d = (i + 1) * step, cx = dx * d, cy = dy * d;
      const corners = [[cx - sideLen / 2, cy - h / 3], [cx + sideLen / 2, cy - h / 3], [cx, cy + 2 * h / 3]];
      result[gi] = gap > 0 ? shrinkTriangle(corners, gap) : corners;
    }
  }
  return result;
}
