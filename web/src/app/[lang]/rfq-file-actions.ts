"use server";
/**
 * Attaching files to a quotation request. Whoever holds the RFQ's access token (returned when it is submitted, also in the
 * e-mailed link) may add up to 5 files of 10 MB within an hour of submitting:
 * 1. requestRfqUploads: checks the token, the time window and the count, and returns one-time signed upload URLs into
 *    the private bucket (the browser uploads directly, so large files do not pass through this server);
 * 2. confirmRfqUploads: re-checks everything, verifies each stored file's size and that its content matches its type
 *    (a renamed program or web page is deleted), then records it on the RFQ for the sales team.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { RFQ_FILES, rfqFileContentOk, rfqFileType, rfqFilesOpen, safeFileName } from "@/lib/rfq-files";
import type { ActionResult } from "./actions";

const tokenSchema = z.string().uuid();
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function openRfq(token: string) {
  let sb: ReturnType<typeof createServiceClient>;
  try { sb = createServiceClient(); } catch { return { sb: null as never, error: "File upload is not available right now. Please send your files by e-mail or WhatsApp, quoting your RFQ number." as const }; }   // the RFQ belongs to whoever holds its token (often a guest without an account)
  const { data: rfq } = await sb.from("rfqs").select("id, rfq_number, created_at, status").eq("access_token", token).maybeSingle();
  if (!rfq) return { sb, error: "Quotation request not found." as const };
  if (!rfqFilesOpen(rfq.created_at)) return { sb, error: "Files can be added within an hour of sending the request. Please send further files by e-mail or WhatsApp, quoting your RFQ number." as const };
  const { count } = await sb.from("rfq_attachments").select("id", { count: "exact", head: true }).eq("rfq_id", rfq.id);
  return { sb, rfq, existing: count ?? 0 };
}

export async function requestRfqUploads(token: string, files: { name: string; size: number }[]): Promise<ActionResult<{ name: string; path: string; uploadToken: string; contentType: string }[]>> {
  if (!tokenSchema.safeParse(token).success) return fail("Invalid request.");
  const list = z.array(z.object({ name: z.string().min(1).max(200), size: z.number().int().min(1) })).min(1).max(RFQ_FILES.max).safeParse(files);
  if (!list.success) return fail(`Choose up to ${RFQ_FILES.max} files.`);
  const o = await openRfq(token); if ("error" in o && o.error) return fail(o.error);
  if (o.existing! + list.data.length > RFQ_FILES.max) return fail(`At most ${RFQ_FILES.max} files per request (${o.existing} already attached).`);
  const out = [];
  for (const f of list.data) {
    const t = rfqFileType(f.name);
    if (!t) return fail(`${f.name}: use PDF, JPG, PNG, WebP, Excel, CSV or Word files.`);
    if (f.size > RFQ_FILES.maxBytes) return fail(`${f.name}: larger than 10 MB.`);
    const path = `rfq/${o.rfq!.id}/${randomUUID().slice(0, 8)}-${safeFileName(f.name)}`;
    const { data, error } = await o.sb.storage.from(RFQ_FILES.bucket).createSignedUploadUrl(path);
    if (error || !data) return fail("The upload could not be prepared. Please try again.");
    out.push({ name: f.name, path, uploadToken: data.token, contentType: t.mime });
  }
  return { ok: true, data: out };
}

export async function confirmRfqUploads(token: string, uploads: { name: string; path: string }[]): Promise<ActionResult<{ saved: string[]; rejected: { name: string; reason: string }[] }>> {
  if (!tokenSchema.safeParse(token).success) return fail("Invalid request.");
  const list = z.array(z.object({ name: z.string().min(1).max(200), path: z.string().min(1).max(300) })).min(1).max(RFQ_FILES.max).safeParse(uploads);
  if (!list.success) return fail("Invalid request.");
  const o = await openRfq(token); if ("error" in o && o.error) return fail(o.error);
  const saved: string[] = []; const rejected: { name: string; reason: string }[] = []; let count = o.existing!;
  for (const u of list.data) {
    const t = rfqFileType(u.name);
    if (!u.path.startsWith(`rfq/${o.rfq!.id}/`) || !t) { rejected.push({ name: u.name, reason: "not part of this request" }); continue; }
    const { data: blob } = await o.sb.storage.from(RFQ_FILES.bucket).download(u.path);
    if (!blob) { rejected.push({ name: u.name, reason: "upload not found" }); continue; }
    const body = Buffer.from(await blob.arrayBuffer());
    const reason = count >= RFQ_FILES.max ? `at most ${RFQ_FILES.max} files` : body.length > RFQ_FILES.maxBytes ? "larger than 10 MB" : !rfqFileContentOk(t.ext, body) ? "the content does not match the file type" : null;
    if (reason) { await o.sb.storage.from(RFQ_FILES.bucket).remove([u.path]); rejected.push({ name: u.name, reason }); continue; }
    const { data: dup } = await o.sb.from("rfq_attachments").select("id").eq("rfq_id", o.rfq!.id).eq("storage_path", u.path).maybeSingle();
    if (!dup) {
      const { error } = await o.sb.from("rfq_attachments").insert({ rfq_id: o.rfq!.id, storage_path: u.path, file_name: u.name.slice(0, 200), size_bytes: body.length, content_type: t.mime });
      if (error) { rejected.push({ name: u.name, reason: "could not be saved" }); continue; }
      await o.sb.from("rfq_events").insert({ rfq_id: o.rfq!.id, event: "file_added", detail: `${u.name.slice(0, 200)} (${Math.max(1, Math.round(body.length / 1024))} KB)` });
      count++;
    }
    saved.push(u.name);
  }
  return { ok: true, data: { saved, rejected } };
}
