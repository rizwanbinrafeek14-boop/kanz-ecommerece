"use client";
import * as React from "react";

/** Configuration choices made in the buy box (e.g. { winding: "SS 316/316L", filler: "PTFE" }), shared with the product visuals. */
let current: Record<string, string> = {};
const listeners = new Set<() => void>();
export function setSelectedChoices(next: Record<string, string>) {
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next; listeners.forEach((l) => l());
}
const EMPTY: Record<string, string> = {};
export function useSelectedChoices(): Record<string, string> {
  return React.useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current, () => EMPTY);
}
