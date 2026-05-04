export const defaultConfig = {
  geometry: {
    shape: 'geodesic',
    frequency: 2,
    radius: 1,
    hemisphere: false,
    truncation: 0.5,
    rotation: 0,
  },
  unwrap: {
    layout: 'flower',
    clusterRotation: 0,
    seed: 1,
    unfold: 1,
  },
  media: {
    source: '',
    mode: 'global',
  },
  display: {
    colorMode: 'color',
  },
  polar: {
    radialLines: 9,
    rings: 5,
    lineThickness: 2,
    gridOpacity: 1,
    mask: true,
    showLabels: false,
    exportSize: 2048,
  },
  titlecard: {
    radialLines: 36,
    rings: 5,
    lineThickness: 2,
    gridOpacity: 1,
    bgTransparent: false,
    exportSize: 2048,
    imageCards: {
      enabled: true,
      count: 8,
      seed: 1,
      threshold: false,
      thresholdLevel: 0.5,
      blackToAlpha: false,
    },
    batch: {
      json: '[\n  {"a":"AGNIESZKA","b":"POLSKA","t":"THE HAPPIEST THOUGHT"},\n  {"a":"ARI","b":"DYKIER","t":"DREAM"}\n]',
    },
    texts: [
      { content: 'DOME DREAMING', ring: 4, sector: 12, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1, flipX: true, flipY: true},
      { content: 'FULLDOME FILM FESTIVAL', ring: 5, sector: 7, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1, flipX: true, flipY: true},
      { content: '', ring: 3, sector: 0, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1, flipX: true, flipY: true},
      { content: '', ring: 2, sector: 0, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1, flipX: true, flipY: true},
      { content: '', ring: 1, sector: 0, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1, flipX: true, flipY: true},
      { content: '', ring: 1, sector: 0, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1, flipX: true, flipY: true},
    ],
  },
  export: {
    width: 3840,
    height: 2160,
    preset: '4K',
  },
};

export function loadConfig() {
  const stored = localStorage.getItem('domedreaming-config');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Deep merge with defaults to pick up any new fields
      const merged = structuredClone(defaultConfig);
      for (const section of Object.keys(merged)) {
        if (parsed[section] && typeof merged[section] === 'object') {
          Object.assign(merged[section], parsed[section]);
        }
      }
      return merged;
    } catch(e) { /* ignore */ }
  }
  return null;
}

export function saveConfig(config) {
  localStorage.setItem('domedreaming-config', JSON.stringify(config));
}

export function saveConfigToFile(config) {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'domedreaming-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function loadConfigFromFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      const text = await file.text();
      try { resolve(JSON.parse(text)); } catch { resolve(null); }
    };
    input.click();
  });
}
