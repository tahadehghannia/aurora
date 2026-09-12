import type { TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * Where the user sits between two poles. A marker on a line, not a score —
 * there's no "good" end of any of these axes, and nothing here is a percentage
 * of anything. Each row states the count it was measured from, so the position
 * is auditable rather than asserted.
 */
export function TasteSpectrums({ spectrums }: { spectrums: TasteSpectrum[] }) {
  if (spectrums.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground/70">Where your taste sits</p>

      <div className="flex max-w-2xl flex-col gap-5">
        {spectrums.map((s) => (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-caption">
              <span className={s.position < 45 ? "font-medium text-foreground" : "text-muted-foreground"}>
                {s.leftLabel}
              </span>
              <span className={s.position > 55 ? "font-medium text-foreground" : "text-muted-foreground"}>
                {s.rightLabel}
              </span>
            </div>

            <div
              className="relative h-1 rounded-full bg-muted"
              role="img"
              aria-label={`${s.leftLabel} to ${s.rightLabel}: ${s.evidence}`}
            >
              <span
                aria-hidden
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
                style={{ left: `${s.position}%` }}
              />
            </div>

            <p className="text-caption text-muted-foreground">{s.evidence}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
