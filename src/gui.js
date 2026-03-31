import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { saveConfig, loadConfig } from './config.js';

const PRESETS = {
  '1080p': { width: 1920, height: 1080 },
  '4K': { width: 3840, height: 2160 },
  'Print': { width: 4000, height: 4000 },
};

export function initGUI(config, onChange) {
  const pane = new Pane({ title: 'Dome Dreaming' });
  pane.registerPlugin(EssentialsPlugin);

  const tab = pane.addTab({
    pages: [
      { title: 'Geometry' },
      { title: 'Unwrap' },
      { title: 'Media' },
      { title: 'Export' },
      { title: 'Config' },
    ],
  });

  // --- Geometry tab ---
  const geometryPage = tab.pages[0];
  geometryPage.addBinding(config.geometry, 'frequency', { min: 1, max: 6, step: 1 });
  geometryPage.addBinding(config.geometry, 'radius', { min: 0.1, max: 5 });
  geometryPage.addBinding(config.geometry, 'hemisphere');
  geometryPage.addBinding(config.geometry, 'truncation', { min: 0, max: 1 });
  geometryPage.addBinding(config.geometry, 'rotation', { min: 0, max: Math.PI * 2 });

  // --- Unwrap tab ---
  const unwrapPage = tab.pages[1];
  unwrapPage.addBinding(config.unwrap, 'layout', {
    options: { Flower: 'flower', Strip: 'strip', Cross: 'cross' },
  });
  unwrapPage.addBinding(config.unwrap, 'gap', { min: 0, max: 1 });
  unwrapPage.addBinding(config.unwrap, 'clusterRotation', { min: 0, max: Math.PI * 2 });

  // --- Media tab ---
  const mediaPage = tab.pages[2];
  mediaPage.addBinding(config.media, 'source');
  mediaPage.addBinding(config.media, 'mode', {
    options: { Global: 'global', 'Per-face': 'per-face' },
  });

  // --- Export tab ---
  const exportPage = tab.pages[3];
  const widthBinding = exportPage.addBinding(config.export, 'width', { min: 100, max: 8000, step: 1 });
  const heightBinding = exportPage.addBinding(config.export, 'height', { min: 100, max: 8000, step: 1 });
  exportPage.addBinding(config.export, 'preset', {
    options: { '1080p': '1080p', '4K': '4K', 'Print': 'Print' },
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
    // Placeholder for export functionality (Task 10+)
    console.log('Export PNG requested', config.export);
  });

  // --- Config tab ---
  const configPage = tab.pages[4];
  configPage.addButton({ title: 'Save Config' }).on('click', () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'domedreaming-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  configPage.addButton({ title: 'Load Config' }).on('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const loaded = JSON.parse(ev.target.result);
          Object.assign(config.geometry, loaded.geometry);
          Object.assign(config.unwrap, loaded.unwrap);
          Object.assign(config.media, loaded.media);
          Object.assign(config.export, loaded.export);
          pane.refresh();
          onChange();
        } catch (err) {
          console.error('Failed to load config:', err);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Listen for all changes and call onChange
  pane.on('change', () => {
    onChange();
  });

  return pane;
}
