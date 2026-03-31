import { initSplitView } from './split-view.js';
import { initViewport3D, updateDome } from './viewport-3d.js';
import { initViewport2D, render2D } from './viewport-2d.js';
import { generateGeodesic } from './geodesic.js';
import { unwrapMesh } from './unwrap.js';
import { initGUI } from './gui.js';
import { defaultConfig, loadConfig, saveConfig } from './config.js';

const config = loadConfig() || structuredClone(defaultConfig);

function onChange() {
  saveConfig(config);
  const mesh = generateGeodesic(config.geometry);
  updateDome(config.geometry);
  const unwrapData = unwrapMesh({ mesh, ...config.unwrap });
  render2D(unwrapData);
}

initSplitView();
initViewport3D();
initViewport2D();
initGUI(config, onChange);
onChange(); // initial render

console.log('Dome Dreaming Generator initialized');
