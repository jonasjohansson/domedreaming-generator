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
    gap: 0.1,
    clusterRotation: 0,
    scatter: 0,
    jitter: 0,
    groupSpin: 0,
    scaleVar: 0,
    drift: 0,
    seed: 42,
  },
  media: {
    source: '',
    mode: 'global',
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
    try { return JSON.parse(stored); } catch(e) { /* ignore */ }
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
