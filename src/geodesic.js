import { SHAPES } from './shapes.js';

/**
 * Generates geodesic dome geometry by subdividing an icosahedron,
 * or returns a preset shape geometry.
 *
 * @param {Object} options
 * @param {string} options.shape - Shape preset name (default: 'geodesic')
 * @param {number} options.frequency - Subdivision level (1-6)
 * @param {number} options.radius - Dome radius
 * @param {boolean} options.hemisphere - If true, only top half
 * @param {number} options.truncation - Cut-off latitude (0-1, 1 = full sphere)
 * @param {number} options.rotation - Y-axis rotation in radians
 * @returns {{ vertices: number[][], faces: number[][], normals: number[][], faceGroups: number[] }}
 */
export function generateGeodesic(options) {
  const {
    shape = 'geodesic',
    frequency = 1,
    radius = 1,
    hemisphere = false,
    truncation = 0.5,
    rotation = 0,
  } = options || {};

  // Dome is geodesic with hemisphere forced on
  const isDome = shape === 'dome';
  const effectiveHemisphere = isDome ? true : hemisphere;

  // Non-geodesic preset shapes
  if (shape !== 'geodesic' && !isDome && SHAPES[shape]) {
    const base = SHAPES[shape]();
    return finalize(base.vertices, base.faces, base.faceGroups, radius, effectiveHemisphere, truncation, rotation);
  }

  // --- Icosahedron base geometry ---
  const t = (1 + Math.sqrt(5)) / 2; // golden ratio

  const baseVertices = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((v) => normalize(v));

  const baseFaces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];

  if (frequency === 1) {
    // No subdivision needed
    return finalize(baseVertices, baseFaces, baseFaces.map((_, i) => i), radius, effectiveHemisphere, truncation, rotation);
  }

  // --- Frequency-based subdivision ---
  // For each icosahedron face, subdivide into frequency^2 sub-triangles
  // by interpolating along edges and projecting onto unit sphere.
  const vertices = [];
  const faces = [];
  const faceGroups = [];
  const vertexCache = {};

  // Cache a vertex by its creation key, return its index
  function addVertex(v) {
    const key = v.map((c) => c.toFixed(10)).join(',');
    if (vertexCache[key] !== undefined) return vertexCache[key];
    const idx = vertices.length;
    vertices.push(v);
    vertexCache[key] = idx;
    return idx;
  }

  // Pre-add icosahedron vertices
  for (const v of baseVertices) {
    addVertex(v);
  }

  const n = frequency;

  for (let fi = 0; fi < baseFaces.length; fi++) {
    const [ai, bi, ci] = baseFaces[fi];
    const a = baseVertices[ai];
    const b = baseVertices[bi];
    const c = baseVertices[ci];

    // Build a grid of vertices for this face
    // grid[i][j] where i+j <= n, using barycentric coords (i/n, j/n, (n-i-j)/n)
    const grid = [];
    for (let i = 0; i <= n; i++) {
      grid[i] = [];
      for (let j = 0; j <= n - i; j++) {
        const k = n - i - j;
        // Interpolate in 3D then project onto unit sphere
        const v = normalize([
          (a[0] * k + b[0] * i + c[0] * j) / n,
          (a[1] * k + b[1] * i + c[1] * j) / n,
          (a[2] * k + b[2] * i + c[2] * j) / n,
        ]);
        grid[i][j] = addVertex(v);
      }
    }

    // Generate sub-faces from the grid
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        // Upward triangle
        faces.push([grid[i][j], grid[i + 1][j], grid[i][j + 1]]);
        faceGroups.push(fi);

        // Downward triangle (if it exists)
        if (i + j + 1 < n) {
          faces.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
          faceGroups.push(fi);
        }
      }
    }
  }

  return finalize(vertices, faces, faceGroups, radius, effectiveHemisphere, truncation, rotation);
}

/**
 * Apply radius scaling, hemisphere filtering, rotation, and compute normals.
 */
function finalize(vertices, faces, faceGroups, radius, hemisphere, truncation, rotation) {
  // Scale to radius
  let verts = vertices.map((v) => [
    v[0] * radius,
    v[1] * radius,
    v[2] * radius,
  ]);

  // Hemisphere / truncation filtering
  let filteredFaces = faces;
  let filteredGroups = faceGroups;
  if (hemisphere) {
    const threshold = -radius * truncation;
    filteredFaces = [];
    filteredGroups = [];
    for (let i = 0; i < faces.length; i++) {
      const [a, b, c] = faces[i];
      if (
        verts[a][1] < threshold &&
        verts[b][1] < threshold &&
        verts[c][1] < threshold
      ) {
        continue;
      }
      filteredFaces.push(faces[i]);
      filteredGroups.push(faceGroups[i]);
    }
  }

  // Y-axis rotation
  if (rotation !== 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    verts = verts.map(([x, y, z]) => [
      x * cos + z * sin,
      y,
      -x * sin + z * cos,
    ]);
  }

  // Normals (normalized positions for a sphere)
  const normals = verts.map((v) => normalize(v));

  return {
    vertices: verts,
    faces: filteredFaces,
    normals,
    faceGroups: filteredGroups,
  };
}

// --- Helpers ---

function normalize(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}
