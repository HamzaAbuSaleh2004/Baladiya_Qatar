// Resize an image File/Blob client-side before upload.
//   - max 1280×960
//   - JPEG quality 0.72
//   - keeps aspect ratio
// Returns a new File at <= ~150KB for typical phone photos.
export async function resizeImage(file, { maxW = 1280, maxH = 960, quality = 0.72 } = {}) {
  if (!file) return file;
  // Use createImageBitmap when available; falls back to <img>.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    bitmap = await loadImg(file);
  }
  const ratio = Math.min(maxW / bitmap.width, maxH / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(file);
        // Always rename to .jpg so the backend treats as image/jpeg.
        const out = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
        resolve(out);
      },
      'image/jpeg',
      quality,
    );
  });
}

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
