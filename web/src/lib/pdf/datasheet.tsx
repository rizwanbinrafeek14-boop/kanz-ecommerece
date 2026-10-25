/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> is not an HTML img */
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { C, date, logoDataUri, styles as s, t } from "./shared";

export interface DatasheetData {
  company: { name: string; phone: string; email: string; site: string };
  product: { name: string; manufacturer: string | null; ref: string | null; family: string | null; url: string; sourceTitle: string | null; pages: number[] };
  variant: { sku: string; label: string; code: string | null; weight: number | null } | null;
  specs: [string, string][];
  standards: { code: string; scope: string }[]; materials: { type: string; grades: string[] }[]; notes: string[];
  image: string | null;
  tables: { title: string; drawing: string | null; matchKeys: string[]; columns: { key: string; label: string; unit: string | null }[]; rows: { match: string[]; values: string[]; selected: boolean }[]; notes: string[]; page: number | null }[];
}

/** Datasheet generated only from approved, published product data. English only (built-in PDF fonts). */
export function DatasheetPdf({ d }: { d: DatasheetData }) {
  const logo = logoDataUri();
  return (
    <Document title={`${d.product.name} datasheet`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>{logo && <Image src={logo} style={s.logo} />}<View><Text style={s.company}>{t(d.company.name)}</Text><Text style={s.small}>{t(d.company.phone)} · {t(d.company.email)} · {t(d.company.site)}</Text></View></View>
          <View><Text style={s.title}>PRODUCT DATASHEET</Text><Text style={s.meta}>Generated {date(new Date().toISOString())}</Text></View>
        </View>
        <View style={{ flexDirection: "row", gap: 14, marginBottom: 12 }}>
          {d.image && <Image src={d.image} style={{ width: 110, height: 110, objectFit: "contain", borderWidth: 1, borderColor: C.line }} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: C.ink }}>{t(d.product.name)}</Text>
            {d.product.manufacturer && <Text style={{ marginTop: 3 }}>Manufacturer: {t(d.product.manufacturer)}{d.product.ref ? `   Ref: ${t(d.product.ref)}` : ""}</Text>}
            {d.product.family && <Text style={s.small}>Product family: {t(d.product.family)}</Text>}
            {d.variant && <View style={{ marginTop: 8, padding: 6, backgroundColor: C.soft }}><Text style={{ fontFamily: "Helvetica-Bold" }}>Selected: {t(d.variant.label)}</Text><Text style={s.small}>SKU {t(d.variant.sku)}{d.variant.code ? ` · Manufacturer code ${t(d.variant.code)}` : ""}{d.variant.weight != null ? ` · Weight ${d.variant.weight} kg (as published)` : ""}</Text></View>}
          </View>
        </View>
        {d.specs.length > 0 && <View style={{ marginBottom: 10 }}><Text style={s.boxTitle}>Specifications</Text>{d.specs.map(([k, v], i) => <View key={i} style={{ flexDirection: "row", borderBottomWidth: 0.5, borderColor: C.line, paddingVertical: 2.5 }}><Text style={{ width: 150, fontFamily: "Helvetica-Bold" }}>{t(k)}</Text><Text style={{ flex: 1 }}>{t(v)}</Text></View>)}</View>}
        {(d.standards.length > 0 || d.materials.length > 0) && <View style={{ marginBottom: 10 }}><Text style={s.boxTitle}>Materials & standards</Text>
          {d.materials.map((m, i) => <Text key={`m${i}`}>{t(m.type)}{m.grades.length ? `: ${t(m.grades.join(", "))}` : " (grades not listed in the catalogue)"}</Text>)}
          {d.standards.map((x, i) => <Text key={`s${i}`}>{t(x.code)} — {x.scope === "product" ? "for this product" : "mentioned generally in the catalogue"}</Text>)}</View>}
        {d.tables.map((tb, ti) => (
          <View key={ti} style={{ marginBottom: 12 }} wrap>
            <Text style={s.boxTitle}>{t(tb.title)}</Text>
            {tb.drawing && <Image src={tb.drawing} style={{ maxHeight: 170, objectFit: "contain", marginBottom: 6 }} />}
            <View style={s.th}>{tb.matchKeys.map((k) => <Text key={k} style={{ width: 52 }}>{t(k.replace(/_/g, " "))}</Text>)}{tb.columns.map((c) => <Text key={c.key} style={{ flex: 1, ...s.right }}>{t(c.key)}{c.unit ? ` (${t(c.unit)})` : ""}</Text>)}</View>
            {tb.rows.map((r, ri) => <View key={ri} style={{ ...s.tr, ...(r.selected ? { backgroundColor: "#FBEAEA" } : {}) }} wrap={false}>{r.match.map((m, mi) => <Text key={mi} style={{ width: 52, fontFamily: r.selected ? "Helvetica-Bold" : "Helvetica" }}>{t(m)}</Text>)}{r.values.map((v, vi) => <Text key={vi} style={{ flex: 1, ...s.right, fontFamily: r.selected ? "Helvetica-Bold" : "Helvetica" }}>{t(v)}</Text>)}</View>)}
            <Text style={{ ...s.small, marginTop: 3 }}>{tb.columns.map((c) => `${t(c.key)} = ${t(c.label)}`).join("   ")}</Text>
            {tb.notes.map((n, i) => <Text key={i} style={s.small}>{i + 1}. {t(n)}</Text>)}
          </View>))}
        {d.notes.length > 0 && <View style={{ marginBottom: 10 }}><Text style={s.boxTitle}>Catalogue notes</Text>{d.notes.map((n, i) => <Text key={i} style={s.small}>• {t(n)}</Text>)}</View>}
        <Text style={{ marginTop: 10, fontSize: 7.5, color: C.grey }}>
          Data as published by the manufacturer{d.product.pages.length ? ` (catalogue page ${d.product.pages.join(", ")})` : ""}. This datasheet is generated by {t(d.company.name)} for information only; it is not a certified document. Confirm the exact specification, standard and material certification in your request for quotation. {t(d.product.url)}
        </Text>
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${t(d.company.name)} · ${t(d.product.name)} · Page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
}
