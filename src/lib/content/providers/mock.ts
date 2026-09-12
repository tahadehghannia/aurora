import { MOVIES } from "@/lib/mock/seed-data";
import type { MovieProvider } from "@/lib/content/providers/types";

/** The original fictional catalog, wrapped as a provider — the fallback when no real movie provider is configured. */
export const mockMovieProvider: MovieProvider = {
  name: "Aurora fictional catalog",
  isAvailable: () => true,
  async fetchMovies(titles: string[]) {
    if (titles.length === 0) return MOVIES;
    const wanted = new Set(titles.map((t) => t.toLowerCase()));
    return MOVIES.filter((m) => wanted.has(m.title.toLowerCase()));
  },
};
