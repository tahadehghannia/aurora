-- CreateEnum
CREATE TYPE "AiArtifactKind" AS ENUM ('IDENTITY', 'DNA', 'MOOD_PROFILE', 'TASTE_EVOLUTION');

-- CreateTable
CREATE TABLE "ai_artifacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AiArtifactKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "dataVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_artifacts_userId_kind_idx" ON "ai_artifacts"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ai_artifacts_userId_kind_key" ON "ai_artifacts"("userId", "kind");

-- AddForeignKey
ALTER TABLE "ai_artifacts" ADD CONSTRAINT "ai_artifacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
