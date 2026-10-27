import { publicUrl } from "@/lib/format";

export type ImageSource = "upload" | "catalogue" | "manufacturer";
export interface ImageLike { storage_path: string; thumb_path?: string | null; source?: string | null; kind?: string | null; is_primary?: boolean; sort_order?: number; option_match?: Record<string, string> | null }

/** Main image of a product: the starred one, else the first image that is not limited to some options, else the first. */
export function mainImage<T extends ImageLike>(images: T[] | null | undefined): T | undefined {
  return [...(images ?? [])].sort((a, b) => Number(!!b.is_primary) - Number(!!a.is_primary) || Number(!!a.option_match) - Number(!!b.option_match) || (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
}

/** The small listing version when there is one (uploads are stored as a large image plus a ~600 px thumbnail). */
export const thumbOf = (i: ImageLike | undefined | null) => (i ? i.thumb_path || i.storage_path : null);
export const thumbUrl = (i: ImageLike | undefined | null) => publicUrl("product-images", thumbOf(i));

/** Says where an image comes from when it is not KANZ's own photograph, so a catalogue picture is never presented as one. */
export function imageNote(i: Pick<ImageLike, "source" | "kind">, lang: string): string | null {
  const ar = lang === "ar";
  if (i.source === "catalogue") return i.kind === "drawing" ? (ar ? "رسم من كتالوج الشركة المصنعة" : "Drawing from the manufacturer's catalogue") : (ar ? "صورة من كتالوج الشركة المصنعة" : "Image from the manufacturer's catalogue");
  if (i.source === "manufacturer") return ar ? "صورة من الشركة المصنعة" : "Manufacturer's image";
  if (i.kind === "drawing") return ar ? "رسم توضيحي" : "Drawing";
  return null;
}
