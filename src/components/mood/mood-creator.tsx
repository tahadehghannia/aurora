"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { MoodComposer, DEFAULT_CONTROLS, type MoodControls } from "@/components/mood/mood-composer";
import { MoodResult } from "@/components/mood/mood-result";
import type { RefinementPreset } from "@/lib/mood/refine";
import type { GeneratedMoodWatchlist, MoodWatchlistItem } from "@/lib/mood/watchlist-types";

/**
 * State for the whole create-with-AI flow.
 *
 * The preview lives here and is not persisted until the user says so (§25), so
 * removing, replacing and refining are all cheap and reversible up to the point
 * of saving. Every failure lands in a state the user can act on rather than an
 * empty screen (§41).
 */

interface MoodCreatorProps {
  /** Pre-fills the field when arriving from a mood or genre context (§39). */
  initialPrompt?: string;
  /** Generates immediately on mount — used by contextual entry points. */
  autoGenerate?: boolean;
}

function buildBody(prompt: string, controls: MoodControls) {
  return {
    prompt: prompt.trim(),
    size: controls.size,
    exploration: controls.exploration,
    audience: controls.audience === "" ? null : controls.audience,
    runtimeMaxMin: controls.runtimeMaxMin === "" ? null : controls.runtimeMaxMin,
    contentType: controls.contentType,
  };
}

export function MoodCreator({ initialPrompt = "", autoGenerate = false }: MoodCreatorProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [controls, setControls] = useState<MoodControls>(DEFAULT_CONTROLS);
  const [watchlist, setWatchlist] = useState<GeneratedMoodWatchlist | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seed = useRef(0);
  const started = useRef(false);

  const generate = useCallback(
    async (options: { preset?: RefinementPreset; excludeIds?: string[]; bumpSeed?: boolean; promptOverride?: string } = {}) => {
      const text = (options.promptOverride ?? prompt).trim();
      if (text.length < 2) return;

      setGenerating(true);
      setError(null);
      if (options.bumpSeed) seed.current += 1;

      try {
        const result = await fetchJson<GeneratedMoodWatchlist>("/api/mood/watchlist", {
          method: "POST",
          body: JSON.stringify({
            ...buildBody(text, controls),
            ...(options.preset ? { preset: options.preset } : {}),
            excludeIds: options.excludeIds ?? [],
            seed: seed.current,
          }),
        });
        setWatchlist(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Your watchlist couldn't be generated right now.");
      } finally {
        setGenerating(false);
      }
    },
    [prompt, controls]
  );

  // Contextual entry points (a mood chip on Discover, say) arrive ready to go.
  // The ref guards against a second run in StrictMode's double-invoked effects.
  useEffect(() => {
    if (!autoGenerate || !initialPrompt || started.current) return;
    started.current = true;
    void generate({ promptOverride: initialPrompt });
  }, [autoGenerate, initialPrompt, generate]);

  const removeItem = (contentId: string) => {
    setWatchlist((current) =>
      current ? { ...current, items: current.items.filter((item) => item.card.id !== contentId) } : current
    );
  };

  const replaceItem = async (contentId: string) => {
    if (!watchlist) return;
    try {
      const replacement = await fetchJson<MoodWatchlistItem>("/api/mood/watchlist/replace", {
        method: "POST",
        body: JSON.stringify({
          ...buildBody(watchlist.prompt, controls),
          excludeIds: watchlist.items.map((item) => item.card.id),
        }),
      });
      setWatchlist((current) =>
        current
          ? {
              ...current,
              // Swap in place so the rest of the list doesn't move under the user.
              items: current.items.map((item) => (item.card.id === contentId ? replacement : item)),
            }
          : current
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't find a replacement.");
    }
  };

  const save = async () => {
    if (!watchlist) return;
    setSaving(true);
    try {
      const { id } = await fetchJson<{ id: string }>("/api/mood/watchlist/save", {
        method: "POST",
        body: JSON.stringify({
          title: watchlist.title,
          description: watchlist.description,
          whyThisList: watchlist.whyThisList,
          prompt: watchlist.prompt,
          intent: watchlist.intent,
          exploration: watchlist.exploration,
          personalization: watchlist.personalization,
          aiCurated: watchlist.ai.curated,
          modelVersion: null,
          items: watchlist.items.map((item) => ({
            kind: item.card.kind,
            contentId: item.card.id,
            reason: item.reason,
            reasonType: item.reasonType,
          })),
        }),
      });
      toast.success("Saved to your watchlists.");
      router.push(`/mood/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that watchlist.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Announced for screen readers without stealing focus (§44). */}
      <p aria-live="polite" className="sr-only">
        {generating
          ? "Building your watchlist"
          : watchlist
            ? `${watchlist.items.length} titles ready: ${watchlist.title}`
            : ""}
      </p>

      {!watchlist && (
        <MoodComposer
          prompt={prompt}
          onPromptChange={setPrompt}
          controls={controls}
          onControlsChange={setControls}
          onSubmit={() => void generate()}
          generating={generating}
        />
      )}

      {error && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-body-sm text-foreground">{error}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void generate()} disabled={generating}>
              Try again
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/discover" />}>
              Explore manually
            </Button>
          </div>
        </div>
      )}

      {watchlist && (
        <MoodResult
          watchlist={watchlist}
          busy={generating}
          saving={saving}
          onRemoveItem={removeItem}
          onReplaceItem={replaceItem}
          onRefine={(preset) => void generate({ preset })}
          onRegenerate={() =>
            void generate({ bumpSeed: true, excludeIds: watchlist.items.map((item) => item.card.id) })
          }
          onStartOver={() => {
            setWatchlist(null);
            setError(null);
            setPrompt("");
          }}
          onSave={() => void save()}
        />
      )}
    </div>
  );
}
