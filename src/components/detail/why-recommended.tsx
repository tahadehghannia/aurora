"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, ThumbsUp, ThumbsDown, EyeOff, UserX, TagX, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api/client";
import type { WhyThis } from "@/lib/recommendations/why-this";
import type { ContentCard } from "@/types/content";

interface WhyRecommendedProps {
  whyThis: WhyThis;
  card: Pick<ContentCard, "id" | "kind" | "moods" | "genres" | "creator" | "artistId">;
}

/** Inline headline + an expandable "Why this?" checklist with real feedback actions — no giant AI panel. */
export function WhyRecommended({ whyThis, card }: WhyRecommendedProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [markedUseful, setMarkedUseful] = useState(false);
  const [lastFeedbackId, setLastFeedbackId] = useState<string | null>(null);
  const { headline, reasons } = whyThis;

  const undo = async () => {
    if (!lastFeedbackId) return;
    setBusy("undo");
    try {
      await fetchJson("/api/taste/undo", { method: "POST", body: JSON.stringify({ feedbackId: lastFeedbackId }) });
      setLastFeedbackId(null);
      setDismissed(false);
      setMarkedUseful(false);
      toast.success("Undone.");
    } catch {
      toast.error("Couldn't undo that — try again.");
    } finally {
      setBusy(null);
    }
  };

  if (dismissed) {
    return (
      <p className="flex flex-wrap items-center gap-3 text-body-sm text-muted-foreground">
        Got it — we won&apos;t show you that again.
        {lastFeedbackId && (
          <button type="button" onClick={undo} disabled={busy !== null} className="inline-flex items-center gap-1 text-caption font-medium text-brand disabled:opacity-50">
            <Undo2 size={12} />
            Undo
          </button>
        )}
      </p>
    );
  }
  if (!headline && reasons.length === 0) return null;

  const topMood = card.moods?.[0];

  const moreLikeThis = async () => {
    if (!topMood) return;
    setBusy("more");
    try {
      await fetchJson("/api/taste/mood-feedback", { method: "POST", body: JSON.stringify({ mood: topMood, action: "more" }) });
      toast.success(`We'll lean into ${topMood.toLowerCase()} more.`);
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const notForMe = async () => {
    setBusy("not-for-me");
    try {
      const result = await fetchJson<{ feedbackId: string }>("/api/taste/dismiss", {
        method: "POST",
        body: JSON.stringify({ kind: card.kind, contentId: card.id }),
      });
      setLastFeedbackId(result.feedbackId);
      setDismissed(true);
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  /** The soft negative: ranks similar content down without ever hard-blocking it. */
  const lessLikeThis = async () => {
    setBusy("less");
    try {
      const result = await fetchJson<{ feedbackId: string; message: string }>("/api/taste/less-like-this", {
        method: "POST",
        body: JSON.stringify({ kind: card.kind, contentId: card.id }),
      });
      setLastFeedbackId(result.feedbackId);
      toast.success(result.message);
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const topGenre = card.genres?.[0];

  const hideGenre = async () => {
    if (!topGenre) return;
    setBusy("hide-genre");
    try {
      await fetchJson("/api/taste/mute", { method: "POST", body: JSON.stringify({ type: "genre", value: topGenre, muted: true }) });
      toast.success(`We'll stop suggesting ${topGenre.toLowerCase()}.`);
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const hideCreator = async () => {
    const key = card.creator ? `director:${card.creator}` : card.artistId ? `artist:${card.artistId}` : null;
    if (!key) return;
    setBusy("hide-creator");
    try {
      await fetchJson("/api/taste/mute", { method: "POST", body: JSON.stringify({ type: "creator", value: key, muted: true }) });
      toast.success(`We'll stop suggesting ${card.creator ?? "this artist"}.`);
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const markUseful = async () => {
    setBusy("useful");
    try {
      const result = await fetchJson<{ feedbackId: string; message: string }>("/api/taste/useful", {
        method: "POST",
        body: JSON.stringify({ kind: card.kind, contentId: card.id }),
      });
      setLastFeedbackId(result.feedbackId);
      setMarkedUseful(true);
      toast.success(result.message);
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {headline && <p className="text-body-sm text-muted-foreground">{headline}</p>}

      {reasons.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-caption font-medium text-brand"
            aria-expanded={open}
          >
            Why this?
            <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
          </button>

          {open && (
            <div className="mt-2 flex flex-col gap-3">
              <ul className="flex flex-col gap-1.5">
                {reasons.map((reason) => {
                  const line = (
                    <>
                      <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                      <span className={cn(reason.confidence === "low" && "italic")}>{reason.text}</span>
                    </>
                  );
                  return (
                    <li key={reason.text} className="flex items-start gap-2 text-body-sm text-muted-foreground">
                      {reason.discoveryHref ? (
                        <Link href={reason.discoveryHref} className="flex items-start gap-2 hover:text-foreground">
                          {line}
                        </Link>
                      ) : (
                        line
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                {!markedUseful && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={markUseful}
                    className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                  >
                    <Sparkles size={12} />
                    This was useful
                  </button>
                )}
                {markedUseful && (
                  <span className="inline-flex items-center gap-1 text-success">
                    <Sparkles size={12} />
                    Thanks!
                  </span>
                )}
                {topMood && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={moreLikeThis}
                    className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                  >
                    <ThumbsUp size={12} />
                    More like this
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={lessLikeThis}
                  className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                >
                  <ThumbsDown size={12} />
                  Less like this
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={notForMe}
                  className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                >
                  <EyeOff size={12} />
                  Not for me
                </button>
                {lastFeedbackId && !markedUseful && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={undo}
                    className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover disabled:opacity-50"
                  >
                    <Undo2 size={12} />
                    Undo
                  </button>
                )}
                {(card.creator || card.artistId) && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={hideCreator}
                    className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                  >
                    <UserX size={12} />
                    Hide {card.creator ?? "artist"}
                  </button>
                )}
                {topGenre && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={hideGenre}
                    className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-50"
                  >
                    <TagX size={12} />
                    Hide {topGenre.toLowerCase()}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
