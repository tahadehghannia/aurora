import { Badge } from "@/components/ui/badge";

export function GenreBadges({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {genres.map((g) => (
        <Badge key={g} variant="secondary">
          {g}
        </Badge>
      ))}
    </div>
  );
}
