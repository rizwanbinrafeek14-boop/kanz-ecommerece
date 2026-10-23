#!/usr/bin/env python3
"""
Extract product images + caption text from the KANZ CORNER catalogue PDF.

Output (never auto-published; it only feeds the admin "Import review" screen):
  <out>/images/p{page}-{n}.jpg      cropped product images (alpha composited on white)
  <out>/extracted.json              [{page, image, bbox, caption, width, height, low_res, flags}]
  <out>/page-text.json              raw text per page (for the import builder)

Usage:  python3 scripts/extract_catalogue.py catalogue.pdf data/catalogue-extract
"""
import sys, os, json, hashlib, io
import pymupdf  # pip install pymupdf pillow
from PIL import Image

pdf_path, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, "images"), exist_ok=True)
doc = pymupdf.open(pdf_path)

def load_rgb(xref):
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha: pix = pymupdf.Pixmap(pix, 0)
    if pix.colorspace and pix.colorspace.n > 3: pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")
    return img

def with_smask(xref):
    info = doc.extract_image(xref)
    base = Image.open(io.BytesIO(info["image"])).convert("RGB")
    sm = info.get("smask")
    if sm:
        mask = Image.open(io.BytesIO(doc.extract_image(sm)["image"])).convert("L").resize(base.size)
        bg = Image.new("RGB", base.size, "white"); bg.paste(base, mask=mask); return bg
    return base

# Pass 1: image hash -> pages it appears on (repeated images are logos/headers/watermarks)
seen = {}
for pno, page in enumerate(doc, 1):
    for im in page.get_image_info(xrefs=True):
        x = im["xref"]
        if not x: continue
        try: h = hashlib.md5(doc.extract_image(x)["image"]).hexdigest()
        except Exception: continue
        seen.setdefault(h, set()).add(pno)

results, pagetext = [], {}
for pno, page in enumerate(doc, 1):
    W, H = page.rect.width, page.rect.height
    pagetext[pno] = page.get_text("text")
    lines = []                                 # line-level text boxes (blocks merge several captions)
    for blk in page.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            t = " ".join("".join(sp["text"] for sp in ln["spans"]).split())
            if t: lines.append((*ln["bbox"], t))
    n = 0
    for im in page.get_image_info(xrefs=True):
        x = im["xref"]; bx0, by0, bx1, by1 = im["bbox"]
        if not x: continue
        w, h = im["width"], im["height"]
        bw, bh = bx1 - bx0, by1 - by0
        flags = []
        raw = doc.extract_image(x)
        hh = hashlib.md5(raw["image"]).hexdigest()
        if len(seen.get(hh, ())) >= 3: continue            # logo / repeated header
        if bw > W * 0.9 or bh > H * 0.45: continue          # full-width photos / backgrounds
        if w < 120 or h < 120 or bw < 30: continue          # icons / decorations
        # caption = text lines just below the image, centred under it
        cx0, cx1 = bx0 - bw * 0.1, bx1 + bw * 0.1
        cands = []
        for tx0, ty0, tx1, ty1, txt in lines:
            mid = (tx0 + tx1) / 2
            d = ty0 - by1
            if cx0 <= mid <= cx1 and -3 <= d <= 38 and len(txt) <= 60:
                cands.append((ty0, txt))
        cands.sort()
        best = " ".join(t for _, t in cands[:2]) if cands else None
        low = max(w, h) < 600
        if low: flags.append("low_res")
        if not best: flags.append("no_caption")
        n += 1
        fn = f"p{pno:02d}-{n:02d}.jpg"
        try:
            img = with_smask(x)
            from PIL import ImageChops          # trim white margins left by transparent padding
            bg = Image.new("RGB", img.size, "white")
            box = ImageChops.difference(img, bg).convert("L").point(lambda v: 255 if v > 12 else 0).getbbox()
            if box:
                pad = 6
                img = img.crop((max(box[0]-pad,0), max(box[1]-pad,0), min(box[2]+pad,img.width), min(box[3]+pad,img.height)))
            img.save(os.path.join(out, "images", fn), quality=90)
        except Exception as e:
            flags.append(f"export_failed:{e}"); fn = None
        results.append(dict(page=pno, image=fn, bbox=[round(v, 1) for v in (bx0, by0, bx1, by1)],
                            caption=best, width=w, height=h, flags=flags))

json.dump(results, open(os.path.join(out, "extracted.json"), "w"), indent=1, ensure_ascii=False)
json.dump(pagetext, open(os.path.join(out, "page-text.json"), "w"), indent=1, ensure_ascii=False)
print(f"{len(results)} candidate product images from {len(doc)} pages")
