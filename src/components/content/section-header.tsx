import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, href, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-h6 sm:text-h5 font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-body-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          See all
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}
