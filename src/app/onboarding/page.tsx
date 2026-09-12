import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { getGenres, getMoods, getPopularMovies, getPopularShows, getPopularArtists } from "@/lib/content/queries";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Set up your taste profile" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (profile?.onboardingCompleted) redirect("/home");

  const [genres, moods, movies, shows, artists] = await Promise.all([
    getGenres(),
    getMoods(),
    getPopularMovies(12),
    getPopularShows(12),
    getPopularArtists(12),
  ]);

  return (
    <OnboardingWizard
      genres={genres.map((g) => g.name)}
      moods={moods}
      favoriteOptions={{ movies, shows, artists }}
      firstName={session.user.name?.split(" ")[0]}
    />
  );
}
