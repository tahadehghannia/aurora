"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";

export interface PlaylistSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  _count: { items: number };
  hasItem?: boolean;
}

export function usePlaylistsForSong(songId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["playlists", "for-song", songId],
    queryFn: () => fetchJson<PlaylistSummary[]>(`/api/playlists?songId=${songId}`),
    enabled,
  });
}

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists", "mine"],
    queryFn: () => fetchJson<PlaylistSummary[]>("/api/playlists"),
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; isPublic?: boolean }) =>
      fetchJson<PlaylistSummary>("/api/playlists", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: string) => fetchJson(`/api/playlists/${playlistId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; description?: string; isPublic?: boolean }) =>
      fetchJson(`/api/playlists/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTogglePlaylistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
      inPlaylist,
    }: {
      playlistId: string;
      songId: string;
      inPlaylist: boolean;
    }) => {
      await fetchJson(`/api/playlists/${playlistId}/items`, {
        method: inPlaylist ? "DELETE" : "POST",
        body: JSON.stringify({ songId }),
      });
      return { inPlaylist: !inPlaylist };
    },
    onSuccess: ({ inPlaylist }) => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success(inPlaylist ? "Added to playlist." : "Removed from playlist.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
