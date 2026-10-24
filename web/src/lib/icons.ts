import "server-only";
import sanitizeHtml from "sanitize-html";

export const ICON_MAX_BYTES = 512 * 1024;
export interface CleanIcon { bytes: Buffer; ext: "png" | "webp" | "svg"; contentType: string }

const SVG_TAGS = ["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "title", "desc"];
const SVG_ATTRS = ["xmlns", "viewBox", "width", "height", "d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "fill-opacity", "fill-rule", "clip-rule",
  "opacity", "transform", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2", "points", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "clip-path", "mask", "id", "preserveAspectRatio"];
// If ANY of these survive sanitising, the file is rejected rather than "fixed" - an icon never needs them.
const FORBIDDEN = /(javascript:|vbscript:|data:|expression\s*\(|@import|<\s*(script|foreignObject|iframe|object|embed|image|use|a|style|animate|set)\b|\son\w+\s*=|xlink:href|\shref\s*=|url\(\s*(?!#))/i;

function pngSize(b: Buffer) { return b.length > 24 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null; }
function webpSize(b: Buffer) {
  if (b.length < 30) return null; const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8L") { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}

/** Validates type by CONTENT (not the file name or browser-reported type), checks size and proportions, and sanitises SVG. Throws Error with a user-readable message. */
export function cleanIconUpload(input: Buffer): CleanIcon {
  if (!input.length) throw new Error("The icon file is empty.");
  if (input.length > ICON_MAX_BYTES) throw new Error("Icon is larger than 512 KB. Please use a smaller file.");
  const dimsOk = (d: { w: number; h: number } | null) => {
    if (!d) throw new Error("Could not read the image size.");
    if (d.w < 16 || d.h < 16) throw new Error("Icon is too small (minimum 16×16 pixels).");
    if (d.w > 2048 || d.h > 2048) throw new Error("Icon is too large (maximum 2048×2048 pixels).");
    if (Math.max(d.w / d.h, d.h / d.w) > 4) throw new Error("Icon proportions are too extreme. Use a roughly square image.");
  };
  if (input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) { dimsOk(pngSize(input)); return { bytes: input, ext: "png", contentType: "image/png" }; }
  if (input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP") { dimsOk(webpSize(input)); return { bytes: input, ext: "webp", contentType: "image/webp" }; }
  const head = input.subarray(0, 2048).toString("utf8");
  if (/<svg[\s>]/i.test(head)) {
    const raw = input.toString("utf8");
    if (/<!(ENTITY|DOCTYPE)/i.test(raw)) throw new Error("SVG files with DOCTYPE/ENTITY declarations are not allowed.");
    const clean = sanitizeHtml(raw, {
      allowedTags: SVG_TAGS, allowedAttributes: { "*": SVG_ATTRS }, allowedSchemes: [], allowProtocolRelative: false, disallowedTagsMode: "discard",
      parser: { xmlMode: true, lowerCaseTags: false, lowerCaseAttributeNames: false }, exclusiveFilter: undefined,
    }).trim();
    if (!/^<svg[\s>]/.test(clean)) throw new Error("This SVG could not be made safe. Re-export it as a simple SVG (paths and shapes only) or use PNG/WebP.");
    const rawNoComments = raw.replace(/<\?xml[^>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "");
    if (FORBIDDEN.test(clean) || FORBIDDEN.test(rawNoComments)) {   // checked on the ORIGINAL too: a file that tried to smuggle scripts is rejected, not quietly "fixed"
      throw new Error("This SVG contains scripts, links or external references and was rejected for safety. Use a simple SVG, or PNG/WebP.");
    }
    if (!/<(path|circle|rect|ellipse|line|polyline|polygon)\b/.test(clean)) throw new Error("The SVG contains no drawable shapes after safety cleaning.");
    const withNs = /xmlns=/.test(clean.slice(0, 200)) ? clean : clean.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    if (!/viewBox=/.test(withNs.slice(0, 400)) && !/width=/.test(withNs.slice(0, 400))) throw new Error("The SVG needs a viewBox so it scales correctly.");
    return { bytes: Buffer.from(withNs, "utf8"), ext: "svg", contentType: "image/svg+xml" };
  }
  throw new Error("Unsupported icon type. Use PNG, WebP or SVG.");
}
