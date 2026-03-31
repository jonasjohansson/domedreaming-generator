/**
 * Load 3D models (GLB/GLTF, FBX, OBJ) and extract geometry.
 * Returns a simplified mesh format compatible with the unwrap engine.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

/**
 * Load a 3D model from a File object.
 * @param {File} file
 * @returns {Promise<{ vertices: number[][], faces: number[][], normals: number[][], faceGroups: number[] }>}
 */
export function loadModel(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const ext = file.name.split('.').pop().toLowerCase();

    let loader;
    if (ext === 'glb' || ext === 'gltf') {
      loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        try {
          resolve(extractMesh(gltf.scene));
        } catch (e) { reject(e); }
        URL.revokeObjectURL(url);
      }, undefined, (err) => { URL.revokeObjectURL(url); reject(err); });
    } else if (ext === 'fbx') {
      loader = new FBXLoader();
      loader.load(url, (group) => {
        try {
          resolve(extractMesh(group));
        } catch (e) { reject(e); }
        URL.revokeObjectURL(url);
      }, undefined, (err) => { URL.revokeObjectURL(url); reject(err); });
    } else if (ext === 'obj') {
      loader = new OBJLoader();
      loader.load(url, (group) => {
        try {
          resolve(extractMesh(group));
        } catch (e) { reject(e); }
        URL.revokeObjectURL(url);
      }, undefined, (err) => { URL.revokeObjectURL(url); reject(err); });
    } else {
      URL.revokeObjectURL(url);
      reject(new Error(`Unsupported format: ${ext}`));
    }
  });
}

/**
 * Extract mesh data from a Three.js scene/group.
 * Merges all mesh geometries into a single mesh in our format.
 */
function extractMesh(root) {
  const allVertices = [];
  const allFaces = [];
  const allNormals = [];
  const allFaceGroups = [];
  let vertexOffset = 0;
  let groupId = 0;

  root.traverse((child) => {
    if (!child.isMesh) return;

    const geo = child.geometry;
    child.updateMatrixWorld(true);
    const matrix = child.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    const index = geo.index;

    // Extract vertices, applying world transform
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      v.applyMatrix4(matrix);
      allVertices.push([v.x, v.y, v.z]);
    }

    // Extract normals
    const n = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      if (normAttr) {
        n.set(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        n.applyMatrix3(normalMatrix).normalize();
      } else {
        n.set(0, 1, 0);
      }
      allNormals.push([n.x, n.y, n.z]);
    }

    // Extract faces
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        allFaces.push([
          index.getX(i) + vertexOffset,
          index.getX(i + 1) + vertexOffset,
          index.getX(i + 2) + vertexOffset,
        ]);
        allFaceGroups.push(groupId);
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        allFaces.push([
          i + vertexOffset,
          i + 1 + vertexOffset,
          i + 2 + vertexOffset,
        ]);
        allFaceGroups.push(groupId);
      }
    }

    vertexOffset += posAttr.count;
    groupId++;
  });

  if (allFaces.length === 0) {
    throw new Error('No mesh geometry found in model');
  }

  // Normalize: center and scale to unit sphere
  const center = new THREE.Vector3();
  let maxDist = 0;
  for (const v of allVertices) {
    center.x += v[0]; center.y += v[1]; center.z += v[2];
  }
  center.divideScalar(allVertices.length);

  for (const v of allVertices) {
    v[0] -= center.x; v[1] -= center.y; v[2] -= center.z;
    const d = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (d > maxDist) maxDist = d;
  }

  if (maxDist > 0) {
    const scale = 1 / maxDist;
    for (const v of allVertices) {
      v[0] *= scale; v[1] *= scale; v[2] *= scale;
    }
  }

  return {
    vertices: allVertices,
    faces: allFaces,
    normals: allNormals,
    faceGroups: allFaceGroups,
  };
}
