"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n/config";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const langOf = (l: string) => (isLocale(l) ? l : "en");

// ───────── Auth ─────────
const credSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(8).max(200) });

export async function signInAction(_: unknown, fd: FormData): Promise<ActionResult> {
  const lang = langOf(String(fd.get("lang")));
  const parsed = credSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return fail("Please enter a valid email and a password of at least 8 characters.");
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) return fail("Incorrect email or password.");
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith(`/${lang}/`) ? next : `/${lang}/account`);
}

const signUpSchema = credSchema.extend({
  full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(40).optional(), company_name: z.string().trim().max(160).optional(),
});
export async function signUpAction(_: unknown, fd: FormData): Promise<ActionResult<{ confirm: boolean }>> {
  const lang = langOf(String(fd.get("lang")));
  const parsed = signUpSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Please complete all required fields (password: 8+ characters).");
  const { email, password, full_name, phone, company_name } = parsed.data;
  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { full_name, phone, company_name }, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback?next=/${lang}/account` },
  });
  if (error) return fail(error.message);
  if (data.session) redirect(`/${lang}/account`);
  return { ok: true, data: { confirm: true } };
}

export async function signOutAction(fd: FormData) {
  const lang = langOf(String(fd.get("lang")));
  const sb = await createClient();
  await sb.auth.signOut();
  redirect(`/${lang}`);
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120), phone: z.string().trim().max(40).optional(), company_name: z.string().trim().max(160).optional(),
  cr_number: z.string().trim().max(40).optional(), vat_number: z.string().trim().max(40).optional(),
});
export async function updateProfileAction(_: unknown, fd: FormData): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail("Please check the form fields.");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return fail("Please sign in.");
  const { error } = await sb.from("profiles").update(parsed.data).eq("id", user.id);   // RLS + trigger prevent role changes
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ───────── RFQ ─────────
const rfqSchema = z.object({
  contact: z.object({
    name: z.string().trim().min(2).max(200), email: z.string().trim().email().max(200), phone: z.string().trim().max(50).optional(),
    company: z.string().trim().max(200).optional(), vat_number: z.string().trim().max(50).optional(), city: z.string().trim().max(100).optional(),
    required_by: z.string().trim().max(10).optional(), notes: z.string().trim().max(4000).optional(), session_id: z.string().max(64).optional(),
  }),
  items: z.array(z.object({
    product_id: z.string().uuid().optional().or(z.literal("")), variant_id: z.string().uuid().optional().or(z.literal("")),
    description: z.string().trim().min(1).max(500), specification: z.string().trim().max(500).optional(),
    quantity: z.number().positive().max(10_000_000), unit: z.string().trim().max(20).optional(),
  })).min(1).max(200),
});
export async function submitRfqAction(input: z.input<typeof rfqSchema>): Promise<ActionResult<{ number: string; token: string }>> {
  const parsed = rfqSchema.safeParse(input);
  if (!parsed.success) return fail("Please complete your contact details and add at least one valid item.");
  const sb = await createClient();
  const { data, error } = await sb.rpc("submit_rfq", { p_contact: parsed.data.contact, p_items: parsed.data.items });
  if (error) return fail(error.message);
  const row = (data as { rfq_number: string; access_token: string }[])[0];
  return { ok: true, data: { number: row.rfq_number, token: row.access_token } };
}

export async function respondRfqAction(token: string, accept: boolean): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(token).success) return fail("Invalid link.");
  const sb = await createClient();
  const { error } = await sb.rpc("respond_rfq", { p_token: token, p_accept: accept });
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

// ───────── Checkout ─────────
const orderSchema = z.object({
  items: z.array(z.object({ variant_id: z.string().uuid(), quantity: z.number().positive().max(1_000_000) })).min(1).max(100),
  delivery: z.enum(["delivery", "pickup"]), payment: z.enum(["bank_transfer", "cod"]),
  address: z.object({
    recipient: z.string().trim().max(120), phone: z.string().trim().max(40), line1: z.string().trim().max(200), line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100), region: z.string().trim().max(100).optional(), postal_code: z.string().trim().max(20).optional(),
  }).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export async function placeOrderAction(input: z.input<typeof orderSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return fail("Please check your order details.");
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return fail("Please sign in to place an order.");
  const d = parsed.data;
  // Prices are NOT sent: the database computes them from current catalogue data (place_order).
  const { data, error } = await sb.rpc("place_order", {
    p_items: d.items, p_delivery: d.delivery, p_payment: d.payment, p_address: d.delivery === "delivery" ? d.address ?? null : null, p_notes: d.notes ?? null,
  });
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data as string } };
}
