import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCardByKindAndId } from "@/lib/content/queries";
import { CONTENT_KIND_FROM_TYPE } from "@/types/content";
import { CollectionItemsGrid } from "@/components/library/collection-items-grid";

interface CollectionPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id }, select: { title: true } });
  return { title: collection ? `${collection.title} · Library` : "Collection" };
}

export default async function CollectionDetailPage({ params }: CollectionPageProps) {
  const { id } = await params;
  const session = await requireSession();
  const userId = session.user.id;

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (!collection || (collection.userId !== userId && !collection.isPublic)) {
    notFound();
  }

  const cards = (
    await Promise.all(
      collection.items.map((item) => getCardByKindAndId(CONTENT_KIND_FROM_TYPE[item.contentType], item.contentId))
    )
  ).filter((c) => c !== null);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h5 font-semibold">{collection.title}</h2>
        {collection.description && <p className="text-body-sm text-muted-foreground">{collection.description}</p>}
      </div>

      <CollectionItemsGrid collectionId={collection.id} initialItems={cards} />
    </div>
  );
}
