// A camera or gallery photo as a downscaled JPEG blob, longest side 1280 px; the storage limit is 2 MB and this lands far below it.
// Rejects when the file cannot be decoded as an image; resolves null when the browser cannot encode it.
export async function toJpeg(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.72));
}
