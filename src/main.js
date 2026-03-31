import { initSplitView } from './split-view.js';
import { initViewport3D, updateDome, setMediaTexture } from './viewport-3d.js';
import { initViewport2D, render2D, setMedia } from './viewport-2d.js';
import { generateGeodesic } from './geodesic.js';
import { unwrapMesh } from './unwrap.js';
import { initGUI } from './gui.js';
import { defaultConfig, loadConfig, saveConfig } from './config.js';
import { loadMedia, createTexture } from './media.js';

const config = loadConfig() || structuredClone(defaultConfig);
let currentMesh = null;

function onChange() {
  saveConfig(config);
  currentMesh = generateGeodesic(config.geometry);
  updateDome(config.geometry);
  const unwrapData = unwrapMesh({ mesh: currentMesh, ...config.unwrap });
  render2D(unwrapData);
}

function onMediaLoad(file) {
  loadMedia(file).then(({ element, type }) => {
    config.media.source = file.name;
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
  setMediaTexture(null);
  setMedia(null, null);
  onChange();
}

initSplitView();
initViewport3D();
initViewport2D();
initGUI(config, onChange, { onMediaLoad, onMediaClear });
onChange(); // initial render

console.log('Dome Dreaming Generator initialized');
