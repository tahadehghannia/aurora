"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import type { ContentKind } from "@/types/content";

const WATCH_KINDS: ContentKind[] = ["movie", "tv_show", "episode"];

export function useMarkActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { kind: ContentKind; contentId: string }) =>
      fetchJson("/api/activity", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success(WATCH_KINDS.includes(variables.kind) ? "Marked as watched." : "Marked as listened.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
