// Copies the PDF.js support files (character maps for Japanese/CJK fonts, standard fonts, image decoders) to public/pdfjs
// so the admin catalogue importer can render any manufacturer PDF in the browser. Runs automatically before dev and build.
import { cpSync, existsSync, mkdirSync } from "node:fs";
const src = "node_modules/pdfjs-dist", dst = "public/pdfjs";
if (!existsSync(src)) { console.warn("pdfjs-dist not installed; skipping"); process.exit(0); }
mkdirSync(dst, { recursive: true });
for (const d of ["cmaps", "standard_fonts", "wasm", "iccs"]) if (existsSync(`${src}/${d}`)) cpSync(`${src}/${d}`, `${dst}/${d}`, { recursive: true });
cpSync(`${src}/build/pdf.worker.min.mjs`, `${dst}/pdf.worker.min.mjs`);
console.log("pdf.js assets copied to public/pdfjs");
