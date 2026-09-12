import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon size={22} />
      </div>
      <div className="space-y-1">
        <p className="text-body-md font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <div className="mx-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-body-sm text-muted-foreground sm:mx-0">
      {message}
    </div>
  );
}
