"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";

/**
 * "Aurora got this wrong" in one control (§29).
 *
 * Invalidates the cached artifact then refreshes the route, so the user sees a
 * fresh interpretation rather than a spinner attached to a POST.
 */
export function RegenerateInsight({
  kind,
  label = "Regenerate",
}: {
  kind: "IDENTITY" | "DNA" | "MOOD_PROFILE" | "TASTE_EVOLUTION";
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const regenerate = async () => {
    setBusy(true);
    try {
      await fetchJson("/api/taste/regenerate", { method: "POST", body: JSON.stringify({ kind }) });
      router.refresh();
      toast.success("Aurora is taking another look.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't regenerate that just now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void regenerate()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RefreshCw size={12} aria-hidden />}
      {label}
    </button>
  );
}
