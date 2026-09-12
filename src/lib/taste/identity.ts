import "server-only";
import { prisma } from "@/lib/db/prisma";
import { buildTasteSignal } from "@/lib/recommendations/signals";
import { getTasteSpectrums, MIN_SAMPLE } from "@/lib/taste/spectrums";
import {
  isTakingShape,
  type EntertainmentIdentity,
  type IdentityEvidence,
  type IdentityResult,
} from "@/lib/taste/identity-types";
import { matchIdentity, matchConfidence } from "@/lib/taste/identity-model";
import { generateIdentityCopy } from "@/lib/taste/identity-ai";

/** Below this many deliberate signals, Aurora doesn't claim to know who you are. */
const MIN_SIGNALS = 8;

/**
 * The user's Entertainment Identity: one named archetype, matched from measured
 * taste spectrums, and returned with the counts that produced it.
 *
 * The honesty rules are structural, not stylistic — a result is only returned
 * when there are enough real signals *and* enough measurable spectrums behind
 * it. Otherwise the caller gets the taking-shape state and the user gets an
 * honest empty state instead of a horoscope.
 */
export async function getEntertainmentIdentity(
  userId: string,
  options: { force?: boolean } = {}
): Promise<IdentityResult> {
  const [signal, spectrums, ratingCount, savedCount, watchCount] = await Promise.all([
    buildTasteSignal(userId),
    getTasteSpectrums(userId),
    prisma.rating.count({ where: { userId } }),
    prisma.savedItem.count({ where: { userId } }),
    prisma.watchHistory.count({ where: { userId } }),
  ]);

  const signalsSoFar = ratingCount + savedCount + watchCount;

  if (signalsSoFar < MIN_SIGNALS || spectrums.length < 2) {
    return {
      archetype: null,
      signalsSoFar,
      nextSteps: [
        "Rate a few things you already know you love — that's the strongest signal Aurora has.",
        "Save anything you're curious about; saving counts even before you watch it.",
        "Explore a genre you don't usually pick, so Aurora can see the edges of your taste.",
      ],
    };
  }

  const match = matchIdentity(spectrums);
  if (!match) {
    return { archetype: null, signalsSoFar, nextSteps: ["Keep rating and saving — Aurora needs a little more to go on."] };
  }

  const evidence: IdentityEvidence[] = [];

  // Receipts from the spectrums that actually decided the match.
  for (const key of match.matchedOn) {
    const spectrum = spectrums.find((s) => s.key === key);
    if (spectrum) evidence.push({ text: spectrum.evidence });
  }

  // Receipts from the taste signal itself — countable, clickable.
  const topGenre = [...signal.genreWeights.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])[0];
  if (topGenre) {
    const genreRatings = await prisma.rating.count({ where: { userId, score: { gte: 4 } } });
    if (genreRatings > 0) {
      evidence.push({ text: `You've rated ${genreRatings} titles 4 stars or higher, most often ${topGenre[0].toLowerCase()}.` });
    }
  }

  const topCreator = [...signal.directorWeights.entries()].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1])[0];
  if (topCreator) {
    evidence.push({
      text: `${topCreator[0]} keeps coming up in what you rate highly.`,
      href: `/search?q=${encodeURIComponent(topCreator[0])}`,
    });
  }

  const traits = [...signal.moodWeights.entries()]
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([mood]) => mood);

  const identity: EntertainmentIdentity = {
    archetype: match.archetype,
    confidence: matchConfidence(spectrums),
    evidence,
    spectrums,
    traits,
    // Aurora's own wording, used as-is when no model is available.
    narrative: {
      description: match.archetype.summary,
      emergingTraits: [],
      aiGenerated: false,
    },
  };

  // The model describes the archetype Aurora already matched; it never picks
  // one. A failure here leaves the deterministic wording above untouched.
  const copy = await generateIdentityCopy(userId, identity, options);
  if (copy) {
    identity.narrative = {
      description: copy.data.description,
      emergingTraits: copy.data.emergingTraits,
      aiGenerated: true,
      generatedAt: copy.generatedAt.toISOString(),
    };
    if (copy.data.traits.length > 0) identity.traits = copy.data.traits;
  }

  return identity;
}

export { MIN_SAMPLE, isTakingShape };
export type * from "@/lib/taste/identity-types";
