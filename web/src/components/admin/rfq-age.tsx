import { ageHours } from "@/lib/admin/rfq-list";

/** "3 h", "2 d": how long a request has waited; open ones amber after a day, red after two. */
export function RfqAge({ createdAt, open, now }: { createdAt: string; open: boolean; now: number }) {
  const h = ageHours(createdAt, now); const label = h < 1 ? "< 1 h" : h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} d`;
  if (!open) return <span className="text-muted-foreground">{label}</span>;
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${h >= 48 ? "bg-red-100 text-red-800" : h >= 24 ? "bg-amber-100 text-amber-900" : "bg-muted"}`} title="Waiting for a quotation">{label}</span>;
}
