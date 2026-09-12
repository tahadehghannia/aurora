import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { getCardByKindAndId } from "@/lib/content/queries";
import { getEntertainmentDNA } from "@/lib/taste/dna";
import { getMoodProfile } from "@/lib/taste/mood-profile";
import { getTasteEvolution } from "@/lib/taste/evolution";
import { getTasteStats } from "@/lib/taste/stats";
import { getTasteInsights } from "@/lib/taste/insights";
import { getFavoriteContent } from "@/lib/taste/favorites";
import { getJournal } from "@/lib/taste/journal";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { ProfileHeader } from "@/components/profile/profile-header";
import { FollowButton } from "@/components/profile/follow-button";
import { EntertainmentDnaSection } from "@/components/profile/entertainment-dna";
import { MoodProfileSection } from "@/components/profile/mood-profile-section";
import { TasteEvolutionSection } from "@/components/profile/taste-evolution-section";
import { TasteStatsSection } from "@/components/profile/taste-stats-section";
import { AiInsights } from "@/components/profile/ai-insights";
import { FavoriteContentSections } from "@/components/profile/favorite-content-sections";
import { CreatorsSection } from "@/components/profile/creators-section";
import { RatingsSection } from "@/components/profile/ratings-section";
import { CollectionsPreview } from "@/components/profile/collections-preview";
import { PlaylistsPreview } from "@/components/profile/playlists-preview";
import { JournalSection } from "@/components/profile/journal-section";
import { EmptyState } from "@/components/states/empty-state";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const session = await requireSession();
  const { username } = await params;

  const profileUser = await prisma.user.findFirst({
    where: { profile: { username } },
    include: { profile: true },
  });
  if (!profileUser || !profileUser.profile) notFound();
  if (profileUser.id === session.user.id) redirect("/profile");

  const profile = profileUser.profile;
  const userId = profileUser.id;

  const [ratingCount, savedCount, collectionCount, playlistCount, isFollowing] = await Promise.all([
    prisma.rating.count({ where: { userId } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    prisma.playlist.count({ where: { userId } }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: session.user.id, followingId: userId } },
    }),
  ]);

  const header = (
    <ProfileHeader
      name={profileUser.name ?? profile.username}
      username={profile.username}
      bio={profile.bio}
      image={profileUser.image}
      memberSince={profile.createdAt}
      isOwnProfile={false}
      counts={{ ratings: ratingCount, saved: savedCount, collections: collectionCount, playlists: playlistCount }}
      socialAction={<FollowButton userId={userId} initialFollowing={!!isFollowing} />}
    />
  );

  if (!profile.isPublic) {
    return (
      <div className="flex flex-col gap-10 px-4 py-8 sm:px-8">
        {header}
        <EmptyState icon={Lock} title="This profile is private" description="Only the account owner can see this profile's details." />
      </div>
    );
  }

  const [signal, moodProfile, evolution, stats, insights, favorites, journal, ratingRows, collectionsList, playlistsList] =
    await Promise.all([
      buildTasteSignal(userId),
      getMoodProfile(userId),
      getTasteEvolution(userId),
      getTasteStats(userId),
      getTasteInsights(userId),
      getFavoriteContent(userId),
      getJournal(userId, "all"),
      prisma.rating.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.collection.findMany({
        where: { userId, isPublic: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { _count: { select: { items: true } } },
      }),
      prisma.playlist.findMany({
        where: { userId, isPublic: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { _count: { select: { items: true } } },
      }),
    ]);

  const dna = await getEntertainmentDNA(userId, signal);

  const ratedItems = profile.showRatingsPublicly
    ? (
        await Promise.all(
          ratingRows.map(async (r) => {
            const card = await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId);
            return card ? { card, score: r.score, ratedAt: r.createdAt } : null;
          })
        )
      ).filter((r): r is { card: NonNullable<typeof r>["card"]; score: number; ratedAt: Date } => r !== null)
    : [];

  return (
    <div className="flex flex-col gap-10 px-4 py-8 sm:px-8">
      {header}

      {profile.showTasteDataPublicly && (
        <>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px] lg:items-start lg:gap-8">
            <div className="flex flex-col gap-10">
              <EntertainmentDnaSection dna={dna} />
              <MoodProfileSection profile={moodProfile} interactive={false} />
              <TasteEvolutionSection evolution={evolution} />
            </div>
            <div className="lg:sticky lg:top-8">
              <TasteStatsSection stats={stats} />
            </div>
          </div>
          <CreatorsSection dna={dna} />
          <AiInsights insights={insights} />
        </>
      )}

      {profile.showRatingsPublicly && (
        <>
          <FavoriteContentSections favorites={favorites} />
          <RatingsSection items={ratedItems} sort="newest" total={ratingCount} />
        </>
      )}

      {profile.showCollectionsPublicly && (
        <>
          <CollectionsPreview
            collections={collectionsList.map((c) => ({ id: c.id, title: c.title, description: c.description, itemCount: c._count.items }))}
            isOwnProfile={false}
          />
          <PlaylistsPreview
            playlists={playlistsList.map((p) => ({ id: p.id, title: p.title, description: p.description, itemCount: p._count.items }))}
            isOwnProfile={false}
          />
        </>
      )}

      {profile.showActivityPublicly && <JournalSection initialEntries={journal} />}
    </div>
  );
}
