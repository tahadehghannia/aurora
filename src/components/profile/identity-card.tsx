"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { isTakingShape, type IdentityResult } from "@/lib/taste/identity-types";
import type { TasteStats } from "@/lib/taste/stats";
import { Button } from "@/components/ui/button";

/**
 * The artifact a user can actually take away. Deliberately plain: a wordmark,
 * the identity, the traits, and two real facts. It's the *name* that's worth
 * sharing — decorating it would only make it look generated.
 */
export function IdentityCard({ identity, stats }: { identity: IdentityResult; stats: TasteStats }) {
  const [copied, setCopied] = useState(false);
  if (isTakingShape(identity)) return null;

  const { archetype, traits } = identity;

  const share = async () => {
    const lines = [
      `My Aurora entertainment identity: ${archetype.name}`,
      traits.length > 0 ? traits.join(" · ") : null,
      stats.topGenre ? `Top genre: ${stats.topGenre}` : null,
      stats.topMood ? `Top mood: ${stats.topMood}` : null,
    ].filter(Boolean);
    const text = lines.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Aurora identity", text });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Identity copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Aurora</p>

      <div className="space-y-1">
        <p className="text-h6 font-semibold text-foreground">{archetype.name}</p>
        {traits.length > 0 && <p className="text-body-sm text-muted-foreground">{traits.join(" · ")}</p>}
      </div>

      <dl className="flex flex-col gap-1 border-t border-border pt-3 text-caption">
        {stats.topGenre && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Top genre</dt>
            <dd className="font-medium text-foreground">{stats.topGenre}</dd>
          </div>
        )}
        {stats.topMood && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Top mood</dt>
            <dd className="font-medium text-foreground">{stats.topMood}</dd>
          </div>
        )}
      </dl>

      <Button size="sm" variant="outline" onClick={share} className="w-full">
        {copied ? <Check size={14} /> : <Share2 size={14} />}
        {copied ? "Copied" : "Share identity"}
      </Button>
    </section>
  );
}
