import * as React from "react";
import { cn } from "@/lib/utils";

const Table = ({ className, ...p }: React.ComponentProps<"table">) => (
  <div className="relative w-full overflow-x-auto"><table className={cn("w-full caption-bottom text-sm", className)} {...p} /></div>
);
const TableHeader = ({ className, ...p }: React.ComponentProps<"thead">) => <thead className={cn("[&_tr]:border-b bg-muted/50", className)} {...p} />;
const TableBody = ({ className, ...p }: React.ComponentProps<"tbody">) => <tbody className={cn("[&_tr:last-child]:border-0", className)} {...p} />;
const TableRow = ({ className, ...p }: React.ComponentProps<"tr">) => <tr className={cn("border-b transition-colors hover:bg-muted/40", className)} {...p} />;
const TableHead = ({ className, ...p }: React.ComponentProps<"th">) => <th className={cn("h-10 px-3 text-start align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap", className)} {...p} />;
const TableCell = ({ className, ...p }: React.ComponentProps<"td">) => <td className={cn("p-3 align-middle", className)} {...p} />;
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
