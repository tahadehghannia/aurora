"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Bookmark, Shuffle, EyeOff, ChevronDown, Check, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { CONTENT_ROUTE } from "@/types/content";
import type { OnePick } from "@/lib/recommendations/one-pick";

/**
 * One pick, not a wall of options. Everything shown — the reasons, the mood
 * line, the anchor titles — comes from the same personalization pipeline as
 * the rest of Aurora; nothing here is decorative.
 */
export function TonightsPick({ initialPick }: { initialPick: OnePick | null }) {
  const [pick, setPick] = useState(initialPick);
  const [busy, setBusy] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastFeedbackId, setLastFeedbackId] = useState<string | null>(null);

  if (!pick) return null;
  const { card, reasons, moodContext, likedAnchors } = pick;
  const href = `/${CONTENT_ROUTE[card.kind]}/${card.slug}`;

  const tryAnother = async () => {
    setBusy("another");
    try {
      const next = await fetchJson<OnePick | null>(`/api/recommendations/one-pick?exclude=${encodeURIComponent(pick.shownKeys.join(","))}`);
      if (!next) {
        toast("That's everything we'd confidently suggest right now.");
        return;
      }
      setPick(next);
      setShowWhy(false);
      setSaved(false);
      setLastFeedbackId(null);
    } catch {
      toast.error("Couldn't load another pick — try again.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    try {
      await fetchJson("/api/library", { method: "POST", body: JSON.stringify({ kind: card.kind, contentId: card.id }) });
      setSaved(true);
      toast.success("Saved to your library.");
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const notForMe = async () => {
    setBusy("not-for-me");
    try {
      const result = await fetchJson<{ feedbackId: string; message: string }>("/api/taste/dismiss", {
        method: "POST",
        body: JSON.stringify({ kind: card.kind, contentId: card.id }),
      });
      setLastFeedbackId(result.feedbackId);
      toast.success(result.message);
      await tryAnother();
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (!lastFeedbackId) return;
    setBusy("undo");
    try {
      await fetchJson("/api/taste/undo", { method: "POST", body: JSON.stringify({ feedbackId: lastFeedbackId }) });
      setLastFeedbackId(null);
      toast.success("Undone — that's back in your recommendations.");
    } catch {
      toast.error("Couldn't undo that — try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <Link href={href} className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-lg bg-muted sm:w-40">
        <Image src={card.imageUrl} alt="" fill sizes="160px" className="object-cover" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="space-y-1">
          <p className="text-caption font-medium uppercase tracking-wide text-brand">Tonight&apos;s Pick</p>
          <h2 className="text-h4 font-semibold">
            <Link href={href} className="hover:underline">
              {card.title}
            </Link>
          </h2>
          {card.subtitle && <p className="text-body-sm text-muted-foreground">{card.subtitle}</p>}
        </div>

        {reasons.length > 0 && <p className="text-body-sm text-muted-foreground">{reasons[0].text}</p>}

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-muted-foreground">
          {likedAnchors.length > 0 && <span>You recently liked {likedAnchors.join(" and ")}</span>}
          {moodContext && (
            <span>
              Your mood: <span className="text-foreground">{moodContext}</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" render={<Link href={href} />}>
            <Play className="fill-current" size={14} />
            View details
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || saved} onClick={save}>
            <Bookmark size={14} className={cn(saved && "fill-current")} />
            {saved ? "Saved" : "Save"}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={tryAnother}>
            <Shuffle size={14} />
            Try another
          </Button>
          <Button size="sm" variant="ghost" disabled={busy !== null} onClick={notForMe}>
            <EyeOff size={14} />
            Not for me
          </Button>
          {lastFeedbackId && (
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={undo}>
              <Undo2 size={14} />
              Undo
            </Button>
          )}
        </div>

        {reasons.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              className="inline-flex items-center gap-1 text-caption font-medium text-brand"
              aria-expanded={showWhy}
            >
              Why this?
              <ChevronDown size={12} className={cn("transition-transform", showWhy && "rotate-180")} />
            </button>
            {showWhy && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {reasons.map((reason) => (
                  <li key={reason.text} className="flex items-start gap-2 text-body-sm text-muted-foreground">
                    <Check size={14} className="mt-0.5 shrink-0 text-brand" />
                    {reason.discoveryHref ? (
                      <Link href={reason.discoveryHref} className="hover:text-foreground">
                        {reason.text}
                      </Link>
                    ) : (
                      <span className={cn(reason.confidence === "low" && "italic")}>{reason.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
