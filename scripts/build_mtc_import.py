#!/usr/bin/env python3
"""
Build web/data/catalogue-import/import-mtc.json from a supplier mill-test-certificate (MTC) bundle for grooved fittings.

  python3 scripts/build_mtc_import.py "Kanz_Corner_MTC_-_26-1095.pdf"

What it takes from the MTC: which fitting TYPES and SIZES were supplied and on which pages they appear.
What it deliberately does NOT take: lot codes, test values, heat numbers, the manufacturer's name, prices, SKUs or stock.
The MTC PDF itself is NOT copied into the repository (the repo is public); staff upload it privately in the admin.
Sizes were checked against the page images by eye where the scan's text layer was garbled (see MANUAL_FIXES).
"""
import json, os, re, subprocess, sys, collections

pdf = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "web", "data", "catalogue-import", "import-mtc.json")

# Product families. key -> (English name, Arabic draft name, category, sizes as printed on the MTCs)
HALF = "½"
FAM = {
 "elbow90s": ("Grooved 90° Elbow — Short", "كوع مخدد 90 درجة (قصير)", ['2½"','4"','5"','6"','8"','10"','12"']),
 "elbow90l": ("Grooved 90° Elbow — Long", "كوع مخدد 90 درجة (طويل)", ['2"','2½"','3"','4"','6"','8"']),
 "elbow45":  ("Grooved 45° Elbow — Short", "كوع مخدد 45 درجة (قصير)", ['2½"','3"','4"','6"','8"','12"']),
 "elbow225": ("Grooved 22.5° Elbow — Short", "كوع مخدد 22.5 درجة", ['2½"','4"','6"']),
 "elbow1125":("Grooved 11.25° Elbow — Short", "كوع مخدد 11.25 درجة", ['2½"','4"','6"']),
 "teel":     ("Grooved Equal Tee — Long", "تيه مخدد متساوي (طويل)", ['2½"','3"','4"','6"','8"']),
 "tees":     ("Grooved Equal Tee — Short", "تيه مخدد متساوي (قصير)", ['2½"','6"','12"']),
 "cross":    ("Grooved Cross Tee", "تيه صليب مخدد", ['2½"']),
 "cap":      ("Grooved End Cap", "غطاء نهاية مخدد", ['2½"','3"','4"','6"','8"','12"']),
 "redg":     ("Concentric Grooved Reducer", "مخفض مخدد متحد المركز", ['3"×2½"','4"×2½"','4"×3"','6"×2½"','6"×3"','6"×4"','8"×3"','8"×6"','10"×8"','12"×8"','12"×10"']),
 "redt":     ("Concentric Threaded Reducer", "مخفض مسنن متحد المركز", ['2"×1½"','2½"×1"','2½"×1¼"','2½"×1½"','2½"×2"','3"×1"','3"×1¼"','3"×1½"','3"×2"','4"×1"','4"×1½"','4"×2"','6"×1¼"','6"×1½"','6"×2"']),
 "teerg":    ("Grooved Reducing Tee", "تيه مخدد مخفض", ['3"×2½"','4"×2½"','4"×3"','6"×2½"','6"×3"','6"×4"','8"×6"','10"×4"','10"×6"','12"×4"','12"×6"','12"×8"']),
 "teert":    ("Threaded Reducing Tee", "تيه مسنن مخفض", ['2½"×1"','2½"×1¼"','2½"×1½"','2½"×2"','3"×1"','3"×1¼"','3"×1½"','3"×2"','4"×1"','4"×1¼"','4"×1½"','4"×2"','6"×2"']),
 "mechg":    ("Grooved Mechanical Tee", "تيه ميكانيكي مخدد", ['4"×2½"','4"×3"','6"×2½"','6"×3"','8"×2½"']),
 "secht":    ("Threaded Mechanical Tee", "تيه ميكانيكي بمخرج مسنن", ['2½"×1"','2½"×1¼"','2½"×1½"','3"×1"','3"×1¼"','3"×1½"','3"×2"','4"×1"','4"×1¼"','4"×1½"','4"×2"','6"×1"','6"×1¼"','6"×1½"','6"×2"','8"×2"']),
 "ubolt":    ("U-Bolt Mechanical Tee", "تيه ميكانيكي بمسمار U", ['1½"×½"']),
 "rigid":    ("Rigid Coupling", "وصلة تخديد صلبة", ['2½"','3"','4"','5"','6"','8"','10"','12"']),
 "flex":     ("Flexible Coupling", "وصلة تخديد مرنة", ['2½"','3"','4"','6"']),
 "redcpl":   ("Reducing Coupling (Grooved)", "وصلة تخديد مخفضة", ['2½"×2"','4"×3"','6"×4"']),
 "gfl150":   ("Grooved Flange — Class 150", "فلنجة مخددة فئة 150", ['2"','2½"','3"','4"','6"','8"','10"']),
 "gflpn16":  ("Grooved Flange — PN16", "فلنجة مخددة PN16", ['2"','2½"','3"','4"','8"']),
 "fad150":   ("Flange Adaptor — Class 150", "وصلة فلنج (أدابتر) فئة 150", ['2"','2½"','3"','4"','6"','8"','10"','12"']),
 "fadpn16":  ("Flange Adaptor — PN16", "وصلة فلنج (أدابتر) PN16", ['2½"','3"','4"','6"','8"']),
}
NOTES = {"rigid": 'A hot-dip galvanised ("HDG") 6" rigid coupling also appears on the certificates.'}

def classify(name):
    n = re.sub(r"[^A-Z0-9. ]", " ", name.upper()); n = re.sub(r"\s+", " ", n).replace("RRHREAD", "THREAD")
    has = lambda *w: all(x in n for x in w)
    if "U BOLT" in n or "UBOLT" in n: return "ubolt"
    if "MECH" in n or "MECI" in n: return "secht" if "HREAD" in n else "mechg"
    if "REDUC" in n and "COUPL" in n: return "redcpl"
    if "REDUC" in n and "TEE" in n: return "teert" if "HREAD" in n else "teerg"
    if "REDUC" in n: return "redt" if ("HREAD" in n or "THREA" in n) else "redg"
    if "RIGID" in n or "RIGII" in n: return "rigid"
    if "FLEX" in n: return "flex"
    if "ADAPT" in n: return "fadpn16" if "PN" in n else "fad150"
    if "FLANGE" in n or "FLA " in n: return "gflpn16" if "PN" in n else "gfl150"
    if "CROSS" in n: return "cross"
    if "END CAP" in n: return "cap"
    if "EQUAL" in n: return "teel" if "LONG" in n else "tees"
    if "ELBOW" in n or "DEG" in n:
        if "11.25" in n: return "elbow1125"
        if "22.5" in n: return "elbow225"
        if re.search(r"\b45\b", n): return "elbow45"
        if re.search(r"\b90\b", n): return "elbow90l" if "LONG" in n else "elbow90s"
    return None

# Page 5 uses a different table layout and a poorer scan; read by eye from the page image.
PAGE5 = ["rigid", "flex", "redcpl", "mechg"]
# Rows whose description was unreadable in the text layer; identified from the page image.
MANUAL_FIXES = {7: ["redt"], 10: ["redt"]}

pages = collections.defaultdict(set); unclassified = []; rows = 0
for p in range(1, 23):
    txt = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), pdf, "-"], capture_output=True, text=True).stdout
    if p == 5:
        for k in PAGE5: pages[k].add(p)
        continue
    for line in txt.splitlines():
        if "psi" not in line.lower(): continue
        rows += 1
        name = re.split(r"\s{2,}", line.strip())[0]
        k = classify(name)
        if k: pages[k].add(p)
        else: unclassified.append((p, line.strip()[:90]))
for p, ks in MANUAL_FIXES.items():
    for k in ks: pages[k].add(p)
print(f"{rows} certificate rows scanned; {len(unclassified)} not auto-classified:")
for u in unclassified: print("  ", u)
missing = [k for k in FAM if k not in pages]
assert not missing, f"no pages found for {missing}"

SPEC = {
 "material": ["Ductile iron ASTM A536 (65-45-12)", "EPDM gasket (ASTM D2000, per MTC)"],
 "standard": ["AWWA-606 for grooved & threaded (as stated on MTC)", "ASTM A449 / A183 bolts & nuts (as stated on MTC)"],
 "pressure_class": ["300 psi (as stated on MTC)"],
}
items = []
for key, (en, ar, sizes) in FAM.items():
    pg = sorted(pages[key]); pgs = ", ".join(map(str, pg))
    specs = {**SPEC, "size": sizes, "end_type": ["Grooved" + (" × threaded outlet" if key in ("redt", "teert", "secht") else "")]}
    items.append(dict(
        key="mtc-" + key, batch="mtc", name_en=en, name_ar=ar, category_slug="grooved-fittings", source_page=None, image=None, extra_images=[],
        description_en=f"Ductile iron grooved pipe fitting. Sizes listed are those that appear on the supplier mill test certificates supplied to KANZ CORNER; other sizes may be available on request.{(' ' + NOTES[key]) if key in NOTES else ''}",
        specs=specs, flags=["no_image", "verify_specs", "ar_draft"],
        review_note=("Created from supplier mill test certificates (MTC bundle 26-1095), not from the catalogue.\n"
                     f"• Sizes = sizes seen on the MTC pages ({pgs}). They are sizes that were SUPPLIED, not necessarily everything you stock — add or remove as needed.\n"
                     "• The MTC prints 300 psi under different headings ('Working Pressure' on some pages, 'Hydro Test Max. Pressure' on others). Confirm the rated working pressure with the supplier before publishing.\n"
                     "• 'AWWA-606' is printed on the MTC; the usual designation is AWWA C606. Confirm wording.\n"
                     "• The manufacturer named on the MTC is NOT used as a brand or shown on the website.\n"
                     "• No photo: upload a real photo of this fitting. No price, SKU or stock has been created."),
        mtc=dict(title=f"Supplier MTC bundle 26-1095 — relevant pages: {pgs}", pages=pg)))
json.dump(dict(source="Supplier MTC bundle 26-1095 (grooved fittings)", generated_by="scripts/build_mtc_import.py", items=items), open(OUT, "w"), indent=1, ensure_ascii=False)
print(f"wrote {OUT}: {len(items)} product families")
for i in items: print(f"  {i['name_en']:<36} {len(i['specs']['size']):>2} sizes  pages {i['mtc']['pages']}")
