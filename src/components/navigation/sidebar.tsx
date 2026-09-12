"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderHeart, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/components/navigation/nav-items";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { UserMenu } from "@/components/navigation/user-menu";

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

const SECONDARY_ITEMS = [
  { href: "/library/collections", label: "Collections", icon: FolderHeart },
  { href: "/library/playlists", label: "Playlists", icon: ListMusic },
] as const;

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  // Profile lives in the account menu at the bottom, not the primary list —
  // it's an identity/settings surface, not a content destination like the rest.
  const primaryItems = NAV_ITEMS.filter((item) => item.href !== "/profile");

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-sidebar px-3 py-5 md:flex">
      <Link href="/home" className="px-2 pb-6">
        <Logo />
      </Link>

      <nav className="flex flex-col gap-0.5">
        {primaryItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-body-sm font-medium transition-colors",
                active
                  ? "bg-surface-active text-brand"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col gap-0.5">
        <p className="px-2.5 pb-1 text-caption font-medium uppercase tracking-wide text-muted-foreground/70">
          Your library
        </p>
        {SECONDARY_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-body-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="flex items-center justify-between px-2 pt-4">
        <UserMenu name={user.name} email={user.email} image={user.image} />
        <ThemeToggle />
      </div>
    </aside>
  );
}
