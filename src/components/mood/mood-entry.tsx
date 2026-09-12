import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The doorway into Create with AI (§3, §37).
 *
 * Deliberately quiet: one line, one action, no glow. This is an assistant
 * living inside an entertainment product, not the product itself — so it earns
 * a row, never the page.
 */

interface MoodEntryProps {
  /** Pre-fills the request when arriving from a mood or genre context (§39). */
  prompt?: string;
  label?: string;
  className?: string;
  variant?: "card" | "inline";
}

export function MoodEntry({ prompt, label, className, variant = "card" }: MoodEntryProps) {
  const href = prompt ? `/mood?q=${encodeURIComponent(prompt)}` : "/mood";

  if (variant === "inline") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          className
        )}
      >
        <Sparkles size={15} aria-hidden />
        {label ?? "Build me a watchlist"}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className
      )}
    >
      <span className="min-w-0">
        <span className="block text-body font-medium text-foreground">
          {label ?? "What are you in the mood for?"}
        </span>
        <span className="block truncate text-caption text-muted-foreground">
          Describe it and Aurora builds a watchlist around your taste.
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-body-sm text-brand">
        Create with AI
        <ArrowRight size={15} className="transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
