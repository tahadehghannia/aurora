import type { Metadata } from "next";
import { Star } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { ContentGrid } from "@/components/content/content-grid";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Ratings · Library" };

export default async function RatingsLibraryPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const ratings = await prisma.rating.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  const cards = (
    await Promise.all(
      ratings.map(async (r) => {
        const card = await getCardByKindAndId(CONTENT_KIND_FROM_TYPE[r.contentType], r.contentId);
        return card ? { ...card, subtitle: `Your rating: ${r.score.toFixed(1)}` } : null;
      })
    )
  ).filter((c) => c !== null);

  if (cards.length === 0) {
    return (
      <EmptyState icon={Star} title="No ratings yet" description="Rate movies, shows and music to sharpen your recommendations." />
    );
  }

  return <ContentGrid items={cards} />;
}
