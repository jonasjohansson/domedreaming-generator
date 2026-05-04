/**
 * Title-card image registry. Holds in-memory Image elements loaded from
 * user-selected files. Renderer reads from getImages() and shuffles with
 * a seeded RNG so the same {seed, count, image set} always produces the
 * same layout — viewport and PNG export stay in sync.
 */

const images = []; // { url, img }
let onChangeCb = null;

/**
 * Festival lineup images bundled with the generator at assets/lineup/.
 * Same set used by /grid/ on domedreaming.com — copied in so the generator
 * works standalone without depending on the festival site being served.
 */
export const FESTIVAL_IMAGE_PATHS = [
  'assets/lineup/agnieszka_polska-the_happiest_thought_still_02.webp',
  'assets/lineup/ari_dykier-dream_still_01.webp',
  'assets/lineup/lucas_guiterrez-xyz_craft_still_01.webp',
  'assets/lineup/suvi_parilla-parallel_universe_4096x4096_frame_03341.webp',
  'assets/lineup/sergey_prokofjev-ldgu_001_16x9.webp',
  'assets/lineup/julius_horsthius-recombination_fulldome_stills_(00072).webp',
  'assets/lineup/ryoichi_kurokawa-ins_still_1.webp',
  'assets/lineup/patricia_detmering-with_the_times_against_their_shape.webp',
  'assets/lineup/aavistus-festival.webp',
  'assets/lineup/simon-ryden.webp',
  'assets/lineup/the-new-infinity.webp',
];

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

/**
 * Load images from a list of absolute URLs (typically the festival lineup).
 * Sets crossOrigin so threshold mode (which calls getImageData) works when
 * the remote serves CORS headers; falls back to no-CORS mode for plain
 * display if that fails.
 */
export async function loadImagesFromUrls(urls) {
  const list = Array.from(urls || []);
  await Promise.all(list.map(loadOneUrl));
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

function loadOneUrl(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      images.push({ url, img });
      resolve();
    };
    img.onerror = () => {
      // Retry without crossOrigin (display-only, no pixel reads)
      const fallback = new Image();
      fallback.onload = () => {
        images.push({ url, img: fallback });
        resolve();
      };
      fallback.onerror = () => {
        console.warn('Failed to load image:', url);
        resolve();
      };
      fallback.src = url;
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
