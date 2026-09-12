import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getRecommendationsForUser } from "@/lib/recommendations";
import { ContentGrid } from "@/components/content/content-grid";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Recommendations" };

export default async function RecommendationsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const recommendations = await getRecommendationsForUser(userId, { limit: 36 });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div>
        <h1 className="text-h4 font-semibold">Recommended for you</h1>
        <p className="text-body-sm text-muted-foreground">Aurora&apos;s picks, each with a reason why.</p>
      </div>

      {recommendations.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing to recommend yet"
          description="Rate or save a few things and Aurora will start picking up your taste."
        />
      ) : (
        <ContentGrid items={recommendations} />
      )}
    </div>
  );
}
