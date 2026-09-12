"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import type { ContentCard, ContentKind } from "@/types/content";

export function useMyRatings() {
  return useQuery({
    queryKey: ["ratings", "mine"],
    queryFn: () => fetchJson<(ContentCard & { userScore: number })[]>("/api/ratings"),
  });
}

export function useRateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { kind: ContentKind; contentId: string; score: number }) =>
      fetchJson("/api/ratings", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ratings"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Rating saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
