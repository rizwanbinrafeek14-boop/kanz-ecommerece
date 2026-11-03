/** The data-quality checks (sev 1 = fix first, 2 = should fix, 3 = nice to have; same as the SQL) (computed by admin_data_quality() in migration 0025). Shared by the page and the dashboard. */
export const DQ_CHECKS = {
  unpriced: { sev: 1, label: "Can be bought, but has no price", hint: "Published and not quote-only, with no price on the product or any size. Add prices or switch it to quote-only.", tab: "pricing" },
  no_category: { sev: 1, label: "No category", hint: "Cannot be found by browsing the menu.", tab: "general" },
  no_photo: { sev: 2, label: "No image", hint: "A placeholder drawing is shown.", tab: "images" },
  no_name_ar: { sev: 2, label: "No Arabic name", hint: "Arabic visitors see the English name.", tab: "general" },
  thin_text: { sev: 2, label: "Little or no description", hint: "Under 40 characters of description; weak for buyers and search engines.", tab: "general" },
  temp_photo: { sev: 3, label: "Temporary catalogue image", hint: "Only a catalogue crop or drawing; replace with a real photo when available.", tab: "images" },
  no_brand: { sev: 3, label: "No brand", hint: "Manufacturer not set.", tab: "general" },
  materials: { sev: 3, label: "Materials to review", hint: "Detected materials are waiting for approval and are not shown publicly.", tab: "materials" },
  old_draft: { sev: 3, label: "Draft untouched for 30 days", hint: "Publish, finish or archive it.", tab: "general" },
} as const;
export type DqCheck = keyof typeof DQ_CHECKS;
export const isDqCheck = (c: string | undefined): c is DqCheck => !!c && c in DQ_CHECKS;
