import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminLoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await getSessionUser();
  if (u && (u.role === "staff" || u.role === "admin")) redirect("/admin");
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/brand/logo-icon.png" alt="KANZ CORNER" width={72} height={57} />
          <h1 className="text-xl font-bold">KANZ CORNER Admin</h1>
          {error === "forbidden" && <p className="text-sm text-destructive">That account does not have admin access.</p>}
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
