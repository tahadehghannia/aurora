"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import type { ContentCard, ContentKind } from "@/types/content";

export function useSavedItems(kind?: ContentKind) {
  return useQuery({
    queryKey: ["library", "saved", kind ?? "all"],
    queryFn: () => fetchJson<ContentCard[]>(`/api/library${kind ? `?kind=${kind}` : ""}`),
  });
}

export function useToggleSave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kind, contentId, saved }: { kind: ContentKind; contentId: string; saved: boolean }) => {
      await fetchJson(`/api/library`, {
        method: saved ? "DELETE" : "POST",
        body: JSON.stringify({ kind, contentId }),
      });
      return { kind, contentId, saved: !saved };
    },
    onSuccess: ({ saved }) => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      toast.success(saved ? "Saved to your library." : "Removed from your library.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
