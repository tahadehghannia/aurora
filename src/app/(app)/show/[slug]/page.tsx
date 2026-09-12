import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, Layers, Play } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getShowBySlug } from "@/lib/content/queries";
import { showToCard } from "@/lib/content/mappers";
import { getSimilarTo, getExploreBeyond } from "@/lib/recommendations";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { whyRecommendedWithAi } from "@/lib/recommendations/why-this";
import { getUserContentState } from "@/lib/content/user-state";
import { GenreBadges } from "@/components/detail/genre-badges";
import { DetailActions } from "@/components/detail/detail-actions";
import { WhyRecommended } from "@/components/detail/why-recommended";
import { ContentRow } from "@/components/content/content-row";
import { CrossMediaSection } from "@/components/content/cross-media-section";
import { getCrossMediaConnections } from "@/lib/crossmedia/discovery";

interface ShowPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ShowPageProps): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  return { title: show?.title ?? "TV Show" };
}

export default async function ShowPage({ params }: ShowPageProps) {
  const { slug } = await params;
  const show = await getShowBySlug(slug);
  if (!show) notFound();

  const session = await requireSession();
  const userId = session.user.id;

  const [{ saved, userScore }, similar, signal, exploreBeyond, crossMedia] = await Promise.all([
    getUserContentState(userId, "tv_show", show.id),
    getSimilarTo("tv_show", show.id, 12),
    buildTasteSignal(userId),
    getExploreBeyond("tv_show", show.id, userId, 8),
    getCrossMediaConnections("tv_show", show.id, userId),
  ]);

  const card = showToCard(show);
  const whyThis = await whyRecommendedWithAi(card, signal, userId);
  const seasons = [...new Set(show.episodes.map((e) => e.season))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="relative h-[42vh] min-h-72 w-full overflow-hidden sm:h-[48vh]">
        <Image src={show.backdropUrl ?? show.posterUrl} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </section>

      <div className="-mt-32 flex flex-col gap-6 px-4 sm:flex-row sm:px-8">
        <div className="relative mx-auto h-56 w-40 shrink-0 overflow-hidden rounded-lg shadow-lg sm:mx-0 sm:h-72 sm:w-48">
          <Image src={show.posterUrl} alt="" fill sizes="200px" className="object-cover" />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-1 text-center sm:text-left">
            {show.tagline && <p className="text-body-sm italic text-muted-foreground">{show.tagline}</p>}
            <h1 className="text-h3 font-bold sm:text-h2">{show.title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-3 text-body-sm text-muted-foreground sm:justify-start">
              <span>{show.firstAirYear}</span>
              <span className="flex items-center gap-1">
                <Layers size={14} />
                {show.seasonCount} season{show.seasonCount === 1 ? "" : "s"}
              </span>
              {show.communityRating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="fill-rating text-rating" />
                  {show.communityRating.toFixed(1)} ({show.ratingCount.toLocaleString()})
                </span>
              )}
              {show.creator && <span>Created by {show.creator}</span>}
            </div>
          </div>

          <div className="flex justify-center sm:justify-start">
            <GenreBadges genres={show.genres.map((g) => g.name)} />
          </div>

          <DetailActions kind="tv_show" contentId={show.id} title={show.title} initialSaved={saved} initialUserScore={userScore} />
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 sm:px-8">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-h6 font-semibold">Overview</h2>
          <p className="text-body-md text-muted-foreground">{show.overview}</p>
          <WhyRecommended whyThis={whyThis} card={card} />
        </div>

        {show.cast.length > 0 && (
          <div className="max-w-2xl space-y-2">
            <h2 className="text-h6 font-semibold">Cast</h2>
            <p className="text-body-sm text-muted-foreground">{show.cast.join(", ")}</p>
          </div>
        )}

        {seasons.map((season) => (
          <div key={season} className="space-y-3">
            <h2 className="text-h6 font-semibold">Season {season}</h2>
            <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {show.episodes
                .filter((e) => e.season === season)
                .map((episode) => (
                  <Link
                    key={episode.id}
                    href={`/episode/${episode.slug}`}
                    className="flex items-center gap-4 p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                      {episode.stillUrl && <Image src={episode.stillUrl} alt="" fill sizes="96px" className="object-cover" />}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity hover:opacity-100">
                        <Play size={18} className="fill-white text-white" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-sm font-medium">
                        {episode.episodeNumber}. {episode.title}
                      </p>
                      <p className="line-clamp-1 text-caption text-muted-foreground">{episode.overview}</p>
                    </div>
                    {episode.communityRating > 0 && (
                      <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                        <Star size={12} className="fill-rating text-rating" />
                        {episode.communityRating.toFixed(1)}
                      </span>
                    )}
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-10 sm:px-8">
        <ContentRow title="More like this" items={similar} />
        {exploreBeyond.length > 0 && (
          <ContentRow title="Explore beyond this" subtitle="Same mood, a different genre" items={exploreBeyond} variant="compact" />
        )}
        <CrossMediaSection result={crossMedia} />
      </div>
    </div>
  );
}
