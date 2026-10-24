const RASTER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isRasterDataUrl(value) {
  if (typeof value !== "string") return false;
  const match = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  return !!match && match[1].length % 4 === 0;
}

// Persisted/imported strings must never become arbitrary URLs or HTML attributes.
export function drawingImageUrl(value) {
  if (value instanceof Blob && RASTER_TYPES.has(value.type)) return URL.createObjectURL(value);
  return isRasterDataUrl(value) ? value : null;
}
