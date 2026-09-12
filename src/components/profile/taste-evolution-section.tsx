import Link from "next/link";
import { slugifyGenre } from "@/lib/utils";
import type { TasteEvolution } from "@/lib/taste/evolution";

interface TasteEvolutionSectionProps {
  evolution: TasteEvolution;
}

export function TasteEvolutionSection({ evolution }: TasteEvolutionSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h6 font-semibold">Taste Evolution</h2>
        <p className="text-body-sm text-muted-foreground">How your entertainment identity has changed over time.</p>
      </div>

      {!evolution.available ? (
        <p className="text-body-sm text-muted-foreground">
          Keep exploring — your taste story will appear here once there&apos;s enough history to trace.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-6 pl-5">
          <div aria-hidden className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-border" />
          {evolution.periods.map((period) => (
            <li key={period.label} className="relative">
              <span aria-hidden className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full border-2 border-brand bg-background" />
              <p className="text-body-sm font-semibold text-foreground">{period.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {period.topGenres.map((genre) => (
                  <Link
                    key={genre}
                    href={`/discover?genre=${slugifyGenre(genre)}`}
                    className="rounded-full border border-border px-3 py-1 text-body-sm text-muted-foreground hover:border-brand hover:text-foreground"
                  >
                    {genre}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
