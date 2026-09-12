import { z } from "zod";

export const contentKindSchema = z.enum(["movie", "tv_show", "episode", "artist", "album", "song"]);

export const libraryItemSchema = z.object({
  kind: contentKindSchema,
  contentId: z.string().min(1),
});

export const ratingSchema = z.object({
  kind: contentKindSchema,
  contentId: z.string().min(1),
  score: z.number().min(0.5).max(5).multipleOf(0.5),
});
