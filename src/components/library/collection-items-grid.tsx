"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, FolderHeart } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states/empty-state";
import { CONTENT_ROUTE, type ContentCard } from "@/types/content";
import { fetchJson } from "@/lib/api/client";

interface CollectionItemsGridProps {
  collectionId: string;
  initialItems: ContentCard[];
}

export function CollectionItemsGrid({ collectionId, initialItems }: CollectionItemsGridProps) {
  const [items, setItems] = useState(initialItems);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (item: ContentCard) => {
    setRemovingId(item.id);
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      await fetchJson(`/api/collections/${collectionId}/items`, {
        method: "DELETE",
        body: JSON.stringify({ kind: item.kind, contentId: item.id }),
      });
      toast.success(`Removed "${item.title}" from this collection.`);
    } catch (err) {
      setItems(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't remove that item.");
    } finally {
      setRemovingId(null);
    }
  };

  if (items.length === 0) {
    return <EmptyState icon={FolderHeart} title="This collection is empty" description="Save items into it from any detail page." />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="group flex flex-col gap-2">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
            <Link href={`/${CONTENT_ROUTE[item.kind]}/${item.slug}`}>
              {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="200px" className="object-cover" />}
            </Link>
            <button
              type="button"
              aria-label={`Remove ${item.title} from this collection`}
              disabled={removingId === item.id}
              onClick={() => handleRemove(item)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
          <Link href={`/${CONTENT_ROUTE[item.kind]}/${item.slug}`} className="min-w-0">
            <p className="truncate text-body-sm font-medium text-foreground">{item.title}</p>
            {item.subtitle && <p className="truncate text-caption text-muted-foreground">{item.subtitle}</p>}
          </Link>
        </div>
      ))}
    </div>
  );
}
