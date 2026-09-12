"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  className?: string;
}

const SIZE_MAP = { sm: 14, md: 18, lg: 24 };

export function StarRating({ value, onChange, size = "md", readOnly = false, className }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const iconSize = SIZE_MAP[size];
  const display = hovered ?? value;

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      role={readOnly ? undefined : "radiogroup"}
      aria-label="Rating"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = display >= star;
        const halfFilled = !filled && display >= star - 0.5;

        return (
          <button
            key={star}
            type="button"
            role={readOnly ? undefined : "radio"}
            disabled={readOnly}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            aria-checked={readOnly ? undefined : value === star}
            className={cn(
              "relative",
              // Invisible expanded hit area — kept within half the button gap
              // (gap-2 = 8px) so neighboring stars' hit areas never overlap.
              !readOnly && "after:absolute after:-inset-1 after:content-['']",
              !readOnly && "cursor-pointer transition-transform hover:scale-110",
              readOnly && "cursor-default"
            )}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onClick={(e) => {
              if (readOnly || !onChange) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const isHalf = e.clientX - rect.left < rect.width / 2;
              onChange(isHalf ? star - 0.5 : star);
            }}
          >
            <Star
              size={iconSize}
              className={cn(filled || halfFilled ? "fill-rating text-rating" : "fill-transparent text-muted-foreground")}
              style={halfFilled ? { clipPath: "inset(0 50% 0 0)" } : undefined}
            />
            {halfFilled && (
              <Star
                size={iconSize}
                className="absolute inset-0 fill-transparent text-muted-foreground"
                style={{ clipPath: "inset(0 0 0 50%)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
