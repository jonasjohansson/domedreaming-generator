/**
 * Base geometry generators for preset shapes.
 * Each returns { vertices: number[][], faces: number[][], faceGroups: number[] }
 * All vertices are on or near the unit sphere (normalized where appropriate).
 */

const PHI = (1 + Math.sqrt(5)) / 2;

function norm(v) {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ── Tetrahedron ──────────────────────────────────────────────

export function tetrahedron() {
  const a = 1 / Math.sqrt(3);
  const vertices = [
    [a, a, a],
    [a, -a, -a],
    [-a, a, -a],
    [-a, -a, a],
  ].map(norm);

  const faces = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 1],
    [1, 3, 2],
  ];
  return { vertices, faces, faceGroups: faces.map((_, i) => i) };
}

// ── Cube (triangulated) ─────────────────────────────────────

export function cube() {
  const s = 1 / Math.sqrt(3);
  const vertices = [
    [-s, -s, -s], // 0
    [ s, -s, -s], // 1
    [ s,  s, -s], // 2
    [-s,  s, -s], // 3
    [-s, -s,  s], // 4
    [ s, -s,  s], // 5
    [ s,  s,  s], // 6
    [-s,  s,  s], // 7
  ];

  // 6 faces × 2 triangles each, grouped by face
  const faces = [
    [0, 2, 1], [0, 3, 2], // front (-Z)
    [4, 5, 6], [4, 6, 7], // back (+Z)
    [0, 1, 5], [0, 5, 4], // bottom
    [2, 3, 7], [2, 7, 6], // top
    [0, 4, 7], [0, 7, 3], // left
    [1, 2, 6], [1, 6, 5], // right
  ];
  const faceGroups = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
  return { vertices, faces, faceGroups };
}

// ── Octahedron ──────────────────────────────────────────────

export function octahedron() {
  const vertices = [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, 0, -1],
    [0, -1, 0],
  ];

  const faces = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 1],
    [5, 2, 1],
    [5, 3, 2],
    [5, 4, 3],
    [5, 1, 4],
  ];
  return { vertices, faces, faceGroups: faces.map((_, i) => i) };
}

// ── Dodecahedron (triangulated pentagons) ───────────────────

export function dodecahedron() {
  const a = 1 / PHI;
  const b = PHI;

  const raw = [
    // Cube vertices
    [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1],
    [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
    // Rectangle vertices
    [0, -a, -b], [0, -a, b], [0, a, -b], [0, a, b],
    [-a, -b, 0], [-a, b, 0], [a, -b, 0], [a, b, 0],
    [-b, 0, -a], [-b, 0, a], [b, 0, -a], [b, 0, a],
  ];
  const vertices = raw.map(norm);

  // 12 pentagonal faces, each triangulated into 3 triangles (fan from first vertex)
  const pentagons = [
    [3, 11, 7, 15, 13],
    [3, 13, 2, 16, 17],
    [3, 17, 1, 9, 11],
    [7, 11, 9, 5, 19],
    [7, 19, 18, 6, 15],
    [15, 6, 10, 2, 13],
    [2, 10, 8, 0, 16],
    [16, 0, 12, 1, 17],
    [1, 12, 14, 5, 9],
    [5, 14, 4, 18, 19],
    [4, 14, 12, 0, 8],
    [18, 4, 8, 10, 6],
  ];

  const faces = [];
  const faceGroups = [];
  for (let pi = 0; pi < pentagons.length; pi++) {
    const p = pentagons[pi];
    for (let j = 1; j < p.length - 1; j++) {
      faces.push([p[0], p[j], p[j + 1]]);
      faceGroups.push(pi);
    }
  }

  return { vertices, faces, faceGroups };
}

// ── Icosahedron ─────────────────────────────────────────────

export function icosahedron() {
  const t = PHI;
  const vertices = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(norm);

  const faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { vertices, faces, faceGroups: faces.map((_, i) => i) };
}

// ── Cylinder ────────────────────────────────────────────────

export function cylinder(segments = 24) {
  const vertices = [];
  const faces = [];
  const faceGroups = [];

  // Top and bottom center
  const topCenter = vertices.length;
  vertices.push([0, 1, 0]);
  const botCenter = vertices.length;
  vertices.push([0, -1, 0]);

  // Ring vertices: top ring then bottom ring
  const topStart = vertices.length;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    vertices.push([Math.cos(a), 1, Math.sin(a)]);
  }
  const botStart = vertices.length;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    vertices.push([Math.cos(a), -1, Math.sin(a)]);
  }

  // Normalize all to unit sphere
  for (let i = 0; i < vertices.length; i++) {
    vertices[i] = norm(vertices[i]);
  }

  let groupId = 0;

  // Top cap
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push([topCenter, topStart + i, topStart + next]);
    faceGroups.push(groupId);
  }
  groupId++;

  // Bottom cap
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push([botCenter, botStart + next, botStart + i]);
    faceGroups.push(groupId);
  }
  groupId++;

  // Side quads (2 triangles each)
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push([topStart + i, botStart + i, botStart + next]);
    faces.push([topStart + i, botStart + next, topStart + next]);
    faceGroups.push(groupId);
    faceGroups.push(groupId);
    groupId++;
  }

  return { vertices, faces, faceGroups };
}

// ── Cone ────────────────────────────────────────────────────

export function cone(segments = 24) {
  const vertices = [];
  const faces = [];
  const faceGroups = [];

  const apex = 0;
  vertices.push([0, 1, 0]);
  const botCenter = 1;
  vertices.push([0, -1, 0]);

  const ringStart = vertices.length;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    vertices.push([Math.cos(a), -1, Math.sin(a)]);
  }

  for (let i = 0; i < vertices.length; i++) {
    vertices[i] = norm(vertices[i]);
  }

  let groupId = 0;

  // Side faces
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push([apex, ringStart + i, ringStart + next]);
    faceGroups.push(groupId);
    groupId++;
  }

  // Bottom cap
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    faces.push([botCenter, ringStart + next, ringStart + i]);
    faceGroups.push(groupId);
  }

  return { vertices, faces, faceGroups };
}

// ── Torus ───────────────────────────────────────────────────

export function torus(majorSegments = 24, minorSegments = 12, majorR = 0.7, minorR = 0.3) {
  const vertices = [];
  const faces = [];
  const faceGroups = [];

  for (let i = 0; i < majorSegments; i++) {
    const theta = (i / majorSegments) * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    for (let j = 0; j < minorSegments; j++) {
      const phi = (j / minorSegments) * Math.PI * 2;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      const x = (majorR + minorR * cosP) * cosT;
      const y = minorR * sinP;
      const z = (majorR + minorR * cosP) * sinT;
      vertices.push([x, y, z]);
    }
  }

  // Normalize to unit sphere
  let maxDist = 0;
  for (const v of vertices) {
    const d = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (d > maxDist) maxDist = d;
  }
  if (maxDist > 0) {
    for (const v of vertices) {
      v[0] /= maxDist;
      v[1] /= maxDist;
      v[2] /= maxDist;
    }
  }

  let groupId = 0;
  for (let i = 0; i < majorSegments; i++) {
    const nextI = (i + 1) % majorSegments;
    for (let j = 0; j < minorSegments; j++) {
      const nextJ = (j + 1) % minorSegments;
      const a = i * minorSegments + j;
      const b = nextI * minorSegments + j;
      const c = nextI * minorSegments + nextJ;
      const d = i * minorSegments + nextJ;
      faces.push([a, b, c]);
      faces.push([a, c, d]);
      faceGroups.push(groupId);
      faceGroups.push(groupId);
      groupId++;
    }
  }

  return { vertices, faces, faceGroups };
}

// ── Shape registry ──────────────────────────────────────────

export const SHAPES = {
  geodesic: null, // handled by geodesic.js subdivision
  tetrahedron,
  cube,
  octahedron,
  dodecahedron,
  icosahedron,
  cylinder,
  cone,
  torus,
};
