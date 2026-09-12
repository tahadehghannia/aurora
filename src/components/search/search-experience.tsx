"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, Clock, Sparkles, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ContentGrid, ContentGridSkeleton } from "@/components/content/content-grid";
import { EmptyState } from "@/components/states/empty-state";
import type { SearchResults } from "@/lib/content/queries";
import type { ContentCard } from "@/types/content";

interface MoodDiscoveryResponse {
  intent: { moods: string[]; genres: string[] };
  items: (ContentCard & { reason: string })[];
}

const MOOD_PROMPT_EXAMPLES = ["something calm tonight", "a dark show but not horror", "music for studying"];

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface SearchExperienceProps {
  suggestions: ContentCard[];
}

export function SearchExperience({ suggestions }: SearchExperienceProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [moodPrompt, setMoodPrompt] = useState("");

  const { data: recentSearches } = useQuery({
    queryKey: ["search-history"],
    queryFn: () => fetchJson<string[]>("/api/search/history"),
  });

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => fetchJson<SearchResults>(`/api/search?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.trim().length > 0,
  });

  const moodDiscovery = useMutation({
    mutationFn: (prompt: string) =>
      fetchJson<MoodDiscoveryResponse>("/api/ai/mood-discover", { method: "POST", body: JSON.stringify({ prompt }) }),
  });

  const allResults = useMemo(() => {
    if (!data) return [];
    return [...data.movies, ...data.shows, ...data.episodes, ...data.artists, ...data.albums, ...data.songs];
  }, [data]);

  const hasQuery = debounced.trim().length > 0;
  const hasMoodResult = moodDiscovery.isSuccess && !hasQuery;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-8">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies, shows, artists, albums, songs..."
          className="h-11 pl-10 pr-10 text-body-md"
          autoFocus
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {!hasQuery && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Sparkles className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand" size={16} />
            <Input
              value={moodPrompt}
              onChange={(e) => setMoodPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && moodPrompt.trim() && moodDiscovery.mutate(moodPrompt.trim())}
              placeholder="Or describe what you want — “something calm tonight”"
              className="h-10 pl-9 pr-20 text-body-sm"
            />
            <button
              onClick={() => moodPrompt.trim() && moodDiscovery.mutate(moodPrompt.trim())}
              disabled={!moodPrompt.trim() || moodDiscovery.isPending}
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md px-2 py-1 text-caption font-medium text-brand disabled:opacity-40"
            >
              {moodDiscovery.isPending && <Loader2 className="animate-spin" size={12} />}
              Ask
            </button>
          </div>
          {!moodDiscovery.isSuccess && (
            <div className="flex flex-wrap gap-1.5">
              {MOOD_PROMPT_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setMoodPrompt(ex);
                    moodDiscovery.mutate(ex);
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-caption text-muted-foreground hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasMoodResult && moodDiscovery.data && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-body-sm font-medium text-muted-foreground">
              For &ldquo;{moodPrompt}&rdquo;
            </p>
            <button
              onClick={() => {
                moodDiscovery.reset();
                setMoodPrompt("");
              }}
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          {moodDiscovery.data.items.length === 0 ? (
            <EmptyState icon={Sparkles} title="Nothing matched that" description="Try describing a mood or genre differently." />
          ) : (
            <ContentGrid items={moodDiscovery.data.items} />
          )}
        </div>
      )}

      {!hasQuery && !hasMoodResult && recentSearches && recentSearches.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-muted-foreground">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-body-sm text-muted-foreground hover:text-foreground"
              >
                <Clock size={13} />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hasQuery && !hasMoodResult && suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-muted-foreground">Popular right now</p>
          <ContentGrid items={suggestions} />
        </div>
      )}

      {!hasQuery && !hasMoodResult && suggestions.length === 0 && (!recentSearches || recentSearches.length === 0) && (
        <EmptyState icon={SearchIcon} title="Search Aurora" description="Find movies, shows, episodes, artists, albums and songs." />
      )}

      {hasQuery && isFetching && <ContentGridSkeleton count={12} />}

      {hasQuery && !isFetching && data && data.total === 0 && (
        <EmptyState icon={SearchIcon} title={`No results for "${debounced}"`} description="Try a different title, artist or keyword." />
      )}

      {hasQuery && !isFetching && data && data.total > 0 && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({data.total})</TabsTrigger>
            {data.movies.length > 0 && <TabsTrigger value="movies">Movies ({data.movies.length})</TabsTrigger>}
            {data.shows.length > 0 && <TabsTrigger value="shows">TV Shows ({data.shows.length})</TabsTrigger>}
            {data.artists.length > 0 && <TabsTrigger value="artists">Artists ({data.artists.length})</TabsTrigger>}
            {data.albums.length > 0 && <TabsTrigger value="albums">Albums ({data.albums.length})</TabsTrigger>}
            {data.songs.length > 0 && <TabsTrigger value="songs">Songs ({data.songs.length})</TabsTrigger>}
          </TabsList>
          <TabsContent value="all" className="pt-4">
            <ContentGrid items={allResults} />
          </TabsContent>
          <TabsContent value="movies" className="pt-4">
            <ContentGrid items={data.movies} />
          </TabsContent>
          <TabsContent value="shows" className="pt-4">
            <ContentGrid items={data.shows} />
          </TabsContent>
          <TabsContent value="artists" className="pt-4">
            <ContentGrid items={data.artists} />
          </TabsContent>
          <TabsContent value="albums" className="pt-4">
            <ContentGrid items={data.albums} />
          </TabsContent>
          <TabsContent value="songs" className="pt-4">
            <ContentGrid items={data.songs} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
