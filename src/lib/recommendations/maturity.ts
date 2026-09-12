import "server-only";
import { prisma } from "@/lib/db/prisma";

export type MaturityStage = 1 | 2 | 3 | 4 | 5;

export interface MaturitySnapshot {
  stage: MaturityStage;
  label: string;
  ratingCount: number;
  savedCount: number;
  behaviorCount: number;
  hasOnboardingPreferences: boolean;
}

const STAGE_LABEL: Record<MaturityStage, string> = {
  1: "Onboarding-driven",
  2: "Preference + ratings",
  3: "Behavior + content similarity",
  4: "Taste model + behavioral patterns",
  5: "Hybrid personalization",
};

/**
 * Where a user sits on the cold-start curve — used to decide how much
 * weight popularity/onboarding defaults should carry vs. learned behavior.
 * Never presented to the user as a "confidence score"; it's an internal
 * signal for weighting decisions (see hybrid.ts) and API transparency.
 */
export async function getMaturityStage(userId: string): Promise<MaturitySnapshot> {
  const [ratingCount, savedCount, watchCount, listenCount, preference, genreAffinityCount] = await Promise.all([
    prisma.rating.count({ where: { userId } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.watchHistory.count({ where: { userId } }),
    prisma.listeningHistory.count({ where: { userId } }),
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.userGenre.count({ where: { userId } }),
  ]);

  const behaviorCount = watchCount + listenCount;
  const hasOnboardingPreferences = genreAffinityCount > 0 || (preference?.favoriteMoods.length ?? 0) > 0;

  let stage: MaturityStage;
  if (ratingCount === 0 && savedCount === 0 && behaviorCount === 0) {
    stage = 1; // nothing but onboarding, if even that
  } else if (ratingCount + savedCount < 5) {
    stage = 2; // a handful of explicit signals
  } else if (behaviorCount < 10) {
    stage = 3; // real preference data, limited implicit behavior
  } else if (ratingCount + savedCount < 20) {
    stage = 4; // rich behavior, taste model is reliable
  } else {
    stage = 5; // enough volume for hybrid (content + collaborative) to carry real weight
  }

  return {
    stage,
    label: STAGE_LABEL[stage],
    ratingCount,
    savedCount,
    behaviorCount,
    hasOnboardingPreferences,
  };
}
