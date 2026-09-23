import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Info, Star } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getRecommendationsForUser, getBecauseYouLiked, getOutsideUsualTaste } from "@/lib/recommendations";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { getTrending, getTopRated, getRecentlyAdded, getRecentActivity, discoverContent } from "@/lib/content/queries";
import { ContentRow } from "@/components/content/content-row";
import { RankedList } from "@/components/content/ranked-list";
import { CrossMediaSection } from "@/components/content/cross-media-section";
import { getBeyondYourUsual } from "@/lib/crossmedia/discovery";
import { getOnePerfectPick } from "@/lib/recommendations/one-pick";
import { TonightsPick } from "@/components/home/tonights-pick";
import { TasteSummaryCard } from "@/components/home/taste-summary-card";
import { MoodEntry } from "@/components/mood/mood-entry";
import { getEntertainmentIdentity } from "@/lib/taste/identity";
import { getTasteInsights } from "@/lib/taste/insights";
import { Button } from "@/components/ui/button";
import { CONTENT_ROUTE } from "@/types/content";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [
    profile,
    recommendations,
    trending,
    topRated,
    recentlyAdded,
    recentActivity,
    signal,
    becauseYouLiked,
    outsideUsualTaste,
    beyondYourUsual,
    tasteInsights,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    getRecommendationsForUser(userId, { limit: 16 }),
    getTrending(12),
    getTopRated(12),
    getRecentlyAdded(12),
    getRecentActivity(userId, 12),
    buildTasteSignal(userId),
    getBecauseYouLiked(userId, 10),
    getOutsideUsualTaste(userId, 8),
    getBeyondYourUsual(userId),
    getTasteInsights(userId),
  ]);

  const topGenres = [...signal.genreWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([genre]) => genre);

  const genreRows = await Promise.all(
    topGenres.map(async (genre) => ({
      genre,
      items: await discoverContent({ genre: slugify(genre), limit: 12 }),
    }))
  );

  const hero = recommendations[0];
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-10 pb-16">
      <p className="px-4 pt-6 text-body-sm text-muted-foreground sm:px-8 sm:pt-8">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}.
      </p>

      {hero && (
        <section className="relative h-[52vh] min-h-80 w-full overflow-hidden sm:h-[60vh]">
          <Image src={hero.imageUrl} alt="" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-4 pb-8 sm:px-8 sm:pb-12">
            <p className="text-body-sm font-medium text-ai">
              {firstName ? `Picked for ${firstName}` : "Picked for you"}
            </p>
            <h1 className="max-w-xl text-h3 font-bold leading-tight sm:text-h1">{hero.title}</h1>
            {hero.reason && <p className="max-w-lg text-body-md text-muted-foreground">{hero.reason}</p>}
            <div className="mt-2 flex items-center gap-3">
              <Button size="lg" render={<Link href={`/${CONTENT_ROUTE[hero.kind]}/${hero.slug}`} />}>
                <Play className="fill-current" size={16} />
                View details
              </Button>
              {typeof hero.rating === "number" && hero.rating > 0 && (
                <span className="flex items-center gap-1 text-body-sm text-muted-foreground">
                  <Star size={15} className="fill-rating text-rating" />
                  {hero.rating.toFixed(1)}
                </span>
              )}
              <Link
                href={`/${CONTENT_ROUTE[hero.kind]}/${hero.slug}`}
                className="flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground"
              >
                <Info size={16} />
                More info
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Both of these can involve a model call. Streaming them separately
          keeps Home's hero and rails instant instead of holding the whole page
          on an AI round-trip — the same treatment Profile already gets (§27). */}
      <Suspense fallback={<PickSkeleton />}>
        <TonightsPickBlock userId={userId} />
      </Suspense>

      <Suspense fallback={<SummarySkeleton />}>
        <TasteSummaryBlock userId={userId} insight={tasteInsights[0] ?? null} />
      </Suspense>

      {/* A quiet doorway, sized as one row rather than a feature banner (§37). */}
      <div className="px-4 sm:px-8">
        <MoodEntry />
      </div>

      <div className="flex flex-col gap-12 sm:px-8">
        <ContentRow
          title="Recommended for you"
          subtitle="Based on what you love"
          items={recommendations}
          variant="large"
          href="/recommendations"
        />

        <ContentRow title="Recently watched" items={recentActivity} variant="compact" />

        {becauseYouLiked && (
          <ContentRow title={`Because you liked ${becauseYouLiked.sourceTitle}`} items={becauseYouLiked.items} />
        )}

        <CrossMediaSection result={beyondYourUsual} title="Beyond Your Usual" />

        <ContentRow title="Trending now" items={trending} />

        {genreRows.map(
          ({ genre, items }) => items.length > 0 && <ContentRow key={genre} title={`More ${genre}`} items={items} />
        )}

        <RankedList title="Top rated" items={topRated} />

        <ContentRow title="Recently added" items={recentlyAdded} variant="compact" />

        {outsideUsualTaste.length > 0 && (
          <ContentRow
            title="Something different"
            subtitle="Outside your usual taste, still worth a look"
            items={outsideUsualTaste}
            variant="compact"
          />
        )}
      </div>

      {profile && !profile.onboardingCompleted && (
        <div className="mx-4 rounded-xl border border-dashed border-border p-4 text-body-sm text-muted-foreground sm:mx-8">
          Finish{" "}
          <Link href="/onboarding" className="font-medium text-foreground hover:underline">
            setting up your taste profile
          </Link>{" "}
          to get sharper recommendations.
        </div>
      )}
    </div>
  );
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Tonight's pick, streamed — the AI chooses from Aurora's ranked shortlist. */
async function TonightsPickBlock({ userId }: { userId: string }) {
  const onePick = await getOnePerfectPick(userId);
  if (!onePick) return null;
  return (
    <div className="px-4 sm:px-8">
      <TonightsPick initialPick={onePick} />
    </div>
  );
}

/** The Home summary reads the same identity model Profile uses (§32). */
async function TasteSummaryBlock({ userId, insight }: { userId: string; insight: string | null }) {
  const identity = await getEntertainmentIdentity(userId);
  return (
    <div className="px-4 sm:px-8">
      <TasteSummaryCard identity={identity} insight={insight} />
    </div>
  );
}

function PickSkeleton() {
  return (
    <div className="px-4 sm:px-8" aria-hidden>
      <div className="h-36 w-full animate-pulse rounded-xl bg-muted/60" />
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-2 px-4 sm:px-8" aria-hidden>
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="h-5 w-56 animate-pulse rounded bg-muted" />
      <div className="h-3 w-72 max-w-full animate-pulse rounded bg-muted" />
    </div>
  );
}
