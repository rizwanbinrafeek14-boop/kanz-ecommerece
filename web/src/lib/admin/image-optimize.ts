"use client";
/**
 * Prepares a product photo in the browser before it is stored: corrects the camera orientation, scales it down to at most
 * 2000 px on the long side and re-encodes it as WebP, and makes a 600 px thumbnail for listings, search and the quote list.
 * SVG drawings are stored as they are. Nothing is ever enlarged.
 */
export interface OptimizedImage { main: File; thumb: File | null; width: number; height: number; bytes: number; originalBytes: number; small: boolean }

const MAIN = 2000, THUMB = 600;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"];
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;   // phone and camera originals; the stored file is far smaller
/** Below this size (long side, px) a photo looks blurred on the product page; it is still accepted but marked low-res. */
export const MIN_GOOD_PX = 800;

function baseName(name: string) {
  return name.replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "image";
}

async function encode(bmp: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("This browser cannot process images.");
  ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  // browsers without a WebP encoder return PNG: use JPEG on a white background instead
  if (blob && blob.type === "image/webp") return blob;
  ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  const jpg = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!jpg) throw new Error("The image could not be converted.");
  return jpg;
}

export async function optimizeImage(file: File): Promise<OptimizedImage> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name}: use JPG, PNG, WebP, AVIF, GIF or SVG.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name}: the file is larger than 40 MB.`);
  const base = baseName(file.name);
  if (file.type === "image/svg+xml") return { main: new File([file], `${base}.svg`, { type: file.type }), thumb: null, width: 0, height: 0, bytes: file.size, originalBytes: file.size, small: false };
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { throw new Error(`${file.name}: the image could not be read (damaged or unsupported file).`); }
  try {
    const long = Math.max(bmp.width, bmp.height);
    const main = await encode(bmp, MAIN, 0.86);
    const thumb = long > THUMB ? await encode(bmp, THUMB, 0.8) : null;
    const ext = main.type === "image/webp" ? "webp" : "jpg";
    const scale = Math.min(1, MAIN / long);
    return {
      main: new File([main], `${base}.${ext}`, { type: main.type }), thumb: thumb ? new File([thumb], `${base}-thumb.${ext}`, { type: thumb.type }) : null,
      width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale), bytes: main.size, originalBytes: file.size, small: long < MIN_GOOD_PX,
    };
  } finally { bmp.close(); }
}

export const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
