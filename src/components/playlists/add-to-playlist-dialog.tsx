"use client";

import { useState } from "react";
import { ListMusic, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePlaylistsForSong, useCreatePlaylist, useTogglePlaylistItem } from "@/hooks/use-playlists";

interface AddToPlaylistDialogProps {
  songId: string;
}

export function AddToPlaylistDialog({ songId }: AddToPlaylistDialogProps) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: playlists, isLoading, isError, refetch } = usePlaylistsForSong(songId, open);
  const toggle = useTogglePlaylistItem();
  const createPlaylist = useCreatePlaylist();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createPlaylist.mutateAsync({ title: newTitle.trim() });
      setNewTitle("");
      if (created) {
        await toggle.mutateAsync({ playlistId: created.id, songId, inPlaylist: false });
      }
      refetch();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <ListMusic size={16} />
        Add to playlist
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isError && <ErrorState title="Couldn't load your playlists" onRetry={() => refetch()} />}

          {!isLoading && !isError && playlists?.length === 0 && (
            <p className="px-1 py-2 text-body-sm text-muted-foreground">
              You don&apos;t have any playlists yet — create your first one below.
            </p>
          )}

          {!isLoading &&
            !isError &&
            playlists?.map((playlist) => (
              <label
                key={playlist.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <Checkbox
                  checked={!!playlist.hasItem}
                  disabled={toggle.isPending}
                  onCheckedChange={() =>
                    toggle.mutate({ playlistId: playlist.id, songId, inPlaylist: !!playlist.hasItem })
                  }
                />
                <span className="min-w-0 flex-1 truncate text-body-sm">{playlist.title}</span>
                {playlist.hasItem && <Check size={14} className="shrink-0 text-success" />}
                <span className="shrink-0 text-caption text-muted-foreground">{playlist._count.items}</span>
              </label>
            ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New playlist name"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="Create playlist"
            onClick={handleCreate}
            disabled={creating || !newTitle.trim()}
          >
            {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
