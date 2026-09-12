"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROFILE_TABS, type ProfileTab } from "@/components/profile/profile-tabs-config";

/**
 * Contextual navigation for a page that would otherwise be one enormous scroll.
 * Server-rendered per tab via a query param — each tab is a real URL, so it's
 * linkable, back-button-correct, and only renders the sections it needs.
 */
export function ProfileTabs({ active }: { active: ProfileTab }) {
  const params = useSearchParams();

  return (
    <nav aria-label="Profile sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {PROFILE_TABS.map((tab) => {
          const isActive = tab.key === active;
          const next = new URLSearchParams(params.toString());
          if (tab.key === "overview") next.delete("tab");
          else next.set("tab", tab.key);
          const query = next.toString();

          return (
            <li key={tab.key}>
              <Link
                href={query ? `/profile?${query}` : "/profile"}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-block border-b-2 px-3 py-2 text-body-sm transition-colors",
                  isActive
                    ? "border-brand font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
