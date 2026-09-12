"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/library", label: "Saved" },
  { href: "/library/ratings", label: "Ratings" },
  { href: "/library/collections", label: "Collections" },
  { href: "/library/playlists", label: "Playlists" },
];

export function LibraryTabs() {
  const pathname = usePathname();

  return (
    <div className="relative border-b border-border">
      <div className="scroll-fade-x flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const active = tab.href === "/library" ? pathname === "/library" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 border-b-2 px-3 pb-2.5 text-body-sm font-medium transition-colors",
                active ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
        <span className="w-4 shrink-0" aria-hidden />
      </div>
    </div>
  );
}
