import type { Metadata } from "next";
import Link from "next/link";
import { FolderHeart } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EmptyState } from "@/components/states/empty-state";
import { CreateCollectionDialog } from "@/components/library/create-collection-dialog";
import { AiWatchlistDialog } from "@/components/library/ai-watchlist-dialog";

export const metadata: Metadata = { title: "Collections · Library" };

export default async function CollectionsLibraryPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end gap-2">
        <AiWatchlistDialog />
        <CreateCollectionDialog />
      </div>

      {collections.length === 0 ? (
        <EmptyState
          icon={FolderHeart}
          title="No collections yet"
          description="Group movies, shows and music into your own themed collections."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/library/collections/${c.id}`}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <p className="font-medium">{c.title}</p>
              {c.description && <p className="line-clamp-2 text-body-sm text-muted-foreground">{c.description}</p>}
              <p className="mt-1 text-caption text-muted-foreground">
                {c._count.items} item{c._count.items === 1 ? "" : "s"} · {c.isPublic ? "Public" : "Private"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
