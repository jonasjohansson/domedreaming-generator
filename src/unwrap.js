/**
 * Unwraps a geodesic mesh into a flat 2D layout.
 *
 * @param {Object} options
 * @param {object} options.mesh - Output from generateGeodesic() with { vertices, faces, normals, faceGroups }
 * @param {string} options.layout - 'flower' | 'strip' | 'cross'
 * @param {number} options.gap - Space between face clusters (default 0.1)
 * @param {number} options.clusterRotation - Rotation of each cluster in radians (default 0)
 * @returns {{ faces2D: { vertices: [number,number][], groupId: number, faceIndex: number }[], bounds: { width: number, height: number, minX: number, minY: number } }}
 */
export function unwrapMesh(options) {
  const {
    mesh,
    layout = 'flower',
    gap = 0.1,
    clusterRotation = 0,
  } = options || {};

  const { vertices, faces, faceGroups } = mesh;

  // 1. Group faces by icosahedron parent
  const groups = {};
  for (let i = 0; i < faces.length; i++) {
    const gid = faceGroups[i];
    if (!groups[gid]) groups[gid] = [];
    groups[gid].push(i);
  }

  // 2. Flatten each group's sub-triangles to 2D
  const groupFlattened = {}; // groupId -> array of { vertices: [[x,y],[x,y],[x,y]], faceIndex }
  for (const gid of Object.keys(groups)) {
    const faceIndices = groups[gid];
    groupFlattened[gid] = flattenGroup(vertices, faces, faceIndices);
  }

  // Center each group around its own centroid
  for (const gid of Object.keys(groupFlattened)) {
    centerGroup(groupFlattened[gid]);
  }

  // 3. Arrange groups according to layout
  const groupIds = Object.keys(groupFlattened).map(Number).sort((a, b) => a - b);
  let positions; // map groupId -> { x, y, rotation }

  switch (layout) {
    case 'strip':
      positions = layoutStrip(groupFlattened, groupIds, gap);
      break;
    case 'cross':
      positions = layoutCross(groupFlattened, groupIds, gap);
      break;
    case 'flower':
    default:
      positions = layoutFlower(groupFlattened, groupIds, gap);
      break;
  }

  // 4. Apply positions and cluster rotation, build output
  const faces2D = [];

  for (const gid of groupIds) {
    const pos = positions[gid];
    const groupFaces = groupFlattened[gid];
    const totalRotation = clusterRotation + (pos.rotation || 0);

    for (const f of groupFaces) {
      const transformedVerts = f.vertices.map(([x, y]) => {
        // Apply rotation
        let rx = x, ry = y;
        if (totalRotation !== 0) {
          const cos = Math.cos(totalRotation);
          const sin = Math.sin(totalRotation);
          rx = x * cos - y * sin;
          ry = x * sin + y * cos;
        }
        // Apply translation
        return [rx + pos.x, ry + pos.y];
      });

      faces2D.push({
        vertices: transformedVerts,
        groupId: gid,
        faceIndex: f.faceIndex,
      });
    }
  }

  // 5. Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of faces2D) {
    for (const [x, y] of f.vertices) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  return {
    faces2D,
    bounds: {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
    },
  };
}

// --- Flatten a group of 3D triangles to 2D preserving edge lengths ---

function flattenGroup(vertices, faces, faceIndices) {
  const result = [];

  for (const fi of faceIndices) {
    const [ai, bi, ci] = faces[fi];
    const a = vertices[ai];
    const b = vertices[bi];
    const c = vertices[ci];

    const verts2D = flattenTriangle(a, b, c);
    result.push({ vertices: verts2D, faceIndex: fi });
  }

  return result;
}

/**
 * Project a 3D triangle to 2D preserving edge lengths.
 * Places first vertex at origin, second along the x-axis,
 * then computes the third from distances.
 */
function flattenTriangle(a, b, c) {
  const dAB = dist3(a, b);
  const dAC = dist3(a, c);
  const dBC = dist3(b, c);

  // Place A at origin, B along x-axis
  const ax = 0, ay = 0;
  const bx = dAB, by = 0;

  // C from distances to A and B
  const cx = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
  const cySquared = dAC * dAC - cx * cx;
  const cy = Math.sqrt(Math.max(0, cySquared));

  return [[ax, ay], [bx, by], [cx, cy]];
}

function dist3(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// --- Center a group of 2D faces around its centroid ---

function centerGroup(groupFaces) {
  let cx = 0, cy = 0, count = 0;
  for (const f of groupFaces) {
    for (const [x, y] of f.vertices) {
      cx += x;
      cy += y;
      count++;
    }
  }
  cx /= count;
  cy /= count;

  for (const f of groupFaces) {
    f.vertices = f.vertices.map(([x, y]) => [x - cx, y - cy]);
  }
}

// --- Measure the bounding extent of a group (for spacing) ---

function groupExtent(groupFaces) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of groupFaces) {
    for (const [x, y] of f.vertices) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { width: maxX - minX, height: maxY - minY };
}

// --- Layout: Strip ---
// All 20 groups in a horizontal row

function layoutStrip(groupFlattened, groupIds, gap) {
  const positions = {};
  let xOffset = 0;

  for (const gid of groupIds) {
    const ext = groupExtent(groupFlattened[gid]);
    positions[gid] = { x: xOffset + ext.width / 2, y: 0, rotation: 0 };
    xOffset += ext.width + gap;
  }

  return positions;
}

// --- Layout: Cross ---
// 4 arms of 5 groups each in a cruciform pattern

function layoutCross(groupFlattened, groupIds, gap) {
  const positions = {};

  // Measure a representative group size
  const ext0 = groupExtent(groupFlattened[groupIds[0]]);
  const step = Math.max(ext0.width, ext0.height) + gap;

  // Arms: up, right, down, left — 5 groups each
  const arms = [
    { dx: 0, dy: -1 },  // up
    { dx: 1, dy: 0 },   // right
    { dx: 0, dy: 1 },   // down
    { dx: -1, dy: 0 },  // left
  ];

  for (let arm = 0; arm < 4; arm++) {
    for (let i = 0; i < 5; i++) {
      const gid = groupIds[arm * 5 + i];
      if (gid === undefined) break;
      const dist = (i + 1) * step;
      positions[gid] = {
        x: arms[arm].dx * dist,
        y: arms[arm].dy * dist,
        rotation: 0,
      };
    }
  }

  return positions;
}

// --- Layout: Flower (icosahedron net) ---
// The classic icosahedron net: a strip of 10 alternating up/down triangles
// with 5 flaps on top and 5 on bottom, fanned out from the center.
//
// The icosahedron face indices 0-19 from geodesic.js map to:
//   0-4:   top cap (faces sharing the north pole vertex)
//   5-9:   upper middle ring (adjacent to top, pointing down)
//   10-14: lower middle ring (adjacent to bottom, pointing up)
//   15-19: lower ring (connecting bottom faces)
//
// The net layout arranges them as:
//   Row of top flaps:      0   1   2   3   4
//   Row of alternating:   5 15  6 16  7 17  8 18  9 19
//   Row of bottom flaps:    10  11  12  13  14

function layoutFlower(groupFlattened, groupIds, gap) {
  const positions = {};

  // Measure the triangle size from group 0
  const ext0 = groupExtent(groupFlattened[groupIds[0]]);
  // For equilateral triangles, height ~ width * sqrt(3)/2
  const triWidth = ext0.width;
  const triHeight = ext0.height;

  // Half-width step for alternating triangles
  const hw = triWidth / 2 + gap / 2;
  const hh = triHeight + gap;

  // The icosahedron net is a strip of 10 pairs (up/down triangles)
  // arranged horizontally, with 5 top flaps and 5 bottom flaps.
  //
  // Face group mapping from geodesic.js baseFaces:
  //   Top cap:      0,1,2,3,4   (triangles around north pole)
  //   Upper ring:   5,6,7,8,9   (pointing down, adjacent to top cap)
  //   Lower ring:   10,11,12,13,14 (pointing up, adjacent to bottom)
  //   Bottom ring:  15,16,17,18,19 (connecting to south pole)

  // Middle strip: alternating up/down triangles
  // Order: 5(down) 15(up) 6(down) 16(up) 7(down) 17(up) 8(down) 18(up) 9(down) 19(up)
  const middleDown = [5, 6, 7, 8, 9];     // pointing down (upper ring)
  const middleUp = [15, 16, 17, 18, 19];  // pointing up (lower ring)
  const topFlaps = [0, 1, 2, 3, 4];       // top cap
  const bottomFlaps = [10, 11, 12, 13, 14]; // bottom flaps

  // Place the middle strip
  // Each pair of (down, up) shares a column position
  const startX = -(4.5 * hw);

  for (let i = 0; i < 5; i++) {
    const colX = startX + i * 2 * hw;

    // Down-pointing triangle (upper ring)
    // Needs to be flipped: rotate 180 degrees
    positions[middleDown[i]] = {
      x: colX,
      y: 0,
      rotation: Math.PI,
    };

    // Up-pointing triangle (lower ring)
    positions[middleUp[i]] = {
      x: colX + hw,
      y: 0,
      rotation: 0,
    };
  }

  // Top flaps: each sits above its corresponding down-triangle
  for (let i = 0; i < 5; i++) {
    const parentPos = positions[middleDown[i]];
    positions[topFlaps[i]] = {
      x: parentPos.x,
      y: parentPos.y - hh,
      rotation: 0,
    };
  }

  // Bottom flaps: each sits below its corresponding up-triangle
  for (let i = 0; i < 5; i++) {
    const parentPos = positions[middleUp[i]];
    positions[bottomFlaps[i]] = {
      x: parentPos.x,
      y: parentPos.y + hh,
      rotation: Math.PI,
    };
  }

  return positions;
}
