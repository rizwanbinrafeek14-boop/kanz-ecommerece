/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> is not an HTML img */
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { C, date, logoDataUri, money, styles as s, t } from "./shared";

export interface QuoteData {
  rfq: Record<string, any>; items: Record<string, any>[]; company: { name: string; address: string; phone: string; email: string; vat: string; cr: string };
}
export function QuotationPdf({ rfq, items, company }: QuoteData) {
  const logo = logoDataUri();
  const w = [22, 0, 48, 36, 62, 66];
  return (
    <Document title={`Quotation ${rfq.rfq_number}`} author={company.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>{logo && <Image src={logo} style={s.logo} />}<View><Text style={s.company}>{t(company.name)}</Text><Text style={s.small}>{t(company.address)}</Text><Text style={s.small}>{t(company.phone)} · {t(company.email)}</Text>{company.vat ? <Text style={s.small}>VAT No: {t(company.vat)}{company.cr ? `   CR: ${t(company.cr)}` : ""}</Text> : null}</View></View>
          <View><Text style={s.title}>QUOTATION</Text><Text style={s.meta}>No: {t(rfq.rfq_number)}{"\n"}Date: {date(rfq.quoted_at ?? rfq.created_at)}{"\n"}Valid until: {date(rfq.quote_valid_until)}</Text></View>
        </View>
        <View style={s.row2}>
          <View style={s.box}><Text style={s.boxTitle}>Prepared for</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{t(rfq.company_name || rfq.contact_name)}</Text>{rfq.company_name ? <Text>{t(rfq.contact_name)}</Text> : null}<Text style={s.small}>{t(rfq.contact_email)}{rfq.contact_phone ? ` · ${t(rfq.contact_phone)}` : ""}</Text>{rfq.vat_number ? <Text style={s.small}>VAT No: {t(rfq.vat_number)}</Text> : null}</View>
          <View style={s.box}><Text style={s.boxTitle}>Terms</Text><Text>Lead time: {t(rfq.lead_time) || "—"}</Text><Text>Payment: {t(rfq.payment_terms) || "—"}</Text><Text>Delivery: {t(rfq.delivery_terms) || t(rfq.delivery_city) || "—"}</Text></View>
        </View>
        <View style={s.th}><Text style={{ width: w[0] }}>#</Text><Text style={{ flex: 1 }}>Description</Text><Text style={{ width: w[2], ...s.right }}>Qty</Text><Text style={{ width: w[3], paddingLeft: 8 }}>Unit</Text><Text style={{ width: w[4], ...s.right }}>Unit price</Text><Text style={{ width: w[5], ...s.right }}>Amount (SAR)</Text></View>
        {items.map((i) => (
          <View key={i.id} style={s.tr} wrap={false}>
            <Text style={{ width: w[0] }}>{i.line_no}</Text>
            <View style={{ flex: 1 }}><Text>{t(i.description)}</Text>{i.specification ? <Text style={s.small}>{t(i.specification)}</Text> : null}{i.quoted_lead_time ? <Text style={s.small}>Lead time: {t(i.quoted_lead_time)}</Text> : null}</View>
            <Text style={{ width: w[2], ...s.right }}>{Number(i.quantity)}</Text><Text style={{ width: w[3], paddingLeft: 8 }}>{t(i.unit)}</Text>
            <Text style={{ width: w[4], ...s.right }}>{i.quoted_unit_price != null ? money(i.quoted_unit_price) : "—"}</Text>
            <Text style={{ width: w[5], ...s.right }}>{i.quoted_unit_price != null ? money(Number(i.quoted_unit_price) * Number(i.quantity)) : "—"}</Text>
          </View>))}
        <View style={s.totals} wrap={false}>
          <View style={s.totRow}><Text>Subtotal (excl. VAT)</Text><Text>{money(rfq.quoted_subtotal)}</Text></View>
          <View style={s.totRow}><Text>VAT ({Number(rfq.vat_rate ?? 15)}%)</Text><Text>{money(rfq.quoted_vat)}</Text></View>
          <View style={s.grand}><Text>Total (SAR)</Text><Text>{money(rfq.quoted_total)}</Text></View>
        </View>
        {rfq.quote_notes ? <View style={{ marginTop: 14 }}><Text style={s.boxTitle}>Notes</Text><Text style={{ lineHeight: 1.4 }}>{t(rfq.quote_notes)}</Text></View> : null}
        <Text style={{ marginTop: 14, fontSize: 8, color: C.grey }}>Prices are in Saudi Riyals. This quotation is valid until the date shown and is subject to stock availability and our standard terms.</Text>
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${t(company.name)} · ${t(company.email)} · Page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
}
