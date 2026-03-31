/**
 * Media loading and mapping for dome faces.
 * Supports images and videos with equirectangular UV mapping.
 */

import * as THREE from 'three';

/**
 * Load a media file (image or video) from a File object.
 * @param {File} file
 * @returns {Promise<{ element: HTMLImageElement|HTMLVideoElement, type: 'image'|'video' }>}
 */
export function loadMedia(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.addEventListener('loadeddata', () => {
        video.play();
        resolve({ element: video, type: 'video' });
      });
      video.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      });
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ element: img, type: 'image' });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    }
  });
}

/**
 * Create a Three.js texture from a media element.
 * @param {HTMLImageElement|HTMLVideoElement} element
 * @param {'image'|'video'} type
 * @returns {THREE.Texture}
 */
export function createTexture(element, type) {
  let texture;
  if (type === 'video') {
    texture = new THREE.VideoTexture(element);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  } else {
    texture = new THREE.CanvasTexture(element);
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Compute equirectangular UV coordinates for a geodesic mesh.
 * Maps spherical coordinates to UV: u = 0.5 + atan2(z, x) / (2*PI), v = 0.5 - asin(y/r) / PI
 *
 * @param {number[][]} vertices - Array of [x,y,z] vertex positions
 * @param {number[][]} faces - Array of [a,b,c] face index triples
 * @returns {Float32Array} UV coordinates, 2 floats per vertex per face (faces.length * 3 * 2)
 */
export function computeUVs(vertices, faces) {
  const uvs = new Float32Array(faces.length * 3 * 2);

  for (let fi = 0; fi < faces.length; fi++) {
    const [a, b, c] = faces[fi];
    const verts = [vertices[a], vertices[b], vertices[c]];

    // Compute raw UVs
    const rawUVs = verts.map((v) => {
      const r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
      const u = 0.5 + Math.atan2(v[2], v[0]) / (2 * Math.PI);
      const v2 = 0.5 - Math.asin(Math.max(-1, Math.min(1, v[1] / r))) / Math.PI;
      return [u, v2];
    });

    // Fix seam wrapping: if any pair of u values differ by > 0.5,
    // some vertices are on opposite sides of the seam
    fixSeamUVs(rawUVs);

    for (let vi = 0; vi < 3; vi++) {
      const offset = (fi * 3 + vi) * 2;
      uvs[offset] = rawUVs[vi][0];
      uvs[offset + 1] = rawUVs[vi][1];
    }
  }

  return uvs;
}

/**
 * Fix UV seam wrapping for a triangle. If u values span the 0/1 boundary,
 * shift the lower values up by 1 so the triangle doesn't stretch across the whole texture.
 */
function fixSeamUVs(uvs) {
  const u0 = uvs[0][0], u1 = uvs[1][0], u2 = uvs[2][0];
  const maxDiff = Math.max(
    Math.abs(u0 - u1),
    Math.abs(u1 - u2),
    Math.abs(u0 - u2)
  );

  if (maxDiff > 0.5) {
    // Shift any u < 0.5 up by 1
    for (let i = 0; i < 3; i++) {
      if (uvs[i][0] < 0.5) {
        uvs[i][0] += 1.0;
      }
    }
  }
}

/**
 * Draw media clipped to a triangle in the 2D canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[][]} face2DVertices - Three [x,y] vertices of the 2D triangle
 * @param {HTMLImageElement|HTMLVideoElement} mediaElement
 * @param {number[][]} faceUVs - Three [u,v] UV coordinates corresponding to the triangle vertices
 */
export function drawFaceMedia(ctx, face2DVertices, mediaElement, faceUVs) {
  const [[x0, y0], [x1, y1], [x2, y2]] = face2DVertices;
  const [[u0, v0], [u1, v1], [u2, v2]] = faceUVs;

  const mw = mediaElement.videoWidth || mediaElement.naturalWidth || mediaElement.width;
  const mh = mediaElement.videoHeight || mediaElement.naturalHeight || mediaElement.height;

  if (!mw || !mh) return;

  ctx.save();

  // Clip to triangle
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  // We need to find an affine transform that maps the UV triangle (in media pixel coords)
  // to the 2D face triangle.
  // Source (media) coords:
  const sx0 = u0 * mw, sy0 = v0 * mh;
  const sx1 = u1 * mw, sy1 = v1 * mh;
  const sx2 = u2 * mw, sy2 = v2 * mh;

  // We want a transform T such that T * [sx, sy, 1] = [dx, dy, 1]
  // for each of the 3 vertex pairs. This is a 2x3 affine matrix.
  // ctx.setTransform(a, b, c, d, e, f) maps:
  //   dx = a*sx + c*sy + e
  //   dy = b*sx + d*sy + f

  // Solve the system:
  // a*sx0 + c*sy0 + e = x0
  // a*sx1 + c*sy1 + e = x1
  // a*sx2 + c*sy2 + e = x2
  // (same for b,d,f with y values)

  const det = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2);
  if (Math.abs(det) < 1e-10) {
    ctx.restore();
    return;
  }

  const invDet = 1 / det;

  const a = ((x0 - x2) * (sy1 - sy2) - (x1 - x2) * (sy0 - sy2)) * invDet;
  const c = ((x1 - x2) * (sx0 - sx2) - (x0 - x2) * (sx1 - sx2)) * invDet;
  const e = x0 - a * sx0 - c * sy0;

  const b = ((y0 - y2) * (sy1 - sy2) - (y1 - y2) * (sy0 - sy2)) * invDet;
  const d = ((y1 - y2) * (sx0 - sx2) - (y0 - y2) * (sx1 - sx2)) * invDet;
  const f = y0 - b * sx0 - d * sy0;

  // Use transform() (not setTransform) to compose with the current
  // canvas transform (DPR + pan/zoom), so media draws in screen space.
  ctx.transform(a, b, c, d, e, f);

  // Draw the media - use a region large enough to cover any UV wrapping
  // For wrapped UVs (u > 1), we may need to draw the image multiple times
  const maxU = Math.max(u0, u1, u2);
  const tilesX = Math.ceil(maxU);
  for (let tx = 0; tx < tilesX; tx++) {
    ctx.drawImage(mediaElement, tx * mw, 0, mw, mh);
  }

  ctx.restore();
}
