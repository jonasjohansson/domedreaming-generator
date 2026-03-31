/**
 * Unwraps a geodesic mesh into a flat 2D layout.
 *
 * The approach:
 * 1. Place the 20 icosahedron parent triangles as a connected net (edge-to-edge unfolding via BFS)
 * 2. Within each parent triangle, subdivide using the same barycentric grid as geodesic.js
 * 3. Apply gap by shrinking each parent triangle toward its centroid
 *
 * @param {Object} options
 * @param {object} options.mesh - Output from generateGeodesic()
 * @param {string} options.layout - 'flower' | 'strip' | 'cross'
 * @param {number} options.gap - Space between face clusters (0-1, default 0.1)
 * @param {number} options.clusterRotation - Overall rotation in radians (default 0)
 * @returns {{ faces2D: { vertices: [number,number][], groupId: number, faceIndex: number }[], bounds: object }}
 */
export function unwrapMesh(options) {
  const { mesh, layout = 'flower', gap = 0.1, clusterRotation = 0 } = options || {};
  const { vertices, faces, faceGroups } = mesh;

  // Detect if this is a geodesic mesh (exactly 20 base groups with perfect square face counts)
  // or an arbitrary mesh (from loaded 3D model)
  const groupSet = new Set(faceGroups);
  const numGroups = groupSet.size;
  const isGeodesic = numGroups <= 20 && isGeodesicMesh(faceGroups, numGroups);

  let faces2D;
  if (isGeodesic) {
    faces2D = unwrapGeodesic(vertices, faces, faceGroups, layout, gap);
  } else {
    faces2D = unwrapGeneric(vertices, faces, faceGroups, gap);
  }

  // Apply overall rotation
  if (clusterRotation !== 0) {
    let cx = 0, cy = 0, count = 0;
    for (const f of faces2D) {
      for (const [x, y] of f.vertices) { cx += x; cy += y; count++; }
    }
    if (count > 0) {
      cx /= count; cy /= count;
      const cos = Math.cos(clusterRotation);
      const sin = Math.sin(clusterRotation);
      for (const f of faces2D) {
        f.vertices = f.vertices.map(([x, y]) => {
          const dx = x - cx, dy = y - cy;
          return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
        });
      }
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

// --- Geodesic detection ---

function isGeodesicMesh(faceGroups, numGroups) {
  if (numGroups > 20) return false;
  const counts = {};
  for (const g of faceGroups) {
    counts[g] = (counts[g] || 0) + 1;
  }
  const vals = Object.values(counts);
  const first = vals[0];
  // All groups should have the same count (freq²) and it should be a perfect square
  const allSame = vals.every(v => v === first);
  const sqrt = Math.sqrt(first);
  return allSame && Math.round(sqrt) * Math.round(sqrt) === first;
}

// --- Geodesic unwrap (icosahedron net with barycentric subdivision) ---

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
      faces2D.push({
        vertices: subTris[i],
        groupId: g,
        faceIndex: groupFaceIndices[i],
      });
    }
  }
  return faces2D;
}

// --- Generic unwrap (BFS edge-based unfolding for arbitrary meshes) ---

function unwrapGeneric(vertices, faces, faceGroups, gap) {
  // Build face adjacency from the actual mesh
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

  // BFS unfolding from face 0
  const placed = {};
  const root = 0;
  const [ai, bi, ci] = faces[root];
  const a = vertices[ai], b = vertices[bi], c = vertices[ci];

  // Flatten root triangle preserving edge lengths
  const dAB = dist3(a, b);
  const dAC = dist3(a, c);
  const dBC = dist3(b, c);

  const p0 = [0, 0];
  const p1 = [dAB, 0];
  const cxPos = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
  const cyPos = Math.sqrt(Math.max(0, dAC * dAC - cxPos * cxPos));
  const p2 = [cxPos, cyPos];

  placed[root] = {
    corners: [p0, p1, p2],
    vm: { [ai]: p0, [bi]: p1, [ci]: p2 },
  };

  const queue = [root];
  const visited = new Set([root]);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentVm = placed[current].vm;
    const currentFace = faces[current];

    for (const { neighbor, sharedEdge } of adj[current]) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
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
    }
  }

  // Build faces2D with optional gap
  const faces2D = [];
  for (let fi = 0; fi < faces.length; fi++) {
    if (!placed[fi]) continue;
    let corners = placed[fi].corners;
    if (gap > 0) corners = shrinkTriangle(corners, gap);
    faces2D.push({
      vertices: corners,
      groupId: faceGroups[fi],
      faceIndex: fi,
    });
  }
  return faces2D;
}

function dist3(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// --- Barycentric subdivision of a 2D triangle ---
// Generates sub-triangles in the same order as geodesic.js

function subdivideTriangle2D(p0, p1, p2, frequency) {
  const n = frequency;
  if (n <= 0) return [[p0, p1, p2]];

  const subTris = [];

  function vert(i, j) {
    const k = n - i - j;
    return [
      (p0[0] * k + p1[0] * i + p2[0] * j) / n,
      (p0[1] * k + p1[1] * i + p2[1] * j) / n,
    ];
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i; j++) {
      // Upward triangle
      subTris.push([vert(i, j), vert(i + 1, j), vert(i, j + 1)]);
      // Downward triangle
      if (i + j + 1 < n) {
        subTris.push([vert(i + 1, j), vert(i + 1, j + 1), vert(i, j + 1)]);
      }
    }
  }

  return subTris;
}

// --- Adjacency and unfolding helpers ---

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
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return [2 * projX - p[0], 2 * projY - p[1]];
}

function shrinkTriangle(corners, gap) {
  const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
  const cy = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
  const factor = 1 - gap;
  return corners.map(([x, y]) => [
    cx + (x - cx) * factor,
    cy + (y - cy) * factor,
  ]);
}

// --- Layout: Flower (edge-based BFS unfolding from face 0) ---
// Produces a connected icosahedron net radiating from the north pole.

function layoutFlower(baseFaces, gap) {
  const adjacency = buildAdjacency(baseFaces);
  const sideLen = 1;
  const h = sideLen * Math.sqrt(3) / 2;

  // Place root face as equilateral triangle
  const root = 0;
  const rootCorners = [[0, 0], [sideLen, 0], [sideLen / 2, h]];

  const placed = {};
  const rootFace = baseFaces[root];
  placed[root] = {
    corners: rootCorners,
    vm: {
      [rootFace[0]]: rootCorners[0],
      [rootFace[1]]: rootCorners[1],
      [rootFace[2]]: rootCorners[2],
    },
  };

  // BFS unfolding — each child face is reflected across the shared edge
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
      const edgeP0 = currentVm[sv0];
      const edgeP1 = currentVm[sv1];

      // Current face's vertex opposite the shared edge
      const currentThird = currentFace.find(v => v !== sv0 && v !== sv1);
      const currentThirdP = currentVm[currentThird];

      // Neighbor face's vertex opposite the shared edge
      const neighborFace = baseFaces[neighbor];
      const neighborThird = neighborFace.find(v => v !== sv0 && v !== sv1);

      // Reflect current's opposite vertex across the shared edge
      const reflected = reflectAcrossLine(currentThirdP, edgeP0, edgeP1);

      const vm = {
        [sv0]: edgeP0,
        [sv1]: edgeP1,
        [neighborThird]: reflected,
      };

      // Corners in baseFaces vertex order (critical for barycentric mapping)
      const corners = neighborFace.map(v => vm[v]);
      placed[neighbor] = { corners, vm };
    }
  }

  // Apply gap (shrink each triangle toward its centroid) and return corners
  const result = {};
  for (const fi of Object.keys(placed)) {
    result[fi] = gap > 0 ? shrinkTriangle(placed[fi].corners, gap) : [...placed[fi].corners];
  }
  return result;
}

// --- Layout: Strip (alternating up/down triangles in a row) ---

function layoutStrip(gap) {
  const sideLen = 1;
  const h = sideLen * Math.sqrt(3) / 2;
  const result = {};

  for (let i = 0; i < 20; i++) {
    const pair = Math.floor(i / 2);
    const isDown = i % 2 === 1;

    let corners;
    if (!isDown) {
      corners = [
        [pair * sideLen, 0],
        [(pair + 1) * sideLen, 0],
        [(pair + 0.5) * sideLen, h],
      ];
    } else {
      corners = [
        [(pair + 0.5) * sideLen, h],
        [(pair + 1) * sideLen, 0],
        [(pair + 1.5) * sideLen, h],
      ];
    }

    result[i] = gap > 0 ? shrinkTriangle(corners, gap) : corners;
  }
  return result;
}

// --- Layout: Cross (4 arms of 5 triangles) ---

function layoutCross(gap) {
  const sideLen = 1;
  const h = sideLen * Math.sqrt(3) / 2;
  const result = {};
  const step = sideLen * 1.2;

  const directions = [
    [1, 0],   // right
    [0, -1],  // up
    [-1, 0],  // left
    [0, 1],   // down
  ];

  for (let arm = 0; arm < 4; arm++) {
    const [dx, dy] = directions[arm];
    for (let i = 0; i < 5; i++) {
      const gi = arm * 5 + i;
      const dist = (i + 1) * step;
      const cx = dx * dist;
      const cy = dy * dist;

      const corners = [
        [cx - sideLen / 2, cy - h / 3],
        [cx + sideLen / 2, cy - h / 3],
        [cx, cy + 2 * h / 3],
      ];

      result[gi] = gap > 0 ? shrinkTriangle(corners, gap) : corners;
    }
  }
  return result;
}
