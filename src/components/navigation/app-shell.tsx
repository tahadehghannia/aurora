import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";

interface AppShellProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-full">
      <Sidebar user={user} />
      <main className="min-h-full pb-20 md:ml-56 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
