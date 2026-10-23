/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> is not an HTML img */
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { C, date, logoDataUri, money, styles as s, t } from "./shared";

export function InvoicePdf({ invoice, order, items }: { invoice: Record<string, any>; order: Record<string, any>; items: Record<string, any>[] }) {
  const logo = logoDataUri(); const sel = invoice.seller_snapshot ?? {}; const buy = invoice.buyer_snapshot ?? {};
  const addr = buy.address ? [buy.address.line1, buy.address.line2, buy.address.city, buy.address.region, buy.address.postal_code].filter(Boolean).join(", ") : "";
  return (
    <Document title={`Invoice ${invoice.invoice_number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>{logo && <Image src={logo} style={s.logo} />}<View><Text style={s.company}>{t(sel.company_name_en ?? "KANZ CORNER EST.")}</Text><Text style={s.small}>{t(sel.company_address_en)}</Text><Text style={s.small}>{t(sel.company_phone)} · {t(sel.company_email_sales)}</Text>
            <Text style={s.small}>VAT No: {t(sel.vat_number) || "—"}{sel.company_cr_number ? `   CR: ${t(sel.company_cr_number)}` : ""}</Text></View></View>
          <View><Text style={s.title}>VAT INVOICE</Text><Text style={s.meta}>Invoice No: {t(invoice.invoice_number)}{"\n"}Date: {date(invoice.issued_at)}{"\n"}Order: {t(order.order_number)}</Text></View>
        </View>
        <View style={s.row2}>
          <View style={s.box}><Text style={s.boxTitle}>Bill to</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{t(buy.name)}</Text>{buy.contact && buy.contact !== buy.name ? <Text>{t(buy.contact)}</Text> : null}<Text style={s.small}>{t(buy.email)}</Text>{buy.vat_number ? <Text style={s.small}>VAT No: {t(buy.vat_number)}</Text> : null}{addr ? <Text style={s.small}>{t(addr)}</Text> : null}</View>
          <View style={s.box}><Text style={s.boxTitle}>Payment</Text><Text>Status: {t(order.payment_status)}</Text><Text>Method: {t(String(order.payment_method).replace(/_/g, " "))}</Text><Text>Delivery: {t(order.delivery_method)}</Text></View>
        </View>
        <View style={s.th}><Text style={{ width: 22 }}>#</Text><Text style={{ flex: 1 }}>Description</Text><Text style={{ width: 44, ...s.right }}>Qty</Text><Text style={{ width: 66, ...s.right }}>Unit price</Text><Text style={{ width: 40, ...s.right }}>VAT %</Text><Text style={{ width: 70, ...s.right }}>Amount (SAR)</Text></View>
        {items.map((i, n) => (
          <View key={i.id} style={s.tr} wrap={false}><Text style={{ width: 22 }}>{n + 1}</Text><View style={{ flex: 1 }}><Text>{t(i.name_en)}</Text>{(i.sku || i.spec_summary) ? <Text style={s.small}>{t([i.sku, i.spec_summary].filter(Boolean).join(" · "))}</Text> : null}</View>
            <Text style={{ width: 44, ...s.right }}>{Number(i.quantity)}</Text><Text style={{ width: 66, ...s.right }}>{money(i.unit_price)}</Text><Text style={{ width: 40, ...s.right }}>{Number(invoice.vat_rate)}</Text><Text style={{ width: 70, ...s.right }}>{money(i.line_total)}</Text></View>))}
        <View style={s.totals} wrap={false}>
          {Number(order.shipping_total) > 0 && <View style={s.totRow}><Text>Shipping</Text><Text>{money(order.shipping_total)}</Text></View>}
          <View style={s.totRow}><Text>Taxable amount</Text><Text>{money(invoice.subtotal)}</Text></View>
          <View style={s.totRow}><Text>VAT ({Number(invoice.vat_rate)}%)</Text><Text>{money(invoice.vat_total)}</Text></View>
          <View style={s.grand}><Text>Total (SAR)</Text><Text>{money(invoice.grand_total)}</Text></View>
        </View>
        <Text style={{ marginTop: 16, fontSize: 7.5, color: C.grey }}>Amounts in Saudi Riyals (SAR).</Text>
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${t(sel.company_name_en ?? "KANZ CORNER EST.")} · Invoice ${t(invoice.invoice_number)} · Page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
}
