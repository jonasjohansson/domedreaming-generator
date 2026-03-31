/**
 * Unwraps a geodesic or arbitrary mesh into a flat 2D layout.
 * Always produces connected nets — the seed controls which unfolding
 * pattern is used (different root face + BFS neighbor order = different net shape).
 */
export function unwrapMesh(options) {
  const {
    mesh, layout = 'flower', gap = 0.1, clusterRotation = 0,
    isGeodesic = true, seed = 1,
  } = options || {};
  const { vertices, faces, faceGroups } = mesh;

  let faces2D;
  if (isGeodesic) {
    faces2D = unwrapGeodesic(vertices, faces, faceGroups, layout, gap, seed);
  } else {
    faces2D = unwrapGenericPatches(vertices, faces, faceGroups, gap, seed);
  }

  // Apply overall rotation
  if (clusterRotation !== 0) {
    const [cx, cy] = centroidOf(faces2D);
    const cos = Math.cos(clusterRotation), sin = Math.sin(clusterRotation);
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

  return { faces2D, bounds: { width: maxX - minX, height: maxY - minY, minX, minY } };
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

function shuffleArray(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function centroidOf(faces2D) {
  let cx = 0, cy = 0, count = 0;
  for (const f of faces2D) {
    for (const [x, y] of f.vertices) { cx += x; cy += y; count++; }
  }
  return count > 0 ? [cx / count, cy / count] : [0, 0];
}

// ============================================================
// Geodesic unwrap
// ============================================================

function unwrapGeodesic(vertices, faces, faceGroups, layout, gap, seed) {
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
      // Seed controls the net shape: different root + BFS order
      parentTriangles = layoutFlowerSeeded(baseFaces, gap, seed);
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
// Flower layout with seed-controlled spanning tree
// ============================================================
// Different seeds produce different connected icosahedron nets by:
// 1. Choosing a different root face (seed % 20)
// 2. Shuffling BFS neighbor order (different spanning tree)

function layoutFlowerSeeded(baseFaces, gap, seed) {
  const rand = mulberry32(seed);
  const adjacency = buildAdjacency(baseFaces);
  const sideLen = 1, h = sideLen * Math.sqrt(3) / 2;

  // Pick root face based on seed
  const root = Math.floor(rand() * baseFaces.length);
  const rootCorners = [[0, 0], [sideLen, 0], [sideLen / 2, h]];
  const rootFace = baseFaces[root];

  const placed = {};
  placed[root] = {
    corners: rootCorners,
    vm: { [rootFace[0]]: rootCorners[0], [rootFace[1]]: rootCorners[1], [rootFace[2]]: rootCorners[2] },
  };

  // BFS with shuffled neighbor order → different spanning tree = different net
  const queue = [root];
  const visited = new Set([root]);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentVm = placed[current].vm;
    const currentFace = baseFaces[current];

    // Shuffle neighbors for this face → different unfolding pattern
    const neighbors = shuffleArray(adjacency[current], rand);

    for (const { neighbor, sharedEdge } of neighbors) {
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

// ============================================================
// Generic unwrap: patch-based BFS edge-unfolding
// ============================================================

const MAX_PATCH_SIZE = 40;

function unwrapGenericPatches(vertices, faces, faceGroups, gap, seed) {
  const rand = mulberry32(seed);

  // Build adjacency
  const edgeMap = {};
  for (let fi = 0; fi < faces.length; fi++) {
    const face = faces[fi];
    for (let e = 0; e < 3; e++) {
      const v0 = face[e], v1 = face[(e + 1) % 3];
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

  // Create patches via BFS with shuffled neighbor order
  const globalVisited = new Set();
  const patches = [];

  // Randomize starting order
  const startOrder = shuffleArray(Array.from({ length: faces.length }, (_, i) => i), rand);

  for (const start of startOrder) {
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
    if (dAB < 1e-10) continue;
    const px = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
    const py = Math.sqrt(Math.max(0, dAC * dAC - px * px));

    placed[start] = {
      corners: [[0, 0], [dAB, 0], [px, py]],
      vm: { [ai]: [0, 0], [bi]: [dAB, 0], [ci]: [px, py] },
    };
    patch.push({ corners: placed[start].corners, faceIndex: start, groupId: faceGroups[start] });

    while (queue.length > 0 && patch.length < MAX_PATCH_SIZE) {
      const current = queue.shift();
      const currentVm = placed[current].vm;
      const currentFace = faces[current];

      const neighbors = shuffleArray(adj[current], rand);

      for (const { neighbor, sharedEdge } of neighbors) {
        if (patchVisited.has(neighbor)) continue;
        if (patch.length >= MAX_PATCH_SIZE) break;

        patchVisited.add(neighbor);
        globalVisited.add(neighbor);
        queue.push(neighbor);

        const [sv0, sv1] = sharedEdge;
        const currentThird = currentFace.find(v => v !== sv0 && v !== sv1);
        const reflected = reflectAcrossLine(currentVm[currentThird], currentVm[sv0], currentVm[sv1]);
        const neighborFace = faces[neighbor];
        const neighborThird = neighborFace.find(v => v !== sv0 && v !== sv1);
        const vm = { [sv0]: currentVm[sv0], [sv1]: currentVm[sv1], [neighborThird]: reflected };
        const corners = neighborFace.map(v => vm[v]);

        placed[neighbor] = { corners, vm };
        patch.push({ corners, faceIndex: neighbor, groupId: faceGroups[neighbor] });
      }
    }

    patches.push(patch);
  }

  // Arrange patches in rows
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

  const faces2D = [];
  let rowX = 0, rowY = 0, rowMaxH = 0;
  const totalArea = patchBounds.reduce((s, b) => s + b.width * b.height, 0);
  const targetRowWidth = Math.sqrt(totalArea) * 1.5;

  for (let pi = 0; pi < patches.length; pi++) {
    const patch = patches[pi];
    const bounds = patchBounds[pi];
    const gapOffset = gap * 0.3;

    if (rowX + bounds.width > targetRowWidth && rowX > 0) {
      rowY += rowMaxH + gapOffset;
      rowX = 0;
      rowMaxH = 0;
    }

    const offsetX = rowX - bounds.minX;
    const offsetY = rowY - bounds.minY;

    for (const f of patch) {
      let corners = f.corners.map(([x, y]) => [x + offsetX, y + offsetY]);
      if (gap > 0) corners = shrinkTriangle(corners, gap * 0.15);
      faces2D.push({ vertices: corners, groupId: f.groupId, faceIndex: f.faceIndex });
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
      if (i + j + 1 < n) subTris.push([vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)]);
    }
  }
  return subTris;
}

function buildAdjacency(baseFaces) {
  const edgeMap = {};
  for (let fi = 0; fi < baseFaces.length; fi++) {
    const face = baseFaces[fi];
    for (let e = 0; e < 3; e++) {
      const v0 = face[e], v1 = face[(e + 1) % 3];
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
