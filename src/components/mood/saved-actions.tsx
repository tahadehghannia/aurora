"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Pencil, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Ownership actions on a saved watchlist (§25, §30, §48): rename, delete, and
 * the doorways that turn one answer into continued discovery.
 */
export function SavedMoodWatchlistActions({ id, title, prompt }: { id: string; title: string; prompt: string }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);

  const rename = async () => {
    const next = draft.trim();
    if (!next || next === title) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      await fetchJson(`/api/mood/watchlist/${id}`, { method: "PATCH", body: JSON.stringify({ title: next }) });
      toast.success("Renamed.");
      setRenaming(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename that.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await fetchJson(`/api/mood/watchlist/${id}`, { method: "DELETE" });
      toast.success("Watchlist deleted.");
      router.push("/mood");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete that.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border pt-6">
      {renaming ? (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Watchlist title"
            maxLength={80}
            autoFocus
          />
          <Button size="sm" onClick={() => void rename()} disabled={busy}>
            <Check size={15} aria-hidden />
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRenaming(false)} disabled={busy}>
            <X size={15} aria-hidden />
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setRenaming(true)}>
            <Pencil size={15} aria-hidden />
            Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
            <Trash2 size={15} aria-hidden />
            Delete
          </Button>
        </div>
      )}

      {/* One request should lead to the next (§48). */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<Link href={`/mood?q=${encodeURIComponent(prompt)}`} />}>
          <Sparkles size={15} aria-hidden />
          Try this mood again
        </Button>
        <Button size="sm" variant="ghost" render={<Link href="/mood" />}>
          Create another
        </Button>
        <Button size="sm" variant="ghost" render={<Link href="/discover" />}>
          Explore manually
        </Button>
      </div>
    </div>
  );
}
