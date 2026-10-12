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
