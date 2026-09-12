import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Star, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getMovieBySlug } from "@/lib/content/queries";
import { movieToCard } from "@/lib/content/mappers";
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

interface MoviePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MoviePageProps): Promise<Metadata> {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  return { title: movie?.title ?? "Movie" };
}

export default async function MoviePage({ params }: MoviePageProps) {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  if (!movie) notFound();

  const session = await requireSession();
  const userId = session.user.id;

  const [{ saved, userScore }, similar, signal, exploreBeyond, crossMedia] = await Promise.all([
    getUserContentState(userId, "movie", movie.id),
    getSimilarTo("movie", movie.id, 12),
    buildTasteSignal(userId),
    getExploreBeyond("movie", movie.id, userId, 8),
    getCrossMediaConnections("movie", movie.id, userId),
  ]);

  const card = movieToCard(movie);
  const whyThis = await whyRecommendedWithAi(card, signal, userId);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="relative h-[42vh] min-h-72 w-full overflow-hidden sm:h-[48vh]">
        <Image src={movie.backdropUrl ?? movie.posterUrl} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </section>

      <div className="-mt-32 flex flex-col gap-6 px-4 sm:flex-row sm:px-8">
        <div className="relative mx-auto h-56 w-40 shrink-0 overflow-hidden rounded-lg shadow-lg sm:mx-0 sm:h-72 sm:w-48">
          <Image src={movie.posterUrl} alt="" fill sizes="200px" className="object-cover" />
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <div className="space-y-1 text-center sm:text-left">
            {movie.tagline && <p className="text-body-sm italic text-muted-foreground">{movie.tagline}</p>}
            <h1 className="text-h3 font-bold sm:text-h2">{movie.title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-3 text-body-sm text-muted-foreground sm:justify-start">
              <span>{movie.releaseYear}</span>
              {movie.runtimeMin && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {movie.runtimeMin} min
                </span>
              )}
              {movie.communityRating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={14} className="fill-rating text-rating" />
                  {movie.communityRating.toFixed(1)} ({movie.ratingCount.toLocaleString()})
                </span>
              )}
              {movie.director && <span>Directed by {movie.director}</span>}
            </div>
          </div>

          <div className="flex justify-center sm:justify-start">
            <GenreBadges genres={movie.genres.map((g) => g.name)} />
          </div>

          <DetailActions kind="movie" contentId={movie.id} title={movie.title} initialSaved={saved} initialUserScore={userScore} />
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 sm:px-8">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-h6 font-semibold">Overview</h2>
          <p className="text-body-md text-muted-foreground">{movie.overview}</p>
          <WhyRecommended whyThis={whyThis} card={card} />
        </div>

        {movie.cast.length > 0 && (
          <div className="max-w-2xl space-y-2">
            <h2 className="text-h6 font-semibold">Cast</h2>
            <p className="text-body-sm text-muted-foreground">{movie.cast.join(", ")}</p>
          </div>
        )}
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
