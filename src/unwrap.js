/**
 * Unwraps a geodesic or arbitrary mesh into a flat 2D layout.
 * Always produces connected nets. The seed controls net variation.
 *
 * Flower layout unfolds from the north pole vertex with 5-fold symmetry,
 * matching the Dome Dreaming logo aesthetic.
 */
export function unwrapMesh(options) {
  const {
    mesh, layout = 'flower', clusterRotation = 0,
    isGeodesic = true, seed = 1,
  } = options || {};
  const { vertices, faces, faceGroups } = mesh;

  // Determine frequency from face count
  const groupSet = new Set(faceGroups);
  const numGroups = groupSet.size;
  const facesPerGroup = faces.length / numGroups;
  const frequency = Math.round(Math.sqrt(facesPerGroup));

  let faces2D;
  if (layout === 'islands') {
    faces2D = unwrapGenericPatches(vertices, faces, faceGroups, seed);
  } else if (layout === 'connected') {
    faces2D = unwrapConnected(vertices, faces, faceGroups, seed);
  } else if (isGeodesic && layout === 'flower' && frequency > 1) {
    // Centered connected unfolding from north pole — complex shapes at high freq
    faces2D = unwrapCenteredFlower(vertices, faces, faceGroups, seed);
  } else if (isGeodesic && (layout === 'flower' || layout === 'strip' || layout === 'cross')) {
    // Classic 20-face layouts for freq 1
    faces2D = unwrapGeodesic(vertices, faces, faceGroups, layout, seed);
  } else {
    // Non-geodesic default
    faces2D = unwrapConnected(vertices, faces, faceGroups, seed);
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
// Seeded PRNG
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

function unwrapGeodesic(vertices, faces, faceGroups, layout, seed) {
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
      parentTriangles = layoutStrip();
      break;
    case 'cross':
      parentTriangles = layoutCross();
      break;
    case 'flower':
    default:
      parentTriangles = layoutPetal(baseFaces, seed);
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
// Petal layout: vertex-based 5-fold symmetric unfolding
// ============================================================
// Unfolds from the north pole vertex (vertex 0) with the 5 surrounding
// faces fanning out as petals. Remaining faces unfold from the outer
// edges, producing the Dome Dreaming logo shape.
//
// The seed controls:
// 1. Starting rotation angle
// 2. BFS neighbor order for outer faces (different net shapes)

function layoutPetal(baseFaces, seed) {
  const rand = mulberry32(seed);
  const adjacency = buildAdjacency(baseFaces);
  const sideLen = 1;

  // Vertex 0 is the north pole, shared by faces 0-4
  // Ring vertices in order: face[i] = [0, ringVerts[i], ringVerts[(i+1)%5]]
  // Face 0: [0,11,5], Face 1: [0,5,1], Face 2: [0,1,7], Face 3: [0,7,10], Face 4: [0,10,11]
  const ringVerts = [11, 5, 1, 7, 10];

  // Place vertex 0 at center
  const center = [0, 0];

  // Place ring vertices at 72° intervals (fills full circle for petal aesthetic)
  const startAngle = rand() * Math.PI * 2;
  const ringPos = {};
  for (let i = 0; i < 5; i++) {
    const angle = startAngle + (i * 72) * Math.PI / 180;
    ringPos[ringVerts[i]] = [
      Math.cos(angle) * sideLen,
      Math.sin(angle) * sideLen,
    ];
  }

  // Place the 5 center faces
  const placed = {};
  for (let fi = 0; fi < 5; fi++) {
    const face = baseFaces[fi];
    // face = [0, ringVerts[fi], ringVerts[(fi+1)%5]]
    const vm = {
      [face[0]]: center,
      [face[1]]: ringPos[face[1]],
      [face[2]]: ringPos[face[2]],
    };
    placed[fi] = { corners: face.map(v => vm[v]), vm };
  }

  // BFS unfold remaining 15 faces from outer edges of the ring
  const queue = shuffleArray([0, 1, 2, 3, 4], rand);
  const visited = new Set([0, 1, 2, 3, 4]);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentVm = placed[current].vm;
    const currentFace = baseFaces[current];

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
    result[fi] = [...placed[fi].corners];
  }
  return result;
}

// ============================================================
// Centered flower: BFS from north pole, radiates outward
// ============================================================
// At higher frequencies, produces complex centered shapes where
// the outline grows more intricate with more faces.

function unwrapCenteredFlower(vertices, faces, faceGroups, seed) {
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

  // Find the face closest to the north pole (highest average Y)
  // This centers the unfolding at the top of the dome
  let bestFace = 0, bestY = -Infinity;
  for (let fi = 0; fi < faces.length; fi++) {
    const [ai, bi, ci] = faces[fi];
    const avgY = (vertices[ai][1] + vertices[bi][1] + vertices[ci][1]) / 3;
    if (avgY > bestY) { bestY = avgY; bestFace = fi; }
  }

  // Use seed to optionally shift the start face among the top faces
  // (different seeds pick slightly different center faces for variety)
  const topFaces = [];
  for (let fi = 0; fi < faces.length; fi++) {
    const [ai, bi, ci] = faces[fi];
    const avgY = (vertices[ai][1] + vertices[bi][1] + vertices[ci][1]) / 3;
    if (avgY > bestY * 0.85) topFaces.push(fi);
  }
  const startFace = topFaces[Math.floor(rand() * topFaces.length)] || bestFace;

  const placed = {};
  const visited = new Set([startFace]);
  const queue = [startFace];
  const faces2D = [];

  // Place root face centered at origin
  const [ai, bi, ci] = faces[startFace];
  const a = vertices[ai], b = vertices[bi], c = vertices[ci];
  const dAB = dist3(a, b), dAC = dist3(a, c), dBC = dist3(b, c);
  if (dAB > 1e-10) {
    const px = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
    const py = Math.sqrt(Math.max(0, dAC * dAC - px * px));
    // Center the root triangle at origin
    const cx = (0 + dAB + px) / 3, cy = (0 + 0 + py) / 3;
    placed[startFace] = {
      corners: [[-cx, -cy], [dAB - cx, -cy], [px - cx, py - cy]],
      vm: { [ai]: [-cx, -cy], [bi]: [dAB - cx, -cy], [ci]: [px - cx, py - cy] },
    };
    faces2D.push({ vertices: placed[startFace].corners, groupId: faceGroups[startFace], faceIndex: startFace });
  }

  // BFS with shuffled neighbors — radiates outward from center
  while (queue.length > 0) {
    const current = queue.shift();
    if (!placed[current]) continue;
    const currentVm = placed[current].vm;
    const currentFace = faces[current];
    const neighbors = shuffleArray(adj[current], rand);

    for (const { neighbor, sharedEdge } of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);

      const [sv0, sv1] = sharedEdge;
      const currentThird = currentFace.find(v => v !== sv0 && v !== sv1);
      const reflected = reflectAcrossLine(currentVm[currentThird], currentVm[sv0], currentVm[sv1]);
      const neighborFace = faces[neighbor];
      const neighborThird = neighborFace.find(v => v !== sv0 && v !== sv1);
      const vm = { [sv0]: currentVm[sv0], [sv1]: currentVm[sv1], [neighborThird]: reflected };
      const corners = neighborFace.map(v => vm[v]);
      placed[neighbor] = { corners, vm };
      faces2D.push({ vertices: corners, groupId: faceGroups[neighbor], faceIndex: neighbor });
    }
  }

  return faces2D;
}

// ============================================================
// Connected unwrap: single spanning tree, all faces connected
// ============================================================
// One continuous net — seed controls root face and BFS neighbor
// ordering, producing different branching patterns. Higher frequency
// means more faces and more complex coastlines/arms.

function unwrapConnected(vertices, faces, faceGroups, seed) {
  const rand = mulberry32(seed);

  // Build adjacency with dihedral angles
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

  // Compute face normals
  const normals = faces.map(([ai, bi, ci]) => {
    const a = vertices[ai], b = vertices[bi], c = vertices[ci];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
  });

  // Build adjacency with dihedral angle per edge
  const adj = Array.from({ length: faces.length }, () => []);
  for (const key of Object.keys(edgeMap)) {
    const fis = edgeMap[key];
    if (fis.length === 2) {
      const [v0, v1] = key.split(',').map(Number);
      const n1 = normals[fis[0]], n2 = normals[fis[1]];
      const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      adj[fis[0]].push({ neighbor: fis[1], sharedEdge: [v0, v1], angle });
      adj[fis[1]].push({ neighbor: fis[0], sharedEdge: [v0, v1], angle });
    }
  }

  // BFS unfolding — skip edges at sharp creases (high dihedral angle)
  // This keeps one main connected piece but trims spiky branches
  const CREASE_THRESHOLD = 0.6; // ~34° — edges sharper than this get cut
  const startFace = Math.floor(rand() * faces.length);
  const placed = {};
  const visited = new Set([startFace]);
  const queue = [startFace];
  const faces2D = [];
  const deferred = []; // faces skipped due to sharp creases

  // Place root face
  const [ai, bi, ci] = faces[startFace];
  const a = vertices[ai], b = vertices[bi], c = vertices[ci];
  const dAB = dist3(a, b), dAC = dist3(a, c), dBC = dist3(b, c);
  if (dAB > 1e-10) {
    const px = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
    const py = Math.sqrt(Math.max(0, dAC * dAC - px * px));
    placed[startFace] = {
      corners: [[0, 0], [dAB, 0], [px, py]],
      vm: { [ai]: [0, 0], [bi]: [dAB, 0], [ci]: [px, py] },
    };
    faces2D.push({
      vertices: placed[startFace].corners,
      groupId: faceGroups[startFace],
      faceIndex: startFace,
    });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!placed[current]) continue;
    const currentVm = placed[current].vm;
    const currentFace = faces[current];

    // Sort neighbors: flattest edges first, then shuffle within similar angles
    const neighbors = shuffleArray(adj[current], rand);
    neighbors.sort((a, b) => a.angle - b.angle);

    for (const { neighbor, sharedEdge, angle } of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      // Cut at sharp creases — defer these faces
      if (angle > CREASE_THRESHOLD) {
        deferred.push(neighbor);
        continue;
      }

      queue.push(neighbor);

      const [sv0, sv1] = sharedEdge;
      const currentThird = currentFace.find(v => v !== sv0 && v !== sv1);
      const reflected = reflectAcrossLine(currentVm[currentThird], currentVm[sv0], currentVm[sv1]);
      const neighborFace = faces[neighbor];
      const neighborThird = neighborFace.find(v => v !== sv0 && v !== sv1);
      const vm = { [sv0]: currentVm[sv0], [sv1]: currentVm[sv1], [neighborThird]: reflected };
      const corners = neighborFace.map(v => vm[v]);
      placed[neighbor] = { corners, vm };
      faces2D.push({
        vertices: corners,
        groupId: faceGroups[neighbor],
        faceIndex: neighbor,
      });
    }
  }

  // Process deferred faces: unfold them as small connected sub-nets
  // starting from each deferred face, using the same crease-aware BFS
  for (const dStart of deferred) {
    if (placed[dStart]) continue; // already placed via another path

    const subQueue = [dStart];
    const subPlaced = {};

    const [da, db, dc] = faces[dStart];
    const va = vertices[da], vb = vertices[db], vc = vertices[dc];
    const d1 = dist3(va, vb), d2 = dist3(va, vc), d3 = dist3(vb, vc);
    if (d1 < 1e-10) continue;
    const cpx = (d1 * d1 + d2 * d2 - d3 * d3) / (2 * d1);
    const cpy = Math.sqrt(Math.max(0, d2 * d2 - cpx * cpx));

    subPlaced[dStart] = {
      corners: [[0, 0], [d1, 0], [cpx, cpy]],
      vm: { [da]: [0, 0], [db]: [d1, 0], [dc]: [cpx, cpy] },
    };
    placed[dStart] = subPlaced[dStart];
    faces2D.push({
      vertices: subPlaced[dStart].corners,
      groupId: faceGroups[dStart],
      faceIndex: dStart,
    });

    while (subQueue.length > 0) {
      const current = subQueue.shift();
      const curVm = subPlaced[current]?.vm || placed[current]?.vm;
      if (!curVm) continue;
      const curFace = faces[current];
      const nbrs = shuffleArray(adj[current], rand);

      for (const { neighbor, sharedEdge, angle } of nbrs) {
        if (visited.has(neighbor) || placed[neighbor]) continue;
        visited.add(neighbor);
        if (angle > CREASE_THRESHOLD) { deferred.push(neighbor); continue; }
        subQueue.push(neighbor);

        const [sv0, sv1] = sharedEdge;
        const curThird = curFace.find(v => v !== sv0 && v !== sv1);
        const refl = reflectAcrossLine(curVm[curThird], curVm[sv0], curVm[sv1]);
        const nbrFace = faces[neighbor];
        const nbrThird = nbrFace.find(v => v !== sv0 && v !== sv1);
        const vm = { [sv0]: curVm[sv0], [sv1]: curVm[sv1], [nbrThird]: refl };
        const corners = nbrFace.map(v => vm[v]);
        subPlaced[neighbor] = { corners, vm };
        placed[neighbor] = subPlaced[neighbor];
        faces2D.push({ vertices: corners, groupId: faceGroups[neighbor], faceIndex: neighbor });
      }
    }
  }

  // Any remaining unvisited faces
  for (let fi = 0; fi < faces.length; fi++) {
    if (placed[fi]) continue;
    const [a2, b2, c2] = faces[fi];
    const va = vertices[a2], vb = vertices[b2], vc = vertices[c2];
    const d1 = dist3(va, vb), d2 = dist3(va, vc), d3 = dist3(vb, vc);
    if (d1 < 1e-10) continue;
    const cpx = (d1 * d1 + d2 * d2 - d3 * d3) / (2 * d1);
    const cpy = Math.sqrt(Math.max(0, d2 * d2 - cpx * cpx));
    faces2D.push({ vertices: [[0, 0], [d1, 0], [cpx, cpy]], groupId: faceGroups[fi], faceIndex: fi });
  }

  return faces2D;
}

// ============================================================
// Generic unwrap: patch-based BFS edge-unfolding
// ============================================================

function unwrapGenericPatches(vertices, faces, faceGroups, seed) {
  const rand = mulberry32(seed);

  // Scale patch size with face count: more faces → smaller patches → more variety
  const MAX_PATCH = Math.max(4, Math.min(25, Math.floor(faces.length / 10)));

  // Build adjacency with dihedral angles
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

  // Compute face normals
  const normals = faces.map(([ai, bi, ci]) => {
    const a = vertices[ai], b = vertices[bi], c = vertices[ci];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return len > 0 ? [nx / len, ny / len, nz / len] : [0, 1, 0];
  });

  // Collect shared edges with dihedral angles
  const sharedEdges = [];
  for (const key of Object.keys(edgeMap)) {
    const fis = edgeMap[key];
    if (fis.length === 2) {
      const [v0, v1] = key.split(',').map(Number);
      const n1 = normals[fis[0]], n2 = normals[fis[1]];
      const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))); // 0 = coplanar
      sharedEdges.push({ f1: fis[0], f2: fis[1], edge: [v0, v1], angle });
    }
  }

  // Shuffle edges with seed, then sort by angle (flattest first)
  // The shuffle ensures different seeds produce different merge orders
  // for edges with similar angles (like on a sphere)
  const shuffled = shuffleArray(sharedEdges, rand);
  shuffled.sort((a, b) => a.angle - b.angle + (rand() - 0.5) * 0.3);

  // Union-Find to group faces into patches
  const parent = Array.from({ length: faces.length }, (_, i) => i);
  const patchSize = new Array(faces.length).fill(1);

  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) {
    a = find(a); b = find(b);
    if (a === b) return false;
    if (patchSize[a] < patchSize[b]) [a, b] = [b, a];
    parent[b] = a;
    patchSize[a] += patchSize[b];
    return true;
  }

  // Merge faces: use angle for hard meshes, random cuts for smooth ones
  // On a sphere, most angles are similar, so randomness drives the cuts
  const mergedEdges = new Set();
  for (const se of shuffled) {
    const ra = find(se.f1), rb = find(se.f2);
    if (ra === rb) continue;
    if (patchSize[ra] + patchSize[rb] > MAX_PATCH) continue;
    // Always cut sharp edges; randomly cut smooth ones for variety
    if (se.angle > 0.8) continue;
    if (rand() < 0.25) continue; // 25% chance to cut any edge → creates organic boundaries
    union(se.f1, se.f2);
    mergedEdges.add(se.f1 + ',' + se.f2);
    mergedEdges.add(se.f2 + ',' + se.f1);
  }

  // Group faces by patch root
  const patchGroups = {};
  for (let fi = 0; fi < faces.length; fi++) {
    const root = find(fi);
    if (!patchGroups[root]) patchGroups[root] = [];
    patchGroups[root].push(fi);
  }

  // Build per-patch adjacency (only merged edges)
  const adj = Array.from({ length: faces.length }, () => []);
  for (const se of sharedEdges) {
    const key1 = se.f1 + ',' + se.f2;
    if (mergedEdges.has(key1)) {
      adj[se.f1].push({ neighbor: se.f2, sharedEdge: se.edge });
      adj[se.f2].push({ neighbor: se.f1, sharedEdge: se.edge });
    }
  }

  // Unfold each patch via BFS and arrange
  const patches = [];
  for (const root of Object.keys(patchGroups)) {
    const group = patchGroups[root];
    const patchFaces = new Set(group);
    const start = group[Math.floor(rand() * group.length)];

    const placed = {};
    const queue = [start];
    const visited = new Set([start]);
    const patch = [];

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

    while (queue.length > 0) {
      const current = queue.shift();
      const currentVm = placed[current].vm;
      const currentFace = faces[current];

      for (const { neighbor, sharedEdge } of adj[current]) {
        if (visited.has(neighbor) || !patchFaces.has(neighbor)) continue;
        visited.add(neighbor);
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

    // Any faces in group not reached (disconnected within patch)
    for (const fi of group) {
      if (visited.has(fi)) continue;
      const [a2, b2, c2] = faces[fi];
      const va = vertices[a2], vb = vertices[b2], vc = vertices[c2];
      const d1 = dist3(va, vb), d2 = dist3(va, vc), d3 = dist3(vb, vc);
      if (d1 < 1e-10) continue;
      const cpx = (d1 * d1 + d2 * d2 - d3 * d3) / (2 * d1);
      const cpy = Math.sqrt(Math.max(0, d2 * d2 - cpx * cpx));
      patch.push({ corners: [[0, 0], [d1, 0], [cpx, cpy]], faceIndex: fi, groupId: faceGroups[fi] });
    }

    if (patch.length > 0) patches.push(patch);
  }

  // Sort patches largest first for better packing
  patches.sort((a, b) => b.length - a.length);

  // Compute patch bounding boxes and arrange in rows
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
  const targetRowWidth = Math.sqrt(totalArea) * 1.4;

  for (let pi = 0; pi < patches.length; pi++) {
    const patch = patches[pi];
    const bounds = patchBounds[pi];
    const spacing = Math.max(bounds.width, bounds.height) * 0.05;

    if (rowX + bounds.width > targetRowWidth && rowX > 0) {
      rowY += rowMaxH + spacing;
      rowX = 0;
      rowMaxH = 0;
    }

    const offsetX = rowX - bounds.minX;
    const offsetY = rowY - bounds.minY;

    for (const f of patch) {
      faces2D.push({
        vertices: f.corners.map(([x, y]) => [x + offsetX, y + offsetY]),
        groupId: f.groupId,
        faceIndex: f.faceIndex,
      });
    }

    rowX += bounds.width + spacing;
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

function layoutStrip() {
  const sideLen = 1, h = sideLen * Math.sqrt(3) / 2, result = {};
  for (let i = 0; i < 20; i++) {
    const pair = Math.floor(i / 2), isDown = i % 2 === 1;
    const corners = isDown
      ? [[(pair + 0.5) * sideLen, h], [(pair + 1) * sideLen, 0], [(pair + 1.5) * sideLen, h]]
      : [[pair * sideLen, 0], [(pair + 1) * sideLen, 0], [(pair + 0.5) * sideLen, h]];
    result[i] = corners;
  }
  return result;
}

// --- Layout: Cross ---

function layoutCross() {
  const sideLen = 1, h = sideLen * Math.sqrt(3) / 2, result = {}, step = sideLen * 1.2;
  const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  for (let arm = 0; arm < 4; arm++) {
    const [dx, dy] = dirs[arm];
    for (let i = 0; i < 5; i++) {
      const gi = arm * 5 + i, d = (i + 1) * step, cx = dx * d, cy = dy * d;
      const corners = [[cx - sideLen / 2, cy - h / 3], [cx + sideLen / 2, cy - h / 3], [cx, cy + 2 * h / 3]];
      result[gi] = corners;
    }
  }
  return result;
}
