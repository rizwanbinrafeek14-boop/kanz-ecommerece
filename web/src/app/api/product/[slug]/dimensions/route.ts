import { NextResponse } from "next/server";
import { getDimensionRows } from "@/lib/queries/catalog";

export const revalidate = 60;
/** Full dimension tables of a published product, for the product page's "Show all sizes" and selections beyond the first rows. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,200}$/.test(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const tables = await getDimensionRows(slug);
  if (!tables) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tables }, { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } });
}
