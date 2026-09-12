"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import type { ContentKind } from "@/types/content";

export interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  _count: { items: number };
  hasItem?: boolean;
}

export function useCollectionsForItem(kind: ContentKind, contentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["collections", "for-item", kind, contentId],
    queryFn: () => fetchJson<CollectionSummary[]>(`/api/collections?kind=${kind}&contentId=${contentId}`),
    enabled,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections", "mine"],
    queryFn: () => fetchJson<CollectionSummary[]>("/api/collections"),
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; isPublic?: boolean }) =>
      fetchJson<CollectionSummary>("/api/collections", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleCollectionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collectionId,
      kind,
      contentId,
      inCollection,
    }: {
      collectionId: string;
      kind: ContentKind;
      contentId: string;
      inCollection: boolean;
    }) => {
      await fetchJson(`/api/collections/${collectionId}/items`, {
        method: inCollection ? "DELETE" : "POST",
        body: JSON.stringify({ kind, contentId }),
      });
      return { inCollection: !inCollection };
    },
    onSuccess: ({ inCollection }) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      toast.success(inCollection ? "Added to collection." : "Removed from collection.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
