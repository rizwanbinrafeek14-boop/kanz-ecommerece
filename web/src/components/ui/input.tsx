import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input type={type} data-slot="input"
      className={cn("flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive", className)}
      {...props} />
  );
}
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea data-slot="textarea"
      className={cn("flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      {...props} />
  );
}
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select data-slot="select"
      className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      {...props}>{children}</select>
  );
}
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-sm font-medium leading-none", className)} {...props} />;
}
function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn("size-4 rounded border-input accent-[var(--primary)]", className)} {...props} />;
}
export { Input, Textarea, NativeSelect, Label, Checkbox };
