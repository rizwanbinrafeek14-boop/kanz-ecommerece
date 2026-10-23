import * as React from "react";
import { cn } from "@/lib/utils";

const Card = ({ className, ...p }: React.ComponentProps<"div">) => <div data-slot="card" className={cn("rounded-xl border bg-card text-card-foreground shadow-xs", className)} {...p} />;
const CardHeader = ({ className, ...p }: React.ComponentProps<"div">) => <div className={cn("flex flex-col gap-1.5 p-5", className)} {...p} />;
const CardTitle = ({ className, ...p }: React.ComponentProps<"h3">) => <h3 className={cn("font-semibold leading-none tracking-tight", className)} {...p} />;
const CardDescription = ({ className, ...p }: React.ComponentProps<"p">) => <p className={cn("text-sm text-muted-foreground", className)} {...p} />;
const CardContent = ({ className, ...p }: React.ComponentProps<"div">) => <div className={cn("p-5 pt-0", className)} {...p} />;
const CardFooter = ({ className, ...p }: React.ComponentProps<"div">) => <div className={cn("flex items-center p-5 pt-0", className)} {...p} />;
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
