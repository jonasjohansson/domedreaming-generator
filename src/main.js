import { initSplitView } from './split-view.js';
import { initViewport3D, updateDome, setMediaTexture } from './viewport-3d.js';
import { initViewport2D, render2D, setMedia } from './viewport-2d.js';
import { generateGeodesic } from './geodesic.js';
import { unwrapMesh } from './unwrap.js';
import { initGUI } from './gui.js';
import { defaultConfig, loadConfig, saveConfig } from './config.js';
import { loadMedia, createTexture } from './media.js';
import { exportPNG } from './export.js';

const config = loadConfig() || structuredClone(defaultConfig);
let currentMesh = null;
let currentUnwrapData = null;
let currentMediaElement = null;

function onChange() {
  saveConfig(config);
  currentMesh = generateGeodesic(config.geometry);
  updateDome(config.geometry);
  currentUnwrapData = unwrapMesh({ mesh: currentMesh, ...config.unwrap });
  render2D(currentUnwrapData);
}

function onMediaLoad(file) {
  loadMedia(file).then(({ element, type }) => {
    config.media.source = file.name;
    currentMediaElement = element;
    const texture = createTexture(element, type);
    setMediaTexture(texture);
    setMedia(element, currentMesh);
    onChange();
  }).catch((err) => {
    console.error('Failed to load media:', err);
  });
}

function onMediaClear() {
  config.media.source = '';
  currentMediaElement = null;
  setMediaTexture(null);
  setMedia(null, null);
  onChange();
}

initSplitView();
initViewport3D();
initViewport2D();
initGUI(config, onChange, {
  onMediaLoad,
  onMediaClear,
  onExport: () => exportPNG(currentUnwrapData, config, currentMediaElement, currentMesh),
});
onChange(); // initial render

console.log('Dome Dreaming Generator initialized');
