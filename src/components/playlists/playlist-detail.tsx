"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, X, Clock, Loader2, ListMusic } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { useDeletePlaylist, useUpdatePlaylist } from "@/hooks/use-playlists";
import { fetchJson } from "@/lib/api/client";

export interface PlaylistTrack {
  songId: string;
  slug: string;
  title: string;
  artistName: string;
  artistSlug: string;
  albumSlug: string | null;
  durationSec: number;
}

interface PlaylistDetailProps {
  playlistId: string;
  title: string;
  description: string | null;
  tracks: PlaylistTrack[];
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlaylistDetail({ playlistId, title, description, tracks: initialTracks }: PlaylistDetailProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(title);
  const [descriptionInput, setDescriptionInput] = useState(description ?? "");
  const [tracks, setTracks] = useState(initialTracks);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const updatePlaylist = useUpdatePlaylist();
  const deletePlaylist = useDeletePlaylist();

  const totalDuration = tracks.reduce((sum, t) => sum + t.durationSec, 0);

  const saveEdit = async () => {
    await updatePlaylist.mutateAsync({ id: playlistId, title: titleInput.trim(), description: descriptionInput.trim() });
    setEditing(false);
    router.refresh();
  };

  const handleRemove = async (songId: string) => {
    setRemovingId(songId);
    const previous = tracks;
    setTracks((prev) => prev.filter((t) => t.songId !== songId));
    try {
      await fetchJson(`/api/playlists/${playlistId}/items`, {
        method: "DELETE",
        body: JSON.stringify({ songId }),
      });
      toast.success("Removed from playlist.");
    } catch (err) {
      setTracks(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't remove that track.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleDelete = async () => {
    await deletePlaylist.mutateAsync(playlistId);
    router.push("/library/playlists");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <div className="flex-1 space-y-3">
            <Input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} className="text-h5 font-semibold" />
            <Textarea value={descriptionInput} onChange={(e) => setDescriptionInput(e.target.value)} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} disabled={updatePlaylist.isPending || !titleInput.trim()}>
                {updatePlaylist.isPending && <Loader2 className="animate-spin" size={14} />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-h5 font-semibold">{title}</h2>
            {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
            <p className="mt-1 text-caption text-muted-foreground">
              {tracks.length} track{tracks.length === 1 ? "" : "s"}
              {totalDuration > 0 && ` · ${Math.round(totalDuration / 60)} min`}
            </p>
          </div>
        )}

        {!editing && (
          <div className="flex shrink-0 gap-2">
            <Button size="icon" variant="outline" aria-label="Edit playlist" onClick={() => setEditing(true)}>
              <Pencil size={15} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="icon" variant="outline" aria-label="Delete playlist" />}>
                <Trash2 size={15} />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this playlist?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{title}&rdquo; and its track list will be permanently deleted. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deletePlaylist.isPending}>
                    {deletePlaylist.isPending && <Loader2 className="animate-spin" size={14} />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {tracks.length === 0 ? (
        <EmptyState icon={ListMusic} title="No tracks yet" description="Add songs to this playlist from any song's detail page." />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {tracks.map((track, i) => (
            <div key={track.songId} className="group flex items-center gap-4 px-4 py-3">
              <span className="w-5 shrink-0 text-body-sm text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/song/${track.slug}`} className="block truncate text-body-sm font-medium hover:underline">
                  {track.title}
                </Link>
                <Link href={`/artist/${track.artistSlug}`} className="block truncate text-caption text-muted-foreground hover:underline">
                  {track.artistName}
                </Link>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                <Clock size={12} />
                {formatDuration(track.durationSec)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${track.title} from this playlist`}
                disabled={removingId === track.songId}
                onClick={() => handleRemove(track.songId)}
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-error group-hover:opacity-100 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
