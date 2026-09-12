import type { Milestone } from "@/lib/taste/milestones";

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** A handful of real, dated moments — not a gamified achievement wall. */
export function DiscoveryMilestones({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {milestones.map((m) => (
        <div key={m.label} className="space-y-0.5">
          <p className="text-body-sm font-medium text-foreground">{m.label}</p>
          <p className="text-caption text-muted-foreground">{formatDate(m.date)}</p>
        </div>
      ))}
    </div>
  );
}
