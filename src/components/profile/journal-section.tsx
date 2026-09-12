"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Star, Eye, Headphones, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTENT_ROUTE, type ContentKind } from "@/types/content";
import type { JournalEntry, JournalFilter } from "@/lib/taste/journal";

interface JournalSectionProps {
  initialEntries: JournalEntry[];
}

const FILTERS: { value: JournalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv_show", label: "Shows" },
  { value: "music", label: "Music" },
];

const FILTER_KINDS: Record<Exclude<JournalFilter, "all">, ContentKind[]> = {
  movie: ["movie"],
  tv_show: ["tv_show", "episode"],
  music: ["artist", "album", "song"],
};

const KIND_ICON = { watched: Eye, listened: Headphones, rated: Star, saved: Bookmark } as const;

function describeEntry(entry: JournalEntry): string {
  switch (entry.kind) {
    case "watched":
      return "Watched";
    case "listened":
      return "Listened to";
    case "rated":
      return `Rated ${entry.score?.toFixed(1)}`;
    case "saved":
      return "Saved";
  }
}

/**
 * Filters entirely client-side over the entries the server already fetched
 * for the correct (possibly not-the-viewer) profile — no re-fetch, and no
 * risk of silently calling an API scoped to the viewer's own session while
 * looking at someone else's journal.
 */
export function JournalSection({ initialEntries }: JournalSectionProps) {
  const [filter, setFilter] = useState<JournalFilter>("all");

  const entries = useMemo(() => {
    if (filter === "all") return initialEntries;
    const kinds = FILTER_KINDS[filter];
    return initialEntries.filter((e) => kinds.includes(e.card.kind));
  }, [initialEntries, filter]);

  if (initialEntries.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Journal</h2>
        <p className="text-body-sm text-muted-foreground">Your watch, listen, rate and save history will appear here.</p>
      </section>
    );
  }

  // Group by calendar day for the "September 8 / September 7 / ..." reading pattern.
  const groups: { label: string; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const label = new Date(entry.at).toLocaleDateString(undefined, { month: "long", day: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h6 font-semibold">Journal</h2>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-caption font-medium transition-colors",
                filter === f.value ? "bg-surface-active text-brand" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">Nothing in this category yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
              <div className="flex flex-col gap-1">
                {group.entries.map((entry) => {
                  const Icon = KIND_ICON[entry.kind];
                  return (
                    <Link
                      key={entry.id}
                      href={`/${CONTENT_ROUTE[entry.card.kind]}/${entry.card.slug}`}
                      className="flex items-center gap-2.5 rounded-md px-1 py-1 text-body-sm transition-colors hover:bg-muted/50"
                    >
                      <Icon size={14} className="shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-foreground">{entry.card.title}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">{describeEntry(entry)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
