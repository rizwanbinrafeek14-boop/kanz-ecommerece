"use client";
import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = D.Root;
const SheetTrigger = D.Trigger;
const SheetClose = D.Close;
const SheetTitle = D.Title;

function SheetContent({ className, children, side = "start", ...props }: React.ComponentProps<typeof D.Content> & { side?: "start" | "end" }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <D.Content
        aria-describedby={undefined}
        className={cn("fixed inset-y-0 z-50 flex w-[88%] max-w-sm flex-col bg-background shadow-xl", side === "start" ? "start-0" : "end-0", className)}
        {...props}>
        {children}
        <D.Close className="absolute end-3 top-3 rounded-sm p-1 opacity-70 hover:opacity-100"><X className="size-5" /><span className="sr-only">Close</span></D.Close>
      </D.Content>
    </D.Portal>
  );
}
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle };
