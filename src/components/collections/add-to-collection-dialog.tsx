"use client";

import { useState } from "react";
import { FolderPlus, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states/error-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCollectionsForItem, useCreateCollection, useToggleCollectionItem } from "@/hooks/use-collections";
import type { ContentKind } from "@/types/content";

interface AddToCollectionDialogProps {
  kind: ContentKind;
  contentId: string;
}

export function AddToCollectionDialog({ kind, contentId }: AddToCollectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: collections, isLoading, isError, refetch } = useCollectionsForItem(kind, contentId, open);
  const toggle = useToggleCollectionItem();
  const createCollection = useCreateCollection();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await createCollection.mutateAsync({ title: newTitle.trim() });
      setNewTitle("");
      if (created) {
        await toggle.mutateAsync({ collectionId: created.id, kind, contentId, inCollection: false });
      }
      refetch();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderPlus size={16} />
        Add to collection
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to collection</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-2">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          )}

          {isError && <ErrorState title="Couldn't load your collections" onRetry={() => refetch()} />}

          {!isLoading && !isError && collections?.length === 0 && (
            <p className="px-1 py-2 text-body-sm text-muted-foreground">
              You don&apos;t have any collections yet — create your first one below.
            </p>
          )}

          {!isLoading &&
            !isError &&
            collections?.map((collection) => (
              <label
                key={collection.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <Checkbox
                  checked={!!collection.hasItem}
                  disabled={toggle.isPending && toggle.variables?.collectionId === collection.id}
                  onCheckedChange={() =>
                    toggle.mutate({
                      collectionId: collection.id,
                      kind,
                      contentId,
                      inCollection: !!collection.hasItem,
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate text-body-sm">{collection.title}</span>
                {collection.hasItem && <Check size={14} className="shrink-0 text-success" />}
                <span className="shrink-0 text-caption text-muted-foreground">{collection._count.items}</span>
              </label>
            ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New collection name"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="Create collection"
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
