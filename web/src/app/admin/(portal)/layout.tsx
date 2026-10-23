import Image from "next/image";
import { Menu } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { adminSignOut } from "../login/actions";
import { AdminNav } from "@/components/admin/nav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();   // server-side gate for every admin page
  const brand = (
    <div className="flex items-center gap-2.5 border-b border-white/10 p-4">
      <Image src="/brand/logo-icon.png" alt="" width={40} height={32} className="h-8 w-auto" />
      <span className="font-bold tracking-wide text-white">KANZ Admin</span>
    </div>
  );
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-ink lg:flex">{brand}<AdminNav role={user.role} signOut={adminSignOut} /></aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-4 py-3">
          <Sheet>
            <SheetTrigger className="lg:hidden" aria-label="Menu"><Menu className="size-6" /></SheetTrigger>
            <SheetContent side="start" className="bg-ink"><SheetTitle className="sr-only">Menu</SheetTitle>{brand}<AdminNav role={user.role} signOut={adminSignOut} /></SheetContent>
          </Sheet>
          <div className="ms-auto flex items-center gap-3 text-sm"><span className="text-muted-foreground">{user.fullName ?? user.email}</span><Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge></div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
