interface AiInsightsProps {
  insights: string[];
}

/** Subtle, text-only insights — no AI badges, glow, or chatbot styling. */
export function AiInsights({ insights }: AiInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 border-l-2 border-brand/40 pl-4">
      {insights.map((insight) => (
        <p key={insight} className="text-body-sm italic text-muted-foreground">
          {insight}
        </p>
      ))}
    </div>
  );
}
