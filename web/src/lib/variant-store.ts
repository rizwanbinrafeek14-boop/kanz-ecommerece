"use client";
import * as React from "react";

/** The variant currently selected in the buy box, shared with the Approvals section (both are separate client components on the product page). */
let selected: string | null = null;
const listeners = new Set<() => void>();
export function setSelectedVariant(id: string | null) { if (id !== selected) { selected = id; listeners.forEach((l) => l()); } }
export function useSelectedVariant(): string | null {
  return React.useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => selected, () => null);
}
