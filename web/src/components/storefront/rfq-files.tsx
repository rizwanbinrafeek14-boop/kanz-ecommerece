"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";
import { confirmRfqUploads, requestRfqUploads } from "@/app/[lang]/rfq-file-actions";

export const RFQ_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.docx,.doc";
export const RFQ_MAX_FILES = 5;
export interface FileLabels { files: string; filesHint: string; filesChoose: string; filesAttached: string; filesUploading: string; filesAdd: string; filesFailed: string; remove: string }

/** Uploads files to an RFQ: signed one-time upload URLs straight to private storage, then the server checks and records them. */
export async function uploadRfqFiles(token: string, files: File[]): Promise<{ saved: string[]; rejected: { name: string; reason: string }[]; error?: string }> {
  if (!files.length) return { saved: [], rejected: [] };
  const slots = await requestRfqUploads(token, files.map((f) => ({ name: f.name, size: f.size })));
  if (!slots.ok) return { saved: [], rejected: [], error: slots.error };
  const storage = createClient().storage.from("rfq-attachments");
  const uploaded: { name: string; path: string }[] = []; const rejected: { name: string; reason: string }[] = [];
  for (const [i, s] of slots.data.entries()) {
    const { error } = await storage.uploadToSignedUrl(s.path, s.uploadToken, files[i], { contentType: s.contentType });
    if (error) rejected.push({ name: s.name, reason: error.message }); else uploaded.push({ name: s.name, path: s.path });
  }
  if (!uploaded.length) return { saved: [], rejected };
  const done = await confirmRfqUploads(token, uploaded);
  if (!done.ok) return { saved: [], rejected, error: done.error };
  return { saved: done.data.saved, rejected: [...rejected, ...done.data.rejected] };
}

/** File chooser with a removable list (used in the RFQ form before sending). */
export function RfqFilePicker({ files, onChange, labels, disabled }: { files: File[]; onChange: (f: File[]) => void; labels: FileLabels; disabled?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div data-rfq-files>
      <p className="text-sm font-medium">{labels.files}</p>
      <p className="mb-2 text-xs text-muted-foreground">{labels.filesHint}</p>
      <Button type="button" size="sm" variant="outline" disabled={disabled || files.length >= RFQ_MAX_FILES} onClick={() => ref.current?.click()}><Paperclip className="size-4" />{labels.filesChoose}</Button>
      <input ref={ref} type="file" multiple accept={RFQ_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" data-rfq-file-input
        onChange={(e) => { onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, RFQ_MAX_FILES)); e.target.value = ""; }} />
      {files.length > 0 && <ul className="mt-2 space-y-1 text-sm">{files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-2"><Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="truncate">{f.name}</span>
          <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(f.size / 1024))} KB{f.size > 10 * 1024 * 1024 ? " — > 10 MB" : ""}</span>
          <button type="button" className="ms-auto rounded p-1 hover:bg-muted" aria-label={`${labels.remove}: ${f.name}`} onClick={() => onChange(files.filter((_, n) => n !== i))}><X className="size-4" /></button></li>))}</ul>}
    </div>);
}

/** On the quotation page: add more files while the upload window is open. */
export function RfqAddFiles({ token, labels, remaining }: { token: string; labels: FileLabels; remaining: number }) {
  const router = useRouter(); const [files, setFiles] = React.useState<File[]>([]); const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ saved: string[]; rejected: { name: string; reason: string }[]; error?: string } | null>(null);
  if (remaining <= 0) return null;
  return (
    <div className="mt-4 rounded-lg border p-4">
      <RfqFilePicker files={files} onChange={(f) => setFiles(f.slice(0, remaining))} labels={labels} disabled={busy} />
      {files.length > 0 && <Button className="mt-3" size="sm" disabled={busy} onClick={async () => { setBusy(true); const r = await uploadRfqFiles(token, files); setBusy(false); setMsg(r); if (r.saved.length) { setFiles([]); router.refresh(); } }}>
        {busy ? <><Loader2 className="size-4 animate-spin" />{labels.filesUploading}</> : labels.filesAdd}</Button>}
      {msg && <FileResult r={msg} labels={labels} />}
    </div>);
}

export function FileResult({ r, labels }: { r: { saved: string[]; rejected: { name: string; reason: string }[]; error?: string }; labels: FileLabels }) {
  return (
    <div className="mt-3 space-y-1 text-sm" role="status" data-rfq-file-result>
      {r.error && <p className="text-destructive">{r.error}</p>}
      {r.saved.length > 0 && <p className="text-success">{labels.filesAttached}: {r.saved.join(", ")}</p>}
      {r.rejected.map((x) => <p key={x.name} className="text-destructive">{labels.filesFailed}: {x.name} — {x.reason}</p>)}
    </div>);
}
