import fs from "node:fs";
import path from "node:path";
import { StyleSheet } from "@react-pdf/renderer";

export const C = { red: "#A6242E", ink: "#0D0E16", grey: "#5D636D", line: "#E3E5E9", soft: "#F4F5F6" };
export const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: C.ink },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: C.red, paddingBottom: 12, marginBottom: 14 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 46, height: 36, objectFit: "contain" },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: C.grey, lineHeight: 1.4 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.red, textAlign: "right" },
  meta: { fontSize: 9, textAlign: "right", lineHeight: 1.5 },
  box: { borderWidth: 1, borderColor: C.line, borderRadius: 3, padding: 8, flex: 1 },
  boxTitle: { fontSize: 8, color: C.grey, textTransform: "uppercase", marginBottom: 3, fontFamily: "Helvetica-Bold" },
  row2: { flexDirection: "row", gap: 10, marginBottom: 12 },
  th: { flexDirection: "row", backgroundColor: C.ink, color: "#fff", paddingVertical: 5, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5, paddingHorizontal: 4 },
  right: { textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 220, marginTop: 10 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderTopWidth: 1.5, borderTopColor: C.ink, marginTop: 3, fontFamily: "Helvetica-Bold", fontSize: 11 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, textAlign: "center", fontSize: 7, color: C.grey, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 5 },
});

export function logoDataUri(): string | undefined {
  try { return `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), "public", "brand", "logo-icon.png")).toString("base64")}`; } catch { return undefined; }
}
/** The built-in PDF fonts only cover Latin text, so replace characters outside Latin-1 (e.g. Arabic) instead of printing garbage. */
export const t = (v: unknown) => String(v ?? "").replace(/[^ -~ -ÿ–—‘’“”•€]/g, "?");
export const money = (n: unknown) => Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const date = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }) : "—");
