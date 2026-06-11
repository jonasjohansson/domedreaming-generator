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
    flipX: true,
    flipY: true,
    invertText: true,
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
      // Text 1 ← entry title. Prominent slot — centered at bottom outer ring,
      // larger font so the film title reads as the headline. Arc mode (not
      // cell mode) so multi-word titles like "LOCAL DYSTOPIAS IN THE GLOBAL
      // UTOPIA" pack tightly along the curve and read as one phrase.
      { content: 'FULLDOME FILM FESTIVAL', ring: 5, sector: 18, fontSize: 120, font: 'OffBit', cellMode: false, charsPerCell: 1 },
      // Text 2 ← entry artist. Centered at top outer ring. Arc mode keeps
      // names like "JEREMY OURY" together as a single curved word instead
      // of breaking them into separate cell-aligned letters.
      { content: 'PATRICIA DETMERING', ring: 5, sector: 0, fontSize: 90, font: 'OffBit', cellMode: false, charsPerCell: 1 },
      // Text 3-5 = persistent festival branding. Festival name spans the
      // bottom outer ring; the two city/date lines flank it on ring 4
      // (Malmö lower-right at sector 20, Stockholm upper-right at sector 4).
      { content: 'DREAMING FILM FESTIVAL', ring: 5, sector: 18, fontSize: 70, font: 'OffBit', cellMode: true, charsPerCell: 1 },
      { content: 'MALMÖ 12 MAY', ring: 4, sector: 20, fontSize: 60, font: 'OffBit', cellMode: true, charsPerCell: 1 },
      { content: 'STOCKHOLM 7–9 MAY', ring: 4, sector: 4, fontSize: 55, font: 'OffBit', cellMode: true, charsPerCell: 1 },
      // Text 6 is unused; reset from defaults on startup in main.js.
      { content: '', ring: 1, sector: 0, fontSize: 100, font: 'OffBit', cellMode: true, charsPerCell: 1 },
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
