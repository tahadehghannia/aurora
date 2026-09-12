import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ContentRow } from "@/components/content/content-row";
import { getTrending, getPopularArtists } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Aurora — Your taste, understood.",
};

export default async function LandingPage() {
  const [trending, artists] = await Promise.all([getTrending(12), getPopularArtists(10)]);
  const hero = trending[0];

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3.5 backdrop-blur-sm sm:px-8">
        <Logo />
        <div className="flex items-center gap-1">
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button render={<Link href="/signup" />}>Get started</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {hero && (
          <section className="relative h-[62vh] min-h-96 w-full overflow-hidden sm:h-[70vh]">
            <Image src={hero.imageUrl} alt="" fill priority className="object-cover" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 px-4 pb-10 sm:px-8 sm:pb-14">
              <h1 className="max-w-lg text-h2 font-bold leading-[1.08] tracking-tight sm:text-display-l">
                Your taste, understood.
              </h1>
              <p className="max-w-md text-body-md text-muted-foreground">
                Movies, shows and music in one place — with recommendations that tell you why,
                not just what.
              </p>
              <div className="mt-1">
                <Button size="lg" className="h-11 px-7 text-body-md" render={<Link href="/signup" />}>
                  Start discovering
                </Button>
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-12 py-14 sm:gap-16 sm:py-20">
          <ContentRow title="On Aurora right now" items={trending} />

          <section className="px-4 sm:px-8">
            <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-[minmax(0,160px)_1fr] sm:gap-16">
              <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
                How it works
              </p>
              <div className="space-y-5 text-body-md text-foreground">
                <p>
                  Rate a few things you already love, and Aurora starts building a picture of your
                  taste — not just genres, but the moods, artists and directors you keep coming back
                  to.
                </p>
                <p className="text-muted-foreground">
                  Every recommendation comes with a plain reason: because you liked something
                  specific, because of a genre you gravitate toward, or because it&apos;s what people
                  with similar taste are into right now. No black box.
                </p>
              </div>
            </div>
          </section>

          <ContentRow title="Artists people are into" items={artists} variant="compact" />

          <section className="border-t border-border px-4 pt-14 sm:px-8">
            <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-h4 font-semibold">Ready when you are.</h2>
                <p className="text-body-sm text-muted-foreground">
                  Free to join — takes about a minute to set up.
                </p>
              </div>
              <Button size="lg" className="h-11 px-7 text-body-md" render={<Link href="/signup" />}>
                Create your account
              </Button>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 text-caption text-muted-foreground sm:flex-row sm:justify-between">
          <Logo markClassName="h-4 w-4" wordmarkClassName="text-caption font-medium" />
          <span>© {new Date().getFullYear()} Aurora</span>
        </div>
      </footer>
    </div>
  );
}
