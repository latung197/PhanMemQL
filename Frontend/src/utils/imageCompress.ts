// Shrinks a picture in the browser before it is uploaded (the backend keeps pictures in the database and refuses more than 2 MB).

export interface PreparedImage {
  contentType: string;
  dataBase64: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_EDGE = 1600;
/** Stay under the backend limit with room to spare (base64 is sent as is, the limit is on the bytes). */
const TARGET_BYTES = 1_500_000;

const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
  image.src = url;
});

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality));

const toBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(new Error('read'));
  reader.readAsDataURL(blob);
});

/** Returns the picture scaled to at most 1600 px on its long side and re-encoded (WebP, else JPEG) under about 1.5 MB. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error('type');
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  // A small file that is already small enough goes up unchanged.
  if (scale === 1 && file.size <= 400_000) return { contentType: file.type, dataBase64: await toBase64(file) };

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let blob: Blob | null = null;
  for (const quality of [0.86, 0.75, 0.62, 0.5]) {
    blob = await toBlob(canvas, 'image/webp', quality);
    // A browser without WebP encoding answers with PNG: use JPEG then.
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('size');
  return { contentType: blob.type, dataBase64: await toBase64(blob) };
}
