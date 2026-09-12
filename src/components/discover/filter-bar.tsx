"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
  genres: string[];
}

const KIND_TABS = [
  { value: "", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv_show", label: "TV Shows" },
  { value: "music", label: "Music" },
] as const;

const SORTS = [
  { value: "popularity", label: "Most popular" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

export function FilterBar({ genres }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const kind = searchParams.get("kind") ?? "";
  const genre = searchParams.get("genre") ?? "";
  const sort = searchParams.get("sort") ?? "popularity";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-fade-x flex gap-2 overflow-x-auto no-scrollbar">
        {KIND_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => updateParam("kind", tab.value)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-body-sm transition-colors",
              kind === tab.value
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={genre || "all"} onValueChange={(v) => updateParam("genre", v === "all" || !v ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Genre">
              {(v: string) => (v === "all" ? "All genres" : genres.find((g) => slugify(g) === v) ?? "All genres")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genres</SelectItem>
            {genres.map((g) => (
              <SelectItem key={g} value={slugify(g)}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => v && updateParam("sort", v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort">
              {(v: string) => SORTS.find((s) => s.value === v)?.label ?? "Most popular"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
