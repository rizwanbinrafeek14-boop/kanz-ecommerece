"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Layers, Gem, LayoutDashboard, Package, FolderTree, Tags, SlidersHorizontal, Warehouse, Image as ImageIcon, FileText, ShoppingBag, Users, PenSquare, MessageCircle, BookOpen, BadgeCheck, BarChart3, ScanSearch, UserCog, LogOut, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS: { label: string; items: { href: string; label: string; icon: React.ElementType; admin?: boolean }[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }, { href: "/admin/reports", label: "Reports", icon: BarChart3 }] },
  { label: "Catalogue", items: [
    { href: "/admin/import", label: "Import review", icon: ScanSearch }, { href: "/admin/catalogue", label: "Catalogue import", icon: BookOpen }, { href: "/admin/products", label: "Products", icon: Package }, { href: "/admin/products/images", label: "Product images", icon: Images }, { href: "/admin/families", label: "Product families", icon: Layers }, { href: "/admin/materials", label: "Materials", icon: Gem },
    { href: "/admin/categories", label: "Categories", icon: FolderTree }, { href: "/admin/brands", label: "Brands", icon: Tags }, { href: "/admin/attributes", label: "Attributes", icon: SlidersHorizontal }, { href: "/admin/certifications", label: "Certifications", icon: BadgeCheck, admin: true },
  ] },
  { label: "Operations", items: [
    { href: "/admin/inventory", label: "Inventory", icon: Warehouse }, { href: "/admin/rfqs", label: "Quotations (RFQ)", icon: FileText },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag }, { href: "/admin/customers", label: "Customers", icon: Users },
  ] },
  { label: "Website", items: [{ href: "/admin/banners", label: "Banners", icon: ImageIcon }, { href: "/admin/content", label: "Content & settings", icon: PenSquare }, { href: "/admin/social", label: "Social & contact", icon: MessageCircle }] },
  { label: "System", items: [{ href: "/admin/users", label: "Staff & roles", icon: UserCog, admin: true }] },
];
const ALL_HREFS = GROUPS.flatMap((g) => g.items.map((x) => x.href));


export function AdminNav({ role, signOut }: { role: string; signOut: () => Promise<void> }) {
  const path = usePathname();
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto p-3 text-sm" aria-label="Admin">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.admin || role === "admin");
        if (!items.length) return null;
        return (
          <div key={g.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/60">{g.label}</p>
            {items.map(({ href, label, icon: Icon }) => {
              // the most specific item wins (Product images inside Products)
              const active = href === "/admin" ? path === "/admin" : path.startsWith(href) && !ALL_HREFS.some((h) => h.length > href.length && h.startsWith(href) && path.startsWith(h));
              return (
                <Link key={href} href={href} className={cn("flex items-center gap-2.5 rounded-md px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white", active && "bg-primary text-white hover:bg-primary")}>
                  <Icon className="size-4" />{label}
                </Link>
              );
            })}
          </div>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-white/10 pt-3">
        <a href="/en" target="_blank" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white"><ExternalLink className="size-4" />View storefront</a>
        <form action={signOut}><button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-white/75 hover:bg-white/10 hover:text-white"><LogOut className="size-4" />Sign out</button></form>
      </div>
    </nav>
  );
}
