import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateGeodesic } from './geodesic.js';
import { computeUVs } from './media.js';

let scene, camera, renderer, controls, container;
let domeMesh, wireframeMesh;
let currentTexture = null;

// 20 distinct hues for icosahedron face groups
const colorPalette = Array.from({ length: 20 }, (_, i) =>
  new THREE.Color().setHSL(i / 20, 0.65, 0.55)
);

export function initViewport3D() {
  container = document.getElementById('viewport-3d');
  if (!container) return;

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.5, 3);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x111111, 1);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);

  // Initial dome
  updateDome();

  // Resize handling
  window.addEventListener('resize', onResize);
  window.addEventListener('split-resize', onResize);

  // Start animation loop
  animate();
}

export function updateDome(options) {
  // Remove old meshes
  if (domeMesh) {
    scene.remove(domeMesh);
    domeMesh.geometry.dispose();
    domeMesh.material.dispose();
    domeMesh = null;
  }
  if (wireframeMesh) {
    scene.remove(wireframeMesh);
    wireframeMesh.geometry.dispose();
    wireframeMesh.material.dispose();
    wireframeMesh = null;
  }

  const geodesic = generateGeodesic(options);
  const { vertices, faces, normals, faceGroups } = geodesic;

  // Build BufferGeometry
  const geometry = new THREE.BufferGeometry();

  // Non-indexed: expand faces so each face can have its own vertex colors
  const positionArray = new Float32Array(faces.length * 3 * 3);
  const normalArray = new Float32Array(faces.length * 3 * 3);
  const colorArray = new Float32Array(faces.length * 3 * 3);

  for (let fi = 0; fi < faces.length; fi++) {
    const [a, b, c] = faces[fi];
    const groupIndex = faceGroups[fi] % colorPalette.length;
    const color = colorPalette[groupIndex];

    for (let vi = 0; vi < 3; vi++) {
      const vertIdx = faces[fi][vi];
      const offset = (fi * 3 + vi) * 3;

      positionArray[offset] = vertices[vertIdx][0];
      positionArray[offset + 1] = vertices[vertIdx][1];
      positionArray[offset + 2] = vertices[vertIdx][2];

      normalArray[offset] = normals[vertIdx][0];
      normalArray[offset + 1] = normals[vertIdx][1];
      normalArray[offset + 2] = normals[vertIdx][2];

      colorArray[offset] = color.r;
      colorArray[offset + 1] = color.g;
      colorArray[offset + 2] = color.b;
    }
  }

  // Compute UVs for media mapping
  const uvArray = computeUVs(vertices, faces);
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));

  // Solid mesh: use texture if available, otherwise vertex colors
  let solidMaterial;
  if (currentTexture) {
    solidMaterial = new THREE.MeshStandardMaterial({
      map: currentTexture,
      side: THREE.DoubleSide,
    });
  } else {
    solidMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });
  }
  domeMesh = new THREE.Mesh(geometry, solidMaterial);
  scene.add(domeMesh);

  // Wireframe overlay using LineSegments
  const wireGeometry = new THREE.WireframeGeometry(geometry);
  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0x111111,
    linewidth: 1,
  });
  wireframeMesh = new THREE.LineSegments(wireGeometry, wireMaterial);
  scene.add(wireframeMesh);
}

export function getScene() {
  return scene;
}

function onResize() {
  if (!container || !camera || !renderer) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

export function setMediaTexture(texture) {
  currentTexture = texture;
  if (domeMesh) {
    domeMesh.material.dispose();
    if (texture) {
      domeMesh.material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });
    } else {
      domeMesh.material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
