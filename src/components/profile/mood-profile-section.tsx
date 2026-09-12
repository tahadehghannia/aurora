"use client";

import { useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/api/client";
import type { MoodProfile, MoodEntry } from "@/lib/taste/mood-profile";

interface MoodProfileSectionProps {
  profile: MoodProfile;
  /** false on a public profile view — feedback always applies to the signed-in viewer, so it must not appear on someone else's profile. */
  interactive?: boolean;
}

function useFeedback(mood: string) {
  const [pending, setPending] = useState<"more" | "less" | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const send = async (action: "more" | "less") => {
    setPending(action);
    try {
      await fetchJson("/api/taste/mood-feedback", { method: "POST", body: JSON.stringify({ mood, action }) });
      if (action === "less") {
        setDismissed(true);
        toast.success(`Toned down ${mood.toLowerCase()} recommendations.`);
      } else {
        toast.success(`We'll lean into ${mood.toLowerCase()} more.`);
      }
    } catch {
      toast.error("Couldn't save that — try again.");
    } finally {
      setPending(null);
    }
  };

  return { pending, dismissed, send };
}

function FeedbackButtons({ mood, interactive, pending, send, showLess = true }: { mood: string; interactive: boolean; pending: "more" | "less" | null; send: (a: "more" | "less") => void; showLess?: boolean }) {
  if (!interactive) return null;
  return (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        aria-label={`More like ${mood}`}
        disabled={pending !== null}
        onClick={(e) => {
          e.preventDefault();
          send("more");
        }}
        className={cn("rounded p-0.5 text-muted-foreground hover:text-success", pending === "more" && "text-success")}
      >
        <ThumbsUp size={12} />
      </button>
      {showLess && (
        <button
          type="button"
          aria-label={`Less like ${mood}`}
          disabled={pending !== null}
          onClick={(e) => {
            e.preventDefault();
            send("less");
          }}
          className={cn("rounded p-0.5 text-muted-foreground hover:text-error", pending === "less" && "text-error")}
        >
          <ThumbsDown size={12} />
        </button>
      )}
    </div>
  );
}

/** A weighted horizontal bar — width from a real percentage when there's enough mood diversity to make one meaningful, otherwise a fixed rank-based width so the bar still reads as "roughly this strong" without implying false precision. */
function MoodBar({ entry, rankWidth, interactive }: { entry: MoodEntry; rankWidth: number; interactive: boolean }) {
  const { pending, dismissed, send } = useFeedback(entry.mood);
  if (dismissed) return null;
  const width = entry.percentage ?? rankWidth;

  return (
    <div className="group flex items-center gap-3 py-1">
      <Link href={`/discover?mood=${encodeURIComponent(entry.mood)}`} className="w-28 shrink-0 truncate text-body-sm text-foreground hover:text-brand sm:w-32">
        {entry.mood}
      </Link>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, width)}%` }} />
      </span>
      {typeof entry.percentage === "number" && <span className="w-9 shrink-0 text-right text-caption text-muted-foreground">{entry.percentage}%</span>}
      <FeedbackButtons mood={entry.mood} interactive={interactive} pending={pending} send={send} />
    </div>
  );
}

function PlainMoodRow({ mood, interactive }: { mood: string; interactive: boolean }) {
  const { pending, dismissed, send } = useFeedback(mood);
  if (dismissed) return null;

  return (
    <div className="group flex items-center gap-2">
      <Link href={`/discover?mood=${encodeURIComponent(mood)}`} className="rounded-full border border-dashed border-border px-3 py-1 text-body-sm text-muted-foreground hover:border-brand hover:text-foreground">
        {mood}
      </Link>
      <FeedbackButtons mood={mood} interactive={interactive} pending={pending} send={send} showLess={false} />
    </div>
  );
}

export function MoodProfileSection({ profile, interactive = true }: MoodProfileSectionProps) {
  if (!profile.hasEnoughSignal) {
    return (
      <section className="space-y-2">
        <h2 className="text-h6 font-semibold">Mood Profile</h2>
        <p className="text-body-sm text-muted-foreground">
          We need a few more ratings to understand the moods you gravitate toward.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h6 font-semibold">Mood Profile</h2>
        <p className="text-body-sm text-muted-foreground">The emotional states you tend to enjoy.</p>
      </div>

      <div>
        {profile.mostEnjoyed.map((entry, i) => (
          <MoodBar key={entry.mood} entry={entry} rankWidth={90 - i * 15} interactive={interactive} />
        ))}
      </div>

      {profile.recentlyExplored.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">Recently explored</p>
          <div className="flex flex-wrap gap-2">
            {profile.recentlyExplored.map((mood) => (
              <PlainMoodRow key={mood} mood={mood} interactive={interactive} />
            ))}
          </div>
        </div>
      )}

      {profile.emerging.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">Emerging</p>
          <div className="flex flex-wrap gap-2">
            {profile.emerging.map((mood) => (
              <PlainMoodRow key={mood} mood={mood} interactive={interactive} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
