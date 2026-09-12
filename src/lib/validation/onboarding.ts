import { z } from "zod";
import { contentKindSchema } from "@/lib/validation/content";

export const onboardingSchema = z.object({
  contentTypes: z.array(z.enum(["movies", "tv", "music"])).min(1, "Pick at least one."),
  genres: z.array(z.string()).min(3, "Pick at least 3 genres."),
  favorites: z.array(z.object({ kind: contentKindSchema, contentId: z.string() })).default([]),
  moods: z.array(z.string()).default([]),
  recommendationDiversity: z.number().min(0).max(100).default(50),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
