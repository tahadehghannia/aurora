import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { isTakingShape, type IdentityResult } from "@/lib/taste/identity-types";

/**
 * A doorway into Profile, not a copy of it: the identity name, a few traits,
 * and one insight. Everything deeper — evidence, spectrums, DNA — lives in one
 * place, on Profile.
 */
export function TasteSummaryCard({ identity, insight }: { identity: IdentityResult; insight?: string | null }) {
  if (isTakingShape(identity)) {
    // Nothing confident to say yet — but still a doorway, not a dead end.
    if (identity.signalsSoFar === 0) return null;
    return (
      <Link href="/profile" className="group flex flex-col gap-1.5">
        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Your taste lately</p>
        <p className="text-body-md text-foreground">Your entertainment identity is still taking shape.</p>
        <span className="inline-flex items-center gap-1 text-caption font-medium text-brand">
          See what Aurora has so far
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <Link href="/profile" className="group flex flex-col gap-1.5">
      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Your taste lately</p>
      <p className="text-h6 font-semibold text-foreground">{identity.archetype.name}</p>
      {identity.traits.length > 0 && (
        <p className="text-body-sm text-muted-foreground">{identity.traits.slice(0, 3).join(" · ")}</p>
      )}
      {/* Prefer the shared identity model's own read of what's changing; fall
          back to Aurora's deterministic insight. Home never computes a second,
          competing taste model (§32). */}
      {identity.narrative.emergingTraits.length > 0 ? (
        <p className="max-w-xl text-body-sm text-muted-foreground">
          Lately leaning {identity.narrative.emergingTraits.join(" and ")}.
        </p>
      ) : (
        insight && <p className="max-w-xl text-body-sm text-muted-foreground">{insight}</p>
      )}
      <span className="mt-0.5 inline-flex items-center gap-1 text-caption font-medium text-brand">
        Explore your DNA
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
