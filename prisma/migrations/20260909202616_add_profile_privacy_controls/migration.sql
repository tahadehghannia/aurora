-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "showActivityPublicly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showCollectionsPublicly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showRatingsPublicly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showTasteDataPublicly" BOOLEAN NOT NULL DEFAULT true;
