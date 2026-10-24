"use client";
import * as React from "react";
import { track } from "@/lib/track";

type Ev = "phone_click" | "datasheet_download" | "whatsapp_click";
/** A normal link that also records one anonymous first-party event (no third-party scripts, no cookies). */
export function TrackedLink({ event, product, children, ...a }: Omit<React.ComponentProps<"a">, "onClick"> & { event: Ev; product?: string }) {
  return <a {...a} onClick={() => track(event, { product })}>{children}</a>;
}
