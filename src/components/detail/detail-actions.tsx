"use client";

import { useState } from "react";
import { Bookmark, Share2, Eye, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/content/star-rating";
import { useToggleSave } from "@/hooks/use-library";
import { useRateContent } from "@/hooks/use-ratings";
import { useMarkActivity } from "@/hooks/use-activity";
import { AddToCollectionDialog } from "@/components/collections/add-to-collection-dialog";
import type { ContentKind } from "@/types/content";

interface DetailActionsProps {
  kind: ContentKind;
  contentId: string;
  title: string;
  initialSaved: boolean;
  initialUserScore: number;
}

const WATCHABLE: ContentKind[] = ["movie", "tv_show", "episode"];
const LISTENABLE: ContentKind[] = ["album", "song"];

export function DetailActions({ kind, contentId, title, initialSaved, initialUserScore }: DetailActionsProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [userScore, setUserScore] = useState(initialUserScore);

  const toggleSave = useToggleSave();
  const rate = useRateContent();
  const markActivity = useMarkActivity();

  const isWatchable = WATCHABLE.includes(kind);
  const isListenable = LISTENABLE.includes(kind);
  const hasActivityAction = isWatchable || isListenable;

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className={saved ? "border-brand bg-brand/10 text-brand hover:text-brand" : undefined}
          disabled={toggleSave.isPending}
          onClick={() => {
            const wasSaved = saved;
            setSaved(!wasSaved);
            toggleSave.mutate(
              { kind, contentId, saved: wasSaved },
              { onError: () => setSaved(wasSaved) }
            );
          }}
        >
          <Bookmark size={16} className={saved ? "fill-current" : undefined} />
          {saved ? "Saved" : "Save"}
        </Button>

        {hasActivityAction && (
          <Button
            variant="outline"
            onClick={() => markActivity.mutate({ kind, contentId })}
            disabled={markActivity.isPending}
          >
            {isWatchable ? <Eye size={16} /> : <Headphones size={16} />}
            {isWatchable ? "Mark watched" : "Mark listened"}
          </Button>
        )}

        <AddToCollectionDialog kind={kind} contentId={contentId} />

        <Button
          variant="ghost"
          size="icon"
          aria-label="Share"
          onClick={handleShare}
          className="relative after:absolute after:-inset-1.5 after:content-['']"
        >
          <Share2 size={16} />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <StarRating
          value={userScore}
          onChange={(value) => {
            setUserScore(value);
            rate.mutate({ kind, contentId, score: value });
          }}
        />
        {userScore > 0 && <span className="text-body-sm text-muted-foreground">Your rating: {userScore.toFixed(1)}</span>}
      </div>
    </div>
  );
}
