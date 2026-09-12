"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Film, Tv, Music, Check, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ContentCard, ContentKind } from "@/types/content";

interface OnboardingWizardProps {
  genres: string[];
  moods: string[];
  favoriteOptions: { movies: ContentCard[]; shows: ContentCard[]; artists: ContentCard[] };
  firstName?: string;
}

const CONTENT_TYPES = [
  { value: "movies", label: "Movies", icon: Film },
  { value: "tv", label: "TV Shows", icon: Tv },
  { value: "music", label: "Music", icon: Music },
] as const;

const STEP_TITLES = ["Welcome", "What do you love?", "Pick your genres", "A few favorites", "Set the mood", "Almost there"];

export function OnboardingWizard({ genres, moods, favoriteOptions, firstName }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<{ kind: ContentKind; contentId: string }[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [diversity, setDiversity] = useState(50);

  const totalSteps = STEP_TITLES.length;
  const progress = ((step + 1) / totalSteps) * 100;

  const favoriteChoices: (ContentCard & { kind: ContentKind })[] = [
    ...favoriteOptions.movies,
    ...favoriteOptions.shows,
    ...favoriteOptions.artists,
  ];

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const toggleFavorite = (kind: ContentKind, contentId: string) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.kind === kind && f.contentId === contentId);
      if (exists) return prev.filter((f) => !(f.kind === kind && f.contentId === contentId));
      if (prev.length >= 8) return prev;
      return [...prev, { kind, contentId }];
    });
  };

  const canContinue =
    step === 0 ||
    (step === 1 && contentTypes.length > 0) ||
    (step === 2 && selectedGenres.length >= 3) ||
    step === 3 ||
    step === 4 ||
    step === 5;

  const next = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentTypes,
          genres: selectedGenres,
          favorites,
          moods: selectedMoods,
          recommendationDiversity: diversity,
        }),
      });
      if (!res.ok) throw new Error("Something went wrong. Please try again.");
      router.push("/home");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      {step > 0 && (
        <div className="px-4 pt-6 sm:px-8">
          <div className="mx-auto max-w-xl">
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>
      )}

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-xl">
          {step === 0 && (
            <div className="flex flex-col gap-8">
              {favoriteChoices.length > 0 && (
                <div className="flex gap-2">
                  {favoriteChoices.slice(0, 6).map((item) => (
                    <div key={`${item.kind}-${item.id}`} className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:w-20">
                      <Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <h1 className="text-h3 font-bold">
                  {firstName ? `Welcome, ${firstName}.` : "Welcome to Aurora."}
                </h1>
                <p className="max-w-sm text-body-md text-muted-foreground">
                  A minute of setup, and Aurora will already understand your taste.
                </p>
              </div>
              <Button size="lg" className="h-11 w-fit px-8 text-body-md" onClick={next}>
                Get started
              </Button>
            </div>
          )}

          {step === 1 && (
            <StepShell title="What do you love?" description="Pick everything that applies.">
              <div className="grid grid-cols-3 gap-3">
                {CONTENT_TYPES.map(({ value, label, icon: Icon }) => {
                  const active = contentTypes.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggle(contentTypes, value, setContentTypes)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-5 transition-colors",
                        active ? "border-brand bg-brand/10 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                      )}
                    >
                      <Icon size={24} />
                      <span className="text-body-sm font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Pick your genres" description="Choose at least 3 to help Aurora get a feel for your taste.">
              <div className="flex flex-wrap gap-2">
                {genres.map((genre) => (
                  <Chip
                    key={genre}
                    label={genre}
                    active={selectedGenres.includes(genre)}
                    onClick={() => toggle(selectedGenres, genre, setSelectedGenres)}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="A few favorites" description="Optional — select up to 8 titles or artists you already love.">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {favoriteChoices.map((item) => {
                  const active = favorites.some((f) => f.kind === item.kind && f.contentId === item.id);
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => toggleFavorite(item.kind, item.id)}
                      className="group relative flex flex-col gap-1.5 text-left"
                    >
                      <div
                        className={cn(
                          "relative aspect-[2/3] overflow-hidden rounded-lg ring-2 ring-transparent transition-all",
                          active && "ring-brand"
                        )}
                      >
                        <Image src={item.imageUrl} alt="" fill sizes="120px" className="object-cover" />
                        {active && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-foreground">
                              <Check size={16} />
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="truncate text-caption text-muted-foreground">{item.title}</p>
                    </button>
                  );
                })}
              </div>
            </StepShell>
          )}

          {step === 4 && (
            <StepShell title="Set the mood" description="What kind of moods do you gravitate toward?">
              <div className="flex flex-wrap gap-2">
                {moods.map((mood) => (
                  <Chip
                    key={mood}
                    label={mood}
                    active={selectedMoods.includes(mood)}
                    onClick={() => toggle(selectedMoods, mood, setSelectedMoods)}
                  />
                ))}
              </div>
            </StepShell>
          )}

          {step === 5 && (
            <StepShell title="One last thing" description="How adventurous should your recommendations be?">
              <div className="flex flex-col gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={diversity}
                  onChange={(e) => setDiversity(Number(e.target.value))}
                  className="w-full accent-brand"
                />
                <div className="flex justify-between text-caption text-muted-foreground">
                  <span>Stick to what I know</span>
                  <span>Surprise me</span>
                </div>
              </div>
            </StepShell>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <Button variant="ghost" onClick={back} disabled={submitting}>
                <ArrowLeft size={16} />
                Back
              </Button>
            ) : (
              <span />
            )}

            {step > 0 &&
              (step === totalSteps - 1 ? (
                <Button onClick={finish} disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Generate my taste profile
                </Button>
              ) : (
                <Button onClick={next} disabled={!canContinue}>
                  Continue
                  <ArrowRight size={16} />
                </Button>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function StepShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="text-h4 font-semibold">{title}</h2>
        <p className="text-body-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-body-sm transition-colors",
        active
          ? "border-brand bg-brand/10 text-foreground"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
