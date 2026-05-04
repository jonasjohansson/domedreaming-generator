/**
 * Title-card image registry. Holds in-memory Image elements loaded from
 * user-selected files. Renderer reads from getImages() and shuffles with
 * a seeded RNG so the same {seed, count, image set} always produces the
 * same layout — viewport and PNG export stay in sync.
 */

const images = []; // { url, img }
let onChangeCb = null;

export function setOnChange(cb) {
  onChangeCb = cb;
}

export function getImages() {
  return images.slice();
}

export function getImageCount() {
  return images.length;
}

export async function loadImageFiles(files) {
  const list = Array.from(files || []);
  await Promise.all(list.map(loadOneFile));
  if (onChangeCb) onChangeCb();
}

export function clearImages() {
  for (const entry of images) {
    if (entry.url && entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url);
  }
  images.length = 0;
  if (onChangeCb) onChangeCb();
}

function loadOneFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return Promise.resolve();
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      images.push({ url, img });
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

/**
 * Mulberry32 — a small, deterministic 32-bit PRNG. Seed it once per render
 * and use it for shuffles + cell-size rolls so layouts are reproducible.
 */
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
