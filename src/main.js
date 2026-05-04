import { initSplitView } from './split-view.js';
import { initViewport3D, updateDome, setMediaTexture, setCustomMesh } from './viewport-3d.js';
import { initViewport2D, render2D, setMedia, setUnfold } from './viewport-2d.js';
import { initViewportPolar, setPolarMedia, setPolarConfig, renderPolar } from './viewport-polar.js';
import { initViewportTitlecard, setTitlecardConfig, renderTitlecard } from './viewport-titlecard.js';
import { loadImageFiles as loadTitlecardImages, loadImagesFromUrls as loadTitlecardImageUrls, clearImages as clearTitlecardImages, setOnChange as setTitlecardImagesOnChange, FESTIVAL_IMAGE_PATHS } from './titlecard-images.js';
import { generateGeodesic } from './geodesic.js';
import { unwrapMesh } from './unwrap.js';
import { initGUI } from './gui.js';
import { defaultConfig, loadConfig, saveConfig } from './config.js';
import { loadMedia, createTexture } from './media.js';
import { exportPNG } from './export.js';
import { exportSVG } from './export-svg.js';
import { exportPolarPNG, exportPolarGridPNG, exportPolarGridSVG } from './export-polar.js';
import { exportTitlecardPNG, exportTitlecardSVG } from './export-titlecard.js';
import { loadModel } from './model-loader.js';
import { setColorMode } from './colors.js';

const config = loadConfig() || structuredClone(defaultConfig);
let currentMesh = null;
let currentUnwrapData = null;
let currentMediaElement = null;
let customModel = null; // loaded 3D model mesh data

function onChange() {
  saveConfig(config);
  setColorMode(config.display.colorMode);

  if (customModel) {
    currentMesh = customModel;
    setCustomMesh(customModel);
  } else {
    currentMesh = generateGeodesic(config.geometry);
    updateDome(config.geometry);
  }

  const isGeodesic = !customModel && (config.geometry.shape === 'geodesic' || config.geometry.shape === 'dome' || config.geometry.shape === 'icosahedron');
  currentUnwrapData = unwrapMesh({ mesh: currentMesh, ...config.unwrap, isGeodesic });
  setUnfold(config.unwrap.unfold, currentMesh);
  render2D(currentUnwrapData);
  setPolarConfig(config.polar);
  renderPolar();
  setTitlecardConfig(config.titlecard);
  renderTitlecard();

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
    setPolarMedia(element);
    render2D(currentUnwrapData);
    renderPolar();
  }).catch((err) => {
    console.error('Failed to load media:', err);
  });
}

function onMediaClear() {
  config.media.source = '';
  currentMediaElement = null;
  setMediaTexture(null);
  setMedia(null, null);
  setPolarMedia(null);
  render2D(currentUnwrapData);
  renderPolar();
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
initViewportPolar();
initViewportTitlecard();
initGUI(config, onChange, {
  onMediaLoad,
  onMediaClear,
  onModelLoad,
  onModelClear,
  onExport: () => exportPNG(currentUnwrapData, config, currentMediaElement, currentMesh),
  onExportSVG: () => exportSVG(currentUnwrapData),
  onExportPolar: () => exportPolarPNG(config, currentMediaElement),
  onExportPolarGrid: () => exportPolarGridPNG(config),
  onExportPolarGridSVG: () => exportPolarGridSVG(config),
  onExportTitlecard: () => exportTitlecardPNG(config),
  onExportTitlecardSVG: () => exportTitlecardSVG(config),
  onTitlecardImagesLoad: (files) => loadTitlecardImages(files),
  onTitlecardImagesClear: () => clearTitlecardImages(),
  onTitlecardFestivalImagesLoad: () => {
    loadTitlecardImageUrls(FESTIVAL_IMAGE_PATHS);
  },
});

// Re-render the title card whenever the image registry changes
setTitlecardImagesOnChange(() => renderTitlecard());
onChange();

// Force-load all title-card fonts before re-rendering. Canvas falls back to
// monospace for any face that hasn't been loaded by the document, so we
// explicitly request each one.
const TC_FONTS = ['OffBit', 'OffBit-101', 'OffBit-Dot', 'OffBit-Bar', 'OPSPastPerfect'];
if (document.fonts && document.fonts.load) {
  Promise.all(TC_FONTS.map((f) => document.fonts.load(`16px "${f}"`)))
    .then(() => renderTitlecard())
    .catch(() => renderTitlecard());
}

// Keep the polar panel re-rendering when media is a video
function videoTick() {
  if (currentMediaElement && currentMediaElement.tagName === 'VIDEO') {
    renderPolar();
  }
  requestAnimationFrame(videoTick);
}
requestAnimationFrame(videoTick);

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
