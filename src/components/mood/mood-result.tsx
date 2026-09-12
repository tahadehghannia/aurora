"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RefreshCw, X, Repeat, ThumbsDown, Ban, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { CONTENT_ROUTE } from "@/types/content";
import { PERSONALIZATION_COPY } from "@/lib/mood/compose";
import { REFINEMENT_LABELS, REFINEMENT_PRESETS, type RefinementPreset } from "@/lib/mood/refine";
import type { GeneratedMoodWatchlist, MoodWatchlistItem } from "@/lib/mood/watchlist-types";

/**
 * The generated watchlist, rendered as an editorial list rather than a grid of
 * cards (§47): artwork, title, the few facts that matter, and one line saying
 * why it's here.
 *
 * The provenance line is not decoration. A user is entitled to know whether a
 * model wrote this copy or Aurora's own ranking did, so the component states it
 * plainly instead of implying AI involvement that didn't happen.
 */

interface MoodResultProps {
  watchlist: GeneratedMoodWatchlist;
  onRemoveItem: (contentId: string) => void;
  onReplaceItem: (contentId: string) => Promise<void>;
  onRefine: (preset: RefinementPreset) => void;
  onRegenerate: () => void;
  onStartOver: () => void;
  onSave: () => void;
  saving: boolean;
  busy: boolean;
}

function metadata(item: MoodWatchlistItem): string {
  const parts: string[] = [];
  if (item.year) parts.push(String(item.year));
  // Runtime is stated only when known — never inferred (§21).
  if (item.runtimeMin) parts.push(`${item.runtimeMin} min`);
  else if (item.card.kind === "movie") parts.push("Runtime unavailable");
  const genre = item.card.genres?.[0];
  if (genre) parts.push(genre);
  return parts.join(" · ");
}

export function MoodResult({
  watchlist,
  onRemoveItem,
  onReplaceItem,
  onRefine,
  onRegenerate,
  onStartOver,
  onSave,
  saving,
  busy,
}: MoodResultProps) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});

  const sendFeedback = async (item: MoodWatchlistItem, endpoint: string, label: string) => {
    try {
      await fetchJson(endpoint, {
        method: "POST",
        body: JSON.stringify({ kind: item.card.kind, contentId: item.card.id }),
      });
      setFeedbackGiven((prev) => ({ ...prev, [item.card.id]: label }));
      toast.success(`Noted — ${label.toLowerCase()}.`);
      // "Not for me" is a removal as well as a signal.
      if (endpoint.endsWith("/dismiss")) onRemoveItem(item.card.id);
    } catch {
      toast.error("Couldn't record that just now.");
    }
  };

  const replace = async (contentId: string) => {
    setReplacing(contentId);
    try {
      await onReplaceItem(contentId);
    } finally {
      setReplacing(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-h4 font-semibold tracking-tight text-foreground">{watchlist.title}</h2>
          <p className="text-body text-muted-foreground">{watchlist.description}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Why Aurora made this for you
          </h3>
          <p className="mt-1.5 text-body-sm text-foreground">{watchlist.whyThisList}</p>

          {watchlist.insufficientData && (
            <p className="mt-2 text-caption text-muted-foreground">
              We&apos;re still learning your taste — rate a few things and these lists get sharper.
            </p>
          )}
          {!watchlist.insufficientData && (
            <p className="mt-2 text-caption text-muted-foreground">
              {PERSONALIZATION_COPY[watchlist.personalization]}
            </p>
          )}
        </div>

        {/* Provenance. Never implies AI did work it didn't do. */}
        <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {watchlist.ai.curated
              ? "Chosen by AI from titles Aurora ranked for you"
              : (watchlist.ai.note ?? "Ranked by Aurora from your taste and request")}
            {` · picked from ${watchlist.poolSize} candidates.`}
          </span>
        </p>
      </header>

      <ol className="space-y-3" aria-label="Your watchlist">
        {watchlist.items.map((item, index) => {
          const href = `/${CONTENT_ROUTE[item.card.kind]}/${item.card.slug}`;
          const given = feedbackGiven[item.card.id];

          return (
            <li
              key={item.card.id}
              className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-border/80 sm:gap-4"
            >
              <span className="w-5 shrink-0 pt-1 text-right text-caption tabular-nums text-muted-foreground">
                {index + 1}
              </span>

              <Link href={href} className="relative h-24 w-16 shrink-0 overflow-hidden rounded bg-muted sm:h-28 sm:w-20">
                {item.card.imageUrl && (
                  <Image src={item.card.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                )}
              </Link>

              <div className="min-w-0 flex-1 space-y-1">
                <Link href={href} className="block">
                  <p className="truncate text-body font-medium text-foreground hover:text-brand">{item.card.title}</p>
                </Link>
                <p className="text-caption text-muted-foreground">{metadata(item)}</p>
                <p className="text-body-sm text-foreground/90">{item.reason}</p>

                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => void replace(item.card.id)}
                    disabled={busy || replacing === item.card.id}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
                  >
                    {replacing === item.card.id ? (
                      <Loader2 size={12} className="animate-spin" aria-hidden />
                    ) : (
                      <Repeat size={12} aria-hidden />
                    )}
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendFeedback(item, "/api/taste/less-like-this", "Less like this")}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <ThumbsDown size={12} aria-hidden />
                    Less like this
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendFeedback(item, "/api/taste/dismiss", "Not for me")}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Ban size={12} aria-hidden />
                    Not for me
                  </button>
                  {/* Text, not just colour, so the state isn't colour-dependent (§44). */}
                  {given && <span className="px-1.5 text-caption text-brand">{given} — noted</span>}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRemoveItem(item.card.id)}
                aria-label={`Remove ${item.card.title} from this list`}
                className="h-fit shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>

      <section className="space-y-3 border-t border-border pt-5">
        <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Not quite right?</h3>
        <div className="flex flex-wrap gap-1.5">
          {REFINEMENT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onRefine(preset)}
              disabled={busy}
              className="rounded-full border border-border px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:border-brand hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              {REFINEMENT_LABELS[preset]}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={saving || busy || watchlist.items.length === 0}>
          {saving && <Loader2 className="animate-spin" size={16} aria-hidden />}
          Save watchlist
        </Button>
        <Button variant="outline" onClick={onRegenerate} disabled={busy}>
          <RefreshCw size={15} aria-hidden />
          Regenerate
        </Button>
        <Button variant="ghost" onClick={onStartOver} disabled={busy}>
          Try a different mood
        </Button>
      </div>
    </div>
  );
}
