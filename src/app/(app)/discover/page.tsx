import type { Metadata } from "next";
import { Suspense } from "react";
import { Compass } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import {
  discoverContent,
  getGenres,
  getTrending,
  getNewReleases,
  getTopRated,
  getHiddenGems,
} from "@/lib/content/queries";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { ContentGrid, ContentGridSkeleton } from "@/components/content/content-grid";
import { ContentRow, ContentRowSkeleton } from "@/components/content/content-row";
import { RankedList } from "@/components/content/ranked-list";
import { EmptyState } from "@/components/states/empty-state";
import { MoodEntry } from "@/components/mood/mood-entry";
import { FilterBar } from "@/components/discover/filter-bar";

export const metadata: Metadata = { title: "Discover" };

interface DiscoverPageProps {
  searchParams: Promise<{ kind?: string; genre?: string; mood?: string; sort?: string }>;
}


/** Turns the active Discover filter into a sentence the mood parser understands. */
function moodPrompt(mood?: string, genre?: string): string | undefined {
  if (mood && genre) return `Something ${mood.toLowerCase()} — ${genre}`;
  if (mood) return `Something ${mood.toLowerCase()}`;
  if (genre) return `Something ${genre}`;
  return undefined;
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;
  const genres = await getGenres();
  const hasFilter = !!(params.kind || params.genre || params.mood || params.sort);

  return (
    <div className="flex flex-col gap-8 py-6">
      <div className="px-4 sm:px-8">
        <h1 className="text-h4 font-semibold">Discover</h1>
        <p className="text-body-sm text-muted-foreground">Explore without needing to search.</p>
      </div>

      {/* Bridges browsing into personalization, carrying the current filter as
          the request so the list starts from what they were already exploring (§39). */}
      <div className="px-4 sm:px-8">
        <MoodEntry
          prompt={moodPrompt(params.mood, params.genre)}
          label={
            params.mood || params.genre
              ? `Build a ${(params.mood ?? params.genre ?? "").toLowerCase()} watchlist for me`
              : undefined
          }
        />
      </div>

      <div className="px-4 sm:px-8">
        <FilterBar genres={genres.map((g) => g.name)} />
      </div>

      <Suspense
        fallback={
          hasFilter ? (
            <div className="px-4 sm:px-8">
              <ContentGridSkeleton count={18} />
            </div>
          ) : (
            <div className="flex flex-col gap-10 sm:px-8">
              <ContentRowSkeleton />
              <ContentRowSkeleton />
            </div>
          )
        }
      >
        {hasFilter ? (
          <div className="px-4 sm:px-8">
            <FilteredResults kind={params.kind} genre={params.genre} mood={params.mood} sort={params.sort} />
          </div>
        ) : (
          <CuratedDiscover />
        )}
      </Suspense>
    </div>
  );
}

async function FilteredResults({
  kind,
  genre,
  mood,
  sort,
}: {
  kind?: string;
  genre?: string;
  mood?: string;
  sort?: string;
}) {
  const items = await discoverContent({
    kind: kind as "movie" | "tv_show" | "music" | undefined,
    genre,
    mood,
    sort: sort as "popularity" | "rating" | "newest" | undefined,
    limit: 48,
  });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="Nothing matches these filters"
        description={mood ? `Nothing tagged ${mood.toLowerCase()} yet — try a different mood or genre.` : "Try a different genre or category."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mood && <p className="text-body-sm text-muted-foreground">Matching the {mood.toLowerCase()} mood</p>}
      <ContentGrid items={items} />
    </div>
  );
}

/** No filters applied — a curated front page instead of one undifferentiated grid. */
async function CuratedDiscover() {
  const session = await requireSession();

  const [forYourTaste, trending, newReleases, hiddenGems, topRated] = await Promise.all([
    getRecommendationsForUser(session.user.id, { limit: 14 }),
    getTrending(14),
    getNewReleases(14),
    getHiddenGems(12),
    getTopRated(16),
  ]);

  return (
    <div className="flex flex-col gap-12 sm:px-8">
      <ContentRow title="For your taste" items={forYourTaste} variant="large" />
      <ContentRow title="Trending now" items={trending} />
      <ContentRow title="New releases" items={newReleases} />
      <ContentRow
        title="Hidden gems"
        subtitle="Well-rated, less mainstream"
        items={hiddenGems}
        variant="compact"
      />
      <RankedList title="Top rated" items={topRated} />
    </div>
  );
}
