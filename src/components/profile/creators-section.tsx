import Link from "next/link";
import Image from "next/image";
import type { EntertainmentDNA, WeightedLabel } from "@/lib/taste/dna";

interface CreatorsSectionProps {
  dna: EntertainmentDNA;
}

function roleLine(role: string, favoriteCount?: number): string {
  if (typeof favoriteCount !== "number") return role;
  return `${role} · ${favoriteCount} favorite${favoriteCount === 1 ? "" : "s"}`;
}

function InitialsCard({ name, role, favoriteCount }: { name: string; role: string; favoriteCount?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <Link
      href={`/search?q=${encodeURIComponent(name)}`}
      className="flex shrink-0 flex-col items-center gap-1.5 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-body-sm font-medium text-foreground">
        {initials}
      </div>
      <span className="w-20 truncate text-caption text-foreground">{name}</span>
      <span className="text-caption text-muted-foreground">{roleLine(role, favoriteCount)}</span>
    </Link>
  );
}

/** Directors and actors have no stored artwork, so they render as initials cards; artists reuse their real photo. */
export function CreatorsSection({ dna }: CreatorsSectionProps) {
  const hasAny = dna.favoriteCreators.length + dna.favoriteActors.length + dna.favoriteArtists.length > 0;
  if (!hasAny) return null;

  const byCreator: WeightedLabel[] = dna.favoriteCreators;

  return (
    <section className="space-y-3">
      <h2 className="text-h6 font-semibold">Favorite Creators</h2>
      <div className="flex gap-5 overflow-x-auto pb-1">
        {byCreator.map((c) => (
          <InitialsCard key={`director-${c.name}`} name={c.name} role="Director" favoriteCount={c.favoriteCount} />
        ))}
        {dna.favoriteActors.map((a) => (
          <InitialsCard key={`actor-${a.name}`} name={a.name} role="Actor" favoriteCount={a.favoriteCount} />
        ))}
        {dna.favoriteArtists.map((artist) => (
          <Link
            key={artist.id}
            href={`/artist/${artist.slug}`}
            className="flex shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
              <Image src={artist.imageUrl} alt="" fill sizes="56px" className="object-cover" />
            </div>
            <span className="w-20 truncate text-caption text-foreground">{artist.name}</span>
            <span className="text-caption text-muted-foreground">{roleLine("Artist", artist.favoriteCount)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
