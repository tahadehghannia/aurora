import { cn } from "@/lib/utils";

/**
 * Aurora's mark: three horizon-line arcs at receding opacity, evoking the
 * aurora borealis without being a literal, illustrative graphic. Deliberately
 * not an icon-in-a-colored-square — just a line mark, the way a mature brand
 * would render at 20px in a nav bar.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={cn("text-brand", className)} aria-hidden="true">
      <path d="M3 19.5C8 12 13 8 25 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.95" />
      <path d="M3 22.5C9 16 15 12.5 25 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M3 25.5C10 20.5 16.5 17.5 25 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}

export function Logo({ className, markClassName, wordmarkClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("h-5 w-5", markClassName)} />
      <span className={cn("text-h6 font-semibold tracking-tight", wordmarkClassName)}>Aurora</span>
    </span>
  );
}
