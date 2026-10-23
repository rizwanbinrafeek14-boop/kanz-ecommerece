"use client";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-bold">Something went wrong · حدث خطأ ما</h1>
      <p className="mt-2 text-sm text-muted-foreground">Please try again. If it keeps happening, contact us on WhatsApp. · يرجى المحاولة مرة أخرى.</p>
      <Button className="mt-6" onClick={reset}>Try again · إعادة المحاولة</Button>
    </div>
  );
}
