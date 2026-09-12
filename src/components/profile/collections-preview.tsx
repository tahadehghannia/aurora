import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";

interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
  coverImages?: string[];
}

interface CollectionsPreviewProps {
  collections: CollectionSummary[];
  isOwnProfile: boolean;
}

function CoverMosaic({ images }: { images: string[] }) {
  if (images.length === 0) {
    return <div className="aspect-video w-full rounded-lg bg-muted" />;
  }
  if (images.length === 1) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <Image src={images[0]} alt="" fill sizes="240px" className="object-cover" />
      </div>
    );
  }
  return (
    <div className="grid aspect-video w-full grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-muted">
      {Array.from({ length: 4 }, (_, i) => images[i]).map((src, i) =>
        src ? (
          <div key={i} className="relative">
            <Image src={src} alt="" fill sizes="120px" className="object-cover" />
          </div>
        ) : (
          <div key={i} className="bg-muted" />
        )
      )}
    </div>
  );
}

export function CollectionsPreview({ collections, isOwnProfile }: CollectionsPreviewProps) {
  if (collections.length === 0 && !isOwnProfile) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h6 font-semibold">Collections</h2>
        {isOwnProfile && (
          <Link href="/library/collections" className="text-caption text-muted-foreground hover:text-foreground">
            {collections.length > 0 ? "View all" : "Create one"} →
          </Link>
        )}
      </div>

      {collections.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">No collections yet — group titles into themed sets like &ldquo;Late Night Cinema.&rdquo;</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/library/collections/${c.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20"
            >
              <CoverMosaic images={c.coverImages ?? []} />
              <div>
                <p className="font-medium text-foreground">{c.title}</p>
                {c.description && <p className="line-clamp-2 text-body-sm text-muted-foreground">{c.description}</p>}
                <p className="mt-1 text-caption text-muted-foreground">
                  {c.itemCount} item{c.itemCount === 1 ? "" : "s"}
                </p>
              </div>
            </Link>
          ))}
          {isOwnProfile && (
            <Link
              href="/library/collections"
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-4 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus size={18} />
              <span className="text-body-sm">New collection</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
