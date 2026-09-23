"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RegenerateInsight } from "@/components/profile/regenerate-insight";
import type { IdentityResult } from "@/lib/taste/identity-types";
import { isTakingShape } from "@/lib/taste/identity-types";
import { WhereTasteSits } from "@/components/profile/where-taste-sits";

interface EntertainmentIdentityProps {
  identity: IdentityResult;
  /** First view gets the paced reveal; afterwards it renders immediately. */
  reveal?: boolean;
  /**
   * Hides the name, description and trait chips.
   *
   * Used when the animated portrait above is already showing them — repeating
   * the identity as a heading directly beneath its own portrait reads as a
   * layout bug, not emphasis.
   */
  headless?: boolean;
}

/** Steps in the reveal, in order. Pacing is the entire effect — no motion, just sequencing. */
const REVEAL_MS = [0, 900, 1700];

function usePacedReveal(enabled: boolean): number {
  const [step, setStep] = useState(enabled ? 0 : REVEAL_MS.length);

  useEffect(() => {
    if (!enabled) return;

    // Anyone who has asked for reduced motion gets every step at once — the
    // delays collapse to zero rather than the reveal being skipped, which
    // keeps all the state updates inside callbacks (no cascading render).
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const delays = reduced ? REVEAL_MS.map(() => 0) : REVEAL_MS;

    const timers = delays.map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [enabled]);

  return step;
}

export function EntertainmentIdentity({ identity, reveal = false, headless = false }: EntertainmentIdentityProps) {
  const step = usePacedReveal(reveal);
  const [showEvidence, setShowEvidence] = useState(false);

  if (isTakingShape(identity)) {
    return (
      <section className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Your Entertainment Identity
          </p>
          <h1 className="text-h3 font-semibold">Still taking shape</h1>
          <p className="max-w-xl text-body-md text-muted-foreground">
            Aurora hasn&apos;t seen enough yet to say what kind of entertainment person you are — and it would rather
            say nothing than guess.
          </p>
        </div>

        <ul className="flex max-w-xl flex-col gap-2">
          {identity.nextSteps.map((step) => (
            <li key={step} className="flex items-start gap-2 text-body-sm text-muted-foreground">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
              {step}
            </li>
          ))}
        </ul>

        {identity.signalsSoFar > 0 && (
          <p className="text-caption text-muted-foreground">
            {identity.signalsSoFar} signal{identity.signalsSoFar === 1 ? "" : "s"} so far.
          </p>
        )}
      </section>
    );
  }

  const { archetype, confidence, evidence, spectrums, traits, narrative } = identity;

  return (
    <section className="space-y-8">
      <div className={cn("space-y-3", headless && "hidden")}>
        <p
          className={cn(
            "text-caption font-medium uppercase tracking-wide text-muted-foreground transition-opacity duration-500",
            step >= 1 ? "opacity-100" : "opacity-0"
          )}
        >
          {confidence === "clear" ? "Your Entertainment Identity" : "Your Entertainment Identity, so far"}
        </p>

        <h1
          className={cn(
            "text-h2 font-semibold leading-tight transition-opacity duration-700 sm:text-h1",
            step >= 2 ? "opacity-100" : "opacity-0"
          )}
        >
          {archetype.name}
        </h1>

        <div className={cn("space-y-4 transition-opacity duration-700", step >= 3 ? "opacity-100" : "opacity-0")}>
          <p className="max-w-2xl text-body-lg text-muted-foreground">{narrative.description}</p>

          {narrative.emergingTraits.length > 0 && (
            <p className="text-body-sm text-muted-foreground">
              Just starting to show up: {narrative.emergingTraits.join(", ")}.
            </p>
          )}

          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((trait) => (
                <Link
                  key={trait}
                  href={`/discover?mood=${encodeURIComponent(trait)}`}
                  className="rounded-full border border-border px-3 py-1 text-body-sm text-foreground hover:border-brand"
                >
                  {trait}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Says plainly where the wording came from. An interpretation shown as
          measurement is a lie even when the numbers behind it are real (§30). */}
      <div className={cn("flex flex-wrap items-center gap-3 transition-opacity duration-700", step >= 3 ? "opacity-100" : "opacity-0")}>
        <p className="text-caption text-muted-foreground">
          {narrative.aiGenerated
            ? "Aurora's interpretation of your taste, generated from your activity."
            : "Generated from your Aurora activity."}
        </p>
        {narrative.aiGenerated && <RegenerateInsight kind="IDENTITY" label="Not quite right? Regenerate" />}
      </div>

      {evidence.length > 0 && (
        <div className={cn("transition-opacity duration-700", step >= 3 ? "opacity-100" : "opacity-0")}>
          <button
            type="button"
            onClick={() => setShowEvidence((v) => !v)}
            className="inline-flex items-center gap-1 text-caption font-medium text-brand"
            aria-expanded={showEvidence}
          >
            Why Aurora sees you this way
            <ChevronDown size={12} className={cn("transition-transform", showEvidence && "rotate-180")} />
          </button>

          {showEvidence && (
            <ul className="mt-3 flex max-w-2xl flex-col gap-2">
              {evidence.map((item) => (
                <li key={item.text} className="flex items-start gap-2 text-body-sm text-muted-foreground">
                  <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                  {item.href ? (
                    <Link href={item.href} className="hover:text-foreground">
                      {item.text}
                    </Link>
                  ) : (
                    item.text
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {spectrums.length > 0 && (
        <div className={cn("transition-opacity duration-700", step >= 3 ? "opacity-100" : "opacity-0")}>
          <WhereTasteSits spectrums={spectrums} />
        </div>
      )}
    </section>
  );
}
