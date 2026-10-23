"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "./ui";
import { inviteStaff, setUserRole } from "@/lib/admin/user-actions";
import { run } from "@/lib/admin/client";
import { formatDateTime } from "@/lib/format";

export interface UserRow { id: string; full_name: string | null; company_name: string | null; role: string; is_active: boolean; created_at: string; isMe: boolean }

export function UserManager({ rows }: { rows: UserRow[] }) {
  const router = useRouter(); const [open, setOpen] = React.useState(false); const [inv, setInv] = React.useState({ email: "", name: "", role: "staff" as "staff" | "admin" }); const [busy, setBusy] = React.useState(false);
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setOpen(true)}><UserPlus className="size-4" />Invite staff</Button></div>
      <div className="overflow-hidden rounded-xl border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map((u) => (
          <TableRow key={u.id}><TableCell className="font-medium">{u.full_name || "—"}{u.company_name && <span className="text-muted-foreground"> · {u.company_name}</span>}{u.isMe && <Badge variant="secondary" className="ms-2">you</Badge>}</TableCell>
            <TableCell><NativeSelect value={u.role} disabled={u.isMe} aria-label={`Role for ${u.full_name}`} className="h-8 w-32" onChange={async (e) => { if (await run(setUserRole(u.id, e.target.value as "staff", u.is_active), "Role updated")) router.refresh(); }}><option value="customer">customer</option><option value="staff">staff</option><option value="admin">admin</option></NativeSelect></TableCell>
            <TableCell><Button size="sm" variant={u.is_active ? "outline" : "default"} disabled={u.isMe} onClick={async () => { if (await run(setUserRole(u.id, u.role as "staff", !u.is_active), u.is_active ? "Account disabled" : "Account enabled")) router.refresh(); }}>{u.is_active ? "Disable" : "Enable"}</Button></TableCell>
            <TableCell className="text-xs text-muted-foreground">{formatDateTime(u.created_at)}</TableCell></TableRow>))}</TableBody></Table></div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Invite a staff member</DialogTitle><DialogDescription>They receive an email to set a password. Staff manage the catalogue, stock, quotations and orders; admins can also change settings, VAT, roles and delete data.</DialogDescription></DialogHeader>
        <div className="grid gap-3"><Field label="Full name"><Input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} /></Field><Field label="Email"><Input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></Field>
          <Field label="Role"><NativeSelect value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as "staff" | "admin" })}><option value="staff">Staff</option><option value="admin">Administrator</option></NativeSelect></Field></div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !inv.email} onClick={async () => { setBusy(true); const r = await run(inviteStaff(inv.email, inv.role, inv.name), "Invitation sent"); setBusy(false); if (r) { setOpen(false); router.refresh(); } }}>Send invitation</Button></DialogFooter>
      </DialogContent></Dialog>
    </>
  );
}
