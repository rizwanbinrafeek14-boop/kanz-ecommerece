#!/usr/bin/env python3
"""
Build the catalogue import package consumed by /admin/import.

  python3 scripts/extract_catalogue.py <catalogue.pdf> /tmp/extract     # crops images + captions
  python3 scripts/build_import.py <catalogue.pdf> /tmp/extract          # writes web/data/catalogue-import/

Everything produced here is UNVERIFIED staging data. Nothing is published until an admin approves it.
No prices, SKUs, stock, certifications or availability are generated.
"""
import sys, os, re, json, csv, html, shutil
import pymupdf
from PIL import Image

pdf, ex = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "data", "catalogue-import")
IMG = os.path.join(OUT, "images")
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(IMG)

AR = "ar_draft"          # Arabic names are drafts and need native-speaker review
LOW = "low_res"
items = []

def add(key, name, cat, page, image=None, ar=None, desc=None, specs=None, flags=None, note=None, extra_images=None):
    items.append(dict(key=key, batch="pdf", name_en=name, name_ar=ar, category_slug=cat, source_page=page, image=image,
                      extra_images=extra_images or [], description_en=desc, specs=specs or {},
                      flags=[LOW] + ([AR] if ar else []) + (flags or []), review_note=note))

# ── Pipes (page 4) ────────────────────────────────────────────────
add("pipe-cs-erw", "Carbon Steel Pipe — ERW", "pipes-carbon-steel", 4, "p04-04.jpg", "أنبوب صلب كربوني ملحوم (ERW)",
    "Carbon steel ERW pipe. Special grades available on request.",
    {"size": ['1/8" to 72" NB'], "schedule": ["40", "XS", "80", "120", "160", "XXS", "STD"],
     "grade": ["API 5L Grade B", "A671 Grade CC60 Class 12/22", "A671 Grade CC70 Class 12/22", "A312 Grade TP316", "A358"],
     "standard": ["ASTM A53", "ASTM A134", "ASTM A135", "ASTM A252", "API 5CT/5L", "DIN 1626", "ASTM A500"], "material": ["Carbon steel"]},
    ["verify_specs"], "Catalogue lists 'A 312 Grade TP316' among carbon steel grades — A312 is a stainless specification. Confirm the grade list.")
add("pipe-cs-smls", "Carbon Steel Pipe — Seamless", "pipes-carbon-steel", 4, "p04-03.jpg", "أنبوب صلب كربوني بدون لحام",
    "Seamless carbon steel pipe. Special grades available on request.",
    {"size": ['1/8" to 72" NB'], "schedule": ["40", "XS", "80", "120", "160", "XXS", "STD"],
     "grade": ["A106 Grade B", "A333 Grade 6", "API 5L Grade X52", "A312 Grade TP316"],
     "standard": ["ASTM A106", "API 5L", "ASTM A179", "ASTM A192", "ASTM A210", "ASTM A252", "ASTM A333", "ASTM A519"], "material": ["Carbon steel"],
     "brand": ["Sumitomo", "Chengdu", "Bentler", "Tubos", "Interpipe", "Mittal", "TMK", "TPCO", "Al-Jazeera", "SSP", "Hyundai", "JESCO"]},
    ["verify_specs"], "Confirm A312 TP316 in the carbon steel grade list, and that KANZ CORNER may state these as 'brands available'.")
add("pipe-ss", "Stainless Steel Pipe — SMLS / ERW", "pipes-stainless-steel", 4, "p04-01.jpg", "أنبوب ستانلس ستيل (بدون لحام / ملحوم)",
    "Seamless and ERW stainless steel pipe in the 200, 300 and 400 series.",
    {"size": ['1/4" up to 48"'], "schedule": ["10", "40", "80"],
     "grade": ["201", "202", "301", "302", "302HQ", "303", "304", "304L", "304F", "309", "310", "310S", "314", "314L", "316", "316L", "316Ti", "316F", "317", "317L", "321", "409L", "410", "410S", "416", "420", "420J1", "420JS", "430", "430F", "431"],
     "standard": ["ASTM A321", "ASTM A213", "ASTM A269"], "material": ["Stainless steel"]},
    ["verify_specs"], "Catalogue prints 'Schedule: 10,40,,80' (typo). 'ASTM A321' is not a pipe specification — A312/A269/A213 are; confirm the standard list.")
add("pipe-duplex", "Duplex Stainless Steel Pipe", "pipes-duplex", 4, "p04-06.jpg", "أنبوب ستانلس ستيل دوبلكس",
    "Duplex and super-duplex stainless steel pipe.",
    {"size": ['1/4" up to 48"'], "schedule": ["10", "40", "80"], "grade": ["UNS S31803", "UNS S32750", "UNS S32760", "UNS S32205", "F51", "UNS S32550"],
     "standard": ["ASTM A358", "ASTM A789 / ASME SA789", "ASTM A790 / ASME SA790"], "material": ["Duplex stainless steel"],
     "brand": ["Tubacex", "Sandvik", "Sanyo", "DEI", "Froch", "Ta Chen"]},
    ["verify_specs"], "Catalogue lists 'China' as a brand — removed from the brand list; add back only if it is a real brand name.")

# ── Pipe fittings (page 6) ────────────────────────────────────────
FIT_TYPES = "Catalogue header for this page lists: elbow 45°/90°, coupling, end cap, equal tee, flanges, reducer tee (threaded & welded), mechanical tee (threaded & welded), concentric & eccentric reducer (threaded & welded), reducer coupling. Confirm which apply to this family."
add("fit-ss", "Stainless Steel Fittings", "fittings-stainless", 6, "p06-03.jpg", "وصلات ستانلس ستيل", None, {"material": ["Stainless steel"]}, ["verify_specs"], FIT_TYPES)
add("fit-grooved", "Grooved Fittings", "grooved-fittings", 6, "p06-05.jpg", "وصلات مخددة", None, {}, ["verify_specs"], FIT_TYPES)
add("fit-forged", "Forged Steel Fittings (CS/SS)", "forged-fittings", 6, "p06-04.jpg", "وصلات صلب مطروق (كربوني / ستانلس)", None, {"material": ["Carbon steel", "Stainless steel"]}, ["verify_specs"], FIT_TYPES)
add("fit-cs", "Carbon Steel Fittings", "fittings-carbon", 6, "p06-02.jpg", "وصلات صلب كربوني", None, {"material": ["Carbon steel"]}, ["verify_specs"], FIT_TYPES)
add("fit-pvc", "PVC / CPVC / PPR Fittings", "plastic-fittings", 6, "p06-07.jpg", "وصلات PVC / CPVC / PPR", None, {}, ["verify_specs"], "One family covers three materials — split into separate products if they are sold separately. " + FIT_TYPES)
add("fit-hdpe", "HDPE Fittings", "fittings-hdpe", 6, "p06-06.jpg", "وصلات HDPE", None, {"material": ["HDPE"]}, ["verify_specs"], "Image identification (black fittings with brass parts) should be confirmed. " + FIT_TYPES)

# ── Flanges (page 7) ──────────────────────────────────────────────
for k, n, a, c, im in [("flg-blind", "Blind Flange", "فلنجة عمياء", "flanges-blind", "p07-01"), ("flg-sw", "Socket-Weld Flange", "فلنجة مقبس لحام", "flanges-socket-weld", "p07-02"),
    ("flg-wn", "Weld Neck Flange", "فلنجة رقبة لحام", "flanges-weld-neck", "p07-03"), ("flg-so", "Slip-On Flange", "فلنجة انزلاقية", "flanges-slip-on", "p07-04"),
    ("flg-th", "Threaded Flange", "فلنجة مسننة", "flanges-threaded", "p07-05"), ("flg-lj", "Lap-Joint Flange", "فلنجة لاب جوينت", "flanges-lap-joint", "p07-06"),
    ("flg-sb", "Spectacle Blind Flange", "فلنجة نظارة (سبكتكل بلايند)", "flanges-spectacle-blind", "p07-07"), ("flg-or", "Orifice Flange", "فلنجة فتحة قياس", "flanges-orifice", "p07-08")]:
    add(k, n, c, 7, im + ".jpg", a, None, {"type": [n.replace(" Flange", "")]}, [], "Pressure class, material and standard are not stated in the catalogue — add before publishing.")

# ── Valves (page 7) ───────────────────────────────────────────────
for k, n, a, c, im in [("vlv-bf", "Butterfly Valve", "صمام فراشة", "valves-butterfly", "p07-09"), ("vlv-gate", "Gate Valve", "صمام بوابة", "valves-gate", "p07-10"),
    ("vlv-globe", "Globe Valve", "صمام كروي (غلوب)", "valves-globe", "p07-11"), ("vlv-anghose", "Angle Hose Valve", "صمام زاوية للخراطيم", "valves-other", "p07-12"),
    ("vlv-angle", "Angle Valve", "صمام زاوية", "valves-other", "p07-17"), ("vlv-mud", "Flanged Mud Box", "صندوق طين بفلنجات", "valves-other", "p07-18"),
    ("vlv-dpc", "Dual Plate Check Valve", "صمام عدم رجوع ثنائي الصفيحة", "valves-check", "p07-13"), ("vlv-apg", "Angle Pattern Gate Valve", "صمام بوابة زاوية", "valves-gate", "p07-14"),
    ("vlv-check", "Check Valve", "صمام عدم رجوع", "valves-check", "p07-15"), ("vlv-sol", "Solenoid Valve", "صمام سولينويد", "valves-other", "p07-16"),
    ("vlv-storm", "Storm Valve", "صمام عواصف", "valves-other", "p07-19"), ("vlv-fgate", "Flanged Gate Valve", "صمام بوابة بفلنجات", "valves-gate", "p07-20")]:
    add(k, n, c, 7, im + ".jpg", a, None, {}, [], "Class, size range, material and brands are not stated in the catalogue for this valve — add before publishing.")

# ── Fasteners (page 8) ────────────────────────────────────────────
FASTENER_LIST = "Catalogue fastener list: Bolts, Screws, Nuts, Washers, Rivet, Carriage Bolt, Threaded Bolt, Anchor bolt, Nail, Hex Key, U-Bolt, Eye Bolt, Sheet Metal Screws, Coupling Nut, Set Screw, Acorn Nut, Flange Nut, Lock Nut. Washers, rivets, carriage bolts and sheet-metal screws have no photo — add as separate products if sold."
for k, n, a, c, im in [("fas-rod", "Threaded Rod / Stud Bolt", "سيخ مسنن", "fasteners-studs", "p08-01"), ("fas-anchor", "Anchor Bolt", "مسمار تثبيت (انكر)", "fasteners-anchors", "p08-02"),
    ("fas-cnut", "Coupling Nut", "صامولة وصل", "fasteners-nuts", "p08-03"), ("fas-assorted", "Bolts & Screws (assorted)", "مسامير وبراغي متنوعة", "fasteners-bolts", "p08-04"),
    ("fas-ubolt", "U-Bolt", "مسمار U", "fasteners-bolts", "p08-05"), ("fas-fnut", "Flange Nut", "صامولة بفلنجة", "fasteners-nuts", "p08-06"),
    ("fas-acorn", "Acorn Nut", "صامولة قبعة", "fasteners-nuts", "p08-07"), ("fas-eye", "Eye Bolt", "مسمار عين", "fasteners-bolts", "p08-08"),
    ("fas-nail", "Nail", "مسمار حديد", "fasteners", "p08-09"), ("fas-lock", "Lock Nut (nylon insert)", "صامولة قفل", "fasteners-nuts", "p08-10"),
    ("fas-hex", "Hex Key Set", "طقم مفاتيح سداسية", "fasteners", "p08-11"), ("fas-set", "Set Screw", "برغي تثبيت", "fasteners-bolts", "p08-12")]:
    add(k, n, c, 8, im + ".jpg", a, None, {}, [], FASTENER_LIST)

# ── Gaskets & gauges ─────────────────────────────────────────────
add("gsk", "Gaskets", "gaskets", 8, "p08-13.jpg", "جوانات",
    "Types: sheet gaskets, solid material gaskets, spiral-wound gaskets, double-jacketed gaskets, kammprofile gaskets, fishbone gaskets, flange gaskets, asbestos, non-asbestos, ring joint.",
    {"type": ["Sheet", "Solid material", "Spiral-wound", "Double-jacketed", "Kammprofile", "Fishbone", "Flange", "Asbestos", "Non-asbestos", "Ring joint"]},
    ["verify_specs"], "One family for all gasket types; split by type if sold separately. Asbestos gaskets are listed — check regulatory suitability before offering them online.",
    ["p08-15.jpg", "p08-16.jpg", "p08-14.jpg"])
add("gauges", "Gauges", "gauges", 9, "p09-13.jpg", "مقاييس", None, {}, ["foreign_branding", "verify_specs"],
    "The pressure-gauge photo shows a third-party brand name on the dial. Replace the image with your own product photo. Catalogue caption is spelled 'Guages'.",
    ["p09-12.jpg"])

# ── Other products (page 9) ──────────────────────────────────────
for k, n, a, c, im in [("oth-clamp", "Stainless Steel Repair Clamp", "مشبك إصلاح ستانلس ستيل", "other-clamps-adapters", "p09-01"), ("oth-adapter", "Flange Adapter", "وصلة فلنج (أدابتر)", "other-clamps-adapters", "p09-02"),
    ("oth-flex", "Flexible Connector", "وصلة مرنة", "other-connectors", "p09-03"), ("oth-tcrj", "Thread Connector Rubber Joint", "وصلة مطاطية مسننة", "other-connectors", "p09-05"),
    ("oth-plug", "Test Plug", "سدادة اختبار", "other-products", "p09-06"), ("oth-cam", "Cam Lock", "وصلة كام لوك", "other-connectors", "p09-04"),
    ("oth-brass", "Brass Pipe Fittings", "وصلات أنابيب نحاس أصفر", "other-brass-tube", "p09-07"), ("oth-tube", "Tube Fittings", "وصلات أنابيب (تيوب)", "other-brass-tube", "p09-08"),
    ("oth-sprk", "Automatic Sprinklers", "رشاشات أوتوماتيكية", "other-safety-fire", "p09-09"), ("oth-vent", "Automatic Air Vent", "فتحة هواء أوتوماتيكية", "other-safety-fire", "p09-10"),
    ("oth-nohub", "No Hub Coupling", "وصلة بدون هب", "other-clamps-adapters", "p09-11")]:
    add(k, n, c, 9, im + ".jpg", a, None, {}, ["foreign_branding"] if False else [], "Specifications are not stated in the catalogue — add before publishing.")

# ── Branding / non-product images found in the PDF (shown in the review screen, never imported) ──
flags_report = [
    dict(page=4, kind="foreign_branding", text="STABLE WAY TRADING logo (Arabic + English)", image="p04-07.jpg"),
    dict(page=4, kind="foreign_branding", text="BARAKAH VALVES TRADING + www.barakahvalves.com (text on page)"),
    dict(page=5, kind="foreign_branding", text="'TRADING COMPANY' header marks"),
    dict(page=9, kind="foreign_branding", text="STABLE WAY TRADING header marks; gauge photo shows a third-party dial brand"),
]

# ── Legacy batch: earlier extraction not present in the uploaded PDF ──
LEGACY_DIR = os.path.join(ROOT, "data")
COVERED = {"KC-FIT-CS": "fit-cs", "KC-FIT-SS": "fit-ss", "KC-FIT-GRV": "fit-grooved", "KC-FIT-HDPE": "fit-hdpe", "KC-FIT-PVC": "fit-pvc"}
SKIP_PREFIX = ("KC-FLG-", "KC-FAST-", "KC-GSK")           # fully covered by the uploaded PDF
CAT_MAP = {"Pipes > Copper Pipes &amp; Coils": "pipes-copper", "Pipes > HDPE Pipes": "pipes-hdpe", "Pipes > PVC, CPVC &amp; PPR Pipes": "pipes-pvc",
           "Pipes > Cast Iron Pipes": "pipes-cast-iron", "Pipe Fittings > Copper Fittings": "copper-fittings",
           "Pipe Fittings > Forged Fittings (Threaded)": "forged-threaded", "Pipe Fittings > Forged Fittings (Socket Weld)": "forged-socket-weld",
           "Valves > General Valves": "valves-other", "Valves > Instrument Valves": "valves-instrument", "Other Products": "other-products"}
KEYMAP = {"size": "size", "size range": "size", "schedule": "schedule", "grades": "grade", "grade": "grade", "standards": "standard", "standard": "standard",
          "spec": "standard", "brands": "brand", "material": "material", "class": "pressure_class", "pressure rating": "pressure_class", "connection": "end_type", "types": "type"}

def split_vals(v): return [x.strip() for x in re.split(r",|/(?=\s)", v) if x.strip()]
with open(os.path.join(LEGACY_DIR, "products-import.csv"), encoding="utf-8") as f:
    legacy = list(csv.DictReader(f))
by_key = {i["key"]: i for i in items}
os.makedirs(os.path.join(IMG, "legacy"), exist_ok=True)
for r in legacy:
    sku = r["SKU"]
    ref = f"Legacy reference {sku} (internal code from the earlier WordPress extraction — NOT a SKU)."
    lis = [html.unescape(x) for x in re.findall(r"<li>(.*?)</li>", r["Description"])]
    if sku in COVERED:
        tgt = by_key[COVERED[sku]]
        tgt["review_note"] = (tgt["review_note"] or "") + f"\n\nEarlier extraction ({sku}) listed: " + " | ".join(lis) + ". These details are NOT in the uploaded PDF — verify."
        continue
    if sku.startswith(SKIP_PREFIX): continue
    cat = r["Categories"]
    slug = CAT_MAP.get(cat) or ("gauges" if cat.startswith("Gauges") else None)
    if not slug: continue
    specs, rest = {}, []
    for li in lis:
        m = re.match(r"^([A-Za-z ]+):\s*(.+)$", li)
        if m and m.group(1).strip().lower() in KEYMAP:
            specs.setdefault(KEYMAP[m.group(1).strip().lower()], []).extend(split_vals(m.group(2)))
        else: rest.append(li)
    img = None
    src = os.path.join(LEGACY_DIR, "product-images", sku + ".jpg")
    if os.path.exists(src):
        shutil.copy(src, os.path.join(IMG, "legacy", sku + ".jpg")); img = f"legacy/{sku}.jpg"
    desc = html.unescape(r["Short description"]) + ((" " + "; ".join(rest) + ".") if rest else "")
    items.append(dict(key="legacy-" + sku.lower(), batch="legacy", name_en=html.unescape(r["Name"]), name_ar=None, category_slug=slug, source_page=None, image=img,
                      extra_images=[], description_en=desc, specs=specs, flags=["not_in_uploaded_pdf", "verify_specs", LOW], review_note=ref))

# ── copy referenced images, add pipe chart reference ──
refd = set()
for it in items:
    for im in [it["image"]] + it["extra_images"]:
        if im and not im.startswith("legacy/"): refd.add(im)
for im in sorted(refd): shutil.copy(os.path.join(ex, "images", im), os.path.join(IMG, im))
# unused crops (logos / branding) kept out of the import but listed for transparency
doc = pymupdf.open(pdf)
pix = doc[4].get_pixmap(dpi=140); pix.save(os.path.join(IMG, "pipe-chart.png"))
Image.open(os.path.join(IMG, "pipe-chart.png")).convert("RGB").save(os.path.join(IMG, "pipe-chart.jpg"), quality=85); os.remove(os.path.join(IMG, "pipe-chart.png"))
for it in items:
    if it["key"].startswith("pipe-"): it["document"] = dict(title="Nominal wall thickness schedule (catalogue page 5)", image="pipe-chart.jpg")
if os.path.exists(os.path.join(ex, "images", "p04-07.jpg")): shutil.copy(os.path.join(ex, "images", "p04-07.jpg"), os.path.join(IMG, "flag-stable-way-logo.jpg"))
flags_report[0]["image"] = "flag-stable-way-logo.jpg"

json.dump(dict(source="kanz-CATALOGE.pdf (10 pages) + earlier WordPress extraction", generated_by="scripts/build_import.py",
               items=items, branding_flags=flags_report), open(os.path.join(OUT, "import.json"), "w"), indent=1, ensure_ascii=False)
print(f"{sum(i['batch']=='pdf' for i in items)} items from PDF, {sum(i['batch']=='legacy' for i in items)} legacy items, {len(refd)} images")
