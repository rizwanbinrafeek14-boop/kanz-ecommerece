"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelOption { key: string; name: string; values: { value: string; label: string }[] }
export interface SelVariant { id: string; options: Record<string, string> }

/** Values of option `idx` that exist in at least one variant matching the choices made for the options before it. */
export function availableValues(options: SelOption[], variants: SelVariant[], sel: Record<string, string>, idx: number) {
  const before = options.slice(0, idx).map((o) => o.key);
  return new Set(variants.filter((v) => before.every((k) => v.options[k] === sel[k])).map((v) => v.options[options[idx].key]));
}
/** After a change, keep later choices if still valid, otherwise move them to the first valid value — so the selection is always a real variant. */
export function settle(options: SelOption[], variants: SelVariant[], sel: Record<string, string>, from = 0) {
  const out = { ...sel };
  for (let i = from; i < options.length; i++) {
    const ok = availableValues(options, variants, out, i);
    if (!ok.has(out[options[i].key])) out[options[i].key] = options[i].values.find((v) => ok.has(v.value))?.value ?? "";
  }
  return out;
}

/** Dependent option chips (connection → class → size …). Combinations the catalogue does not list cannot be selected. */
export function OptionSelector({ options, variants, value, onChange, unavailableLabel }: { options: SelOption[]; variants: SelVariant[]; value: Record<string, string>; onChange: (v: Record<string, string>) => void; unavailableLabel: string }) {
  return (
    <div className="space-y-4">
      {options.map((o, idx) => {
        const ok = availableValues(options, variants, value, idx);
        return (
          <fieldset key={o.key}>
            <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium"><span>{o.name}</span><span className="font-mono text-xs text-muted-foreground">{o.values.find((v) => v.value === value[o.key])?.label}</span></legend>
            <div role="radiogroup" aria-label={o.name} className="flex flex-wrap gap-1.5">
              {o.values.map((v) => {
                const on = value[o.key] === v.value; const can = ok.has(v.value);
                return (
                  <button key={v.value} type="button" role="radio" aria-checked={on} aria-disabled={!can} disabled={!can} title={can ? undefined : unavailableLabel}
                    onClick={() => onChange(settle(options, variants, { ...value, [o.key]: v.value }, idx + 1))}
                    className={cn("min-h-10 min-w-12 rounded-md border px-3 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on ? "border-ink bg-ink text-white" : can ? "border-steel-300 bg-white hover:border-primary hover:text-primary" : "cursor-not-allowed border-dashed border-steel-200 bg-steel-50 text-steel-400 line-through")}>
                    {v.label}
                  </button>);
              })}
            </div>
          </fieldset>);
      })}
    </div>
  );
}
