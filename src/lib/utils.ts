export { cn } from "cn"

/** Genre-name -> URL slug, matching the slugs already stored on Genre rows (see prisma/seed-lib.ts). */
export function slugifyGenre(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}
