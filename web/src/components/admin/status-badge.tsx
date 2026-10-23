import { Badge } from "@/components/ui/badge";
const V: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "info"> = {
  submitted: "warning", under_review: "info", quoted: "info", accepted: "success", rejected: "destructive", expired: "secondary", converted: "success", cancelled: "secondary",
  pending: "warning", confirmed: "info", processing: "info", ready_for_pickup: "info", shipped: "info", delivered: "success", completed: "success", refunded: "destructive",
  unpaid: "warning", paid: "success", partially_paid: "warning", failed: "destructive",
};
export function StatusBadge({ status }: { status: string }) { return <Badge variant={V[status] ?? "secondary"}>{status.replace(/_/g, " ")}</Badge>; }
