import type { Metadata } from "next";
import "../globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · KANZ Admin" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-muted/40 text-foreground">{children}<Toaster /></body>
    </html>
  );
}
