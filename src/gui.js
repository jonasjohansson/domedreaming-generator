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
      { title: 'Polar' },
      { title: 'Title Card' },
      { title: 'Export' },
      { title: 'Config' },
    ],
  });

  const FONT_OPTIONS = {
    OffBit: 'OffBit',
    'OffBit-101': 'OffBit-101',
    'OffBit-Dot': 'OffBit-Dot',
    'OffBit-Bar': 'OffBit-Bar',
    'OPS Past Perfect': 'OPSPastPerfect',
  };

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
  geoFolder.addBinding(config.geometry, 'shape', {
    options: {
      Geodesic: 'geodesic',
      Dome: 'dome',
      Tetrahedron: 'tetrahedron',
      Cube: 'cube',
      Octahedron: 'octahedron',
      Dodecahedron: 'dodecahedron',
      Icosahedron: 'icosahedron',
      Cylinder: 'cylinder',
      Cone: 'cone',
      Torus: 'torus',
    },
  });
  geoFolder.addBinding(config.geometry, 'frequency', { min: 1, max: 6, step: 1 });
  geoFolder.addBinding(config.geometry, 'radius', { min: 0.1, max: 5 });
  geoFolder.addBinding(config.geometry, 'hemisphere');
  geoFolder.addBinding(config.geometry, 'truncation', { min: 0, max: 1 });
  geoFolder.addBinding(config.geometry, 'rotation', { min: 0, max: Math.PI * 2 });

  const displayFolder = shapePage.addFolder({ title: 'Display', expanded: true });
  displayFolder.addBinding(config.display, 'colorMode', {
    options: { Color: 'color', 'Black & White': 'bw' },
    label: 'colors',
  });

  const unwrapFolder = shapePage.addFolder({ title: 'Unwrap', expanded: true });
  unwrapFolder.addBinding(config.unwrap, 'layout', {
    options: { Flower: 'flower', Connected: 'connected', Islands: 'islands', Strip: 'strip', Cross: 'cross' },
  });
  unwrapFolder.addBinding(config.unwrap, 'clusterRotation', { min: 0, max: Math.PI * 2 });
  unwrapFolder.addBinding(config.unwrap, 'seed', { min: 1, max: 999, step: 1, label: 'net variant' });
  unwrapFolder.addBinding(config.unwrap, 'unfold', { min: 0, max: 1 });

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

  // --- Polar tab ---
  const polarPage = tab.pages[2];
  polarPage.addBinding(config.polar, 'radialLines', { min: 0, max: 120, step: 1, label: 'radial lines' });
  polarPage.addBinding(config.polar, 'rings', { min: 0, max: 40, step: 1 });
  polarPage.addBinding(config.polar, 'lineThickness', { min: 0.25, max: 6, step: 0.25, label: 'thickness' });
  polarPage.addBinding(config.polar, 'gridOpacity', { min: 0, max: 1, label: 'opacity' });
  polarPage.addBinding(config.polar, 'mask', { label: 'cut through' });
  polarPage.addBinding(config.polar, 'showLabels', { label: 'degree labels' });
  polarPage.addBinding(config.polar, 'exportSize', { min: 256, max: 8192, step: 64, label: 'export px' });
  polarPage.addButton({ title: 'Export PNG (square)' }).on('click', () => {
    if (callbacks.onExportPolar) callbacks.onExportPolar();
  });
  polarPage.addButton({ title: 'Export Grid PNG (mask)' }).on('click', () => {
    if (callbacks.onExportPolarGrid) callbacks.onExportPolarGrid();
  });
  polarPage.addButton({ title: 'Export Grid SVG' }).on('click', () => {
    if (callbacks.onExportPolarGridSVG) callbacks.onExportPolarGridSVG();
  });

  // --- Title Card tab ---
  const tcPage = tab.pages[3];
  const tcGrid = tcPage.addFolder({ title: 'Grid', expanded: true });
  tcGrid.addBinding(config.titlecard, 'radialLines', { min: 1, max: 64, step: 1, label: 'radial lines' });
  tcGrid.addBinding(config.titlecard, 'rings', { min: 1, max: 16, step: 1 });
  tcGrid.addBinding(config.titlecard, 'lineThickness', { min: 0.25, max: 6, step: 0.25, label: 'thickness' });
  tcGrid.addBinding(config.titlecard, 'gridOpacity', { min: 0, max: 1, label: 'opacity' });
  tcGrid.addBinding(config.titlecard, 'bgTransparent', { label: 'transparent bg' });
  tcGrid.addBinding(config.titlecard, 'flipX', { label: 'flip X (all text)' });
  tcGrid.addBinding(config.titlecard, 'flipY', { label: 'flip Y (all text)' });
  tcGrid.addBinding(config.titlecard, 'invertText', { label: 'invert text vs images' });

  // Image cards
  const tcImg = tcPage.addFolder({ title: 'Image Cards', expanded: true });
  tcImg.addButton({ title: 'Load Festival Images' }).on('click', () => {
    if (callbacks.onTitlecardFestivalImagesLoad) callbacks.onTitlecardFestivalImagesLoad();
  });
  tcImg.addButton({ title: 'Load Images from disk' }).on('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
      if (input.files && input.files.length && callbacks.onTitlecardImagesLoad) {
        callbacks.onTitlecardImagesLoad(input.files);
      }
    };
    input.click();
  });
  tcImg.addButton({ title: 'Clear Images' }).on('click', () => {
    if (callbacks.onTitlecardImagesClear) callbacks.onTitlecardImagesClear();
  });
  tcImg.addBinding(config.titlecard.imageCards, 'enabled');
  tcImg.addBinding(config.titlecard.imageCards, 'count', { min: 1, max: 64, step: 1 });
  tcImg.addBinding(config.titlecard.imageCards, 'seed', { min: 1, max: 9999, step: 1 });
  tcImg.addBinding(config.titlecard.imageCards, 'threshold', { label: 'B&W threshold' });
  tcImg.addBinding(config.titlecard.imageCards, 'thresholdLevel', { min: 0, max: 1, label: 'level' });
  tcImg.addBinding(config.titlecard.imageCards, 'blackToAlpha', { label: 'black → alpha' });

  for (let i = 0; i < config.titlecard.texts.length; i++) {
    const folder = tcPage.addFolder({ title: `Text ${i + 1}`, expanded: i < 2 });
    const tc = config.titlecard.texts[i];
    folder.addBinding(tc, 'content', { label: 'text' });
    folder.addBinding(tc, 'ring', { min: 1, max: 16, step: 1 });
    folder.addBinding(tc, 'sector', { min: 0, max: 64, step: 1, label: 'sector (center)' });
    folder.addBinding(tc, 'fontSize', { min: 10, max: 400, step: 1, label: 'font size' });
    folder.addBinding(tc, 'font', { options: FONT_OPTIONS });
    folder.addBinding(tc, 'cellMode', { label: 'cell mode' });
    folder.addBinding(tc, 'charsPerCell', { min: 1, max: 4, step: 1, label: 'chars/cell' });
  }

  tcPage.addBinding(config.titlecard, 'exportSize', { min: 256, max: 8192, step: 64, label: 'export px' });
  tcPage.addButton({ title: 'Export Title Card PNG' }).on('click', () => {
    if (callbacks.onExportTitlecard) callbacks.onExportTitlecard();
  });
  tcPage.addButton({ title: 'Export Title Card SVG' }).on('click', () => {
    if (callbacks.onExportTitlecardSVG) callbacks.onExportTitlecardSVG();
  });

  // Batch export — load a .json file from disk ({artist, title} per entry),
  // then hit Export Batch ZIP to render one PNG per entry into a single zip.
  // Text 1 ← title (the headline slot — usually bottom outer), Text 2 ← artist.
  // Image-card seed += entry index so each card gets a different layout from
  // the same image set. The "preview" dropdown picks one entry to render
  // live in the viewport so you can flip through the lineup before exporting.
  let tcBatch = null;
  const previewState = { index: 0 };

  function parseBatchEntries() {
    try {
      const arr = JSON.parse(config.titlecard.batch.json || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function applyPreviewEntry(entry) {
    if (!entry) return;
    // Text 1 = title (the prominent slot), Text 2 = artist.
    if (config.titlecard.texts[0]) config.titlecard.texts[0].content = entry.title || '';
    if (config.titlecard.texts[1]) config.titlecard.texts[1].content = entry.artist || '';
    pane.refresh();
    onChange();
  }

  function buildBatchFolder(statusText) {
    if (tcBatch) tcBatch.dispose();
    tcBatch = tcPage.addFolder({ title: 'Batch (artist + title → Text 1/2)', expanded: false });

    const entries = parseBatchEntries();
    const batchStatus = { text: statusText || `Loaded ${entries.length} entries (default lineup)` };
    tcBatch.addBinding(batchStatus, 'text', { readonly: true, label: 'status' });

    if (entries.length) {
      const options = {};
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i] || {};
        const artist = e.artist || `Entry ${i + 1}`;
        const title = e.title ? ` — ${e.title}` : '';
        options[`${i + 1}. ${artist}${title}`] = i;
      }
      if (previewState.index >= entries.length) previewState.index = 0;
      tcBatch
        .addBinding(previewState, 'index', { options, label: 'preview' })
        .on('change', (ev) => applyPreviewEntry(entries[ev.value]));
    }

    tcBatch.addButton({ title: 'Load Batch JSON file' }).on('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) throw new Error('not an array');
          config.titlecard.batch.json = text;
          previewState.index = 0;
          buildBatchFolder(`Loaded ${file.name} (${parsed.length} entries)`);
        } catch (err) {
          buildBatchFolder(`Invalid JSON: ${err.message}`);
        }
      };
      input.click();
    });
    tcBatch.addButton({ title: 'Export Batch ZIP (download all)' }).on('click', () => {
      if (callbacks.onExportTitlecardBatch) callbacks.onExportTitlecardBatch();
    });
  }
  buildBatchFolder();

  // --- Export tab ---
  const exportPage = tab.pages[4];
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
  exportPage.addButton({ title: 'Export SVG' }).on('click', () => {
    if (callbacks.onExportSVG) callbacks.onExportSVG();
  });

  // --- Config tab ---
  const configPage = tab.pages[5];
  configPage.addButton({ title: 'Save Config' }).on('click', () => {
    saveConfigToFile(config);
  });
  configPage.addButton({ title: 'Load Config' }).on('click', async () => {
    const loaded = await loadConfigFromFile();
    if (!loaded) return;
    if (loaded.geometry) Object.assign(config.geometry, loaded.geometry);
    if (loaded.unwrap) Object.assign(config.unwrap, loaded.unwrap);
    if (loaded.display) Object.assign(config.display, loaded.display);
    if (loaded.polar) Object.assign(config.polar, loaded.polar);
    if (loaded.titlecard) Object.assign(config.titlecard, loaded.titlecard);
    if (loaded.media) Object.assign(config.media, loaded.media);
    if (loaded.export) Object.assign(config.export, loaded.export);
    pane.refresh();
    onChange();
  });

  // Listen for all changes and call onChange
  pane.on('change', () => {
    onChange();
  });

  // View-aware tabs: hide GUI tabs whose target panels aren't visible.
  // Tabs in declaration order: 0 Shape, 1 Media, 2 Polar, 3 Title Card,
  // 4 Export, 5 Config. Export + Config always shown.
  function applyTabVisibility() {
    const shown = (id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('panel-hidden');
    };
    const has3d = shown('viewport-3d');
    const has2d = shown('viewport-2d');
    const hasPolar = shown('viewport-polar');
    const hasTC = shown('viewport-titlecard');

    const visibility = [
      has3d || has2d,                     // Shape — drives geometry seen in 3D/2D
      has3d || has2d || hasPolar,         // Media — drives backdrop seen in 3D/2D/Polar
      hasPolar,                           // Polar
      hasTC,                              // Title Card
      true,                               // Export
      true,                               // Config
    ];

    const tabButtons = pane.element.querySelectorAll('.tp-tbiv');
    tabButtons.forEach((btn, i) => {
      btn.style.display = visibility[i] ? '' : 'none';
    });

    // If the currently active tab got hidden, switch to the first visible one.
    const active = Array.from(tabButtons).findIndex((b) => b.classList.contains('tp-tbiv-sel'));
    if (active >= 0 && !visibility[active]) {
      const firstVisible = visibility.findIndex(Boolean);
      if (firstVisible >= 0 && tab.pages[firstVisible]) {
        tab.pages[firstVisible].selected = true;
      }
    }
  }

  applyTabVisibility();
  window.addEventListener('split-resize', applyTabVisibility);

  return pane;
}
