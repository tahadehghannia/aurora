import Link from "next/link";
import { MoodEntry } from "@/components/mood/mood-entry";
import type { MoodWatchlistSummary } from "@/lib/mood/store";

/**
 * Mood watchlists on Profile (§38).
 *
 * Lives on the Collections tab, not Overview — Profile stays centred on the
 * Entertainment Identity, and these are artefacts of it rather than the thing
 * itself.
 */
export function MoodWatchlistsSection({ watchlists }: { watchlists: MoodWatchlistSummary[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-h6 font-semibold">Your AI watchlists</h2>
          <p className="text-body-sm text-muted-foreground">Lists built from a mood you described.</p>
        </div>
        {watchlists.length > 0 && <MoodEntry variant="inline" label="Create another" />}
      </div>

      {watchlists.length === 0 ? (
        <MoodEntry />
      ) : (
        <ul className="divide-y divide-border">
          {watchlists.map((item) => (
            <li key={item.id}>
              <Link
                href={`/mood/${item.id}`}
                className="flex items-baseline justify-between gap-4 py-3 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-medium text-foreground">{item.title}</span>
                  <span className="block truncate text-caption text-muted-foreground">
                    &ldquo;{item.prompt}&rdquo;
                  </span>
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">{item.itemCount} titles</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
