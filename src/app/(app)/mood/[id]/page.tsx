import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getMoodWatchlist } from "@/lib/mood/store";
import { PERSONALIZATION_COPY } from "@/lib/mood/compose";
import { SavedMoodWatchlistActions } from "@/components/mood/saved-actions";
import { CONTENT_ROUTE } from "@/types/content";

export const metadata: Metadata = { title: "Watchlist" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SavedMoodWatchlistPage({ params }: Props) {
  const session = await requireSession();
  const { id } = await params;

  const watchlist = await getMoodWatchlist(session.user.id, id);
  if (!watchlist) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="space-y-3">
        <p className="text-caption text-muted-foreground">
          <Link href="/mood" className="hover:text-foreground">
            Create with AI
          </Link>
        </p>
        <h1 className="text-h3 font-semibold tracking-tight text-foreground">{watchlist.title}</h1>
        <p className="text-body text-muted-foreground">{watchlist.description}</p>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Why Aurora made this for you
          </h2>
          <p className="mt-1.5 text-body-sm text-foreground">{watchlist.whyThisList}</p>
          <p className="mt-2 text-caption text-muted-foreground">
            {PERSONALIZATION_COPY[watchlist.personalization]}
          </p>
        </div>

        <p className="text-caption text-muted-foreground">
          From your request: &ldquo;{watchlist.prompt}&rdquo;
        </p>
      </header>

      <ol className="space-y-3">
        {watchlist.items.map((item, index) => {
          const href = `/${CONTENT_ROUTE[item.card.kind]}/${item.card.slug}`;
          return (
            <li key={item.card.id} className="flex gap-3 rounded-lg border border-border bg-card p-3 sm:gap-4">
              <span className="w-5 shrink-0 pt-1 text-right text-caption tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <Link href={href} className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-muted sm:h-28 sm:w-20">
                {item.card.imageUrl && (
                  <Image src={item.card.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                )}
              </Link>
              <div className="min-w-0 flex-1 space-y-1">
                <Link href={href}>
                  <p className="truncate text-body font-medium text-foreground hover:text-brand">{item.card.title}</p>
                </Link>
                <p className="text-caption text-muted-foreground">
                  {[item.year || null, item.runtimeMin ? `${item.runtimeMin} min` : null, item.card.genres?.[0]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-body-sm text-foreground/90">{item.reason}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <SavedMoodWatchlistActions id={watchlist.id} title={watchlist.title} prompt={watchlist.prompt} />
    </div>
  );
}
