"use client";
import * as React from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { useSelectedVariant } from "@/lib/variant-store";
import type { Approval } from "@/lib/queries/certs";
import { cn } from "@/lib/utils";

export interface ApprovalLabels { heading: string; none: string; view: string; opensNew: string; number: string; scope: string; validUntil: string; issuer: string }

/** Approvals that apply to the visitor's current choice. Unrestricted approvals always apply; size/variant-limited ones only once a matching variant is selected. */
function useApplicable(all: Approval[]) {
  const v = useSelectedVariant();
  return React.useMemo(() => all.filter((a) => a.variantIds.length === 0 || (v !== null && a.variantIds.includes(v))), [all, v]);
}
const nameOf = (a: Approval, lang: string) => (lang === "ar" && a.name_ar ? a.name_ar : a.name_en);

/** Logo row under the main action buttons. Renders nothing when there is nothing verified to show. */
export function ApprovalBadgeRow({ approvals, lang, labels, className }: { approvals: Approval[]; lang: string; labels: ApprovalLabels; className?: string }) {
  const list = useApplicable(approvals);
  if (!list.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-3", className)} aria-label={labels.heading}>
      {list.map((a) => {
        const name = nameOf(a, lang);
        const face = a.logo
          ? <img src={a.logo} alt={a.href ? "" : name} loading="lazy" className="h-12 w-auto max-w-[7rem] object-contain" />
          : <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold"><BadgeCheck className="size-4 text-primary" aria-hidden="true" />{name}</span>;
        return (
          <li key={a.id} title={[name, a.scopeNote].filter(Boolean).join(" — ")}>
            {a.href
              ? <a href={a.href} target="_blank" rel="noopener noreferrer" aria-label={`${name} — ${labels.view} (${labels.opensNew})`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{face}</a>
              : <span className="inline-flex min-h-11 items-center p-1">{face}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** “Approvals” block of the description: the same verified records, with number, issuer, scope and a certificate link. */
export function ApprovalsSection({ approvals, lang, labels }: { approvals: Approval[]; lang: string; labels: ApprovalLabels }) {
  const list = useApplicable(approvals);
  return (
    <section aria-labelledby="approvals-h">
      <h2 id="approvals-h" className="mb-3 border-s-4 border-primary ps-3 text-xl font-bold">{labels.heading}</h2>
      {!list.length ? <p className="text-muted-foreground">{labels.none}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="flex gap-3 rounded-xl border p-4">
              {a.logo ? <img src={a.logo} alt="" loading="lazy" className="h-12 w-16 shrink-0 object-contain" /> : <BadgeCheck className="size-6 shrink-0 text-primary" aria-hidden="true" />}
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{nameOf(a, lang)}</p>
                <dl className="mt-1 space-y-0.5 text-muted-foreground">
                  {a.issuer && <div><dt className="inline">{labels.issuer}: </dt><dd className="inline">{a.issuer}</dd></div>}
                  {a.number && <div><dt className="inline">{labels.number}: </dt><dd className="inline" dir="ltr">{a.number}</dd></div>}
                  {a.validUntil && <div><dt className="inline">{labels.validUntil}: </dt><dd className="inline" dir="ltr">{a.validUntil}</dd></div>}
                  {a.scopeNote && <div className="text-foreground"><dt className="inline font-medium">{labels.scope}: </dt><dd className="inline">{a.scopeNote}</dd></div>}
                </dl>
                {a.href && <a href={a.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{labels.view}<span className="sr-only"> — {nameOf(a, lang)} ({labels.opensNew})</span><ExternalLink className="size-3.5" aria-hidden="true" /></a>}
              </div>
            </li>))}
        </ul>)}
    </section>
  );
}
