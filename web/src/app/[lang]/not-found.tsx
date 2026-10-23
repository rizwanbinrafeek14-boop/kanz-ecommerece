import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="mt-3 text-xl font-bold">Page not found · الصفحة غير موجودة</h1>
      <Button asChild className="mt-6"><Link href="/">Home · الرئيسية</Link></Button>
    </div>
  );
}
