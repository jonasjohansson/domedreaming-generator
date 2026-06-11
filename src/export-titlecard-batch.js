/**
 * Batch title-card export — given a list of {artist, title} entries,
 * render one PNG per entry with title → Text 1 (the prominent headline
 * slot) and artist → Text 2, incrementing the image-card seed per entry
 * so every card gets a different image layout. Bundles into a ZIP.
 */

import JSZip from 'jszip';
import { drawTitlecardAt } from './titlecard-renderer.js';

export async function exportTitlecardBatchZip(config, entries) {
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error('No batch entries.');
  }

  const tc = config && config.titlecard;
  const size = Math.round(Number(tc && tc.exportSize) || 2048);
  if (!size || size < 1) throw new Error('Invalid export size.');

  const zip = new JSZip();
  const baseSeed = (tc.imageCards && tc.imageCards.seed) || 1;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] || {};
    const artist = (e.artist || '').toString();
    const title = (e.title || '').toString();

    // Build a per-entry config without mutating the live one
    const perCardCfg = JSON.parse(JSON.stringify(tc));
    if (perCardCfg.texts && perCardCfg.texts.length >= 2) {
      perCardCfg.texts[0].content = title;
      perCardCfg.texts[1].content = artist;
      // Text 3 (festival branding) and any other custom slots are kept as-is
      // so they appear identically on every batch card.
    }
    if (perCardCfg.imageCards) {
      perCardCfg.imageCards.seed = baseSeed + i;
    }
    perCardCfg.lineThickness = (perCardCfg.lineThickness || 1) * (size / 1024);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawTitlecardAt(ctx, size / 2, size / 2, size / 2, perCardCfg);

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) continue;
    const filename = `${pad(i + 1, entries.length)}-${slug(artist)}-${slug(title)}.png`.replace(/-+/g, '-');
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `domedreaming-titlecards-${Date.now()}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

function pad(n, total) {
  const width = String(total).length;
  return String(n).padStart(width, '0');
}

function slug(s) {
  return (s || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}
