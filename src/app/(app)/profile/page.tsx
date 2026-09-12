import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { getCardByKindAndId } from "@/lib/content/queries";
import { getEntertainmentIdentity } from "@/lib/taste/identity";
import { getEntertainmentDNA } from "@/lib/taste/dna";
import { getEntertainmentHabits } from "@/lib/taste/habits";
import { getMoodProfile } from "@/lib/taste/mood-profile";
import { getTasteEvolution } from "@/lib/taste/evolution";
import { getTasteStats } from "@/lib/taste/stats";
import { getTasteInsights } from "@/lib/taste/insights";
import { getTasteMatches } from "@/lib/taste/taste-match";
import { getFriendsActivity } from "@/lib/taste/friends-activity";
import { getFavoriteContent } from "@/lib/taste/favorites";
import { getJournal } from "@/lib/taste/journal";
import { getRatingsDistribution } from "@/lib/taste/ratings-distribution";
import { getMilestones } from "@/lib/taste/milestones";
import { getRecentDiscoveries } from "@/lib/taste/discoveries";
import { getCollectionCovers, getPlaylistCovers } from "@/lib/taste/covers";
import { listMoodWatchlists } from "@/lib/mood/store";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { isProfileTab, type ProfileTab } from "@/components/profile/profile-tabs-config";
import { EntertainmentIdentity } from "@/components/profile/entertainment-identity";
import { IdentityCard } from "@/components/profile/identity-card";
import { EntertainmentDnaSection } from "@/components/profile/entertainment-dna";
import { MoodProfileSection } from "@/components/profile/mood-profile-section";
import { TasteEvolutionSection } from "@/components/profile/taste-evolution-section";
import { TasteStatsSection } from "@/components/profile/taste-stats-section";
import { ContentDistribution } from "@/components/profile/content-distribution";
import { AiInsights } from "@/components/profile/ai-insights";
import { TasteMatchesSection } from "@/components/profile/taste-matches-section";
import { FriendsActivitySection } from "@/components/profile/friends-activity-section";
import { FavoriteContentSections } from "@/components/profile/favorite-content-sections";
import { CreatorsSection } from "@/components/profile/creators-section";
import { RecentDiscoveries } from "@/components/profile/recent-discoveries";
import { DiscoveryMilestones } from "@/components/profile/discovery-milestones";
import { RatingsOverview } from "@/components/profile/ratings-overview";
import { RatingsSection, type RatingsSort } from "@/components/profile/ratings-section";
import { CollectionsPreview } from "@/components/profile/collections-preview";
import { PlaylistsPreview } from "@/components/profile/playlists-preview";
import { JournalSection } from "@/components/profile/journal-section";
import { NextDiscoveries } from "@/components/profile/next-discoveries";
import { MoodWatchlistsSection } from "@/components/mood/mood-watchlists-section";

export const metadata: Metadata = { title: "Profile" };

const RATINGS_PAGE_SIZE = 10;

function ratingsOrderBy(sort: RatingsSort) {
  if (sort === "highest") return { score: "desc" as const };
  if (sort === "lowest") return { score: "asc" as const };
  return { createdAt: "desc" as const };
}

interface ProfilePageProps {
  searchParams: Promise<{ tab?: string; ratingsSort?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await requireSession();
  const userId = session.user.id;
  const params = await searchParams;
  const tab: ProfileTab = isProfileTab(params.tab) ? params.tab : "overview";
  const ratingsSort: RatingsSort =
    params.ratingsSort === "highest" || params.ratingsSort === "lowest" ? params.ratingsSort : "newest";

  const [user, ratingCount, savedCount, collectionCount, playlistCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.rating.count({ where: { userId } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.playlist.count({ where: { userId } }),
  ]);

  return (
    <div className="flex flex-col gap-8 px-4 py-8 sm:px-8">
      <ProfileHeader
        name={user?.name ?? "Aurora member"}
        username={user?.profile?.username ?? ""}
        bio={user?.profile?.bio ?? null}
        image={user?.image ?? null}
        memberSince={user?.profile?.createdAt ?? new Date()}
        isOwnProfile
        counts={{ ratings: ratingCount, saved: savedCount, collections: collectionCount, playlists: playlistCount }}
      />

      <Suspense fallback={null}>
        <ProfileTabs active={tab} />
      </Suspense>

      {/* Each tab loads only its own data — the profile is far too data-heavy
          to fetch every section on every view. */}
      {tab === "overview" && <OverviewTab userId={userId} />}
      {tab === "taste" && <TasteTab userId={userId} />}
      {tab === "evolution" && <EvolutionTab userId={userId} />}
      {tab === "activity" && <ActivityTab userId={userId} ratingsSort={ratingsSort} ratingCount={ratingCount} />}
      {tab === "collections" && <CollectionsTab userId={userId} />}
      {tab === "community" && <CommunityTab userId={userId} />}
    </div>
  );
}

/**
 * Identity and its share card, behind their own Suspense boundary.
 *
 * Generating the identity copy can involve a model call, and the rest of the
 * Overview is instant — so this streams separately rather than holding the
 * whole tab on an AI round-trip (§27).
 */
async function IdentityBlock({ userId, stats }: { userId: string; stats: Awaited<ReturnType<typeof getTasteStats>> }) {
  const identity = await getEntertainmentIdentity(userId);
  return (
    <>
      <EntertainmentIdentity identity={identity} reveal />
      <IdentityCard identity={identity} stats={stats} />
    </>
  );
}

function IdentitySkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="h-10 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
      <div className="h-4 w-2/3 max-w-md animate-pulse rounded bg-muted" />
    </div>
  );
}

/** Overview — the emotional entry point. Identity first, then just enough to invite exploration. */
async function OverviewTab({ userId }: { userId: string }) {
  const [stats, insights, recentDiscoveries] = await Promise.all([
    getTasteStats(userId),
    getTasteInsights(userId),
    getRecentDiscoveries(userId),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <Suspense fallback={<IdentitySkeleton />}>
        <IdentityBlock userId={userId} stats={stats} />
      </Suspense>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-10">
          <AiInsights insights={insights} />
          <RecentDiscoveries items={recentDiscoveries} />
        </div>
        <div className="flex flex-col gap-6">
          <TasteStatsSection stats={stats} />
          <ContentDistribution stats={stats} />
        </div>
      </div>
    </div>
  );
}

/** Taste — the evidence underneath the identity. */
async function TasteTab({ userId }: { userId: string }) {
  const signal = await buildTasteSignal(userId);
  const [dna, habits, moodProfile, favorites] = await Promise.all([
    getEntertainmentDNA(userId, signal),
    getEntertainmentHabits(userId, signal),
    getMoodProfile(userId, signal),
    getFavoriteContent(userId),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <EntertainmentDnaSection dna={dna} habits={habits} />
      <MoodProfileSection profile={moodProfile} />
      <FavoriteContentSections favorites={favorites} />
      <CreatorsSection dna={dna} />
    </div>
  );
}

/** Evolution — a different question from Taste: what has changed? */
async function EvolutionTab({ userId }: { userId: string }) {
  const [evolution, insights, milestones] = await Promise.all([
    getTasteEvolution(userId),
    getTasteInsights(userId),
    getMilestones(userId),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <TasteEvolutionSection evolution={evolution} />
      <AiInsights insights={insights} />
      <DiscoveryMilestones milestones={milestones} />
    </div>
  );
}

async function ActivityTab({
  userId,
  ratingsSort,
  ratingCount,
}: {
  userId: string;
  ratingsSort: RatingsSort;
  ratingCount: number;
}) {
  const [journal, ratingRows, ratingsDistribution, stats] = await Promise.all([
    getJournal(userId, "all"),
    prisma.rating.findMany({ where: { userId }, orderBy: ratingsOrderBy(ratingsSort), take: RATINGS_PAGE_SIZE }),
    getRatingsDistribution(userId),
    getTasteStats(userId),
  ]);

  const ratedItems = (
    await Promise.all(
      ratingRows.map(async (r) => {
        const card = await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId);
        return card ? { card, score: r.score, ratedAt: r.createdAt } : null;
      })
    )
  ).filter((r): r is { card: NonNullable<typeof r>["card"]; score: number; ratedAt: Date } => r !== null);

  return (
    <div className="flex flex-col gap-12">
      <div id="ratings" className="space-y-6">
        <RatingsOverview distribution={ratingsDistribution} />
        <RatingsSection items={ratedItems} sort={ratingsSort} total={ratingCount} />
      </div>
      <JournalSection initialEntries={journal} />
      <TasteStatsSection stats={stats} />
    </div>
  );
}

async function CollectionsTab({ userId }: { userId: string }) {
  const [moodWatchlists, collectionsList, playlistsList] = await Promise.all([
    listMoodWatchlists(userId, 6),
    prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { _count: { select: { items: true } } },
    }),
    prisma.playlist.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const [collectionCovers, playlistCovers] = await Promise.all([
    getCollectionCovers(collectionsList.map((c) => c.id)),
    getPlaylistCovers(playlistsList.map((p) => p.id)),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <MoodWatchlistsSection watchlists={moodWatchlists} />
      <CollectionsPreview
        collections={collectionsList.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          itemCount: c._count.items,
          coverImages: collectionCovers.get(c.id) ?? [],
        }))}
        isOwnProfile
      />
      <PlaylistsPreview
        playlists={playlistsList.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          itemCount: p._count.items,
          coverImages: playlistCovers.get(p.id) ?? [],
        }))}
        isOwnProfile
      />
    </div>
  );
}

async function CommunityTab({ userId }: { userId: string }) {
  const [matches, friendsActivity, nextDiscoveries] = await Promise.all([
    getTasteMatches(userId),
    getFriendsActivity(userId),
    getRecommendationsForUser(userId, { limit: 8 }),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <TasteMatchesSection matches={matches} />
      <FriendsActivitySection items={friendsActivity} />
      <NextDiscoveries items={nextDiscoveries} />
    </div>
  );
}
