"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CONTENT_ROUTE, type ContentCard as ContentCardData } from "@/types/content";

interface ContentCardProps {
  card: ContentCardData & { reason?: string };
  variant?: "default" | "large" | "compact" | "horizontal";
  saved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  className?: string;
}

const ASPECT: Record<NonNullable<ContentCardProps["variant"]>, string> = {
  default: "aspect-[2/3]",
  large: "aspect-[2/3]",
  compact: "aspect-square",
  horizontal: "aspect-video",
};

const WIDTH: Record<NonNullable<ContentCardProps["variant"]>, string> = {
  default: "w-40 sm:w-44",
  large: "w-52 sm:w-60",
  compact: "w-32 sm:w-36",
  horizontal: "w-64 sm:w-72",
};

export function ContentCard({ card, variant = "default", saved, onToggleSave, className }: ContentCardProps) {
  const href = `/${CONTENT_ROUTE[card.kind]}/${card.slug}`;
  const isRounded = card.kind === "artist" || card.kind === "song";

  return (
    <Link
      href={href}
      className={cn(
        "group flex shrink-0 flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-lg",
        WIDTH[variant],
        className
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted shadow-sm transition-shadow group-hover:shadow-md",
          ASPECT[variant],
          isRounded ? "rounded-full" : "rounded-lg"
        )}
      >
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 240px, 176px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
            No artwork
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {onToggleSave && (
          <button
            type="button"
            aria-label={saved ? "Remove from library" : "Save to library"}
            onClick={(e) => {
              e.preventDefault();
              onToggleSave(e);
            }}
            className={cn(
              "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-opacity",
              saved ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <Bookmark size={14} className={cn("text-white", saved && "fill-white")} />
          </button>
        )}

        {typeof card.rating === "number" && card.rating > 0 && !isRounded && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-caption text-white backdrop-blur-sm">
            <Star size={11} className="fill-rating text-rating" />
            {card.rating.toFixed(1)}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-body-sm font-medium text-foreground">{card.title}</p>
        {card.subtitle && <p className="truncate text-caption text-muted-foreground">{card.subtitle}</p>}
        {card.reason && <p className="mt-0.5 truncate text-caption text-ai">{card.reason}</p>}
      </div>
    </Link>
  );
}

export function ContentCardSkeleton({
  variant = "default",
  className,
}: {
  variant?: ContentCardProps["variant"];
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-2", WIDTH[variant ?? "default"], className)}>
      <Skeleton className={cn("w-full rounded-lg", ASPECT[variant ?? "default"])} />
      <Skeleton className="h-3.5 w-4/5 rounded" />
      <Skeleton className="h-3 w-2/5 rounded" />
    </div>
  );
}
