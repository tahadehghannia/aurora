import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(280).optional(),
  isPublic: z.boolean().optional(),
  showRatingsPublicly: z.boolean().optional(),
  showActivityPublicly: z.boolean().optional(),
  showCollectionsPublicly: z.boolean().optional(),
  showTasteDataPublicly: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
