import { IMAGE_LIMITS } from '../../api/_lib/studio/files.js';

/* ============================================================================
   User attachments
   ----------------------------------------------------------------------------
   A screenshot straight off a phone is 3–8 MB; the model wants a small JPEG and
   a serverless request body has a hard limit. So the browser downscales and
   re-encodes before anything is sent, and refuses what the API would refuse.
   ============================================================================ */

export const MAX_IMAGES = IMAGE_LIMITS.maxCount;
export const ACCEPTED = IMAGE_LIMITS.mimes.join(',');

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

/** Shrinks to `max` on the long edge and re-encodes as JPEG. */
function downscale(dataUrl, max, quality) {
  return new Promise((resolve, reject) => {
    if (typeof Image !== 'function' || typeof document === 'undefined') return reject(new Error('no_canvas'));
    /* a browser that never decodes the image (or a headless one) must not hang
       the composer — give up after a moment and send the original instead */
    const timer = setTimeout(() => reject(new Error('decode_timeout')), 1500);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.width || max) * scale));
        canvas.height = Math.max(1, Math.round((img.height || max) * scale));
        const ctx = canvas.getContext && canvas.getContext('2d');
        if (!ctx) return reject(new Error('no_canvas'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        return reject(e);
      }
    };
    img.onerror = () => { clearTimeout(timer); reject(new Error('decode_failed')); };
    img.src = dataUrl;
  });
}

/**
 * Turns a picked File into { mime, data, name, url } or throws a code the UI can
 * explain. `url` is only for the local thumbnail; `data` is what gets sent.
 */
export async function prepareImage(file, { max = 1280, quality = 0.82 } = {}) {
  const type = String(file?.type || '').toLowerCase();
  if (!type.startsWith('image/')) throw new Error('not_an_image');
  if (!IMAGE_LIMITS.mimes.includes(type)) throw new Error('unsupported_type');

  const original = await readAsDataURL(file);
  if (!original.includes(',')) throw new Error('read_failed');

  let url = original;
  try {
    url = await downscale(original, max, quality);
  } catch {
    /* no canvas (old browser, test runner): send the original if it fits */
    url = original;
  }

  const comma = url.indexOf(',');
  const mime = (url.slice(5, comma).split(';')[0] || type).toLowerCase();
  const data = url.slice(comma + 1);
  if (!IMAGE_LIMITS.mimes.includes(mime)) throw new Error('unsupported_type');
  if (!data || data.length > IMAGE_LIMITS.maxBytes) throw new Error('image_too_large');

  return { mime, data, name: String(file?.name || 'image').slice(0, 120), url, bytes: data.length };
}

export const IMAGE_ERRORS = {
  not_an_image: 'That file is not an image.',
  unsupported_type: 'Use a JPEG, PNG or WebP image.',
  image_too_large: 'That image is too large — try a smaller screenshot.',
  read_failed: 'The image could not be read.',
};
