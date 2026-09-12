import { AUDIENCE_RULES, MOOD_CONCEPTS, type Exploration } from "@/lib/mood/vocabulary";
import type { MoodIntent } from "@/lib/mood/intent";
import type { ScoredCandidate } from "@/lib/mood/rank";

/**
 * Aurora's own wording for a watchlist: the title (§14), the one-line
 * description (§15), the list-level explanation (§17), and the honest
 * personalization strength (§18).
 *
 * This is what a user sees when no AI provider is configured, and it is also
 * the floor the AI has to beat — so it is written to be genuinely good, not a
 * placeholder. Pure and deterministic apart from an explicit seed.
 */

/** Editorial titles, in the register of a shelf label rather than a headline. */
const CONCEPT_TITLES: Record<string, string[]> = {
  calm: ["Quiet Things to Watch", "Slow Evening", "Somewhere Peaceful"],
  comforting: ["Comfort Viewing", "Something Familiar", "Easy Company"],
  uplifting: ["Something Hopeful", "Lighter Things", "Good Company"],
  funny: ["Something Lighter", "Easy Laughs", "Nothing Heavy"],
  dark: ["A Little Darkness", "After Hours", "The Darker Shelf"],
  tense: ["Hold Your Breath", "Tightly Wound", "No Easy Nights"],
  scary: ["Lights Off", "Something Unsettling", "After Midnight"],
  sad: ["Bring Tissues", "Quietly Devastating", "The Heavy Ones"],
  emotional: ["Something Moving", "Close to the Bone", "Feel Something"],
  romantic: ["Love, More or Less", "Something Tender", "Two People"],
  thoughtful: ["Something to Chew On", "The Long Think", "Ideas First"],
  atmospheric: ["Something Beautiful", "Mood Over Plot", "Rainy Night Cinema"],
  dreamy: ["Half-Remembered", "Strange and Lovely", "Dream Logic"],
  energetic: ["Turn It Up", "Momentum", "No Slow Parts"],
  epic: ["The Big Ones", "Go Somewhere", "Scale and Scope"],
  nostalgic: ["Back Then", "Old Favourites, New to You", "The Way It Felt"],
};

const FALLBACK_TITLES = ["Tonight's Shortlist", "Picked for You", "Where to Start"];

/**
 * Deterministic per (concepts, seed) so the same request is stable, but a
 * regenerate can pass a new seed and get a different-feeling list.
 */
function pick<T>(options: T[], seed: number): T {
  return options[Math.abs(seed) % options.length] as T;
}

export function composeTitle(intent: MoodIntent, seed = 0): string {
  const withTitles = intent.concepts.filter((key) => CONCEPT_TITLES[key]);
  const primary = withTitles[0];

  if (!primary) {
    // No recognized feeling: name it after what was actually asked for.
    if (intent.genres.length > 0) return `${intent.genres[0]} Shortlist`;
    return pick(FALLBACK_TITLES, seed);
  }

  const options = CONCEPT_TITLES[primary] ?? FALLBACK_TITLES;
  return pick(options, seed);
}

function listPhrase(values: string[], max = 2): string {
  const kept = values.slice(0, max).map((v) => v.toLowerCase());
  if (kept.length === 0) return "";
  if (kept.length === 1) return kept[0] as string;
  return `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`;
}

/**
 * One short sentence describing the list (§15).
 *
 * The genres named are the ones actually in the list, not the ones the request
 * leaned toward — describing a list of fantasy films as "drama and documentary
 * picks" because those were the search terms is simply wrong.
 */
export function composeDescription(intent: MoodIntent, itemCount: number, actualGenres: string[] = []): string {
  const moodPhrase = listPhrase(intent.moods);
  const genrePhrase = listPhrase(actualGenres.length > 0 ? actualGenres : intent.genres);

  const parts: string[] = [];
  if (moodPhrase && genrePhrase) parts.push(`${itemCount} ${genrePhrase} picks with a ${moodPhrase} feel`);
  else if (moodPhrase) parts.push(`${itemCount} titles with a ${moodPhrase} feel`);
  else if (genrePhrase) parts.push(`${itemCount} ${genrePhrase} picks`);
  else parts.push(`${itemCount} titles picked for you`);

  if (intent.runtimeMaxMin) parts.push(`all under ${intent.runtimeMaxMin} minutes`);
  if (intent.audience) parts.push(`for watching ${AUDIENCE_RULES[intent.audience].label}`);
  if (intent.recency === "new") parts.push("leaning recent");
  if (intent.recency === "classic") parts.push("leaning older");

  return `${parts.join(", ")}.`;
}

export type PersonalizationLevel = "strong" | "aligned" | "exploratory" | "general";

export const PERSONALIZATION_COPY: Record<PersonalizationLevel, string> = {
  strong: "Heavily tailored to your usual taste.",
  aligned: "Built around your taste, with room to wander.",
  exploratory: "Pushed beyond your usual choices on purpose.",
  general: "Based on your request and what Aurora's community rates highly — not yet on your taste.",
};

/**
 * How personalized the list honestly is (§18).
 *
 * Derived from how many picks taste history actually influenced, so it can't
 * overstate itself. A user with no history always gets "general".
 */
export function personalizationLevel(
  items: ScoredCandidate[],
  hasSignal: boolean,
  exploration: Exploration
): PersonalizationLevel {
  if (!hasSignal || items.length === 0) return "general";
  const backed = items.filter((i) => i.tasteBacked).length / items.length;
  if (exploration === "surprise") return "exploratory";
  if (backed >= 0.6) return "strong";
  if (backed >= 0.25) return "aligned";
  return "exploratory";
}

export interface WhyThisListInput {
  intent: MoodIntent;
  items: ScoredCandidate[];
  level: PersonalizationLevel;
  /** Top genres from the user's Entertainment DNA, strongest first. */
  tasteGenres: string[];
  similarTitle: string | null;
}

/**
 * The list-level explanation (§17): connects what was asked for to what Aurora
 * already knows. Every clause is backed by something real — a stated request,
 * a measured affinity, or an explicit constraint.
 */
export function composeWhyThisList(input: WhyThisListInput): string {
  const { intent, items, level, tasteGenres, similarTitle } = input;
  const clauses: string[] = [];

  const moodPhrase = listPhrase(intent.moods);
  if (moodPhrase) clauses.push(`You asked for something ${moodPhrase}`);
  else clauses.push("You described what you were after");

  if (level !== "general" && tasteGenres.length > 0) {
    clauses.push(`and you consistently rate ${listPhrase(tasteGenres)} highly`);
  }

  let sentence = `${clauses.join(", ")}.`;

  if (similarTitle) sentence += ` Aurora used ${similarTitle} as the reference point.`;

  // Only what the user actually said is reported back as their instruction.
  // Genres Aurora vetoed on its own are a different claim and are not made here.
  if (intent.statedExclusions.length > 0) {
    const phrase = listPhrase(intent.statedExclusions, 3).replace(/^./, (c) => c.toUpperCase());
    sentence += ` ${phrase} ${intent.statedExclusions.length === 1 ? "was" : "were"} left out, as you asked.`;
  }
  if (intent.runtimeMaxMin) {
    const known = items.filter((i) => i.candidate.runtimeMin !== null).length;
    sentence += ` ${known === items.length ? "Every title" : `${known} of ${items.length}`} fits inside ${intent.runtimeMaxMin} minutes.`;
  }

  sentence += ` ${PERSONALIZATION_COPY[level]}`;
  return sentence;
}

/** Concept keys that have editorial titles — used by tests and the UI's chips. */
export const TITLED_CONCEPTS = MOOD_CONCEPTS.filter((c) => CONCEPT_TITLES[c.key]).map((c) => c.key);
