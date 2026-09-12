const GENRE_TRAITS: Record<string, string[]> = {
  "Sci-Fi": ["Cinematic", "Speculative"],
  Fantasy: ["Imaginative", "Cinematic"],
  Drama: ["Story-driven", "Emotion-focused"],
  Thriller: ["Tense", "Plot-driven"],
  Mystery: ["Plot-driven", "Curious"],
  Horror: ["Atmospheric", "Bold"],
  Comedy: ["Lighthearted", "Playful"],
  Romance: ["Emotion-focused", "Warm"],
  Action: ["Energetic", "Bold"],
  Adventure: ["Explorative", "Energetic"],
  Crime: ["Plot-driven", "Tense"],
  Documentary: ["Curious", "Grounded"],
  Animation: ["Imaginative", "Playful"],
  Electronic: ["Experimental", "Atmospheric"],
  Alternative: ["Experimental", "Independent"],
  "Indie Rock": ["Independent", "Emotion-focused"],
  "Hip-Hop": ["Rhythmic", "Bold"],
  Jazz: ["Atmospheric", "Refined"],
  Ambient: ["Atmospheric", "Calm"],
  Folk: ["Story-driven", "Grounded"],
  "R&B": ["Emotion-focused", "Rhythmic"],
};

/** Derives a short list of taste-profile adjectives from a user's selected genres. */
export function deriveTasteTraits(genres: string[], limit = 5): string[] {
  const counts = new Map<string, number>();

  for (const genre of genres) {
    for (const trait of GENRE_TRAITS[genre] ?? []) {
      counts.set(trait, (counts.get(trait) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([trait]) => trait);
}
