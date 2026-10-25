import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireSignedIn } from "@/lib/customer-gate";
import { publicUrl } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public product documents (datasheets) are downloaded through here so that only signed-in customers get them. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const sb = await createClient();
  // RLS: only public documents of published products are visible
  const { data: doc } = await sb.from("product_documents").select("title, storage_path, products(slug)").eq("id", id).eq("is_public", true).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const slug = (Array.isArray(doc.products) ? doc.products[0] : doc.products)?.slug ?? null;
  const gate = await requireSignedIn(req, slug);
  if (gate) return gate;
  const src = publicUrl("product-docs", doc.storage_path);
  const file = src ? await fetch(src) : null;
  if (!file?.ok || !file.body) return new NextResponse("Document unavailable", { status: 502 });
  const ext = (doc.storage_path.split(".").pop() ?? "pdf").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `${doc.title.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "document"}.${ext}`;
  return new NextResponse(file.body, { headers: { "content-type": file.headers.get("content-type") ?? "application/octet-stream", "content-disposition": `inline; filename="${name}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
