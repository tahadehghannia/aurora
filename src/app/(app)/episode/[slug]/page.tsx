import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getEpisodeBySlug } from "@/lib/content/queries";
import { getUserContentState } from "@/lib/content/user-state";
import { DetailActions } from "@/components/detail/detail-actions";

interface EpisodePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EpisodePageProps): Promise<Metadata> {
  const { slug } = await params;
  const episode = await getEpisodeBySlug(slug);
  return { title: episode ? `${episode.title} · ${episode.show.title}` : "Episode" };
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { slug } = await params;
  const episode = await getEpisodeBySlug(slug);
  if (!episode) notFound();

  const session = await requireSession();
  const userId = session.user.id;
  const { saved, userScore } = await getUserContentState(userId, "episode", episode.id);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="relative h-[36vh] min-h-56 w-full overflow-hidden sm:h-[42vh]">
        <Image src={episode.stillUrl ?? episode.show.posterUrl} alt="" fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      </section>

      <div className="flex flex-col gap-4 px-4 sm:px-8">
        <Link href={`/show/${episode.show.slug}`} className="text-body-sm text-ai hover:underline">
          {episode.show.title}
        </Link>
        <h1 className="text-h3 font-bold sm:text-h2">
          S{episode.season}E{episode.episodeNumber} · {episode.title}
        </h1>
        <div className="flex items-center gap-3 text-body-sm text-muted-foreground">
          {episode.runtimeMin && <span>{episode.runtimeMin} min</span>}
          {episode.communityRating > 0 && (
            <span className="flex items-center gap-1">
              <Star size={14} className="fill-rating text-rating" />
              {episode.communityRating.toFixed(1)} ({episode.ratingCount.toLocaleString()})
            </span>
          )}
        </div>

        <DetailActions
          kind="episode"
          contentId={episode.id}
          title={episode.title}
          initialSaved={saved}
          initialUserScore={userScore}
        />

        <div className="max-w-2xl space-y-2">
          <h2 className="text-h6 font-semibold">Overview</h2>
          <p className="text-body-md text-muted-foreground">{episode.overview}</p>
        </div>
      </div>
    </div>
  );
}
