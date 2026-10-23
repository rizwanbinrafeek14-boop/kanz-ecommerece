import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      secondary: "border-transparent bg-secondary text-secondary-foreground",
      outline: "text-foreground",
      success: "border-transparent bg-green-100 text-green-800",
      warning: "border-transparent bg-amber-100 text-amber-900",
      destructive: "border-transparent bg-red-100 text-red-800",
      info: "border-transparent bg-blue-100 text-blue-800",
      dark: "border-transparent bg-ink text-white",
    },
  },
  defaultVariants: { variant: "default" },
});
function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
