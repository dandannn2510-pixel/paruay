import { FALLBACK_IMAGE_BY_CATEGORY, PRODUCT_IMAGE_PRESETS } from '../data/productPresets';

export const DEFAULT_SVG_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f1f5f9"/><text x="50%" y="45%" font-family="sans-serif" font-size="44" fill="%2394a3b8" dominant-baseline="middle" text-anchor="middle">📦</text><text x="50%" y="70%" font-family="sans-serif" font-size="14" fill="%2364748b" dominant-baseline="middle" text-anchor="middle">พารวย POS</text></svg>`;

export function isPhotoUrl(img) {
  if (!img || typeof img !== 'string') return false;
  return img.startsWith('http://') || img.startsWith('https://') || img.startsWith('/') || img.startsWith('data:image/');
}

export function getProductPhotoUrl(product) {
  if (!product) return PRODUCT_IMAGE_PRESETS[0].url;
  if (isPhotoUrl(product.image)) {
    return product.image;
  }
  return FALLBACK_IMAGE_BY_CATEGORY[product.categoryId] || PRODUCT_IMAGE_PRESETS[0].url;
}

export function handleImageFallback(e, categoryId) {
  const currentTarget = e.currentTarget;
  const fallback = FALLBACK_IMAGE_BY_CATEGORY[categoryId] || PRODUCT_IMAGE_PRESETS[0].url;

  if (currentTarget.src !== fallback) {
    currentTarget.src = fallback;
  } else {
    // If even the fallback fails (offline), use inline SVG
    currentTarget.onerror = null;
    currentTarget.src = DEFAULT_SVG_PLACEHOLDER;
  }
}

/**
 * Compress and downscale an image file to a lightweight data URL
 * Perfect for storing product photos without blowing up LocalStorage quota
 */
export async function compressImageFile(file, maxDimension = 500, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDimension || h > maxDimension) {
          if (w > h) {
            h = Math.round((h * maxDimension) / w);
            w = maxDimension;
          } else {
            w = Math.round((w * maxDimension) / h);
            h = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
