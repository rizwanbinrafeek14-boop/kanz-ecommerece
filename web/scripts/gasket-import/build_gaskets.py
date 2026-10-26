#!/usr/bin/env python3
"""
KanzCorner gasket catalogue (HTML) -> products, variants, dimension tables, drawings and a paste-ready SQL package.

usage:  python3 -I scripts/gasket-import/build_gaskets.py <KanzCorner_Gasket_Catalogue.html> <out-dir>

Writes to <out-dir>:
  gaskets.json                 everything that will be loaded (for review)
  1-gaskets-products.sql       run in Supabase -> SQL Editor (needs migrations 0014-0018). Idempotent: existing products are skipped.
  catalogue/gaskets/*.svg      drawings extracted from the catalogue -> upload the 'catalogue' folder into Storage -> product-images
  2-gaskets-drawings.sql       run after uploading the drawings (safe to run more than once)
  REVIEW.md                    missing / ambiguous information and items for admin review

Rules followed: only values printed in the catalogue are used (no invented sizes, prices, stock, brands or certifications); every
dimension table stays with its own style and flange standard; "–" cells are not offered; Kanz Corner is the supplier, not the manufacturer.
Never commit the catalogue or the generated package.
"""
import html, json, os, re, sys
from html.parser import HTMLParser

SRC, OUT = sys.argv[1], sys.argv[2]
RAW = open(SRC, encoding="utf-8").read()
IMPORT = "kanz-gasket-catalogue"
CATEGORY = "gaskets-sealing-products"
REVIEW: list[str] = []

# ───────────────────────── parsing helpers ─────────────────────────
class Tables(HTMLParser):
    """Body rows of every <table>, as lists of cell texts (empty cells kept)."""
    def __init__(self):
        super().__init__(); self.tables = []; self.cur = None; self.row = None; self.cell = None; self.body = False
    def handle_starttag(self, t, a):
        if t == "table": self.cur = {"head": [], "rows": []}
        elif t in ("thead", "tbody"): self.body = t == "tbody"
        elif t == "tr": self.row = []
        elif t in ("td", "th"): self.cell = ""
        elif t == "br" and self.cell is not None: self.cell += " "
    def handle_endtag(self, t):
        if t == "table": self.tables.append(self.cur); self.cur = None
        elif t in ("td", "th") and self.row is not None: self.row.append(" ".join((self.cell or "").split())); self.cell = None
        elif t == "tr" and self.cur is not None: (self.cur["rows"] if self.body else self.cur["head"]).append(self.row); self.row = None
    def handle_data(self, d):
        if self.cell is not None: self.cell += d

def tables_in(chunk):
    p = Tables(); p.feed(chunk); return p.tables

pages = re.split(r'<h2 class="pt">', RAW)
def section(title_start):
    hits = [p for p in pages[1:] if html.unescape(p).startswith(title_start)]
    assert len(hits) == 1, f"section not found or ambiguous: {title_start}"
    return hits[0]

SVGS = re.findall(r"<svg\b.*?</svg>", RAW, re.S)
assert len(SVGS) == 37, f"expected 37 drawings, found {len(SVGS)}"
STYLE = """.dl{font:600 11px Inter,Arial,sans-serif;fill:#2B2B2D}.lbl{font:600 11px Inter,Arial,sans-serif;fill:#1E1E20}.sm{font:9px Inter,Arial,sans-serif;fill:#3d3d40}.cl{font:10px Inter,Arial,sans-serif;fill:#B02221}"""

def svg_asset(n, name):
    """Catalogue drawing n (1-based) as a standalone SVG: own namespace, page styles inlined, ids prefixed so files never clash."""
    s = SVGS[n - 1]
    s = re.sub(r"<script\b.*?</script>", "", s, flags=re.S); s = re.sub(r'\son\w+="[^"]*"', "", s)
    pre = f"kzg-{name}-"
    s = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{pre}{m.group(1)}"', s)
    s = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{pre}{m.group(1)})", s)
    s = re.sub(r'href="#([^"]+)"', lambda m: f'href="#{pre}{m.group(1)}"', s)
    vb = re.search(r'viewBox="([\d.\s-]+)"', s).group(1).split()
    w, h = float(vb[2]), float(vb[3]); k = max(1, 900 / max(w, h))
    s = re.sub(r"^<svg\b([^>]*)>", lambda m: "<svg" + re.sub(r'\s(class|width|height|style)="[^"]*"', "", m.group(1)) + f' width="{round(w*k)}" height="{round(h*k)}">', s, count=1)
    if "xmlns=" not in s[:300]: s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    s = s.replace(">", f"><style>{STYLE}</style>", 1)
    path = f"catalogue/gaskets/{name}.svg"
    os.makedirs(os.path.dirname(f"{OUT}/{path}"), exist_ok=True)
    open(f"{OUT}/{path}", "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<!-- Source: Kanz Corner Trading gasket catalogue -->\n' + s)
    return path

def svg_grid(ns, name, cols=4):
    """The eight pass-partition shapes printed side by side, as one drawing (same shapes, same labels)."""
    cells = []
    for i, n in enumerate(ns):
        inner = re.sub(r"^<svg\b[^>]*>|</svg>$", "", SVGS[n - 1].strip(), flags=re.S)
        pre = f"kzg-{name}-{i}-"
        inner = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{pre}{m.group(1)}"', inner); inner = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{pre}{m.group(1)})", inner)
        x, y = (i % cols) * 110 + 5, (i // cols) * 110 + 5
        cells.append(f'<svg x="{x}" y="{y}" width="100" height="100" viewBox="0 0 100 100">{inner}</svg>')
    rows = (len(ns) + cols - 1) // cols
    s = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {cols*110} {rows*110}" width="{cols*220}" height="{rows*220}"><style>{STYLE}</style>{"".join(cells)}</svg>'
    path = f"catalogue/gaskets/{name}.svg"; open(f"{OUT}/{path}", "w", encoding="utf-8").write('<?xml version="1.0" encoding="UTF-8"?>\n<!-- Source: Kanz Corner Trading gasket catalogue -->\n' + s)
    return path

FR = {"½": "1/2", "¼": "1/4", "¾": "3/4"}
def nps(t):
    """'1½' -> '1-1/2', '½' -> '1/2', '26' -> '26' (option value, as used by the shop's size filter)."""
    t = t.strip()
    m = re.fullmatch(r"(\d*)([½¼¾])", t)
    if m: return f"{m.group(1)}-{FR[m.group(2)]}" if m.group(1) else FR[m.group(2)]
    assert re.fullmatch(r"\d+", t), f"unexpected NPS {t!r}"; return t
def nps_key(v): a = re.fullmatch(r"(\d+)-(\d)/(\d)|(\d)/(\d)|(\d+)", v); return float(a.group(1)) + int(a.group(2)) / int(a.group(3)) if a.group(1) else int(a.group(4)) / int(a.group(5)) if a.group(4) else float(a.group(6))
def num(t):
    t = t.strip(); return None if t in ("", "–", "-", "—") else t

AR_CLASS = lambda c: f"فئة {c}"
STD = {"B16.5": ("ASME B16.5", "ASME B16.5", "ASME B16.5"),
       "B16.47A": ("ASME B16.47 Series A", "ASME B16.47 Series A (MSS SP-44 pattern)", "ASME B16.47 السلسلة A (نمط MSS SP-44)"),
       "B16.47B": ("ASME B16.47 Series B", "ASME B16.47 Series B (API 605 pattern)", "ASME B16.47 السلسلة B (نمط API 605)"),
       "API6BX": ("API 6BX", "API 6BX flanges", "فلنجات API 6BX")}
NA = "na"

def opt(key, en, ar, values):
    return {"key": key, "name_en": en, "name_ar": ar, "values": [{"value": v, "label_en": le, "label_ar": la} for v, le, la in values]}
def size_values(sizes, na_label=None):
    vals = [(s, f'{s}"', f'{s}"') for s in sorted(set(sizes), key=nps_key)]
    return vals + ([(NA, *na_label)] if na_label else [])
def class_values(classes, na_label=None):
    vals = [(c, f"Class {c}", AR_CLASS(c)) for c in sorted(set(classes), key=int)]
    return vals + ([(NA, *na_label)] if na_label else [])
def code(s): return re.sub(r"[^A-Z0-9]+", "", s.upper().replace("-1/2", "H").replace("-1/4", "Q").replace("-3/4", "T").replace("1/2", "H").replace("3/4", "T").replace("1/4", "Q"))
def _part(p):
    """NPS sizes as decimals in SKUs (1-1/2 -> 1.5), everything else upper-case letters and digits."""
    if re.fullmatch(r"\d+-\d/\d|\d/\d|\d+", p) and p not in ("150", "300", "400", "600", "900", "1500", "2500", "75"):
        v = nps_key(p); return ("%g" % v)
    return code(p)
def sku(*parts): return "GSK-" + "-".join(_part(p) for p in parts if p and p != NA)

def mat(code_, components, status="auto"):
    """A material of the product and the parts made from it (role + exact grades from the catalogue)."""
    return {"code": code_, "status": status, "components": components, "grades": sorted({g for c in components for g in c.get("grades", [])})}

def choice(key, en, ar, values=None, *, type_="select", required=False, requires=None, hint_en=None, hint_ar=None, **kw):
    c = {"key": key, "name_en": en, "name_ar": ar, "type": type_, "required": required}
    if values is not None: c["values"] = values
    if requires: c["requires"] = requires
    if hint_en: c["hint_en"] = hint_en
    if hint_ar: c["hint_ar"] = hint_ar
    c.update(kw); return c
def cv(value, en, ar=None, material=None, requires=None, hint_en=None):
    x = {"value": value, "label_en": en, "label_ar": ar or en}
    if material: x["material"] = material
    if requires: x["requires"] = requires
    if hint_en: x["hint_en"] = hint_en
    return x

PRODUCTS = []
def product(**p):
    p.setdefault("variants", []); p.setdefault("options", []); p.setdefault("dimension_tables", []); p.setdefault("images", []); p.setdefault("materials", [])
    p.setdefault("attributes", {}); p.setdefault("related", []); p.setdefault("review", []); p.setdefault("match_terms", [])
    PRODUCTS.append(p); return p

def img(path, alt_en, alt_ar, match=None):
    return {"storage_path": path, "alt_en": alt_en, "alt_ar": alt_ar, "option_match": match}

# ═══════════════════════ 1. Spiral wound (pages 3-6) ═══════════════════════
sw_tabs = []
for key, title in (("B16.5", "Spiral Wound · ASME B16.20 for ASME B16.5 Flanges"), ("B16.47A", "Spiral Wound · ASME B16.20 for ASME B16.47 Series A"), ("B16.47B", "Spiral Wound · ASME B16.20 for ASME B16.47 Series B")):
    t = tables_in(section(title)); assert len(t) == 1; sw_tabs.append((key, t[0]))
d_sw = svg_asset(3, "spiral-wound-construction")
sw_imgs = [img(svg_asset(2, "spiral-wound-top-view"), "Spiral wound gasket with centering ring (drawing)", "رسم جوان حلزوني مع حلقة توسيط"),
           img(d_sw, "Spiral wound gasket construction and key dimensions d1-d4", "تركيب الجوان الحلزوني والأبعاد الرئيسية d1-d4"),
           img(svg_asset(6, "spiral-wound-style-sw-cr"), "Style SW-CR: sealing element with centering ring", "النوع SW-CR: عنصر الإحكام مع حلقة التوسيط", {"style": "SW-CR"}),
           img(svg_asset(7, "spiral-wound-style-sw-ir-cr"), "Style SW-IR/CR: inner and centering rings", "النوع SW-IR/CR: حلقة داخلية وحلقة توسيط", {"style": "SW-IR/CR"}),
           img(svg_asset(4, "spiral-wound-style-sw"), "Style SW: sealing element only", "النوع SW: عنصر الإحكام فقط", {"style": "SW"}),
           img(svg_asset(5, "spiral-wound-style-sw-ir"), "Style SW-IR: with inner ring", "النوع SW-IR: مع حلقة داخلية", {"style": "SW-IR"})]
sw_vars, sw_tables = [], []
IR_ONLY_B165 = lambda c, s: (c == "900" and nps_key(s) >= 24) or (c == "1500" and nps_key(s) >= 12) or (c == "2500" and nps_key(s) >= 4)
for key, t in sw_tabs:
    std = STD[key]; rows = []
    classes = ["150", "300", "400", "600", "900", "1500", "2500"] if key == "B16.5" else ["150", "300", "400", "600", "900"]
    if key == "B16.5":
        assert t["head"][1][:2] == ["150 300", "400 600"] and t["head"][1][10:12] == ["150– 600", "900– 2500"], t["head"][1]
    for r in t["rows"]:
        size = nps(r[0]); assert len(r) == (21 if key == "B16.5" else 22), r
        for ci, c in enumerate(classes):
            if key == "B16.5":
                g = {"150": 0, "300": 0, "400": 1, "600": 1, "900": 2, "1500": 3, "2500": 4}[c]
                d1, d2, d3, d4 = num(r[2 + g]), num(r[7 + g]), num(r[12 if int(c) <= 600 else 13]), num(r[14 + ci])
            else:
                d1, d2, d3, d4 = num(r[2 + ci]), num(r[7 + ci]), num(r[12 + ci]), num(r[17 + ci])
            if d4 is None: continue
            assert d1 and d2 and d3, (key, size, c)
            styles = ["SW-IR/CR"] if key != "B16.5" or IR_ONLY_B165(c, size) else ["SW-CR", "SW-IR/CR"]   # inner ring mandatory: B16.47 always; B16.5 per the catalogue note
            for st in styles:
                vals = {"d2": d2, "d3": d3, "d4": d4}
                if st == "SW-IR/CR": vals = {"d1": d1, **vals}
                rows.append({"match": {"style": st, "size": size, "class": c}, "values": vals})
                sw_vars.append({"options": {"style": st, "standard": std[0], "size": size, "class": c}, "sku": sku("SW", st, key, c, size),
                                "label_en": f"{st} · {std[0]} · NPS {size} · Class {c}", "size": f'{size}"', "pressure_class": f"Class {c}", "source_page": {"B16.5": 4, "B16.47A": 5, "B16.47B": 6}[key]})
    cols = [{"key": "d1", "symbol": "d1", "label_en": "Inner ring ID (styles with inner ring)", "label_ar": "القطر الداخلي للحلقة الداخلية", "unit": "mm"},
            {"key": "d2", "symbol": "d2", "label_en": "Sealing element ID", "label_ar": "القطر الداخلي لعنصر الإحكام", "unit": "mm"},
            {"key": "d3", "symbol": "d3", "label_en": "Sealing element OD", "label_ar": "القطر الخارجي لعنصر الإحكام", "unit": "mm"},
            {"key": "d4", "symbol": "d4", "label_en": "Centering ring OD", "label_ar": "القطر الخارجي لحلقة التوسيط", "unit": "mm"}]
    notes = ["All dimensions in millimetres. Class designations: 150 ≈ PN 20 · 300 ≈ PN 50 · 400 ≈ PN 68 · 600 ≈ PN 100 · 900 ≈ PN 150 · 1500 ≈ PN 250 · 2500 ≈ PN 420.",
             "Sealing element thickness 4.45 mm; ring thickness 2.97–3.32 mm."]
    if key == "B16.5":
        notes += ["NPS 3½ is not listed in ASME B16.20 and is available on request.",
                  "Inner rings are mandatory for: Class 900 NPS 24, Class 1500 NPS 12 and larger, Class 2500 NPS 4 and larger, and all PTFE-filled gaskets.",
                  "Class 400 NPS ½–3 and Class 900 NPS ½–2½ use Class 600 and Class 1500 gaskets respectively; Class 2500 NPS 14 and larger are not covered.",
                  "Tolerances (ASME B16.20) d1: NPS 1¼–3 +0.75/−0, NPS 4 and larger +1.52/−0 · d2: NPS ½–8 ±0.41, NPS 10–24 ±0.76 · d3: NPS ½–8 ±0.76, NPS 10–24 +1.52/−0.76 · d4: ±0.76."]
    else:
        notes += [f"{std[1]} flanges. Inner rings are required in all large-diameter spiral wound gaskets."]
    sw_tables.append({"title_en": f"Spiral wound gaskets — ASME B16.20 for {std[1]} flanges", "title_ar": f"الجوانات الحلزونية — ASME B16.20 لفلنجات {std[2]}",
                      "columns": cols, "applies": {"standard": std[0]}, "rows": rows, "notes": notes, "source_page": {"B16.5": 4, "B16.47A": 5, "B16.47B": 6}[key], "drawing_path": d_sw})
for st in ("SW", "SW-IR"):
    sw_vars.append({"options": {"style": st, "standard": NA, "size": NA, "class": NA}, "sku": sku("SW", st, "JOINT"), "label_en": f"{st} · made to the joint dimensions", "source_page": 3})
SS_W = ["SS 304/304L", "SS 316/316L", "SS 321", "SS 347"]
NI_W = ["Alloy 20", "Monel 400", "Inconel 600", "Inconel 625", "Incoloy 800", "Incoloy 825", "Hastelloy C-276"]
IR = ["SW-IR", "SW-IR/CR"]; CR = ["SW-CR", "SW-IR/CR"]
product(
    slug="spiral-wound-gaskets", family_slug="spiral-wound-gasket", name_en="Spiral Wound Gaskets – ASME B16.20", name_ar="جوانات حلزونية (Spiral Wound) – ASME B16.20",
    family_name_en="Spiral Wound Gaskets", family_name_ar="الجوانات الحلزونية", product_type="spiral-wound-gasket", unit="pcs", pages=[3, 4, 5, 6],
    short_desc_en="Spiral wound gaskets to ASME B16.20 for ASME B16.5 (NPS ½–24, Class 150–2500) and ASME B16.47 Series A and B flanges (NPS 26–60, Class 150–900), in styles SW, SW-IR, SW-CR and SW-IR/CR.",
    short_desc_ar="جوانات حلزونية وفق ASME B16.20 لفلنجات ASME B16.5 (المقاسات ½–24، الفئات 150–2500) وفلنجات ASME B16.47 السلسلتين A وB (المقاسات 26–60، الفئات 150–900) بالأنواع SW وSW-IR وSW-CR وSW-IR/CR.",
    description_en=("A spiral wound gasket is a pre-formed V-shaped metal strip wound together with a soft filler tape. The metal spiral gives the joint spring-back and recovery under pressure and temperature cycling, while the filler fills flange-face imperfections and makes the seal. It is the standard choice for raised-face flanges in hydrocarbon, steam and chemical service.\n\n"
                    "Styles: SW (sealing element only) for tongue-and-groove and male/female faces, valve bonnets and pressure-vessel covers where the gasket is located by the joint itself — not for plain raised-face pipe flanges. "
                    "SW-IR (with inner ring): the inner ring backs up the windings against inward buckling and keeps them out of the flow; for male/female joints, not for plain raised-face flanges. "
                    "SW-CR (with centering ring): the most common style for raised-face pipe flanges; the outer ring locates the gasket inside the bolt circle, limits compression and stops outward blow-out; not normally used with PTFE filler. "
                    "SW-IR/CR (inner and centering rings): specified for PTFE filler; NPS 24+ in Class 900, NPS 12+ in Class 1500 and NPS 4+ in Class 2500; and for socket-weld, lapped, weld-neck and integral flanges on raised faces.\n\n"
                    "Marking to ASME B16.20: manufacturer's name or trademark · nominal pipe size and pressure class · winding metal and filler material · inner ring material (when not SS304) · outer ring material (when not carbon steel) · ASME B16.20. "
                    "Example: MANUFACTURER · 4\" 150 · 316L / FG · ASME B16.20 · SS304 I.R.\n\nPacking: each gasket is supplied vacuum-sealed flat on corrugated fibreboard to protect the windings in transit.\n\n"
                    "To order, state: NPS and class · flange standard · style (SW, SW-IR, SW-CR, SW-IR/CR) · winding metal · filler · inner and outer ring materials · quantity."),
    description_ar=("الجوان الحلزوني شريط معدني مُشكّل على هيئة V ملفوف مع شريط حشو لين. يمنح الحلزون المعدني الوصلة قدرة على الارتداد والاستعادة مع تغيرات الضغط والحرارة، بينما يملأ الحشو عيوب وجه الفلنجة ويحقق الإحكام. وهو الخيار القياسي لفلنجات الوجه البارز في خدمات الهيدروكربونات والبخار والكيماويات.\n\n"
                    "الأنواع: SW (عنصر الإحكام فقط) لوصلات اللسان والمجرى والذكر/الأنثى؛ SW-IR (مع حلقة داخلية)؛ SW-CR (مع حلقة توسيط) وهو الأكثر استخداماً لفلنجات الوجه البارز ولا يُستخدم عادةً مع حشو PTFE؛ SW-IR/CR (حلقة داخلية وحلقة توسيط) ويُشترط مع حشو PTFE وفي الحالات المذكورة في الجداول.\n\n"
                    "عند الطلب يرجى ذكر: المقاس والفئة، مواصفة الفلنجة، النوع، معدن اللف، الحشو، مادتي الحلقة الداخلية والخارجية، والكمية. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Raised-face pipe flanges (SW-CR, SW-IR/CR)\nTongue-and-groove and male/female joints, valve bonnets, pressure-vessel covers (SW, SW-IR)\nHydrocarbon, steam and chemical service",
    options=[opt("style", "Style", "النوع", [("SW-CR", "SW-CR · with centering ring", "SW-CR · مع حلقة توسيط"), ("SW-IR/CR", "SW-IR/CR · inner & centering rings", "SW-IR/CR · حلقة داخلية وحلقة توسيط"),
                                             ("SW", "SW · sealing element only", "SW · عنصر الإحكام فقط"), ("SW-IR", "SW-IR · with inner ring", "SW-IR · مع حلقة داخلية")]),
             opt("standard", "Flange standard / series", "مواصفة / سلسلة الفلنجة", [STD["B16.5"], STD["B16.47A"], STD["B16.47B"], (NA, "Made to the joint dimensions", "حسب أبعاد الوصلة")]),
             opt("size", "Size (NPS)", "المقاس (NPS)", size_values([v["options"]["size"] for v in sw_vars if v["options"]["size"] != NA], ("To joint dimensions", "حسب أبعاد الوصلة"))),
             opt("class", "Pressure class", "فئة الضغط", class_values([v["options"]["class"] for v in sw_vars if v["options"]["class"] != NA], ("—", "—")))],
    variants=sw_vars, dimension_tables=sw_tables, images=sw_imgs,
    choices=[choice("winding", "Winding metal", "معدن اللف", [cv(g, g, material="SS") for g in SS_W] + [cv("Duplex", "Duplex", "دوبلكس", "DSS"), cv("Super Duplex", "Super Duplex", "سوبر دوبلكس", "SDSS")]
                    + [cv(g, g, material="NI") for g in NI_W] + [cv("Titanium", "Titanium", "تيتانيوم", "TI")], required=True),
             choice("filler", "Filler", "مادة الحشو", [cv("Flexible graphite", "Flexible graphite", "جرافيت مرن", "GRAPHITE"),
                    cv("PTFE", "PTFE", "PTFE", "PTFE", requires={"style": IR}, hint_en="PTFE filler needs an inner ring (style SW-IR or SW-IR/CR)."),
                    cv("Ceramic", "Ceramic", "سيراميك", "CERAMIC"), cv("Mica-graphite", "Mica-graphite", "ميكا - جرافيت", "MICA")], required=True),
             choice("inner_ring", "Inner ring material", "مادة الحلقة الداخلية", [cv("SS 304", "SS 304", "SS 304", "SS"), cv("Other stainless or alloy (state grade)", "Other stainless or alloy (state grade)", "ستانلس أو سبيكة أخرى (اذكر الدرجة)")],
                    requires={"style": IR}, required=True, hint_en="Stainless or alloy to suit service. Marked on the gasket when not SS304."),
             choice("outer_ring", "Centering (outer) ring material", "مادة حلقة التوسيط (الخارجية)", [cv("Carbon steel", "Carbon steel (standard)", "صلب كربوني (قياسي)", "CS"), cv("Stainless or alloy (state grade)", "Stainless or alloy (state grade)", "ستانلس أو سبيكة (اذكر الدرجة)")],
                    requires={"style": CR}, required=True),
             choice("ring_grade", "Ring grade (if not standard)", "درجة الحلقة (إن لم تكن قياسية)", type_="text", maxlength=80, requires={"style": IR + ["SW-CR"]})],
    materials=[mat("SS", [{"role": "winding", "grades": SS_W}, {"role": "inner ring", "grades": ["SS 304"], "note": "stainless or alloy to suit service"}, {"role": "outer ring", "note": "stainless or alloy to suit service (standard: carbon steel)"}]),
               mat("DSS", [{"role": "winding", "grades": ["Duplex"]}]), mat("SDSS", [{"role": "winding", "grades": ["Super Duplex"]}]),
               mat("NI", [{"role": "winding", "grades": NI_W}]), mat("TI", [{"role": "winding", "grades": ["Titanium"]}]),
               mat("CS", [{"role": "outer ring", "grades": ["Carbon steel (standard)"]}]),
               mat("GRAPHITE", [{"role": "filler", "grades": ["Flexible graphite"]}]), mat("PTFE", [{"role": "filler", "grades": ["PTFE"]}]),
               mat("CERAMIC", [{"role": "filler", "grades": ["Ceramic"]}]), mat("MICA", [{"role": "filler", "grades": ["Mica-graphite"]}])],
    standards=[("ASME B16.20", "Gasket standard (dimensions and marking)"), ("ASME B16.5", "Flanges NPS ½–24"), ("ASME B16.47 Series A", "Flanges NPS 26–60 (MSS SP-44 pattern)"), ("ASME B16.47 Series B", "Flanges NPS 26–60 (API 605 pattern)")],
    properties=[("Sealing element thickness", "4.45 mm"), ("Ring thickness", "2.97–3.32 mm")],
    attributes={"gasket_family": [("Spiral wound gaskets", "جوانات حلزونية")], "gasket_standard": [("ASME B16.20", "ASME B16.20")]},
    related=["camprofile-kammprofile-gaskets", "heat-exchanger-metal-jacketed-gaskets", "ring-type-joint-gaskets"], match_terms=["%spiral%", "%spiral-wound%"],
    review=["Inner ring material: the catalogue only says 'stainless or alloy to suit service' and that the inner ring is marked when it is not SS304; SS 304 is offered as the default on that basis — please confirm.",
            "Styles SW and SW-IR are offered 'made to the joint dimensions' (the catalogue gives no table for tongue-and-groove / male-female joints).",
            "'Inconel 600/625' and 'Incoloy 800/825' are offered as four separate winding metals.",
            "The catalogue does not state tolerances for the ASME B16.47 tables; the B16.5 tolerances are shown only on the B16.5 table."])

# ═══════════════════════ 2. Non-metallic: flat ring & full face (B16.21) + sheet / custom cut (pages 7, 9, 10) ═══════════════════════
t_fr = tables_in(section("Flat Ring & Full Face · ASME B16.21 for ASME B16.5 Flanges")); assert len(t_fr) == 2
t_fr47 = tables_in(section("Flat Ring · ASME B16.21 for ASME B16.47 Flanges")); assert len(t_fr47) == 2
d_ring, d_ff = svg_asset(9, "flat-ring-gasket"), svg_asset(10, "full-face-gasket")
nm_vars, nm_tables = [], []
# head row of these tables starts with 'all' (the ID column); pass the class headers explicitly
def _ring(t, key, page, title):
    classes = t["head"][1][1:]; assert t["head"][1][0] == "all", t["head"]
    t2 = {"head": [t["head"][0], ["all"] + classes], "rows": t["rows"]}
    rows = []
    for r in t2["rows"]:
        size = nps(r[0]); idv = num(r[2])
        for i, c in enumerate(classes):
            od = num(r[3 + i])
            if od is None: continue
            rows.append({"match": {"size": size, "class": c}, "values": {"id": idv, "od": od}})
            nm_vars.append({"options": {"face": "ring", "standard": STD[key][0], "size": size, "class": c}, "sku": sku("NM", "RING", key, c, size), "label_en": f"Ring gasket · {STD[key][0]} · NPS {size} · Class {c}", "size": f'{size}"', "pressure_class": f"Class {c}", "source_page": page})
    nm_tables.append({"title_en": f"Ring gaskets for {title} raised-face flanges — ASME B16.21", "title_ar": f"جوانات حلقية لفلنجات {STD[key][2]} ذات الوجه البارز — ASME B16.21",
                      "columns": [{"key": "id", "symbol": "ID", "label_en": "Gasket ID (all classes)", "label_ar": "القطر الداخلي", "unit": "mm"}, {"key": "od", "symbol": "OD", "label_en": "Gasket OD", "label_ar": "القطر الخارجي", "unit": "mm"}],
                      "applies": {"face": "ring", "standard": STD[key][0]}, "rows": rows, "source_page": page, "drawing_path": d_ring,
                      "notes": ["Dimensions in mm. Ring gaskets sit inside the bolt circle on raised-face flanges. Other classes, thicknesses and drilling to order."] + (["NPS 22 (DN 550) is not listed in ASME B16.47; dimensions on request."] if key != "B16.5" else [])})
_ring(t_fr[0], "B16.5", 9, "ASME B16.5"); _ring(t_fr47[0], "B16.47A", 10, "ASME B16.47 Series A"); _ring(t_fr47[1], "B16.47B", 10, "ASME B16.47 Series B")
ff_rows = []
assert t_fr[1]["head"][1] == ["ID", "OD", "Bolt circle", "Hole Ø", "No. holes"], t_fr[1]["head"]
for r in t_fr[1]["rows"]:
    size = nps(r[0])
    ff_rows.append({"match": {"size": size, "class": "150"}, "values": {"id": num(r[2]), "od": num(r[3]), "bc": num(r[4]), "hole": num(r[5]), "holes": num(r[6])}})
    nm_vars.append({"options": {"face": "full-face", "standard": "ASME B16.5", "size": size, "class": "150"}, "sku": sku("NM", "FF", "B16.5", "150", size), "label_en": f"Full-face gasket · ASME B16.5 · NPS {size} · Class 150", "size": f'{size}"', "pressure_class": "Class 150", "source_page": 9})
nm_tables.append({"title_en": "Full-face gaskets for ASME B16.5 Class 150 flat-face flanges — ASME B16.21", "title_ar": "جوانات بوجه كامل لفلنجات ASME B16.5 فئة 150 ذات الوجه المسطح — ASME B16.21",
                  "columns": [{"key": "id", "symbol": "ID", "label_en": "Gasket ID", "label_ar": "القطر الداخلي", "unit": "mm"}, {"key": "od", "symbol": "OD", "label_en": "Gasket OD", "label_ar": "القطر الخارجي", "unit": "mm"},
                              {"key": "bc", "symbol": "BC", "label_en": "Bolt circle", "label_ar": "دائرة المسامير", "unit": "mm"}, {"key": "hole", "symbol": "Ø", "label_en": "Hole diameter", "label_ar": "قطر الثقب", "unit": "mm"},
                              {"key": "holes", "symbol": "n", "label_en": "Number of holes", "label_ar": "عدد الثقوب"}],
                  "applies": {"face": "full-face", "standard": "ASME B16.5"}, "rows": ff_rows, "source_page": 9, "drawing_path": d_ff,
                  "notes": ["Dimensions in mm. Full-face gaskets cover the whole flange face and carry the bolt holes, typically on cast iron, ductile, GRP and other flat-face flanges. Other classes, thicknesses and drilling to order."]})
nm_vars += [{"options": {"face": "full-face", "standard": NA, "size": NA, "class": NA}, "sku": sku("NM", "FF", "DRAWING"), "label_en": "Full-face gasket · cut to the customer's flange drawing (other classes, large-diameter flat-face flanges)", "source_page": 10},
            {"options": {"face": "custom", "standard": NA, "size": NA, "class": NA}, "sku": sku("NM", "CUSTOM"), "label_en": "Custom shape · cut to drawing or sample", "source_page": 7},
            {"options": {"face": "sheet", "standard": NA, "size": NA, "class": NA}, "sku": sku("NM", "SHEET"), "label_en": "Gasket sheet (uncut, on request)", "source_page": 7}]
ELAST = [("EPDM", "EPDM"), ("NBR", "NBR (nitrile)"), ("CR", "Neoprene (CR)"), ("FKM", "Viton (FKM)"), ("NR", "Natural rubber"), ("VMQ", "Silicone")]
product(
    slug="non-metallic-gaskets", family_slug="non-metallic-gasket", name_en="Non-Metallic Gaskets – Flat Ring & Full Face (ASME B16.21), Sheet & Custom Cut",
    name_ar="جوانات غير معدنية – حلقية وبوجه كامل (ASME B16.21) وألواح وقطع حسب الطلب", family_name_en="Non-Metallic Gaskets", family_name_ar="الجوانات غير المعدنية",
    product_type="non-metallic-gasket", unit="pcs", pages=[7, 9, 10],
    short_desc_en="Soft cut gaskets from CNAF, inorganic fibre, PTFE, ePTFE, flexible graphite, elastomer, cellulose and cork-nitrile sheet: ring and full-face gaskets to ASME B16.21 for ASME B16.5 and B16.47 Series A/B flanges, custom shapes and sheet.",
    short_desc_ar="جوانات مقصوصة من ألواح CNAF والألياف المعدنية وPTFE وePTFE والجرافيت المرن والمطاط والسليلوز والفلين-نتريل: جوانات حلقية وبوجه كامل وفق ASME B16.21 لفلنجات ASME B16.5 وB16.47 السلسلتين A وB، وأشكال خاصة وألواح.",
    description_en=("Soft cut gaskets are produced from sheet by CNC cutting or press tools in ring (inside bolts) or full-face patterns, in thicknesses from 0.8 mm to 6 mm. The sheet grade is matched to the media, temperature and pressure of the line.\n\n"
                    "Ring gaskets sit inside the bolt circle on raised-face flanges; full-face gaskets cover the whole flange face and carry the bolt holes, typically on cast iron, ductile, GRP and other flat-face flanges. Full-face gaskets for large-diameter flat-face flanges are cut to the customer's flange drawing.\n\n"
                    "Sheet materials: compressed non-asbestos fibre (CNAF) — aramid / synthetic fibres bound with nitrile or SBR, general purpose for water, steam, oils, fuels, gases and mild acids and alkalis (typical: up to ~100 bar, ~400 °C peak depending on grade); "
                    "inorganic fibre sheet — mineral-fibre reinforced, better thermal stability and torque retention than aramid sheet; filled & restructured PTFE — silica, barium-sulfate or glass-microsphere fillers, almost the full chemical range, FDA-compliant grades for food and pharma; "
                    "expanded PTFE (ePTFE) — very conformable, chemically inert, minimal creep, ideal for damaged or large fabricated flanges; flexible graphite — plain, tanged-stainless or flat-foil inserted, high temperature, no cold flow, nuclear and high-purity grades; "
                    "elastomers — EPDM, NBR, Neoprene (CR), Viton (FKM), natural rubber and silicone, plain or cloth-inserted, for water, low-pressure air and utility services; cellulose / fibre jointing — up to ~120 °C, for water, oils and fuels; cork-nitrile — oil and fuel resistant, low flange loads (≈5 bar).\n\n"
                    "Branded sheet materials from leading manufacturers (e.g. Garlock BLUE-GARD®, GYLON®, IFG®) can be supplied on request. Trademarks belong to their respective owners.\n\n"
                    "To order, state: material grade · thickness · ID / OD or full-face drilling · drawing or sample for non-standard shapes · quantity."),
    description_ar=("تُصنع الجوانات المقصوصة من الألواح بالقطع CNC أو بالقوالب على شكل حلقة (داخل المسامير) أو بوجه كامل، بسماكات من 0.8 مم إلى 6 مم، ويُختار نوع اللوح حسب المائع والحرارة والضغط.\n\n"
                    "الجوانات الحلقية لفلنجات الوجه البارز، والجوانات ذات الوجه الكامل تغطي وجه الفلنجة مع ثقوب المسامير (عادةً للفلنجات المسطحة من الحديد الزهر والمرن وGRP). الجوانات بوجه كامل للأقطار الكبيرة تُقص حسب رسم الفلنجة. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Raised-face flanges (ring gaskets)\nFlat-face cast iron, ductile and GRP flanges (full-face gaskets)\nPumps, covers, gearboxes and utility services (custom cut)",
    options=[opt("face", "Gasket form", "شكل الجوان", [("ring", "Ring gasket · raised-face flanges", "جوان حلقي · فلنجات بوجه بارز"), ("full-face", "Full-face gasket · flat-face flanges", "جوان بوجه كامل · فلنجات مسطحة"),
                                                     ("custom", "Custom shape · to drawing or sample", "شكل خاص · حسب الرسم أو العينة"), ("sheet", "Gasket sheet (uncut)", "لوح جوانات (غير مقصوص)")]),
             opt("standard", "Flange standard / series", "مواصفة / سلسلة الفلنجة", [STD["B16.5"], STD["B16.47A"], STD["B16.47B"], (NA, "Cut to drawing / sample", "حسب الرسم / العينة")]),
             opt("size", "Size (NPS)", "المقاس (NPS)", size_values([v["options"]["size"] for v in nm_vars if v["options"]["size"] != NA], ("To drawing", "حسب الرسم"))),
             opt("class", "Pressure class", "فئة الضغط", class_values([v["options"]["class"] for v in nm_vars if v["options"]["class"] != NA], ("—", "—")))],
    variants=nm_vars, dimension_tables=nm_tables,
    images=[img(d_ring, "Ring gasket inside the bolt circle (drawing)", "جوان حلقي داخل دائرة المسامير", {"face": "ring"}), img(d_ff, "Full-face gasket with bolt holes (drawing)", "جوان بوجه كامل مع ثقوب المسامير", {"face": "full-face"})],
    choices=[choice("sheet", "Sheet material", "مادة اللوح", [
                cv("CNAF", "Compressed non-asbestos fibre (CNAF)", "ألياف مضغوطة خالية من الأسبستوس (CNAF)", "CNAF", hint_en="Typical: up to ~100 bar, ~400 °C peak depending on grade"),
                cv("Inorganic fibre", "Inorganic fibre sheet", "لوح ألياف معدنية", "MINFIBRE"),
                cv("Filled PTFE", "Filled & restructured PTFE", "PTFE معبأ ومعاد الهيكلة", "PTFE"), cv("ePTFE", "Expanded PTFE (ePTFE)", "PTFE ممدد (ePTFE)", "PTFE"),
                cv("Graphite plain", "Flexible graphite — plain", "جرافيت مرن — عادي", "GRAPHITE"), cv("Graphite tanged SS", "Flexible graphite — tanged stainless insert", "جرافيت مرن — بإدخال ستانلس مسنّن", "GRAPHITE"),
                cv("Graphite foil insert", "Flexible graphite — flat-foil insert", "جرافيت مرن — بإدخال رقاقة مسطحة", "GRAPHITE")]
                + [cv(f"Elastomer {k}", f"Elastomer — {n}", f"مطاط — {n}", "RUBBER") for k, n in ELAST]
                + [cv("Cellulose", "Cellulose / fibre jointing", "ألياف السليلوز", "CELLULOSE", hint_en="Up to ~120 °C"), cv("Cork-nitrile", "Cork-nitrile", "فلين - نتريل", "CORK", hint_en="Low flange loads (≈5 bar)")], required=True),
             choice("thickness", "Thickness", "السماكة", type_="number", min=0.8, max=6, step=0.1, unit="mm", required=True, hint_en="0.8 mm to 6 mm", hint_ar="من 0.8 إلى 6 مم"),
             choice("insert", "Elastomer insert", "التقوية", [cv("Plain", "Plain", "عادي"), cv("Cloth-inserted", "Cloth-inserted", "مقوى بالنسيج")], requires_choice={"sheet": [f"Elastomer {k}" for k, _ in ELAST]}),
             choice("drawing", "Dimensions / drawing details", "الأبعاد / تفاصيل الرسم", type_="text", maxlength=200, requires={"standard": [NA]}, required=True, hint_en="ID / OD or full-face drilling; send the drawing or sample with the enquiry.")],
    materials=[mat("CNAF", [{"role": "sheet", "grades": ["Compressed non-asbestos fibre (aramid / synthetic fibres, nitrile or SBR binder)"]}]),
               mat("MINFIBRE", [{"role": "sheet", "grades": ["Inorganic fibre sheet"]}]), mat("PTFE", [{"role": "sheet", "grades": ["Filled & restructured PTFE", "Expanded PTFE (ePTFE)"]}]),
               mat("GRAPHITE", [{"role": "sheet", "grades": ["Flexible graphite (plain, tanged-stainless or flat-foil inserted)"]}]),
               mat("SS", [{"role": "insert", "grades": ["Tanged stainless steel insert (flexible graphite sheet)"]}]),
               mat("RUBBER", [{"role": "sheet", "grades": [n for _, n in ELAST]}]), mat("CELLULOSE", [{"role": "sheet", "grades": ["Cellulose / fibre jointing"]}]), mat("CORK", [{"role": "sheet", "grades": ["Cork-nitrile"]}])],
    standards=[("ASME B16.21", "Non-metallic flat gaskets (dimensions)"), ("ASME B16.5", "Flanges NPS ½–24"), ("ASME B16.47 Series A", "Flanges NPS 26–60"), ("ASME B16.47 Series B", "Flanges NPS 26–60")],
    properties=[("Thickness range", "0.8–6 mm")],
    attributes={"gasket_family": [("Non-metallic gaskets", "جوانات غير معدنية")], "gasket_standard": [("ASME B16.21", "ASME B16.21")]},
    related=["expanded-ptfe-joint-sealant", "flange-insulation-kits", "spiral-wound-gaskets"], match_terms=["%non-metallic%", "%non metallic%", "%sheet gasket%", "%full face%", "%cnaf%"],
    review=["The catalogue lists the non-metallic sheet materials (page 7) and the ASME B16.21 ring / full-face dimensions (pages 9–10) separately; they are one product family here (the cut gaskets are made from those sheets), so there is no duplicate card.",
            "Thickness is offered as a number from 0.8 to 6 mm (the catalogue gives the range only, no standard thickness steps).",
            "Flat-foil inserted graphite: the foil metal is not stated, so no metal is classified for it.",
            "In the ASME B16.47 Series A tables, NPS 38–60 Class 150 diameters are larger than Class 300 (as printed, here and in the spiral wound and double jacketed tables; this follows the Series A flange pattern). Loaded unchanged.",
            "Garlock BLUE-GARD, GYLON and IFG are mentioned as 'can be supplied on request' — no brand was created for them."])

# ═══════════════════════ 3. Flange insulation kits (page 8) ═══════════════════════
d_kit = svg_asset(8, "flange-insulation-kit")
product(
    slug="flange-insulation-kits", family_slug="flange-insulation-kit", name_en="Flange Insulation Kits – Type E, F & D", name_ar="أطقم عزل الفلنجات – الأنواع E وF وD",
    family_name_en="Flange Insulation Kits", family_name_ar="أطقم عزل الفلنجات", product_type="flange-insulation-kit", unit="set", pages=[8],
    short_desc_en="Insulation kits that electrically isolate flanged joints for cathodic protection and to stop galvanic corrosion: Type E full face, Type F ring and Type D ring-joint, for RF, FF and RTJ flanges in all standard classes.",
    short_desc_ar="أطقم عزل كهربائي للوصلات الفلنجية للحماية الكاثودية ومنع التآكل الجلفاني: النوع E بوجه كامل، والنوع F حلقي، والنوع D لفلنجات الحلقة المعدنية، لفلنجات RF وFF وRTJ بجميع الفئات القياسية.",
    description_en=("Insulation kits electrically isolate one side of a flanged joint from the other, for cathodic protection and to stop galvanic corrosion between dissimilar metals. Each kit comprises an insulating gasket and, for every bolt, one full-length insulating sleeve, two insulating washers and two steel backing washers.\n\n"
                    "Type E — full-face gasket with bolt holes; best alignment and protection against conductive debris. Type F — ring gasket fitting inside the bolt circle. Type D — oval or octagonal insulating ring for ring-type-joint flanges.\n\n"
                    "Gasket materials: phenolic, neoprene-faced phenolic, G-10 / G-11 glass-reinforced epoxy, with or without sealing element. Sleeves & washers: GRE, phenolic, polyethylene; zinc-plated steel washers. "
                    "Available for raised-face, flat-face and RTJ flanges in all standard classes; special configurations made to order.\n\n"
                    "To order, state: flange size and pressure class · flange standard (ASME B16.5 / B16.47 A or B / API) · face type (RF, FF or RTJ with ring number) · kit type (E, F or D) · gasket material and thickness · bolt diameter and length · service media and temperature."),
    description_ar=("تعزل أطقم العزل جانبي الوصلة الفلنجية كهربائياً للحماية الكاثودية ومنع التآكل الجلفاني بين المعادن المختلفة. يتكون كل طقم من جوان عازل، ولكل مسمار جلبة عازلة بكامل الطول ووردتين عازلتين ووردتين فولاذيتين.\n\n"
                    "النوع E بوجه كامل مع ثقوب المسامير، والنوع F حلقي داخل دائرة المسامير، والنوع D حلقة عازلة بيضاوية أو مثمنة لفلنجات الحلقة المعدنية. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Cathodic protection\nIsolation of dissimilar metals (galvanic corrosion)\nRaised-face, flat-face and RTJ flanges",
    options=[opt("kit", "Kit type", "نوع الطقم", [("E", "Type E · full-face gasket with bolt holes", "النوع E · جوان بوجه كامل مع ثقوب"), ("F", "Type F · ring gasket inside the bolt circle", "النوع F · جوان حلقي داخل دائرة المسامير"),
                                                ("D", "Type D · ring for ring-type-joint flanges", "النوع D · حلقة لفلنجات الحلقة المعدنية")])],
    variants=[{"options": {"kit": k}, "sku": sku("IK", k), "label_en": f"Insulation kit Type {k}", "source_page": 8} for k in ("E", "F", "D")],
    images=[img(d_kit, "Flange insulation kit: insulating gasket, sleeve, insulating and steel washers, nut", "طقم عزل الفلنجة: جوان عازل، جلبة، وردات عازلة وفولاذية، صامولة")],
    choices=[choice("ring_shape", "Ring shape", "شكل الحلقة", [cv("Oval", "Oval", "بيضاوي"), cv("Octagonal", "Octagonal", "مثمن")], requires={"kit": ["D"]}, required=True),
             choice("gasket", "Gasket material", "مادة الجوان", [cv("Phenolic", "Phenolic", "فينوليك", "PHENOLIC"), cv("Neoprene-faced phenolic", "Neoprene-faced phenolic", "فينوليك مكسو بالنيوبرين", "PHENOLIC"),
                    cv("G-10 GRE", "G-10 glass-reinforced epoxy", "إيبوكسي مقوى بالزجاج G-10", "GRE"), cv("G-11 GRE", "G-11 glass-reinforced epoxy", "إيبوكسي مقوى بالزجاج G-11", "GRE")], required=True),
             choice("seal", "Sealing element", "عنصر الإحكام", [cv("With sealing element", "With sealing element", "مع عنصر إحكام"), cv("Without sealing element", "Without sealing element", "بدون عنصر إحكام")], required=True),
             choice("sleeve", "Sleeve & washer material", "مادة الجلب والوردات", [cv("GRE", "GRE", "GRE", "GRE"), cv("Phenolic", "Phenolic", "فينوليك", "PHENOLIC"), cv("Polyethylene", "Polyethylene", "بولي إيثيلين", "PE")], required=True),
             choice("flange_std", "Flange standard", "مواصفة الفلنجة", [cv("ASME B16.5", "ASME B16.5"), cv("ASME B16.47 Series A", "ASME B16.47 Series A"), cv("ASME B16.47 Series B", "ASME B16.47 Series B"), cv("API", "API")], required=True),
             choice("flange", "Flange size and pressure class", "مقاس الفلنجة وفئة الضغط", type_="text", maxlength=60, required=True, hint_en='e.g. 6" Class 300 RF'),
             choice("ring_no", "Ring number (RTJ)", "رقم الحلقة (RTJ)", type_="text", maxlength=20, requires={"kit": ["D"]}, required=True),
             choice("thickness", "Gasket thickness", "سماكة الجوان", type_="text", maxlength=20),
             choice("bolts", "Bolt diameter and length", "قطر المسامير وطولها", type_="text", maxlength=60, required=True),
             choice("service", "Service media and temperature", "المائع ودرجة الحرارة", type_="text", maxlength=120)],
    materials=[mat("PHENOLIC", [{"role": "gasket", "grades": ["Phenolic", "Neoprene-faced phenolic"]}, {"role": "sleeves & washers", "grades": ["Phenolic"]}]),
               mat("GRE", [{"role": "gasket", "grades": ["G-10", "G-11"]}, {"role": "sleeves & washers", "grades": ["GRE"]}]),
               mat("RUBBER", [{"role": "gasket facing", "grades": ["Neoprene"]}]), mat("PE", [{"role": "sleeves & washers", "grades": ["Polyethylene"]}])],
    standards=[("ASME B16.5", "Flanges"), ("ASME B16.47 Series A", "Flanges"), ("ASME B16.47 Series B", "Flanges")],
    properties=[("Kit contents", "Insulating gasket; per bolt: 1 full-length insulating sleeve, 2 insulating washers, 2 steel backing washers"), ("Steel washers", "Zinc-plated steel")],
    attributes={"gasket_family": [("Flange insulation kits", "أطقم عزل الفلنجات")], "standard": [("ASME B16.5", "ASME B16.5"), ("ASME B16.47 Series A", "ASME B16.47 Series A"), ("ASME B16.47 Series B", "ASME B16.47 Series B")]},
    related=["ring-type-joint-gaskets", "non-metallic-gaskets"], match_terms=["%insulat%kit%", "%isolation kit%", "%insulating gasket%"],
    review=["Steel backing washers are 'zinc-plated steel'; the steel grade is not stated, so no steel material was classified for them.",
            "Flange standard 'API' is listed in the ordering information without the series (6A/6B/6BX) — the customer states it.",
            "No dimensions or thicknesses are given for insulation kits; size, class, bolting and thickness are taken from the customer's enquiry."])

# ═══════════════════════ 4. Expanded PTFE joint sealant (page 8) ═══════════════════════
product(
    slug="expanded-ptfe-joint-sealant", family_slug="expanded-ptfe-joint-sealant-family", name_en="Expanded PTFE Joint Sealant (Form-in-Place)", name_ar="شريط مانع تسرب من PTFE الممدد (يُشكّل في الموقع)",
    family_name_en="Expanded PTFE Joint Sealant", family_name_ar="مانع التسرب من PTFE الممدد", product_type="joint-sealant", unit="reel", pages=[8],
    short_desc_en="A soft cord of 100 % expanded PTFE with an adhesive strip, laid on the flange face to form a thin gasket in place — for large, irregular, out-of-flat or damaged flanges, manways, ducting and covers. Supplied on reels in a range of widths.",
    short_desc_ar="حبل لين من PTFE الممدد 100% مع شريط لاصق، يوضع على وجه الفلنجة ليشكّل جواناً رقيقاً في الموقع — للفلنجات الكبيرة أو غير المنتظمة أو المتضررة وفتحات الدخول والمجاري والأغطية. يُورّد على بكرات بعروض مختلفة.",
    description_en=("A soft cord of 100 % expanded PTFE with an adhesive strip on one face. It is laid directly on the flange face, the ends are overlapped, and when the bolts are tightened it flattens into a thin, strong gasket. "
                    "Used where cut gaskets are impractical: very large, irregular, out-of-flat or damaged flanges, manways, ducting and covers.\n\n"
                    "• Chemically inert across the pH range\n• Resists creep and cold flow; rarely needs re-torquing\n• One reel covers many sizes — no cut-out waste\n• Supplied in a range of widths on reels\n• Industrial use only — not for food, drug or medical-device processing"),
    description_ar=("حبل لين من PTFE الممدد بنسبة 100% مع شريط لاصق على أحد وجهيه، يوضع مباشرة على وجه الفلنجة مع تداخل الطرفين، وعند شد المسامير يتسطح ليشكّل جواناً رقيقاً متيناً.\n\n"
                    "• خامل كيميائياً عبر كامل مدى pH\n• يقاوم الزحف والتدفق البارد\n• بكرة واحدة لمقاسات كثيرة دون هدر\n• للاستخدام الصناعي فقط — ليس لمعالجة الأغذية أو الأدوية أو الأجهزة الطبية. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Very large, irregular, out-of-flat or damaged flanges\nManways, ducting and covers",
    choices=[choice("width", "Width", "العرض", type_="text", maxlength=30, required=True, hint_en="Supplied in a range of widths on reels — state the width you need.", hint_ar="يُورّد بعروض مختلفة — اذكر العرض المطلوب."),
             choice("application", "Flange / application", "الفلنجة / الاستخدام", type_="text", maxlength=120)],
    materials=[mat("PTFE", [{"role": "sealant cord", "grades": ["100 % expanded PTFE"]}])],
    properties=[("Material", "100 % expanded PTFE with adhesive strip"), ("Supply", "Reels, range of widths"), ("Use", "Industrial use only — not for food, drug or medical-device processing")],
    attributes={"gasket_family": [("Joint sealants", "موانع تسرب الوصلات")]},
    related=["non-metallic-gaskets", "heat-exchanger-metal-jacketed-gaskets"], match_terms=["%eptfe%", "%expanded ptfe%", "%joint sealant%", "%ptfe tape%"],
    review=["No image in the catalogue for this product: the shop shows a placeholder until you upload a photo.", "Available widths and reel lengths are not listed; the customer states the width."])

# ═══════════════════════ 5. Heat exchanger & metal jacketed (pages 11-13) ═══════════════════════
t_dj = tables_in(section("Double Jacketed · ASME B16.20 for ASME B16.5 Flanges")); assert len(t_dj) == 1
t_dj47 = tables_in(section("Double Jacketed · ASME B16.47 Series A & B")); assert len(t_dj47) == 3
tol = t_dj47[2]["rows"]; assert tol[0][0] == "Outside diameter", tol
HX_TYPES = [("double-jacketed", "Double jacketed", "مغلف مزدوج", 11, "The standard heat-exchanger gasket. A soft filler (usually graphite) is fully enclosed by an overlapped metal jacket, giving even support at the inner and outer edges and protecting the filler from the media."),
            ("corrugated-double-jacketed", "Corrugated double jacketed", "مغلف مزدوج مموج", 12, "Corrugations add resilience and create several concentric sealing lines, so a small leak across the inner edge is held back by the next ring."),
            ("corrugated-metal-filler", "Corrugated metal filler", "حشو معدني مموج", 13, "Metal instead of soft filler for better resistance to temperature swings; the limit is set by the metal chosen."),
            ("single-jacketed", "Single jacketed", "مغلف مفرد", 14, "An economical gasket for narrow faces: the jacket covers one edge and both faces of the filler. Corrugated fillers available."),
            ("double-shell", "Double shell", "غلاف مزدوج", 15, "A second, fully overlapping inner shell adds strength and rigidity. Minimum flange width about 6 mm (¼\")."),
            ("fully-enclosed-single-jacket", "Fully enclosed single jacket", "غلاف مفرد مغلق بالكامل", 16, "The filler is completely enclosed for extra protection; suits very narrow faces down to about 3 mm (⅛\")."),
            ("french-type", "French type (two-piece)", "النوع الفرنسي (قطعتان)", 17, "Easier and quicker to make than one-piece French gaskets; filler is exposed at the OD. Minimum flange width about 6 mm (¼\")."),
            ("metal-shielded-soft", "Metal-shielded soft gasket", "جوان لين بدرع معدني", 18, "A thin metal eyelet rolled over the ID shields a thick compressible soft layer on each side of the metal."),
            ("flat-solid-metal", "Flat solid metal", "معدن مصمت مسطح", 19, "High strength, good heat conductivity and resistance to temperature, corrosion and pressure. Needs smooth faces and high bolt load."),
            ("corrugated-serrated-metal", "Corrugated / serrated metal", "معدن مموج / مسنن", 20, "Economical, lightweight and more resilient than a flat ring, for low-pressure joints with smooth faces and limited bolt load."),
            ("graphite-faced-metal-core", "Graphite-faced metal core", "قلب معدني مكسو بالجرافيت", 21, "A solid metal core with high-purity graphite foil bonded to both faces at controlled density and thickness. Seals at relatively low load with a rigid, easy-to-handle body.")]
hx_imgs = [img(svg_grid(range(22, 30), "heat-exchanger-pass-partition-shapes"), "Typical pass-partition shapes for heat exchanger gaskets (made to drawing)", "أشكال حواجز الممرات النموذجية لجوانات المبادلات الحرارية")]
for v, en, ar, n, _ in HX_TYPES: hx_imgs.append(img(svg_asset(n, f"heat-exchanger-{v}"), f"{en} gasket — cross-section", f"مقطع جوان {ar}", {"type": v}))
hx_imgs.insert(0, hx_imgs.pop(1))   # the double jacketed cross-section is the main picture (product card)
d_dj = hx_imgs[0]["storage_path"]
hx_vars, hx_tables = [], []
def dj_table(t, key, classes, page, title):
    assert t["head"][1] == ["all"] + classes, t["head"]
    rows = []
    for r in t["rows"]:
        size = nps(r[0]); idv = num(r[2])
        for i, c in enumerate(classes):
            od = num(r[3 + i])
            if od is None: continue
            rows.append({"match": {"size": size, "class": c}, "values": {"id": idv, "od": od}})
            hx_vars.append({"options": {"type": "double-jacketed", "standard": STD[key][0], "size": size, "class": c}, "sku": sku("DJ", key, c, size), "label_en": f"Double jacketed · {STD[key][0]} · NPS {size} · Class {c}", "size": f'{size}"', "pressure_class": f"Class {c}", "source_page": page})
    big = key != "B16.5"
    hx_hx = [f"Manufacturing tolerances — jacketed gaskets (ASME B16.20), NPS {'26 and larger' if big else '24 and smaller'}: outside diameter {tol[0][2 if big else 1]}, inside diameter {tol[1][2 if big else 1]}, thickness {tol[2][2 if big else 1]}."]
    hx_tables.append({"title_en": title, "title_ar": title.replace("Double jacketed gaskets", "الجوانات المغلفة المزدوجة").replace("flanges", "فلنجات"),
                      "columns": [{"key": "id", "symbol": "ID", "label_en": "Gasket ID (all classes)", "label_ar": "القطر الداخلي", "unit": "mm"}, {"key": "od", "symbol": "OD", "label_en": "Gasket OD", "label_ar": "القطر الخارجي", "unit": "mm"}],
                      "applies": {"type": "double-jacketed", "standard": STD[key][0]}, "rows": rows, "source_page": page, "drawing_path": d_dj,
                      "notes": (["Dimensions in mm. Nominal thickness 3.2 mm. Gaskets for heat-exchanger girth and channel flanges are made to drawing."] if key == "B16.5" else ["Dimensions in mm."]) + hx_hx})
dj_table(t_dj[0], "B16.5", ["150", "300", "400", "600", "900", "1500", "2500"], 12, "Double jacketed gaskets — ASME B16.20 for ASME B16.5 flanges")
dj_table(t_dj47[0], "B16.47A", ["150", "300", "400", "600", "900"], 13, "Double jacketed gaskets for ASME B16.47 Series A flanges")
dj_table(t_dj47[1], "B16.47B", ["150", "300", "400", "600", "900"], 13, "Double jacketed gaskets for ASME B16.47 Series B flanges")
for v, en, ar, n, _ in HX_TYPES:
    hx_vars.append({"options": {"type": v, "standard": NA, "size": NA, "class": NA}, "sku": sku("HX", v, "DRAWING"), "label_en": f"{en} · made to drawing", "source_page": 11})
product(
    slug="heat-exchanger-metal-jacketed-gaskets", family_slug="heat-exchanger-gasket", name_en="Heat Exchanger & Metal Jacketed Gaskets", name_ar="جوانات المبادلات الحرارية والجوانات المغلفة بالمعدن",
    family_name_en="Heat Exchanger & Metal Jacketed Gaskets", family_name_ar="جوانات المبادلات الحرارية والمغلفة بالمعدن", product_type="heat-exchanger-gasket", unit="pcs", pages=[11, 12, 13],
    short_desc_en="Metal jacketed and solid metal gaskets for heat exchangers and pressure vessels, made to drawing in practically any diameter, with pass-partition bars; double jacketed gaskets also to ASME B16.20 dimensions for ASME B16.5 and B16.47 Series A/B flanges.",
    short_desc_ar="جوانات مغلفة بالمعدن ومعدنية مصمتة للمبادلات الحرارية وأوعية الضغط، تُصنع حسب الرسم بأي قطر تقريباً مع حواجز الممرات؛ والجوانات المغلفة المزدوجة متوفرة أيضاً بأبعاد ASME B16.20 لفلنجات ASME B16.5 وB16.47 السلسلتين A وB.",
    description_en=("Heat exchanger and pressure-vessel joints often have narrow flange faces, pass-partition ribs and non-circular shapes. Jacketed and solid metal gaskets are made to the customer's drawing in practically any diameter and in a wide choice of metals and fillers.\n\n"
                    + "\n".join(f"{en}: {txt}" for _, en, _, _, txt in HX_TYPES) +
                    "\n\nPass-partition gaskets are supplied to the customer's drawing. Please state OD, ID, thickness (T), bar width (C), bar positions measured from centre, and corner radii."),
    description_ar=("غالباً ما تكون لوصلات المبادلات الحرارية وأوعية الضغط أوجه فلنجات ضيقة وحواجز ممرات وأشكال غير دائرية. تُصنع الجوانات المغلفة والمعدنية المصمتة حسب رسم العميل بأي قطر تقريباً وبخيارات واسعة من المعادن ومواد الحشو.\n\n"
                    "لجوانات حواجز الممرات يرجى ذكر: القطر الخارجي والداخلي والسماكة (T) وعرض الحاجز (C) ومواضع الحواجز من المركز وأنصاف أقطار الزوايا. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Heat exchanger girth and channel flanges\nPressure-vessel joints with narrow faces and pass-partition ribs\nPipe flanges (double jacketed, ASME B16.20 dimensions)",
    options=[opt("type", "Gasket type", "نوع الجوان", [(v, en, ar) for v, en, ar, _, _ in HX_TYPES]),
             opt("standard", "Flange standard / series", "مواصفة / سلسلة الفلنجة", [STD["B16.5"], STD["B16.47A"], STD["B16.47B"], (NA, "Made to drawing", "حسب الرسم")]),
             opt("size", "Size (NPS)", "المقاس (NPS)", size_values([v["options"]["size"] for v in hx_vars if v["options"]["size"] != NA], ("To drawing", "حسب الرسم"))),
             opt("class", "Pressure class", "فئة الضغط", class_values([v["options"]["class"] for v in hx_vars if v["options"]["class"] != NA], ("—", "—")))],
    variants=hx_vars, dimension_tables=hx_tables, images=hx_imgs,
    choices=[choice("metal", "Jacket / core metal", "معدن الغلاف / القلب", type_="text", maxlength=60, required=True, hint_en="State the metal and grade (a wide choice of metals is available)."),
             choice("filler", "Filler", "مادة الحشو", type_="text", maxlength=60, requires={"type": ["double-jacketed", "corrugated-double-jacketed", "single-jacketed", "double-shell", "fully-enclosed-single-jacket", "french-type"]}, hint_en="Usually graphite — state the filler you need."),
             choice("drawing", "Drawing details", "تفاصيل الرسم", type_="text", maxlength=200, requires={"standard": [NA]}, required=True, hint_en="OD, ID, thickness (T), bar width (C), bar positions from centre, corner radii — send the drawing with the enquiry.")],
    materials=[],
    standards=[("ASME B16.20", "Double jacketed gasket dimensions and tolerances"), ("ASME B16.5", "Flanges NPS ½–24"), ("ASME B16.47 Series A", "Flanges NPS 26–60"), ("ASME B16.47 Series B", "Flanges NPS 26–60")],
    properties=[("Double jacketed nominal thickness", "3.2 mm (ASME B16.5 table)")],
    attributes={"gasket_family": [("Heat exchanger & metal jacketed gaskets", "جوانات المبادلات الحرارية والمغلفة بالمعدن")], "gasket_standard": [("ASME B16.20", "ASME B16.20")]},
    related=["spiral-wound-gaskets", "camprofile-kammprofile-gaskets", "expanded-ptfe-joint-sealant"], match_terms=["%jacketed%", "%heat exchanger%", "%double jacket%", "%solid metal gasket%"],
    review=["No metals or fillers are listed for jacketed / solid metal gaskets ('a wide choice of metals and fillers'; filler 'usually graphite'), so no material is shown — the product appears as 'Material Not Verified' until you add materials.",
            "The ASME B16.47 Series A & B double jacketed tables do not name the gasket standard in their title (the tolerance table cites ASME B16.20).",
            "Nominal thickness 3.2 mm is printed under the ASME B16.5 table only."])

# ═══════════════════════ 6. Camprofile (pages 14-15) ═══════════════════════
cp1 = section("Camprofile (Kammprofile) Gaskets"); t_cp = tables_in(cp1); assert len(t_cp) == 1
t_cp47 = tables_in(section("Large-Diameter Camprofile · MSS SP-44 / B16.47 Series A Flanges")); assert len(t_cp47) == 1
d_cp = svg_asset(30, "camprofile-serrated-core")
cp_imgs = [img(d_cp, "Camprofile gasket: serrated metal core with soft facing", "جوان كامبروفايل: قلب معدني مسنن مع طبقة لينة"),
           img(svg_asset(32, "camprofile-integral-centering-ring"), "Camprofile with integral centering ring", "كامبروفايل مع حلقة توسيط مدمجة", {"style": "integral-cr"}),
           img(svg_asset(33, "camprofile-loose-centering-ring"), "Camprofile with loose centering ring", "كامبروفايل مع حلقة توسيط منفصلة", {"style": "loose-cr"}),
           img(svg_asset(31, "camprofile-without-centering-ring"), "Camprofile without centering ring", "كامبروفايل بدون حلقة توسيط", {"style": "no-cr"})]
cp_vars, cp_tables = [], []
assert t_cp[0]["head"][1] == ["W", "d1", "d2", "150", "300", "400", "600", "900", "1500", "2500"], t_cp[0]["head"]
rows = []
for r in t_cp[0]["rows"]:
    size = nps(r[0]); w, d1, d2 = num(r[2]), num(r[3]), num(r[4])
    for i, c in enumerate(["150", "300", "400", "600", "900", "1500", "2500"]):
        d3 = num(r[5 + i])
        if d3 is None: continue
        for st in ("integral-cr", "loose-cr"):
            rows.append({"match": {"style": st, "size": size, "class": c}, "values": {"w": w, "d1": d1, "d2": d2, "d3": d3}})
            cp_vars.append({"options": {"style": st, "standard": "ASME B16.5", "size": size, "class": c}, "sku": sku("CP", st, "B16.5", c, size), "label_en": f"Camprofile ({'integral' if st == 'integral-cr' else 'loose'} centering ring) · ASME B16.5 · NPS {size} · Class {c}", "size": f'{size}"', "pressure_class": f"Class {c}", "source_page": 14})
cp_cols = lambda w: ([{"key": "w", "symbol": "W", "label_en": "Contact width", "label_ar": "عرض التلامس", "unit": "mm"}] if w else []) + [
    {"key": "d1", "symbol": "d1", "label_en": "Sealing element ID", "label_ar": "القطر الداخلي لعنصر الإحكام", "unit": "mm"}, {"key": "d2", "symbol": "d2", "label_en": "Sealing element OD", "label_ar": "القطر الخارجي لعنصر الإحكام", "unit": "mm"},
    {"key": "d3", "symbol": "d3", "label_en": "Centering ring OD", "label_ar": "القطر الخارجي لحلقة التوسيط", "unit": "mm"}]
CP_TOL = "Tolerances OD up to 600 mm: d1 / d2 ±0.8, d3 −0.8/+0 · 600–1200 mm: d1 / d2 ±1.2, d3 −0.8/+0 · above 1200 mm: d1 / d2 ±1.6, d3 −1.2/+0. Contact width (W) may not exceed the value shown by more than 10 %."
cp_tables.append({"title_en": "Camprofile gaskets — ASME B16.20 for ASME B16.5 flanges", "title_ar": "جوانات كامبروفايل — ASME B16.20 لفلنجات ASME B16.5", "columns": cp_cols(True),
                  "applies": {"standard": "ASME B16.5"}, "rows": rows, "source_page": 14, "drawing_path": d_cp,
                  "notes": ["Dimensions in mm.", CP_TOL, "Core thickness 4 mm, facing 0.5 mm per side; centering ring 2 mm."]})
assert t_cp47[0]["head"][1] == ["d1", "d2", "150", "300", "400", "600", "900"], t_cp47[0]["head"]
rows = []
for r in t_cp47[0]["rows"]:
    size = nps(r[0]); d1, d2 = num(r[2]), num(r[3])
    for i, c in enumerate(["150", "300", "400", "600", "900"]):
        d3 = num(r[4 + i])
        if d3 is None: continue
        for st in ("integral-cr", "loose-cr"):
            rows.append({"match": {"style": st, "size": size, "class": c}, "values": {"d1": d1, "d2": d2, "d3": d3}})
            cp_vars.append({"options": {"style": st, "standard": "ASME B16.47 Series A", "size": size, "class": c}, "sku": sku("CP", st, "B16.47A", c, size), "label_en": f"Camprofile ({'integral' if st == 'integral-cr' else 'loose'} centering ring) · ASME B16.47 Series A · NPS {size} · Class {c}", "size": f'{size}"', "pressure_class": f"Class {c}", "source_page": 15})
cp_tables.append({"title_en": "Large-diameter camprofile gaskets for MSS SP-44 / ASME B16.47 Series A flanges", "title_ar": "جوانات كامبروفايل كبيرة القطر لفلنجات MSS SP-44 / ASME B16.47 السلسلة A", "columns": cp_cols(False),
                  "applies": {"standard": "ASME B16.47 Series A"}, "rows": rows, "source_page": 15, "drawing_path": d_cp,
                  "notes": ["Dimensions in mm. Classes 150–900. Sizes above NPS 48 in Class 900 and other flange standards on request."]})
cp_vars.append({"options": {"style": "no-cr", "standard": NA, "size": NA, "class": NA}, "sku": sku("CP", "NOCR", "JOINT"), "label_en": "Camprofile without centering ring · made to the joint / drawing (tongue & groove, recessed faces, heat exchangers)", "source_page": 14})
cp_vars.append({"options": {"style": "pass-partition", "standard": NA, "size": NA, "class": NA}, "sku": sku("CP", "PASS", "DRAWING"), "label_en": "Camprofile pass-partition (heat exchanger) version · made to drawing", "source_page": 14})
product(
    slug="camprofile-kammprofile-gaskets", family_slug="camprofile-gasket", name_en="Camprofile (Kammprofile) Gaskets – ASME B16.20", name_ar="جوانات كامبروفايل (Kammprofile) – ASME B16.20",
    family_name_en="Camprofile (Kammprofile) Gaskets", family_name_ar="جوانات كامبروفايل", product_type="camprofile-gasket", unit="pcs", pages=[14, 15],
    short_desc_en="Serrated solid metal core with a thin soft facing: seals at low bolt load and withstands high temperature, pressure and fluctuating conditions. ASME B16.20 dimensions for ASME B16.5 flanges and large-diameter sizes for MSS SP-44 / ASME B16.47 Series A flanges.",
    short_desc_ar="قلب معدني مصمت مسنن مع طبقة لينة رقيقة: يُحكم عند حمل شد منخفض ويتحمل الحرارة والضغط العاليين والظروف المتغيرة. أبعاد ASME B16.20 لفلنجات ASME B16.5 ومقاسات كبيرة لفلنجات MSS SP-44 / ASME B16.47 السلسلة A.",
    description_en=("A solid metal core with fine concentric serrations machined into both faces, covered with a thin soft facing layer. The serrations concentrate seating stress on many narrow rings, so the gasket seals at low bolt load yet withstands high temperature, pressure and fluctuating conditions. The rigid core is blow-out resistant and can be re-faced and reused.\n\n"
                    "Styles: without centering ring (tongue & groove, recessed faces, heat exchangers); integral centering ring (raised-face pipe flanges); loose centering ring (allows thermal movement).\n\n"
                    "Core: CS, SS 304/316L/321/347, Duplex, alloys. Facings: flexible graphite, PTFE, mica. Pass-partition (heat exchanger) versions made to drawing.\n\n"
                    "Serration pitch 1.0 mm · depth ≈ 0.35 mm · 90° profile · crests flattened ≈ 0.1 mm · R0.3.\n\n"
                    "To order, state: NPS and class · flange standard · style · core metal · facing · centering ring material · quantity."),
    description_ar=("قلب معدني مصمت بتسنينات دائرية دقيقة على الوجهين ومغطى بطبقة لينة رقيقة. تركّز التسنينات إجهاد الإحكام على حلقات ضيقة كثيرة فيُحكم الجوان عند حمل شد منخفض ويتحمل الحرارة والضغط العاليين. القلب الصلب مقاوم للانفجار ويمكن إعادة كسوته واستخدامه.\n\n"
                    "القلب: صلب كربوني، ستانلس 304/316L/321/347، دوبلكس، سبائك. الكسوة: جرافيت مرن، PTFE، ميكا. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Raised-face pipe flanges (centering ring styles)\nTongue & groove, recessed faces and heat exchangers (without centering ring)\nHigh temperature, pressure and fluctuating conditions",
    options=[opt("style", "Style", "النوع", [("integral-cr", "Integral centering ring", "حلقة توسيط مدمجة"), ("loose-cr", "Loose centering ring", "حلقة توسيط منفصلة"), ("no-cr", "Without centering ring", "بدون حلقة توسيط"),
                                         ("pass-partition", "Pass-partition (heat exchanger) · to drawing", "بحواجز ممرات (مبادل حراري) · حسب الرسم")]),
             opt("standard", "Flange standard / series", "مواصفة / سلسلة الفلنجة", [STD["B16.5"], ("ASME B16.47 Series A", "MSS SP-44 / ASME B16.47 Series A", "MSS SP-44 / ASME B16.47 السلسلة A"), (NA, "Made to the joint / drawing", "حسب الوصلة / الرسم")]),
             opt("size", "Size (NPS)", "المقاس (NPS)", size_values([v["options"]["size"] for v in cp_vars if v["options"]["size"] != NA], ("To drawing", "حسب الرسم"))),
             opt("class", "Pressure class", "فئة الضغط", class_values([v["options"]["class"] for v in cp_vars if v["options"]["class"] != NA], ("—", "—")))],
    variants=cp_vars, dimension_tables=cp_tables, images=cp_imgs,
    choices=[choice("core", "Core metal", "معدن القلب", [cv("CS", "Carbon steel (CS)", "صلب كربوني", "CS"), cv("SS 304", "SS 304", material="SS"), cv("SS 316L", "SS 316L", material="SS"), cv("SS 321", "SS 321", material="SS"),
                    cv("SS 347", "SS 347", material="SS"), cv("Duplex", "Duplex", "دوبلكس", "DSS"), cv("Other alloy (state grade)", "Other alloy (state grade)", "سبيكة أخرى (اذكر الدرجة)")], required=True),
             choice("facing", "Facing", "الكسوة", [cv("Flexible graphite", "Flexible graphite", "جرافيت مرن", "GRAPHITE"), cv("PTFE", "PTFE", "PTFE", "PTFE"), cv("Mica", "Mica", "ميكا", "MICA")], required=True),
             choice("ring_material", "Centering ring material", "مادة حلقة التوسيط", type_="text", maxlength=60, requires={"style": ["integral-cr", "loose-cr"]}, hint_en="Not specified in the catalogue — state the material you need."),
             choice("drawing", "Joint / drawing details", "تفاصيل الوصلة / الرسم", type_="text", maxlength=200, requires={"standard": [NA]}, required=True)],
    materials=[mat("CS", [{"role": "core", "grades": ["CS"]}]), mat("SS", [{"role": "core", "grades": ["SS 304", "SS 316L", "SS 321", "SS 347"]}]), mat("DSS", [{"role": "core", "grades": ["Duplex"]}]),
               mat("GRAPHITE", [{"role": "facing", "grades": ["Flexible graphite"]}]), mat("PTFE", [{"role": "facing", "grades": ["PTFE"]}]), mat("MICA", [{"role": "facing", "grades": ["Mica"]}])],
    standards=[("ASME B16.20", "Gasket dimensions for ASME B16.5 flanges"), ("ASME B16.5", "Flanges NPS ½–24"), ("ASME B16.47 Series A", "Flanges NPS 26–60 (MSS SP-44)"), ("MSS SP-44", "Flanges NPS 26–60")],
    properties=[("Core thickness", "4 mm"), ("Facing thickness", "0.5 mm per side"), ("Centering ring thickness", "2 mm"), ("Serration", "Pitch 1.0 mm · depth ≈ 0.35 mm · 90° profile · crests flattened ≈ 0.1 mm · R0.3")],
    attributes={"gasket_family": [("Camprofile gaskets", "جوانات كامبروفايل")], "gasket_standard": [("ASME B16.20", "ASME B16.20")]},
    related=["spiral-wound-gaskets", "heat-exchanger-metal-jacketed-gaskets"], match_terms=["%camprofile%", "%kammprofile%", "%kamprofile%"],
    review=["Centering ring material is not stated in the catalogue; customers state it in the enquiry.",
            "The large-diameter table (MSS SP-44 / B16.47 Series A) does not name a gasket standard; ASME B16.20 is cited only for the B16.5 table.",
            "Core thickness 4 mm, facing 0.5 mm per side and centering ring 2 mm are printed under the B16.5 table; they are shown as general properties.",
            "Loose and integral centering-ring styles share the same dimension table (the catalogue gives one table for the centering-ring versions)."])

# ═══════════════════════ 7. Ring type joints R / RX / BX (pages 16-19) ═══════════════════════
r1, r2 = section("Ring Type Joint · Type R (ASME B16.20 / API 6A)"), section("Ring Type Joint · Type R (continued)")
t_r1, t_r2 = tables_in(r1), tables_in(r2); assert len(t_r1) == 2 and len(t_r2) == 1
hard = t_r1[0]["rows"]; assert hard[0][0] == "Soft iron", hard
r_rows = t_r1[1]["rows"] + t_r2[0]["rows"]
assert t_r1[1]["head"][1] == ["P", "A", "B oval", "H oct", "C", "R1", "OD", "ID", "150", "300 600", "900", "1500", "2500", "300 600", "900"], t_r1[1]["head"]
t_rx = tables_in(section("Ring Type Joint · Type RX (ASME B16.20 / API 6A)")); assert len(t_rx) == 1
t_bx = tables_in(section("Ring Type Joint · Type BX (ASME B16.20 / API 6A)")); assert len(t_bx) == 1
assert t_rx[0]["head"][1] == ["OD", "H", "A", "C", "D (bevel)", "R1", "Hole Ø"], t_rx[0]["head"]
assert t_bx[0]["head"][1] == ["OD", "H", "A", "C", "ODT", "Hole Ø"], t_bx[0]["head"]
d_oval, d_oct, d_rx, d_bx = svg_asset(34, "ring-joint-r-oval"), svg_asset(35, "ring-joint-r-octagonal"), svg_asset(36, "ring-joint-rx"), svg_asset(37, "ring-joint-bx")
rt_vars, oval_rows, oct_rows = [], [], []
APPS = [(9, "ASME B16.5", ["150"]), (10, "ASME B16.5", ["300", "600"]), (11, "ASME B16.5", ["900"]), (12, "ASME B16.5", ["1500"]), (13, "ASME B16.5", ["2500"]),
        (14, "ASME B16.47 Series A", ["300", "600"]), (15, "ASME B16.47 Series A", ["900"])]
lapped = []
for r in r_rows:
    ring = r[0]; P, A, B, H, C, R1, OD, ID = (num(x) for x in r[1:9])
    if B: oval_rows.append({"match": {"ring": ring}, "values": {"p": P, "a": A, "b": B, "od": OD, "id": ID}})
    oct_rows.append({"match": {"ring": ring}, "values": {"p": P, "a": A, "h": H, "c": C, "r1": R1, "od": OD, "id": ID}})
    apps = []
    for col, std, classes in APPS:
        cell = r[col].strip()
        if not cell: continue
        star = cell.endswith("*"); size = nps(cell.rstrip("* ").strip())
        if star: lapped.append(ring)
        apps += [(std, c, size) for c in classes]
    assert apps, f"{ring} has no flange application"
    page = 16 if r in t_r1[1]["rows"] else 17
    for prof in (["R-oval"] if B else []) + ["R-oct"]:
        for std, c, size in apps:
            rt_vars.append({"options": {"type": prof, "standard": std, "class": c, "size": size, "ring": ring}, "sku": sku("RTJ", ring, "OVAL" if prof == "R-oval" else "OCT", "B165" if std == "ASME B16.5" else "B1647A", c, size),
                            "label_en": f"{ring} {'oval' if prof == 'R-oval' else 'octagonal'} · {std} · Class {c} · NPS {size}" + (" (lapped flanges only)" if ring in lapped else ""), "size": f'{size}"', "pressure_class": f"Class {c}", "source_page": page})
rx_rows = []
for r in t_rx[0]["rows"]:
    ring = r[0]; vals = dict(zip(["od", "h", "a", "c", "d", "r1", "hole"], (num(x) for x in r[1:8])))
    rx_rows.append({"match": {"ring": ring}, "values": {k: v for k, v in vals.items() if v is not None}})
    rt_vars.append({"options": {"type": "RX", "standard": NA, "class": NA, "size": NA, "ring": ring}, "sku": sku("RTJ", ring), "label_en": f"{ring} pressure-energised ring", "source_page": 18})
bx_rows = []
for r in t_bx[0]["rows"]:
    ring = r[0]; vals = dict(zip(["nominal", "od", "h", "a", "c", "odt", "hole"], [r[1]] + [num(x) for x in r[2:8]]))
    bx_rows.append({"match": {"ring": ring}, "values": vals})
    rt_vars.append({"options": {"type": "BX", "standard": "API 6BX", "class": NA, "size": NA, "ring": ring}, "sku": sku("RTJ", ring), "label_en": f"{ring} · API 6BX flange bore {r[1]} in", "source_page": 19})
mm = lambda k, s, en, ar: {"key": k, "symbol": s, "label_en": en, "label_ar": ar, "unit": "mm"}
R_TOL = "Tolerances: P ±0.18, A ±0.20, B and H +1.27/−0.51 (variation in height around any ring ≤ 0.5 mm), C ±0.20, R1 ±0.50. The 23° faces of R and RX rings have a surface finish no rougher than 1.6 µm Ra (63 µin). Flatness within 0.2 % of ring OD, max. 0.38 mm."
rt_tables = [
    {"title_en": "Type R oval rings — ASME B16.20 / API 6A", "title_ar": "حلقات النوع R البيضاوية — ASME B16.20 / API 6A", "applies": {"type": "R-oval"}, "rows": oval_rows, "source_page": 16, "drawing_path": d_oval,
     "columns": [mm("p", "P", "Pitch diameter", "قطر الخطوة"), mm("a", "A", "Width", "العرض"), mm("b", "B", "Height (oval)", "الارتفاع (بيضاوي)"), mm("od", "OD", "Outside diameter", "القطر الخارجي"), mm("id", "ID", "Inside diameter", "القطر الداخلي")],
     "notes": ["Dimensions in mm. OD = P + A, ID = P − A. Oval rings seat on round- or flat-bottom grooves.", R_TOL, "R ring numbers for API 6B flanges (Class 720, 960, 2000, 3000, 5000) on request."]},
    {"title_en": "Type R octagonal rings — ASME B16.20 / API 6A", "title_ar": "حلقات النوع R المثمنة — ASME B16.20 / API 6A", "applies": {"type": "R-oct"}, "rows": oct_rows, "source_page": 16, "drawing_path": d_oct,
     "columns": [mm("p", "P", "Pitch diameter", "قطر الخطوة"), mm("a", "A", "Width", "العرض"), mm("h", "H", "Height (octagonal)", "الارتفاع (مثمن)"), mm("c", "C", "Width of flat", "عرض السطح المستوي"),
                 mm("r1", "R1", "Corner radius", "نصف قطر الزاوية"), mm("od", "OD", "Outside diameter", "القطر الخارجي"), mm("id", "ID", "Inside diameter", "القطر الداخلي")],
     "notes": ["Dimensions in mm. OD = P + A, ID = P − A. Octagonal rings seat on flat-bottom grooves only.", R_TOL, "* R30 is for lapped flanges only.", "R ring numbers for API 6B flanges (Class 720, 960, 2000, 3000, 5000) on request."]},
    {"title_en": "Type RX pressure-energised rings — ASME B16.20 / API 6A", "title_ar": "حلقات النوع RX ذاتية الإحكام بالضغط — ASME B16.20 / API 6A", "applies": {"type": "RX"}, "rows": rx_rows, "source_page": 18, "drawing_path": d_rx,
     "columns": [mm("od", "OD", "Outside diameter", "القطر الخارجي"), mm("h", "H", "Height", "الارتفاع"), mm("a", "A", "Width", "العرض"), mm("c", "C", "Width of flat", "عرض السطح المستوي"), mm("d", "D", "Bevel", "الشطف"),
                 mm("r1", "R1", "Corner radius", "نصف قطر الزاوية"), mm("hole", "Ø", "Pressure-passage hole", "ثقب معادلة الضغط")],
     "notes": ["Dimensions in mm. RX82–RX91 have one pressure-passage hole, centreline at the midpoint of dimension C.",
               "Tolerances: OD +0.50/−0; H and A +0.20/−0 (a plus tolerance of 0.20 mm on A and H is permitted provided width/height variation around any ring ≤ 0.10 mm); C +0.15/−0; D +0/−0.80; R1 ±0.50; hole +0.50/−0. Surface finish of 23° faces 1.6 µm Ra max. Flatness within 0.2 % of OD, max. 0.38 mm.",
               "Pressure-class cross-reference on request."]},
    {"title_en": "Type BX pressure-energised rings for API 6BX flanges — ASME B16.20 / API 6A", "title_ar": "حلقات النوع BX لفلنجات API 6BX — ASME B16.20 / API 6A", "applies": {"type": "BX"}, "rows": bx_rows, "source_page": 19, "drawing_path": d_bx,
     "columns": [{"key": "nominal", "symbol": "NS", "label_en": "Nominal size (API 6BX flange bore)", "label_ar": "المقاس الاسمي (فتحة فلنجة API 6BX)", "unit": "in"}, mm("od", "OD", "Outside diameter", "القطر الخارجي"),
                 mm("h", "H", "Height", "الارتفاع"), mm("a", "A", "Width", "العرض"), mm("c", "C", "Width of flat", "عرض السطح المستوي"), mm("odt", "ODT", "OD of flat", "القطر الخارجي للسطح المستوي"), mm("hole", "Ø", "Pressure-passage hole", "ثقب معادلة الضغط")],
     "notes": ["Dimensions in mm (nominal size in inches). Rated 2,000 – 20,000 psi depending on size.",
               "Tolerances: OD +0/−0.13; H and A +0.20/−0 (variation ≤ 0.10 mm around the ring); C +0.15/−0; ODT ±0.05; hole ±0.50. Corner radius R = 8–12 % of height H. Surface finish of 23° faces 0.8 µm Ra (32 µin) max. Flatness within 0.2 % of OD, max. 0.38 mm.",
               "Always confirm ring number against the flange nameplate / API 6A table. BX rings are not interchangeable with R or RX rings."]}]
R_MATS = [("Soft iron", "Soft iron — max. 90 HB, ID mark D", "حديد طري — 90 HB كحد أقصى، علامة D", "IRON"),
          ("Low carbon steel", "Low carbon steel — max. 120 HB, ID mark S", "صلب منخفض الكربون — 120 HB كحد أقصى، علامة S", "CS"),
          ("4–6 % Cr ½ % Mo", "4–6 % Cr ½ % Mo — max. 130 HB, ID mark F5", "4–6% كروم ½% موليبدينوم — 130 HB كحد أقصى، علامة F5", "AS"),
          ("SS 304", "SS 304 — max. 160 HB, ID mark S304", "ستانلس 304 — 160 HB كحد أقصى، علامة S304", "SS"), ("SS 316", "SS 316 — max. 160 HB, ID mark S316", "ستانلس 316 — 160 HB كحد أقصى، علامة S316", "SS"),
          ("SS 347", "SS 347 — max. 160 HB, ID mark S347", "ستانلس 347 — 160 HB كحد أقصى، علامة S347", "SS"), ("SS 410", "SS 410 — max. 170 HB, ID mark S410", "ستانلس 410 — 170 HB كحد أقصى، علامة S410", "SS"),
          ("Inconel 625", "Inconel 625 — hardness to specification", "إنكونيل 625 — الصلادة حسب المواصفة", "NI"), ("Incoloy 825", "Incoloy 825 — hardness to specification", "إنكولوي 825 — الصلادة حسب المواصفة", "NI")]
# the hardness table as printed (checked so a changed catalogue stops the build)
assert [r[1] for r in hard] == ["90", "120", "130", "160", "160 / 170", "—"] and [r[2] for r in hard][:3] == ["D", "S", "F5"], hard
RNUM = lambda r: (r.rstrip("0123456789"), int(re.sub(r"\D", "", r)))
rings = sorted({v["options"]["ring"] for v in rt_vars}, key=lambda r: (["R", "RX", "BX"].index(RNUM(r)[0]), RNUM(r)[1]))
product(
    slug="ring-type-joint-gaskets", family_slug="ring-type-joint-gasket", name_en="Ring Type Joint Gaskets – R, RX & BX (ASME B16.20 / API 6A)", name_ar="جوانات الحلقة المعدنية (RTJ) – R وRX وBX (ASME B16.20 / API 6A)",
    family_name_en="Ring Type Joint Gaskets", family_name_ar="جوانات الحلقة المعدنية (RTJ)", product_type="ring-type-joint", unit="pcs", pages=[16, 17, 18, 19],
    short_desc_en="Solid metal ring joints for ring-groove flanges in high-pressure, high-temperature service: Type R oval and octagonal (ASME B16.5 and B16.47 Series A), pressure-energised RX, and BX rings for API 6BX flanges.",
    short_desc_ar="حلقات معدنية مصمتة لفلنجات المجرى الحلقي في الخدمات عالية الضغط والحرارة: النوع R بيضاوي ومثمن (ASME B16.5 وB16.47 السلسلة A)، والنوع RX ذاتي الإحكام، وحلقات BX لفلنجات API 6BX.",
    description_en=("Solid metal rings for ring-groove flanges in high-pressure, high-temperature service. The oval ring is the original design and seats on round- or flat-bottom grooves; the octagonal ring seats on flat-bottom grooves only and seals more efficiently. Both seal by line contact on the 23° groove walls, so the ring must be softer than the groove.\n\n"
                    "The RX ring is a pressure-energised development of the octagonal ring. Its asymmetric profile means line pressure pushes the outer sealing faces harder into the groove, so the seal tightens as pressure rises. RX rings fit the same grooves as R rings of the same number, giving a more robust joint without changing flanges. Used extensively on API 6B wellhead, Christmas-tree and drilling equipment.\n\n"
                    "BX rings are pressure-energised rings for API 6BX flanges, rated 2,000 to 20,000 psi. They are designed so the ring faces make contact before the flanges meet face-to-face, giving a high-integrity metal-to-metal seal. Every BX ring has a pressure-passage hole across its section to equalise pressure on both sides. BX rings are not interchangeable with R or RX rings.\n\n"
                    "To order, state: ring number (R, RX or BX) · material and hardness · oval or octagonal (R type) · coating if required · quantity."),
    description_ar=("حلقات معدنية مصمتة لفلنجات المجرى الحلقي في الخدمات عالية الضغط والحرارة. الحلقة البيضاوية تجلس على مجاري ذات قاع دائري أو مسطح، والمثمنة على المجاري ذات القاع المسطح فقط وتحكم بكفاءة أعلى. ويجب أن تكون الحلقة أنعم من المجرى.\n\n"
                    "حلقة RX تطوير ذاتي الإحكام للحلقة المثمنة وتناسب نفس مجاري حلقات R بنفس الرقم. حلقات BX لفلنجات API 6BX ولا تتبادل مع حلقات R أو RX. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Ring-groove flanges in high-pressure, high-temperature service\nAPI 6B wellhead, Christmas-tree and drilling equipment (RX)\nAPI 6BX flanges (BX)",
    options=[opt("type", "Ring type", "نوع الحلقة", [("R-oval", "R · oval", "R · بيضاوي"), ("R-oct", "R · octagonal", "R · مثمن"), ("RX", "RX · pressure-energised", "RX · ذاتي الإحكام"), ("BX", "BX · API 6BX", "BX · API 6BX")]),
             opt("standard", "Flange standard / series", "مواصفة / سلسلة الفلنجة", [STD["B16.5"], STD["B16.47A"], STD["API6BX"], (NA, "Ring number only", "رقم الحلقة فقط")]),
             opt("class", "Pressure class", "فئة الضغط", class_values([v["options"]["class"] for v in rt_vars if v["options"]["class"] != NA], ("—", "—"))),
             opt("size", "Size (NPS)", "المقاس (NPS)", size_values([v["options"]["size"] for v in rt_vars if v["options"]["size"] != NA], ("—", "—"))),
             opt("ring", "Ring number", "رقم الحلقة", [(r, r, r) for r in rings])],
    variants=rt_vars, dimension_tables=rt_tables,
    images=[img(d_oct, "Type R octagonal ring profile (A, H, P, C, 23°, R1)", "مقطع الحلقة R المثمنة", {"type": "R-oct"}), img(d_oval, "Type R oval ring profile (A, B, P)", "مقطع الحلقة R البيضاوية", {"type": "R-oval"}),
            img(d_rx, "Type RX ring profile (A, H, C, D, 23°, OD)", "مقطع الحلقة RX", {"type": "RX"}), img(d_bx, "Type BX ring profile with pressure-passage hole", "مقطع الحلقة BX مع ثقب معادلة الضغط", {"type": "BX"})],
    choices=[choice("material", "Material and hardness", "المادة والصلادة", [cv(v, en, ar, m) for v, en, ar, m in R_MATS], requires={"type": ["R-oval", "R-oct"]}, required=True, hint_en="The ring must be softer than the groove."),
             choice("material_text", "Material and hardness", "المادة والصلادة", type_="text", maxlength=60, requires={"type": ["RX", "BX"]}, required=True, hint_en="State the material and maximum hardness."),
             choice("coating", "Coating (if required)", "الطلاء (إن لزم)", type_="text", maxlength=60)],
    materials=[mat("IRON", [{"role": "ring (Type R)", "grades": ["Soft iron (max. 90 HB, D)"]}]), mat("CS", [{"role": "ring (Type R)", "grades": ["Low carbon steel (max. 120 HB, S)"]}]),
               mat("AS", [{"role": "ring (Type R)", "grades": ["4–6 % Cr ½ % Mo (max. 130 HB, F5)"]}]),
               mat("SS", [{"role": "ring (Type R)", "grades": ["SS 304 (max. 160 HB, S304)", "SS 316 (max. 160 HB, S316)", "SS 347 (max. 160 HB, S347)", "SS 410 (max. 170 HB, S410)"]}]),
               mat("NI", [{"role": "ring (Type R)", "grades": ["Inconel 625", "Incoloy 825"]}])],
    standards=[("ASME B16.20", "Ring joint dimensions"), ("API 6A", "Ring joint dimensions"), ("ASME B16.5", "Type R ring-groove flanges"), ("ASME B16.47 Series A", "Type R rings R93–R105"), ("API 6BX", "BX ring flanges")],
    properties=[("Sealing", "Line contact on the 23° groove walls")],
    attributes={"gasket_family": [("Ring type joint gaskets", "جوانات الحلقة المعدنية (RTJ)")], "gasket_standard": [("ASME B16.20", "ASME B16.20"), ("API 6A", "API 6A")]},
    related=["spiral-wound-gaskets", "flange-insulation-kits"], match_terms=["%ring type joint%", "%ring joint%", "%rtj%", "%ring gasket%"],
    review=["The ring material / hardness table is printed on the Type R page; RX and BX rings therefore ask the customer to state material and hardness instead of offering that list.",
            "Class 300 and Class 600 share one column in the Type R table (as in ASME B16.20); both classes are offered for those rings.",
            f"R30 is for lapped flanges only (marked * in the catalogue): {', '.join(sorted(set(lapped)))}.",
            "RX rings: the catalogue gives no flange / pressure-class cross-reference ('on request'), so RX rings are selected by ring number only.",
            "BX ratings (2,000–20,000 psi 'depending on size') are not given per ring and are not shown per ring."])

# ═══════════════════════ 8. Graphite packing rings (page 20) ═══════════════════════
t_pk = tables_in(section("Graphite Packing Rings")); assert len(t_pk) == 1
limits = [(r[0], r[1]) for r in t_pk[0]["rows"] if len(r) == 2]
assert limits[0][0] == "Application", limits
product(
    slug="graphite-packing-rings", family_slug="graphite-packing-ring", name_en="Graphite Packing Rings", name_ar="حلقات حشو الجرافيت",
    family_name_en="Graphite Packing Rings", family_name_ar="حلقات حشو الجرافيت", product_type="packing", unit="pcs", pages=[20],
    short_desc_en="Pure expanded graphite packing: die-formed rings (1.4–1.85 g/cm³, square or chevron section) for valve stems and pump shafts, corrugated graphite tape and pre-formed cover seals for pressure-seal bonnets. Up to 1,000 bar in valves.",
    short_desc_ar="حشو من الجرافيت الممدد النقي: حلقات مشكّلة بالقالب (1.4–1.85 جم/سم³، مقطع مربع أو شيفرون) لسيقان الصمامات وأعمدة المضخات، وشريط جرافيت مموج، وحلقات إحكام مشكّلة لأغطية الصمامات ذاتية الإحكام. حتى 1000 بار في الصمامات.",
    description_en=("Pure expanded graphite combines very high chemical resistance and thermal stability with constant elasticity. It does not cold-flow, shrink or age regardless of temperature cycling, and nuclear grades meet strict purity limits (soluble chlorides < 20 ppm) for power-station valves.\n\n"
                    "Forms: die-formed rings — supplied at densities of 1.4 to 1.85 g/cm³, square or chevron/bevelled section, for valve stems and pump shafts; graphite tape — corrugated, W-profile tape wound on site to form repair rings; "
                    "cover seals — pre-formed rings for self-sealing (pressure-seal) bonnets on heavy-duty valves and HP feed-water heaters, remaining elastic at up to 200 N/mm² surface load and bridging sealing gaps up to 0.3 mm.\n\n"
                    "Also available: braided packings (graphite, PTFE, ceramic, glass fibre, bio-soluble fibre), O-rings and rotary shaft seals (rubber and PTFE), ropes and tapes (glass, ceramic, bio-soluble fibre) and custom seals to drawing or sample."),
    description_ar=("يجمع الجرافيت الممدد النقي بين مقاومة كيميائية وثبات حراري عاليين ومرونة ثابتة، ولا يتدفق على البارد ولا ينكمش ولا يتقادم مع تغير الحرارة، وتستوفي الدرجات النووية حدود نقاء صارمة (كلوريدات ذائبة أقل من 20 جزءاً في المليون).\n\n"
                    "الأشكال: حلقات مشكّلة بالقالب، وشريط جرافيت مموج، وحلقات إحكام للأغطية ذاتية الإحكام. (ترجمة أولية تحتاج إلى مراجعة)"),
    applications_en="Valve stems and pump shafts\nPressure-seal bonnets on heavy-duty valves and HP feed-water heaters\nHot & feed water, steam, heat-transfer oils, hydrocarbons and most chemicals",
    options=[opt("form", "Form", "الشكل", [("die-formed", "Die-formed rings", "حلقات مشكّلة بالقالب"), ("tape", "Graphite tape (corrugated)", "شريط جرافيت مموج"), ("cover-seal", "Cover seals (pressure-seal bonnets)", "حلقات إحكام الأغطية")])],
    variants=[{"options": {"form": f}, "sku": sku("PK", f), "label_en": l, "source_page": 20} for f, l in (("die-formed", "Die-formed graphite rings"), ("tape", "Corrugated graphite tape"), ("cover-seal", "Graphite cover seals"))],
    choices=[choice("section", "Section", "المقطع", [cv("Square", "Square", "مربع"), cv("Chevron / bevelled", "Chevron / bevelled", "شيفرون / مشطوف")], requires={"form": ["die-formed"]}, required=True),
             choice("density", "Density", "الكثافة", type_="number", min=1.4, max=1.85, step=0.05, unit="g/cm³", requires={"form": ["die-formed"]}, hint_en="1.4 to 1.85 g/cm³"),
             choice("grade", "Grade", "الدرجة", [cv("Standard", "Standard", "قياسي"), cv("Nuclear", "Nuclear grade (soluble chlorides < 20 ppm)", "درجة نووية (كلوريدات ذائبة < 20 جزء في المليون)")]),
             choice("dimensions", "Dimensions", "الأبعاد", type_="text", maxlength=120, required=True, hint_en="e.g. stem / shaft diameter, bore and section, or bonnet seal size")],
    materials=[mat("GRAPHITE", [{"role": "packing", "grades": ["Pure expanded graphite"]}])],
    properties=[(f"Operating limits — {k.lower()}", v) for k, v in limits] + [("Cover seals", "Elastic at up to 200 N/mm² surface load; bridge sealing gaps up to 0.3 mm"),
                ("Graphite material approvals stated in the catalogue", "Oxygen service (BAM) up to 250 bar / 200 °C; food contact; drinking water (KTW / DVGW) for D1 and D2 sealing elements — certificates on request")],
    attributes={"gasket_family": [("Packings", "الحشوات")]},
    related=["non-metallic-gaskets", "spiral-wound-gaskets"], match_terms=["%packing%", "%graphite ring%"],
    review=["Graphite material approvals (BAM oxygen, food contact, KTW / DVGW) are quoted from the catalogue as text only; no certification badge is shown until the certificates are uploaded and verified.",
            "Ring sizes are not tabulated; the customer states the dimensions.",
            "No image in the catalogue for this product: the shop shows a placeholder until you upload a photo.",
            "Braided packings, O-rings, rotary shaft seals, ropes, tapes and custom seals are mentioned without details; they are described in the text, not created as products."])

# ───────────────────────── checks + output ─────────────────────────
for p in PRODUCTS:
    keys = [o["key"] for o in p["options"]]
    seen = set()
    for v in p["variants"]:
        assert list(v["options"]) == keys, (p["slug"], v["options"], keys)
        for o in p["options"]: assert v["options"][o["key"]] in {x["value"] for x in o["values"]}, (p["slug"], o["key"], v["options"])
        k = json.dumps(v["options"], sort_keys=True); assert k not in seen, (p["slug"], k); seen.add(k)
    skus = [v["sku"] for v in p["variants"]]; assert len(skus) == len(set(skus)), (p["slug"], [s for s in skus if skus.count(s) > 1][:5])
    for t in p["dimension_tables"]:
        for r in t["rows"]:
            assert any(all(v["options"].get(k) == x for k, x in {**t["applies"], **r["match"]}.items()) for v in p["variants"]), (p["slug"], t["title_en"], r["match"])
allsku = [v["sku"] for p in PRODUCTS for v in p["variants"]]; assert len(allsku) == len(set(allsku))
json.dump(PRODUCTS, open(f"{OUT}/gaskets.json", "w"), ensure_ascii=False, indent=1)

# ───────────────────────── SQL ─────────────────────────
def dq(obj):
    s = json.dumps(obj, ensure_ascii=False); assert "$kz$" not in s; return "$kz$" + s + "$kz$::jsonb"
def lit(s): return "null" if s is None else "'" + str(s).replace("'", "''") + "'"
nv = sum(len(p["variants"]) for p in PRODUCTS)
head = f"""-- KANZ: gaskets & sealing products from the KanzCorner gasket catalogue ({len(PRODUCTS)} product families, {nv} configurations).
-- Run in Supabase -> SQL Editor (paste everything, press Run). Requires migrations up to 0018_gaskets.sql.
-- Creates DRAFT, quote-only products in the category "Gaskets & Sealing Products". Nothing goes public until you press Publish in Admin -> Products.
-- Safe to run again: products that already exist are skipped (never overwritten). Existing products with similar names are listed as
-- "possible match" in the result and recorded on the new product for review. One transaction: if anything fails, nothing is saved.
begin;
do $$ begin
  if to_regclass('public.dimension_tables') is null then raise exception 'Run supabase/migrations/0014_catalogue_extraction.sql first.'; end if;
  if not exists (select 1 from information_schema.columns where table_name = 'product_materials' and column_name = 'components') then raise exception 'Run supabase/migrations/0018_gaskets.sql first.'; end if;
end $$;
create temp table kanz_msgs (n serial, msg text) on commit drop;

-- category: under "Gaskets & Gauges" when that category exists, otherwise at the top level
insert into categories (slug, name_en, name_ar, parent_id, sort_order, is_active, description_en, description_ar)
select '{CATEGORY}', 'Gaskets & Sealing Products', 'الجوانات ومنتجات منع التسرب', (select id from categories where slug = 'gaskets-gauges'), 0, true,
       'Spiral wound, non-metallic, camprofile, heat exchanger and ring type joint gaskets, flange insulation kits, joint sealant and graphite packing, with ASME B16.20, ASME B16.21 and API 6A dimensions.',
       'جوانات حلزونية وغير معدنية وكامبروفايل وجوانات المبادلات الحرارية والحلقة المعدنية، وأطقم عزل الفلنجات ومانع التسرب وحشو الجرافيت، بأبعاد ASME B16.20 وASME B16.21 وAPI 6A.'
where not exists (select 1 from categories where slug = '{CATEGORY}');

create or replace function pg_temp.kanz_gasket_load(p jsonb) returns void language plpgsql as $f$
declare v_product uuid; v_family uuid; v_opt uuid; v_cat uuid; v_attr uuid; o jsonb; t jsonb; m jsonb; a record; v_table uuid; n int; dup text; matches text;
begin
  select id into v_product from products where slug = p->>'slug';
  if v_product is not null then
    insert into kanz_msgs (msg) values (case when (select source_ref->>'import' from products where id = v_product) = '{IMPORT}'
      then 'skipped (already imported): /product/' || (p->>'slug') else 'NOT CREATED - the address /product/' || (p->>'slug') || ' is used by another product; review it in Admin -> Products' end);
    return;
  end if;
  select string_agg(sku, ', ') into dup from product_variants where lower(sku) in (select lower(x->>'sku') from jsonb_array_elements(p->'variants') x);
  if dup is not null then raise exception 'SKU already used by another product: % (nothing was saved)', left(dup, 200); end if;
  -- existing products that may be the same item (never changed; listed for the admin)
  select string_agg(name_en || ' (/product/' || slug || ', ' || status || ')', '; ') into matches from products
   where coalesce(source_ref->>'import', '') <> '{IMPORT}' and exists (select 1 from jsonb_array_elements_text(p->'match_terms') term where products.name_en ilike term or products.slug ilike replace(term, ' ', '-'));
  if matches is not null then insert into kanz_msgs (msg) values ('possible match for ' || (p->>'name_en') || ': ' || matches); end if;
  select id into v_cat from categories where slug = '{CATEGORY}';
  insert into product_families (slug, name_en, name_ar, product_type, category_id) values (p->>'family_slug', p->>'family_name_en', p->>'family_name_ar', p->>'product_type', v_cat)
  on conflict (slug) do nothing;
  select id into v_family from product_families where slug = p->>'family_slug';
  insert into products (slug, name_en, name_ar, short_desc_en, short_desc_ar, description_en, description_ar, category_id, brand_id, status, is_quote_only, unit, family_id, family_link,
                        applications_en, specs, source_ref, seo_title_en, seo_title_ar, seo_desc_en, seo_desc_ar)
  values (p->>'slug', p->>'name_en', p->>'name_ar', p->>'short_desc_en', p->>'short_desc_ar', p->>'description_en', p->>'description_ar', v_cat, null, 'draft', true, p->>'unit', v_family, 'confirmed',
          p->>'applications_en', p->'specs', p->'source_ref' || jsonb_build_object('possible_matches', matches), p->>'seo_title_en', p->>'seo_title_ar', p->>'seo_desc_en', p->>'seo_desc_ar')
  returning id into v_product;
  n := 0;
  for o in select * from jsonb_array_elements(p->'options') loop
    insert into product_options (product_id, key, name_en, name_ar, sort_order) values (v_product, o->>'key', o->>'name_en', o->>'name_ar', n) returning id into v_opt;
    insert into product_option_values (option_id, value, label_en, label_ar, sort_order)
      select v_opt, x->>'value', x->>'label_en', x->>'label_ar', ord - 1 from jsonb_array_elements(o->'values') with ordinality as e(x, ord);
    n := n + 1;
  end loop;
  insert into product_variants (product_id, sku, label_en, size, pressure_class, price, is_active, sort_order, options, source_page)
    select v_product, x->>'sku', x->>'label_en', x->>'size', x->>'pressure_class', null, true, ord - 1, x->'options', nullif(x->>'source_page','')::int
    from jsonb_array_elements(p->'variants') with ordinality as e(x, ord);
  n := 0;
  for t in select * from jsonb_array_elements(p->'dimension_tables') loop
    insert into dimension_tables (product_id, title_en, title_ar, columns, applies, drawing_path, notes, source_page, sort_order)
    values (v_product, t->>'title_en', t->>'title_ar', t->'columns', coalesce(t->'applies','{{}}'::jsonb), null, coalesce(t->'notes','[]'::jsonb), nullif(t->>'source_page','')::int, n)
    returning id into v_table;
    insert into dimension_rows (table_id, match, "values", sort_order) select v_table, x->'match', x->'values', ord - 1 from jsonb_array_elements(t->'rows') with ordinality as e(x, ord);
    n := n + 1;
  end loop;
  for m in select * from jsonb_array_elements(p->'materials') loop
    insert into product_materials (product_id, material_code, grades, status, source, components, origin)
    values (v_product, m->>'code', array(select jsonb_array_elements_text(m->'grades')), m->>'status', 'KanzCorner gasket catalogue (product-specific material list)', m->'components', 'import')
    on conflict (product_id, material_code) do nothing;
  end loop;
  for a in select e.key, x from jsonb_each(p->'attributes') e, jsonb_array_elements(e.value) with ordinality as y(x, ord) loop
    select id into v_attr from attribute_defs where key = a.key;
    if v_attr is not null then insert into product_attribute_values (product_id, attribute_id, value_en, value_ar, sort_order) values (v_product, v_attr, a.x->>0, a.x->>1, 0); end if;
  end loop;
  insert into kanz_msgs (msg) values ('created: /product/' || (p->>'slug') || ' (' || jsonb_array_length(p->'variants') || ' configurations, ' || jsonb_array_length(p->'dimension_tables') || ' dimension tables)');
end $f$;

"""
body = []
for p in PRODUCTS:
    std = [{"code": c, "scope": "product", "note": n, "page": None} for c, n in p.get("standards", [])]
    title_en = p["name_en"].replace(" – ", " | ")[:58]
    q = {"slug": p["slug"], "family_slug": p["family_slug"], "family_name_en": p["family_name_en"], "family_name_ar": p["family_name_ar"], "product_type": p["product_type"],
         "name_en": p["name_en"], "name_ar": p["name_ar"], "short_desc_en": p["short_desc_en"], "short_desc_ar": p["short_desc_ar"], "description_en": p["description_en"], "description_ar": p["description_ar"],
         "applications_en": p["applications_en"], "unit": p["unit"], "options": p["options"], "variants": p["variants"], "materials": p["materials"], "attributes": p["attributes"], "match_terms": p["match_terms"],
         "dimension_tables": [{k: v for k, v in t.items() if k != "drawing_path"} for t in p["dimension_tables"]],
         "specs": {"standards": std, "materials": [], "notes": [], "choices": p.get("choices", []), "properties": [{"label_en": k, "value_en": v} for k, v in p.get("properties", [])]},
         "source_ref": {"import": IMPORT, "title": "Gaskets & Sealing Products — Technical Catalogue (Kanz Corner Trading)", "pages": p["pages"], "review": p["review"],
                        "supplier_note": "Kanz Corner Trading supplies products manufactured by qualified gasket manufacturers to these standards; the manufacturer is not named in the catalogue."},
         "seo_title_en": p["name_en"][:70], "seo_title_ar": p["name_ar"][:70], "seo_desc_en": p["short_desc_en"][:158], "seo_desc_ar": p["short_desc_ar"][:158]}
    body.append(f"select pg_temp.kanz_gasket_load({dq(q)});")
rel = []
for p in PRODUCTS:
    for i, r in enumerate(p["related"]):
        rel.append(f"insert into product_relations (product_id, related_id, relation, sort_order) select a.id, b.id, 'related', {i} from products a, products b where a.slug = {lit(p['slug'])} and b.slug = {lit(r)} "
                   f"and a.source_ref->>'import' = '{IMPORT}' and not exists (select 1 from product_relations x where x.product_id = a.id and x.related_id = b.id);")
tail = "\n-- related products (only between products created by this import)\n" + "\n".join(rel) + "\n\nselect msg as result from kanz_msgs order by n;\ncommit;\n"
open(f"{OUT}/1-gaskets-products.sql", "w").write(head + "\n".join(body) + "\n" + tail)

lines = ["-- KANZ: gasket drawings. Run AFTER uploading the 'catalogue' folder (catalogue/gaskets/*.svg) into Storage -> product-images.", "-- Safe to run more than once.", "begin;"]
for p in PRODUCTS:
    slug = p["slug"]
    for n, t in enumerate(p["dimension_tables"]):
        lines.append(f"update dimension_tables set drawing_path = {lit(t['drawing_path'])} where sort_order = {n} and drawing_path is null and product_id = (select id from products where slug = {lit(slug)} and source_ref->>'import' = '{IMPORT}');")
    for i, im in enumerate(p["images"]):
        om = "null" if not im["option_match"] else dq(im["option_match"])
        lines.append(f"insert into product_images (product_id, storage_path, alt_en, alt_ar, sort_order, is_primary, needs_hires, option_match) select id, {lit(im['storage_path'])}, {lit(im['alt_en'])}, {lit(im['alt_ar'])}, {i}, {str(i == 0).lower()}, false, {om} "
                     f"from products where slug = {lit(slug)} and source_ref->>'import' = '{IMPORT}' and not exists (select 1 from product_images x where x.product_id = products.id and x.storage_path = {lit(im['storage_path'])});")
lines.append("commit;")
open(f"{OUT}/2-gaskets-drawings.sql", "w").write("\n".join(lines) + "\n")

rep = ["# Gasket catalogue import — review list", "", f"{len(PRODUCTS)} product families, {nv} configurations, {sum(len(p['dimension_tables']) for p in PRODUCTS)} dimension tables, "
       f"{sum(len(t['rows']) for p in PRODUCTS for t in p['dimension_tables'])} dimension rows, {len(os.listdir(f'{OUT}/catalogue/gaskets'))} drawings.", ""]
for p in PRODUCTS:
    rep += [f"## {p['name_en']}  (/product/{p['slug']})", f"- {len(p['variants'])} configurations, {len(p['dimension_tables'])} tables, {len(p['images'])} drawings, catalogue pages {', '.join(map(str, p['pages']))}"]
    rep += [f"- REVIEW: {x}" for x in p["review"]] + [""]
rep += ["## General", "- No manufacturer is named in the catalogue ('qualified gasket manufacturers'); products have no brand and Kanz Corner is shown as supplier only.",
        "- Not imported as products: ordering information (used in each product's description and enquiry fields), the unit-conversion and Class↔PN charts (reference only), the marking example (in the spiral wound description).",
        "- No prices, stock or certifications were created. Standards are shown as information, not as certification.",
        "- Arabic texts are draft translations; technical codes and units are kept unchanged."]
open(f"{OUT}/REVIEW.md", "w").write("\n".join(rep) + "\n")
print(json.dumps({p["slug"]: {"variants": len(p["variants"]), "tables": len(p["dimension_tables"]), "rows": sum(len(t["rows"]) for t in p["dimension_tables"]), "images": len(p["images"])} for p in PRODUCTS}, indent=1))
