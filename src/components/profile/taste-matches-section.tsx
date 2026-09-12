"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FollowButton } from "@/components/profile/follow-button";
import type { TasteMatch } from "@/lib/taste/taste-match";

interface TasteMatchesSectionProps {
  matches: TasteMatch[];
}

function TasteComparison({ match }: { match: TasteMatch }) {
  const [open, setOpen] = useState(false);
  if (match.genreComparison.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-caption font-medium text-brand"
        aria-expanded={open}
      >
        Compare taste
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">You</p>
            {match.genreComparison.map((g) => (
              <div key={`you-${g.genre}`} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-caption text-muted-foreground">{g.genre}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(4, g.you)}%` }} />
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">{match.name}</p>
            {match.genreComparison.map((g) => (
              <div key={`them-${g.genre}`} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-caption text-muted-foreground">{g.genre}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-info" style={{ width: `${Math.max(4, g.them)}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TasteMatchesSection({ matches }: TasteMatchesSectionProps) {
  if (matches.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Taste Neighbors</h2>
        <p className="text-body-sm text-muted-foreground">
          As more members join and you build up ratings, Aurora will surface people with similar taste.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h6 font-semibold">Taste Neighbors</h2>
        <p className="text-body-sm text-muted-foreground">People with similar taste — not follower counts.</p>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {matches.map((match) => (
          <div key={match.userId} className="flex flex-col gap-3 py-4 first:pt-0">
            <div className="flex items-center gap-3">
              <Link href={`/u/${match.username}`} className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                {match.image && <Image src={match.image} alt="" fill sizes="40px" className="object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-foreground">
                  You and{" "}
                  <Link href={`/u/${match.username}`} className="hover:underline">
                    {match.name}
                  </Link>{" "}
                  <span className="text-brand">{match.matchPct}% Taste Match</span>
                </p>
                {match.sharedGenres.length > 0 && (
                  <p className="truncate text-caption text-muted-foreground">
                    Shared: {match.sharedGenres.join(", ")}
                  </p>
                )}
              </div>
              <FollowButton userId={match.userId} initialFollowing={match.isFollowing} />
            </div>

            {match.commonFavorites.length > 0 && (
              <p className="text-caption text-muted-foreground">
                You both loved: {match.commonFavorites.map((f) => f.title).join(", ")}
              </p>
            )}

            {match.discoverFromThem.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-caption text-muted-foreground">
                  They liked, you haven&apos;t explored:
                </span>
                {match.discoverFromThem.slice(0, 3).map((card) => (
                  <Link
                    key={`${card.kind}-${card.id}`}
                    href={`/${card.kind === "tv_show" ? "show" : card.kind}/${card.slug}`}
                    className="text-caption text-foreground underline-offset-2 hover:underline"
                  >
                    {card.title}
                  </Link>
                ))}
              </div>
            )}

            <TasteComparison match={match} />
          </div>
        ))}
      </div>
    </section>
  );
}
