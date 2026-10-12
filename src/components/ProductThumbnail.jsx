import React from 'react';
import { getProductPhotoUrl, handleImageFallback } from '../utils/imageUtils';

export function ProductThumbnail({
  product,
  size = 40,
  className = '',
  style = {},
  alt = '',
}) {
  const photoUrl = getProductPhotoUrl(product);
  const altText = alt || product?.name || 'สินค้า';

  return (
    <img
      src={photoUrl}
      alt={altText}
      className={`product-thumb-img ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        objectFit: 'cover',
        borderRadius: 8,
        border: '1px solid var(--border-color, #e2e8f0)',
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      }}
      loading="lazy"
      onError={(e) => handleImageFallback(e, product?.categoryId)}
    />
  );
}
