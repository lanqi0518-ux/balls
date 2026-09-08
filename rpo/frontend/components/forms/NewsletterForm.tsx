"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "@/components/ui/Icons";

export function NewsletterForm({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }
    setPending(true);
    const t = toast.loading("Subscribing…");
    // Simulated newsletter registration
    await new Promise((r) => setTimeout(r, 900));
    setPending(false);
    setEmail("");
    toast.success("You're on the list. Confirmation sent.", { id: t });
  };

  const isDark = variant === "dark";

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <div
        className={
          "flex-1 flex items-center gap-2 rounded-full border px-4 h-11 " +
          (isDark
            ? "bg-white/5 border-white/10 focus-within:border-white/40"
            : "bg-white border-line focus-within:border-ink-900")
        }
      >
        <Mail
          className={
            "h-4 w-4 " + (isDark ? "text-white/60" : "text-ink-500")
          }
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@somewhere.xyz"
          className={
            "flex-1 bg-transparent outline-none text-sm placeholder:opacity-60 " +
            (isDark ? "text-white" : "text-ink-900")
          }
          required
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className={
          "h-11 px-5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 " +
          (isDark
            ? "bg-peach-500 hover:bg-peach-600 text-white"
            : "bg-ink-900 hover:bg-ink-800 text-white")
        }
      >
        {pending ? "…" : "Subscribe"}
      </button>
    </form>
  );
}
