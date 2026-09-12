"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import type { ContentCard } from "@/types/content";

interface GeneratedItem {
  card: ContentCard;
  reason: string;
}
interface GeneratedWatchlist {
  title: string;
  description: string;
  items: GeneratedItem[];
}

const EXAMPLES = [
  "10 atmospheric psychological movies for a rainy night",
  "a dark show but not horror",
  "sci-fi movies like Interstellar but less serious",
];

export function AiWatchlistDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GeneratedWatchlist | null>(null);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const watchlist = await fetchJson<GeneratedWatchlist>("/api/ai/watchlist", {
        method: "POST",
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      setResult(watchlist);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate a watchlist for that.");
    } finally {
      setGenerating(false);
    }
  };

  const removeItem = (id: string) => {
    setResult((r) => (r ? { ...r, items: r.items.filter((i) => i.card.id !== id) } : r));
  };

  const save = async () => {
    if (!result || result.items.length === 0) return;
    setSaving(true);
    try {
      await fetchJson("/api/ai/watchlist/save", {
        method: "POST",
        body: JSON.stringify({
          title: result.title,
          description: result.description,
          items: result.items.map((i) => ({ kind: i.card.kind, contentId: i.card.id })),
        }),
      });
      toast.success("Saved to your Library.");
      setOpen(false);
      setResult(null);
      setPrompt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that watchlist.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Sparkles size={16} />
        Generate with AI
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Watchlist</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3 py-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={EXAMPLES[0]}
              rows={3}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setPrompt(ex)}
                  className="rounded-full border border-border px-2.5 py-1 text-caption text-muted-foreground hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div>
              <p className="font-medium text-foreground">{result.title}</p>
              <p className="text-caption text-muted-foreground">&ldquo;{result.description}&rdquo;</p>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {result.items.map(({ card, reason }) => (
                <div key={card.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-foreground">{card.title}</p>
                    <p className="truncate text-caption text-muted-foreground">{reason}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${card.title}`}
                    onClick={() => removeItem(card.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <div className="flex w-full items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
                <RotateCcw size={14} />
                Regenerate
              </Button>
              <Button onClick={save} disabled={saving || result.items.length === 0}>
                {saving && <Loader2 className="animate-spin" size={16} />}
                Save to Library
              </Button>
            </div>
          ) : (
            <Button onClick={generate} disabled={generating || !prompt.trim()}>
              {generating && <Loader2 className="animate-spin" size={16} />}
              Generate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
