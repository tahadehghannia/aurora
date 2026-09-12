import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { ContentGrid } from "@/components/content/content-grid";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Saved · Library" };

export default async function SavedLibraryPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const items = await prisma.savedItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const cards = (
    await Promise.all(items.map((item) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[item.contentType], item.contentId)))
  ).filter((c) => c !== null);

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="Nothing saved yet"
        description="Save movies, shows, artists, albums or songs to build your personal library."
      />
    );
  }

  return <ContentGrid items={cards} />;
}
