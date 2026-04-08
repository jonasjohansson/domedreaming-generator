export const defaultConfig = {
  geometry: {
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
  },
  media: {
    source: '',
    mode: 'global',
  },
  export: {
    width: 3840,
    height: 2160,
    preset: '4K',
    transparent: false,
  },
  grid: {
    rows: 3,
    selectedCell: '1,1',
    patternScale: 1,
    offsetX: 0,
    offsetY: 0,
  },
  wireframe: {
    lineWidth: 0.5,
    lineColor: '#222222',
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
