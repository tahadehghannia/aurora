import { slugifyGenre } from "@/lib/utils";
import type { ContentCard } from "@/types/content";
import type { TasteSignal } from "@/lib/recommendations/signals";
import { scoreCollaborative, itemKey, type CollaborativeModel, type ItemKey } from "@/lib/recommendations/collaborative";
import { CONTENT_TYPE_MAP } from "@/types/content";

export type ReasonType =
  | "LIKED_CONTENT"
  | "GENRE_PREFERENCE"
  | "CREATOR_PREFERENCE"
  | "MOOD_MATCH"
  | "RECENT_BEHAVIOR"
  | "SIMILAR_CONTENT"
  | "COMMUNITY_SIGNAL"
  | "EXPLORATION";

export type ReasonConfidence = "high" | "medium" | "low";

export interface RecommendationReason {
  reasonType: ReasonType;
  text: string;
  confidence: ReasonConfidence;
  /** 1 = strongest evidence (direct user behavior) ... 6 = weakest (pure exploration). Lower sorts first. */
  priority: number;
  /** The specific liked/rated title this reason is grounded in, when there is one. */
  sourceContentId?: string;
  /** Where clicking this reason should lead — the "Why This -> Discovery" loop (genre/mood chips link to Discover, creators to Search). */
  discoveryHref?: string;
}

export interface CommunityContext {
  model: CollaborativeModel;
  userRatings: { key: ItemKey; score: number }[];
}

/** "a atmospheric mood" -> "an atmospheric mood" — good enough for Aurora's fixed mood vocabulary. */
function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** Same thresholds dna.ts uses for confidence tiers, reused here so "Why this?" and Entertainment DNA never disagree about what counts as a strong vs. weak signal. */
function weightConfidence(weight: number): ReasonConfidence {
  if (weight >= 4) return "high";
  if (weight >= 1.5) return "medium";
  return "low";
}

/**
 * The single source of truth for "why was this recommended" — structured,
 * prioritized, confidence-scored, every line traceable to a real signal
 * weight, a real stored rating, or a real collaborative co-rating pattern.
 * explanation.ts's plain-string helpers are thin derivations of this; there
 * is no second, drifting copy of this logic anywhere else.
 *
 * Priority order matches direct-behavior-first: (1) an actual rating on a
 * related title, (2) strong explicit genre/mood preference, (3) creator
 * affinity, (4) recent (last-14-day) behavior specifically, (5) community
 * co-rating similarity, (6) pure exploration/popularity.
 */
export function buildRecommendationReasons(
  candidate: ContentCard,
  signal: TasteSignal,
  community?: CommunityContext
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  const candidateGenres = new Set(candidate.genres ?? []);
  const candidateMoods = new Set(candidate.moods ?? []);

  // Priority 1 — direct user behavior. An actual 4+/5 rating is the
  // strongest possible evidence; a save without a rating is still real,
  // deliberate behavior (the spec's "Because you often save..." category)
  // but slightly softer, so it only fires when there's no rated match.
  // Artist-kind liked entries are excluded from the plain genre-overlap
  // check: an artist's "genres" are broad taste tags, not something an
  // unrelated candidate that merely shares one should be credited to by
  // name. Direct artist/creator-id matches below still apply regardless of
  // kind — that's a real identity match, not a coincidental genre tag.
  const matchesCandidate = (liked: TasteSignal["likedTitles"][number]) =>
    (liked.kind !== "artist" && liked.genres.some((g) => candidateGenres.has(g))) ||
    (!!candidate.artistId && liked.artistId === candidate.artistId) ||
    (!!candidate.creator && liked.creator === candidate.creator);

  const ratedMatch = signal.likedTitles.find((liked) => typeof liked.score === "number" && liked.score >= 4 && matchesCandidate(liked));
  if (ratedMatch) {
    reasons.push({
      reasonType: "LIKED_CONTENT",
      text: `Because you rated ${ratedMatch.title} ${ratedMatch.score!.toFixed(1)}/5.`,
      confidence: "high",
      priority: 1,
    });
  } else {
    const savedMatch = signal.likedTitles.find((liked) => liked.score === undefined && matchesCandidate(liked));
    if (savedMatch) {
      reasons.push({
        reasonType: "LIKED_CONTENT",
        text: `Because you saved ${savedMatch.title}.`,
        confidence: "medium",
        priority: 1,
      });
    }
  }

  // Priority 2 — explicit/strong genre or mood preference.
  const topGenre = [...candidateGenres]
    .map((g) => ({ genre: g, weight: signal.genreWeights.get(g) ?? 0 }))
    .sort((a, b) => b.weight - a.weight)[0];
  if (topGenre && topGenre.weight > 0) {
    const confidence = weightConfidence(topGenre.weight);
    reasons.push({
      reasonType: "GENRE_PREFERENCE",
      text:
        confidence === "high"
          ? `Because you often enjoy ${topGenre.genre.toLowerCase()}.`
          : `This may fit your taste — you've shown some interest in ${topGenre.genre.toLowerCase()}.`,
      confidence,
      priority: 2,
      discoveryHref: `/discover?genre=${slugifyGenre(topGenre.genre)}`,
    });
  }

  const topMood = [...candidateMoods]
    .map((m) => ({ mood: m, weight: signal.moodWeights.get(m) ?? 0 }))
    .sort((a, b) => b.weight - a.weight)[0];
  if (topMood && topMood.weight > 0) {
    const confidence = weightConfidence(topMood.weight);
    reasons.push({
      reasonType: "MOOD_MATCH",
      text:
        confidence === "high"
          ? `It matches the ${topMood.mood.toLowerCase()} mood you gravitate toward.`
          : `This may match ${article(topMood.mood)} ${topMood.mood.toLowerCase()} mood you've been exploring.`,
      confidence,
      priority: 2,
      discoveryHref: `/discover?mood=${encodeURIComponent(topMood.mood)}`,
    });
  }

  // Priority 3 — creator/artist affinity.
  if (candidate.creator) {
    const directorWeight = signal.directorWeights.get(candidate.creator) ?? 0;
    if (directorWeight > 0) {
      reasons.push({
        reasonType: "CREATOR_PREFERENCE",
        text: `You've liked other work from ${candidate.creator}.`,
        confidence: weightConfidence(directorWeight),
        priority: 3,
        discoveryHref: `/search?q=${encodeURIComponent(candidate.creator)}`,
      });
    }
  }
  if (candidate.artistId) {
    const artistWeight = signal.artistWeights.get(candidate.artistId) ?? 0;
    if (artistWeight > 0 && candidate.subtitle) {
      reasons.push({
        reasonType: "CREATOR_PREFERENCE",
        text: `Because you like ${candidate.subtitle}.`,
        confidence: weightConfidence(artistWeight),
        priority: 3,
      });
    }
  }

  // Priority 4 — recent behavior specifically (distinct from all-time taste:
  // this only fires when the last 14 days actually support it).
  const recentGenre = [...candidateGenres].find((g) => (signal.recentGenreWeights.get(g) ?? 0) > 0);
  if (recentGenre) {
    reasons.push({
      reasonType: "RECENT_BEHAVIOR",
      text: `You've recently been exploring ${recentGenre.toLowerCase()}.`,
      confidence: "medium",
      priority: 4,
      discoveryHref: `/discover?genre=${slugifyGenre(recentGenre)}`,
    });
  } else {
    const recentMood = [...candidateMoods].find((m) => (signal.recentMoodWeights.get(m) ?? 0) > 0);
    if (recentMood) {
      reasons.push({
        reasonType: "RECENT_BEHAVIOR",
        text: `You've recently been drawn to ${recentMood.toLowerCase()} stories.`,
        confidence: "medium",
        priority: 4,
        discoveryHref: `/discover?mood=${encodeURIComponent(recentMood)}`,
      });
    }
  }

  // Priority 5 — community/collaborative signal: people whose ratings
  // correlate with this user's ratings also rated this candidate well.
  if (community) {
    const candidateKey = itemKey(CONTENT_TYPE_MAP[candidate.kind], candidate.id);
    const raterCount = community.model.itemRatings.get(candidateKey)?.raters.size ?? 0;
    if (raterCount >= community.model.minRatersForSignal) {
      const collabScore = scoreCollaborative(candidateKey, community.userRatings, community.model);
      if (collabScore > 0.3) {
        reasons.push({
          reasonType: "COMMUNITY_SIGNAL",
          text: "People with similar taste rated this highly.",
          confidence: collabScore > 1 ? "medium" : "low",
          priority: 5,
        });
      }
    }
  }

  // Priority 6 — nothing else fired: honest exploration/popularity fallback,
  // scoped to a genre when there's one to name rather than a bare "trending."
  if (reasons.length === 0) {
    const anyGenre = candidate.genres?.[0];
    if (!signal.hasSignal) {
      reasons.push({
        reasonType: "EXPLORATION",
        text: anyGenre
          ? `Popular among people exploring ${anyGenre.toLowerCase()}.`
          : "Popular with Aurora members right now.",
        confidence: "low",
        priority: 6,
      });
    } else {
      reasons.push({
        reasonType: "EXPLORATION",
        text: "Something a little different from your usual taste — worth a look.",
        confidence: "low",
        priority: 6,
      });
    }
  }

  const deduped = [...new Map(reasons.map((r) => [r.text, r])).values()];
  return deduped.sort((a, b) => a.priority - b.priority).slice(0, 4);
}
