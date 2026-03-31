import { initSplitView } from './split-view.js';
import { initViewport3D, updateDome, setMediaTexture, setCustomMesh } from './viewport-3d.js';
import { initViewport2D, render2D, setMedia } from './viewport-2d.js';
import { generateGeodesic } from './geodesic.js';
import { unwrapMesh } from './unwrap.js';
import { initGUI } from './gui.js';
import { defaultConfig, loadConfig, saveConfig } from './config.js';
import { loadMedia, createTexture } from './media.js';
import { exportPNG } from './export.js';
import { loadModel } from './model-loader.js';

const config = loadConfig() || structuredClone(defaultConfig);
let currentMesh = null;
let currentUnwrapData = null;
let currentMediaElement = null;
let customModel = null; // loaded 3D model mesh data

function onChange() {
  saveConfig(config);

  if (customModel) {
    currentMesh = customModel;
    setCustomMesh(customModel);
  } else {
    currentMesh = generateGeodesic(config.geometry);
    updateDome(config.geometry);
  }

  currentUnwrapData = unwrapMesh({ mesh: currentMesh, ...config.unwrap });
  render2D(currentUnwrapData);

  // Re-apply media to updated mesh
  if (currentMediaElement) {
    setMedia(currentMediaElement, currentMesh);
  }
}

function onMediaLoad(file) {
  loadMedia(file).then(({ element, type }) => {
    config.media.source = file.name;
    currentMediaElement = element;
    const texture = createTexture(element, type);
    setMediaTexture(texture);
    setMedia(element, currentMesh);
    render2D(currentUnwrapData);
  }).catch((err) => {
    console.error('Failed to load media:', err);
  });
}

function onMediaClear() {
  config.media.source = '';
  currentMediaElement = null;
  setMediaTexture(null);
  setMedia(null, null);
  render2D(currentUnwrapData);
}

function onModelLoad(file) {
  loadModel(file).then((meshData) => {
    customModel = meshData;
    onChange();
  }).catch((err) => {
    console.error('Failed to load model:', err);
  });
}

function onModelClear() {
  customModel = null;
  onChange();
}

initSplitView();
initViewport3D();
initViewport2D();
initGUI(config, onChange, {
  onMediaLoad,
  onMediaClear,
  onModelLoad,
  onModelClear,
  onExport: () => exportPNG(currentUnwrapData, config, currentMediaElement, currentMesh),
});
onChange();

// Drag-and-drop support for 3D models and media
const MODEL_EXTS = ['glb', 'gltf', 'fbx', 'obj'];
const MEDIA_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'webm', 'mov'];

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('drag-over');
});
document.addEventListener('dragleave', (e) => {
  if (e.target === document.body || !document.body.contains(e.relatedTarget)) {
    document.body.classList.remove('drag-over');
  }
});
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (MODEL_EXTS.includes(ext)) {
    onModelLoad(file);
  } else if (MEDIA_EXTS.includes(ext) || file.type.startsWith('image/') || file.type.startsWith('video/')) {
    onMediaLoad(file);
  }
});

console.log('Dome Dreaming Generator initialized');
