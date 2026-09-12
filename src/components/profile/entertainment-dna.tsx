import Link from "next/link";
import Image from "next/image";
import { slugifyGenre } from "@/lib/utils";
import type { EntertainmentDNA, WeightedLabel } from "@/lib/taste/dna";
import type { EntertainmentHabit } from "@/lib/taste/habits";
import { RegenerateInsight } from "@/components/profile/regenerate-insight";

interface EntertainmentDnaSectionProps {
  dna: EntertainmentDNA;
  habits?: EntertainmentHabit[];
}

const CONFIDENCE_TITLE: Record<WeightedLabel["confidence"], string> = {
  strong: "Strong preference",
  emerging: "Emerging preference",
  exploring: "Still exploring",
};

/** A single labeled strength bar, its fill width normalized against the strongest entry in its own group. Clicking leads to discovery — the core DNA -> discovery loop. */
function StrengthBar({ label, weight, maxWeight, confidence, href }: { label: string; weight: number; maxWeight: number; confidence: WeightedLabel["confidence"]; href: string }) {
  const pct = Math.max(8, Math.round((weight / maxWeight) * 100));
  return (
    <Link href={href} className="group flex items-center gap-3 py-1" title={CONFIDENCE_TITLE[confidence]}>
      <span className="w-24 shrink-0 truncate text-caption font-medium uppercase tracking-wide text-muted-foreground group-hover:text-foreground sm:w-28">
        {label}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-brand transition-[width] group-hover:bg-brand-hover"
          style={{ width: `${pct}%`, opacity: confidence === "exploring" ? 0.5 : 1 }}
        />
      </span>
    </Link>
  );
}

function StrengthCluster({ title, values, hrefFor }: { title: string; values: WeightedLabel[]; hrefFor: (name: string) => string }) {
  if (values.length === 0) return null;
  const maxWeight = Math.max(...values.map((v) => v.weight));
  return (
    <div className="space-y-1">
      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <div>
        {values.map((v) => (
          <StrengthBar key={v.name} label={v.name} weight={v.weight} maxWeight={maxWeight} confidence={v.confidence} href={hrefFor(v.name)} />
        ))}
      </div>
    </div>
  );
}

function CreatorList({ title, values }: { title: string; values: WeightedLabel[] }) {
  if (values.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <div className="flex flex-col gap-1">
        {values.map((v) => (
          <Link
            key={v.name}
            href={`/search?q=${encodeURIComponent(v.name)}`}
            className="flex items-center justify-between gap-2 text-body-sm text-foreground hover:text-brand"
          >
            <span className="truncate">{v.name}</span>
            {typeof v.favoriteCount === "number" && (
              <span className="shrink-0 text-caption text-muted-foreground">
                {v.favoriteCount} favorite{v.favoriteCount === 1 ? "" : "s"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EntertainmentDnaSection({ dna, habits = [] }: EntertainmentDnaSectionProps) {
  if (!dna.hasEnoughSignal) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Entertainment DNA</h2>
        <p className="text-body-sm text-muted-foreground">
          Your entertainment identity is still taking shape. Rate, save or watch a few things and Aurora will start
          building the stories and sounds that define your taste.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-h6 font-semibold">Entertainment DNA</h2>
          <p className="text-body-sm text-muted-foreground">The stories and sounds that shape your taste.</p>
        </div>
        {dna.narrative?.aiGenerated && <RegenerateInsight kind="DNA" />}
      </div>

      {dna.narrative && (
        <div className="space-y-2">
          <p className="max-w-2xl text-body text-foreground">{dna.narrative.summary}</p>
          {dna.aiTraits && dna.aiTraits.length > 0 && (
            <ul className="space-y-1">
              {dna.aiTraits.map((trait) => (
                <li key={`${trait.dimension}-${trait.label}`} className="text-body-sm text-muted-foreground">
                  <span className="text-caption uppercase tracking-wide text-muted-foreground/70">
                    {trait.dimension}
                  </span>{" "}
                  <span className="font-medium text-foreground">{trait.label}</span> — {trait.evidence}
                </li>
              ))}
            </ul>
          )}
          <p className="text-caption text-muted-foreground">
            Aurora&apos;s interpretation of your taste, generated from your activity.
          </p>
        </div>
      )}

      {dna.yourTaste.length > 0 && <p className="text-h5 font-medium text-foreground">{dna.yourTaste.join(" · ")}</p>}

      {habits.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">Habits</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {habits.map((habit) => (
              <span key={habit.label} className="text-body-sm text-foreground" title={habit.evidence}>
                {habit.label}
                <span className="ml-1.5 text-caption text-muted-foreground">{habit.evidence}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
        <StrengthCluster title="Genres" values={dna.favoriteGenres} hrefFor={(g) => `/discover?genre=${slugifyGenre(g)}`} />
        <StrengthCluster title="Moods" values={dna.favoriteMoods} hrefFor={(m) => `/discover?mood=${encodeURIComponent(m)}`} />
      </div>

      {(dna.favoriteCreators.length > 0 || dna.favoriteActors.length > 0) && (
        <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
          <CreatorList title="Directors" values={dna.favoriteCreators} />
          <CreatorList title="Actors" values={dna.favoriteActors} />
        </div>
      )}

      {dna.favoriteArtists.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">Artists</p>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {dna.favoriteArtists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.slug}`}
                className="flex shrink-0 flex-col items-center gap-1.5 text-center"
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
                  <Image src={artist.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                </div>
                <span className="w-16 truncate text-caption text-muted-foreground">{artist.name}</span>
                {typeof artist.favoriteCount === "number" && (
                  <span className="text-caption text-muted-foreground/70">{artist.favoriteCount} fav.</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
