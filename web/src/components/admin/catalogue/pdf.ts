"use client";
/** Browser-side PDF.js helpers: the visitor's (admin's) browser does the heavy rendering, so the server needs no PDF tooling. */
import type { PDFDocumentProxy } from "pdfjs-dist";

let lib: typeof import("pdfjs-dist") | null = null;
async function pdfjs() {
  if (!lib) { lib = await import("pdfjs-dist"); lib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"; }
  return lib;
}
export async function openPdf(data: ArrayBuffer | string): Promise<PDFDocumentProxy> {
  const p = await pdfjs();
  const src = typeof data === "string" ? { url: data } : { data: new Uint8Array(data) };
  return p.getDocument({ ...src, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/", iccUrl: "/pdfjs/iccs/" }).promise;
}
/** Renders a page to PNG at about 170 dpi (long side ~2000 px) and returns it with the page's text layer. */
export async function renderPage(doc: PDFDocumentProxy, n: number, longSide = 2000): Promise<{ png: Blob; text: string; width: number; height: number }> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(4, longSide / Math.max(base.width, base.height)) });
  const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport }).promise;
  const png = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode page image"))), "image/png"));
  const tc = await page.getTextContent();
  const text = tc.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "")).join("").replace(/[ \t]+\n/g, "\n").trim();
  page.cleanup();
  return { png, text, width: canvas.width, height: canvas.height };
}
