import { CrossMediaCard } from "@/components/content/cross-media-card";
import type { CrossMediaResult } from "@/lib/crossmedia/types";

interface CrossMediaSectionProps {
  result: CrossMediaResult | null;
  title?: string;
}

/** "Explore Beyond the Screen" — a compact, editorial cross-media row. Renders nothing when there's no meaningful connection, rather than forcing empty categories. */
export function CrossMediaSection({ result, title = "Explore Beyond the Screen" }: CrossMediaSectionProps) {
  if (!result || result.connections.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h6 font-semibold">{title}</h2>
        <p className="text-body-sm text-muted-foreground">Because of {result.sourceTitle}</p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {result.connections.map((connection) => (
          <CrossMediaCard key={`${connection.card.kind}-${connection.card.id}`} connection={connection} />
        ))}
      </div>
    </section>
  );
}
