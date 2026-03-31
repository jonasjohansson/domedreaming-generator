import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { saveConfig, loadConfig, saveConfigToFile, loadConfigFromFile } from './config.js';

const PRESETS = {
  'IG Square': { width: 1080, height: 1080 },
  'IG Portrait': { width: 1080, height: 1350 },
  'IG Story': { width: 1080, height: 1920 },
  '1080p': { width: 1920, height: 1080 },
  '4K': { width: 3840, height: 2160 },
  'Print': { width: 4000, height: 4000 },
};

export function initGUI(config, onChange, callbacks = {}) {
  const pane = new Pane({ title: 'Dome Dreaming' });
  pane.registerPlugin(EssentialsPlugin);

  const tab = pane.addTab({
    pages: [
      { title: 'Shape' },
      { title: 'Media' },
      { title: 'Export' },
      { title: 'Config' },
    ],
  });

  // --- Shape tab (Geometry + Unwrap) ---
  const shapePage = tab.pages[0];
  shapePage.addButton({ title: 'Load 3D Model (GLB/FBX/OBJ)' }).on('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf,.fbx,.obj';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file && callbacks.onModelLoad) callbacks.onModelLoad(file);
    };
    input.click();
  });
  shapePage.addButton({ title: 'Reset to Geodesic' }).on('click', () => {
    if (callbacks.onModelClear) callbacks.onModelClear();
  });

  const geoFolder = shapePage.addFolder({ title: 'Geodesic', expanded: true });
  geoFolder.addBinding(config.geometry, 'frequency', { min: 1, max: 6, step: 1 });
  geoFolder.addBinding(config.geometry, 'radius', { min: 0.1, max: 5 });
  geoFolder.addBinding(config.geometry, 'hemisphere');
  geoFolder.addBinding(config.geometry, 'truncation', { min: 0, max: 1 });
  geoFolder.addBinding(config.geometry, 'rotation', { min: 0, max: Math.PI * 2 });

  const unwrapFolder = shapePage.addFolder({ title: 'Unwrap', expanded: true });
  unwrapFolder.addBinding(config.unwrap, 'layout', {
    options: { Flower: 'flower', Connected: 'connected', Islands: 'islands', Strip: 'strip', Cross: 'cross' },
  });
  unwrapFolder.addBinding(config.unwrap, 'clusterRotation', { min: 0, max: Math.PI * 2 });
  unwrapFolder.addBinding(config.unwrap, 'seed', { min: 1, max: 999, step: 1, label: 'net variant' });

  // --- Media tab ---
  const mediaPage = tab.pages[1];
  mediaPage.addButton({ title: 'Load Image/Video' }).on('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file && callbacks.onMediaClear) {
        callbacks.onMediaClear();
        return;
      }
      if (file && callbacks.onMediaLoad) {
        callbacks.onMediaLoad(file);
      }
    };
    input.click();
  });
  mediaPage.addButton({ title: 'Clear Media' }).on('click', () => {
    if (callbacks.onMediaClear) callbacks.onMediaClear();
  });
  mediaPage.addBinding(config.media, 'mode', {
    options: { Global: 'global', 'Per-face': 'per-face' },
  });

  // --- Export tab ---
  const exportPage = tab.pages[2];
  const widthBinding = exportPage.addBinding(config.export, 'width', { min: 100, max: 8000, step: 1 });
  const heightBinding = exportPage.addBinding(config.export, 'height', { min: 100, max: 8000, step: 1 });
  exportPage.addBinding(config.export, 'preset', {
    options: { 'IG Square': 'IG Square', 'IG Portrait': 'IG Portrait', 'IG Story': 'IG Story', '1080p': '1080p', '4K': '4K', 'Print': 'Print' },
  }).on('change', (ev) => {
    const preset = PRESETS[ev.value];
    if (preset) {
      config.export.width = preset.width;
      config.export.height = preset.height;
      widthBinding.refresh();
      heightBinding.refresh();
      onChange();
    }
  });
  exportPage.addButton({ title: 'Export PNG' }).on('click', () => {
    if (callbacks.onExport) callbacks.onExport();
  });

  // --- Config tab ---
  const configPage = tab.pages[3];
  configPage.addButton({ title: 'Save Config' }).on('click', () => {
    saveConfigToFile(config);
  });
  configPage.addButton({ title: 'Load Config' }).on('click', async () => {
    const loaded = await loadConfigFromFile();
    if (!loaded) return;
    if (loaded.geometry) Object.assign(config.geometry, loaded.geometry);
    if (loaded.unwrap) Object.assign(config.unwrap, loaded.unwrap);
    if (loaded.media) Object.assign(config.media, loaded.media);
    if (loaded.export) Object.assign(config.export, loaded.export);
    pane.refresh();
    onChange();
  });

  // Listen for all changes and call onChange
  pane.on('change', () => {
    onChange();
  });

  return pane;
}
