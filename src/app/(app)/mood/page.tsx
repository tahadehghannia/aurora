import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listMoodWatchlists } from "@/lib/mood/store";
import { MoodCreator } from "@/components/mood/mood-creator";

export const metadata: Metadata = {
  title: "Create with AI",
  description: "Describe what you're in the mood for and Aurora builds a watchlist around it.",
};

interface MoodPageProps {
  /** `q` pre-fills the request from a contextual entry point (§39). */
  searchParams: Promise<{ q?: string; go?: string }>;
}

export default async function MoodPage({ searchParams }: MoodPageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const recent = await listMoodWatchlists(session.user.id, 6);
  const initialPrompt = typeof params.q === "string" ? params.q.slice(0, 400) : "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-8">
      <header className="space-y-2">
        <h1 className="text-h3 font-semibold tracking-tight text-foreground">Create with AI</h1>
        <p className="text-body text-muted-foreground">
          Tell Aurora what you feel like watching. It builds the list from real titles, your taste, and what you
          actually asked for — and shows its reasoning.
        </p>
      </header>

      <MoodCreator initialPrompt={initialPrompt} autoGenerate={params.go === "1"} />

      {recent.length > 0 && (
        <section className="space-y-3 border-t border-border pt-8">
          <h2 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Your recent watchlists
          </h2>
          <ul className="divide-y divide-border">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/mood/${item.id}`}
                  className="flex items-baseline justify-between gap-4 py-3 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body-sm font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-caption text-muted-foreground">
                      &ldquo;{item.prompt}&rdquo;
                    </span>
                  </span>
                  <span className="shrink-0 text-caption text-muted-foreground">{item.itemCount} titles</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
