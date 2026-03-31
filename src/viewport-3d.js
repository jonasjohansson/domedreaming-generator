import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls, container;

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

  // Placeholder wireframe icosahedron
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Resize handling
  window.addEventListener('resize', onResize);
  window.addEventListener('split-resize', onResize);

  // Start animation loop
  animate();
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

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
