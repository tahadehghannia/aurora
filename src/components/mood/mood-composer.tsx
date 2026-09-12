"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EXPLORATION_LABEL, type Exploration } from "@/lib/mood/vocabulary";

/**
 * The mood request surface.
 *
 * Free text is the interaction (§4) — the chips below it are shortcuts that
 * write into the same field, not a fixed taxonomy the user has to pick from.
 * The structured controls are optional and secondary (§5), which is why they
 * sit under a plain disclosure rather than competing with the sentence.
 *
 * Native selects are deliberate: they are keyboard- and screen-reader-correct
 * everywhere and give mobile users their platform's own picker.
 */

export interface MoodControls {
  size: 5 | 8 | 10 | 12;
  exploration: Exploration;
  audience: "alone" | "friends" | "couple" | "family" | "";
  runtimeMaxMin: number | "";
  contentType: "any" | "movie" | "tv_show";
}

export const DEFAULT_CONTROLS: MoodControls = {
  size: 8,
  exploration: "balanced",
  audience: "",
  runtimeMaxMin: "",
  contentType: "any",
};

/** Shortcuts, phrased the way someone would actually say them. */
const SUGGESTIONS = [
  "Something calm for tonight",
  "Dark, but not horror",
  "Emotional without being depressing",
  "Something funny and easy to watch",
  "Atmospheric with a great soundtrack",
  "Surprise me",
];

const selectClass =
  "w-full rounded-md border border-border bg-background px-2.5 py-2 text-body-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

interface MoodComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  controls: MoodControls;
  onControlsChange: (controls: MoodControls) => void;
  onSubmit: () => void;
  generating: boolean;
  /** Renders the compact variant used inside dialogs and rails. */
  compact?: boolean;
}

export function MoodComposer({
  prompt,
  onPromptChange,
  controls,
  onControlsChange,
  onSubmit,
  generating,
  compact = false,
}: MoodComposerProps) {
  const promptId = useId();
  const optionsId = useId();

  const set = <K extends keyof MoodControls>(key: K, value: MoodControls[K]) =>
    onControlsChange({ ...controls, [key]: value });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={promptId} className={cn("block font-medium text-foreground", compact ? "text-body-sm" : "text-h6")}>
          What are you in the mood for?
        </label>
        <Textarea
          id={promptId}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter submits; Shift+Enter keeps the newline for longer requests.
            if (e.key === "Enter" && !e.shiftKey && prompt.trim().length >= 2) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={compact ? 2 : 3}
          placeholder="Describe it however you'd say it out loud…"
          className="resize-none text-body"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPromptChange(suggestion)}
            className="rounded-full border border-border px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:border-brand hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <details className="group">
        <summary className="cursor-pointer list-none text-caption text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <span className="underline underline-offset-4 group-open:hidden">Add details (optional)</span>
          <span className="hidden underline underline-offset-4 group-open:inline">Hide details</span>
        </summary>

        <div id={optionsId} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor={`${optionsId}-time`} className="text-caption text-muted-foreground">
              Time available
            </label>
            <select
              id={`${optionsId}-time`}
              className={selectClass}
              value={controls.runtimeMaxMin}
              onChange={(e) => set("runtimeMaxMin", e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">No limit</option>
              <option value="90">Under 90 min</option>
              <option value="120">90–120 min</option>
              <option value="240">2+ hours</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${optionsId}-audience`} className="text-caption text-muted-foreground">
              Watching with
            </label>
            <select
              id={`${optionsId}-audience`}
              className={selectClass}
              value={controls.audience}
              onChange={(e) => set("audience", e.target.value as MoodControls["audience"])}
            >
              <option value="">Didn&apos;t say</option>
              <option value="alone">Alone</option>
              <option value="friends">Friends</option>
              <option value="couple">Partner</option>
              <option value="family">Family</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${optionsId}-type`} className="text-caption text-muted-foreground">
              Type
            </label>
            <select
              id={`${optionsId}-type`}
              className={selectClass}
              value={controls.contentType}
              onChange={(e) => set("contentType", e.target.value as MoodControls["contentType"])}
            >
              <option value="any">Anything</option>
              <option value="movie">Movies</option>
              <option value="tv_show">Shows</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${optionsId}-exploration`} className="text-caption text-muted-foreground">
              How adventurous
            </label>
            <select
              id={`${optionsId}-exploration`}
              className={selectClass}
              value={controls.exploration}
              onChange={(e) => set("exploration", e.target.value as Exploration)}
            >
              {(Object.keys(EXPLORATION_LABEL) as Exploration[]).map((key) => (
                <option key={key} value={key}>
                  {EXPLORATION_LABEL[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${optionsId}-size`} className="text-caption text-muted-foreground">
              How many
            </label>
            <select
              id={`${optionsId}-size`}
              className={selectClass}
              value={controls.size}
              onChange={(e) => set("size", Number(e.target.value) as MoodControls["size"])}
            >
              {[5, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n} titles
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <Button onClick={onSubmit} disabled={generating || prompt.trim().length < 2} className="w-full sm:w-auto">
        {generating && <Loader2 className="animate-spin" size={16} aria-hidden />}
        {generating ? "Building your list…" : "Build my watchlist"}
      </Button>
    </div>
  );
}
