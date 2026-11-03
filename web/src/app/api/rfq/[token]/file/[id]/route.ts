import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { RFQ_FILES } from "@/lib/rfq-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A file the customer attached to their RFQ, for the holder of the RFQ link: redirect to a 60-second signed download. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  let sb: ReturnType<typeof createServiceClient>;
  try { sb = createServiceClient(); } catch { return new Response("Not found", { status: 404 }); }
  const { data: rfq } = await sb.from("rfqs").select("id").eq("access_token", token).maybeSingle();
  const { data: file } = rfq ? await sb.from("rfq_attachments").select("storage_path, file_name").eq("id", id).eq("rfq_id", rfq.id).maybeSingle() : { data: null };
  if (!file) return new NextResponse("Not found", { status: 404 });
  const { data } = await sb.storage.from(RFQ_FILES.bucket).createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (!data?.signedUrl) return new NextResponse("File unavailable", { status: 502 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "cache-control": "private, no-store" } });
}
