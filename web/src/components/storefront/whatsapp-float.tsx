"use client";
import { MessageCircle } from "lucide-react";
import { track } from "@/lib/track";

export function WhatsAppFloat({ number, text, label }: { number: string; text: string; label: string }) {
  if (!number) return null;
  return (
    <a href={`https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
      onClick={() => track("whatsapp_click")} aria-label={label}
      className="no-print fixed bottom-5 end-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105">
      <MessageCircle className="size-7" />
    </a>
  );
}
