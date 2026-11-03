import "server-only";
/**
 * Files attached to a quotation request (drawings, datasheets, bills of quantities). Shared rules for the upload actions,
 * the admin page and the customer's quotation page. Files live in the PRIVATE bucket rfq-attachments under rfq/<rfq id>/.
 */
export const RFQ_FILES = { max: 5, maxBytes: 10 * 1024 * 1024, windowMinutes: 60, bucket: "rfq-attachments" } as const;

const TYPES: Record<string, { mime: string; check: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", check: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  png: { mime: "image/png", check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { mime: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  webp: { mime: "image/webp", check: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", check: (b) => isZip(b) && b.includes("xl/") },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", check: (b) => isZip(b) && b.includes("word/") },
  xls: { mime: "application/vnd.ms-excel", check: isOle },
  doc: { mime: "application/msword", check: isOle },
  csv: { mime: "text/csv", check: (b) => !b.subarray(0, 65536).includes(0) },   // plain text: no NUL bytes
};
function isZip(b: Buffer) { return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04; }
function isOle(b: Buffer) { return b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])); }

/** File extension → allowed type (by the name the customer chose), or null. */
export function rfqFileType(name: string) {
  const ext = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1]; const key = ext === "jpeg" ? "jpg" : ext;
  return key && TYPES[key] ? { ext: key, mime: TYPES[key].mime } : null;
}
/** Does the file's content match its extension? (A renamed program or web page is rejected.) */
export function rfqFileContentOk(ext: string, body: Buffer) { return !!TYPES[ext]?.check(body); }
/** A storage-safe file name that keeps the customer's name readable. */
export const safeFileName = (name: string) => name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
/** Is the RFQ still open for adding files (within the window after it was sent)? */
export const rfqFilesOpen = (createdAt: string, now = Date.now()) => now - new Date(createdAt).getTime() < RFQ_FILES.windowMinutes * 60_000;
