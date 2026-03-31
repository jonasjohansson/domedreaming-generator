export const defaultConfig = {
  geometry: {
    frequency: 2,
    radius: 1,
    hemisphere: true,
    truncation: 0.5,
    rotation: 0,
  },
  unwrap: {
    layout: 'flower',
    gap: 0.1,
    clusterRotation: 0,
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
