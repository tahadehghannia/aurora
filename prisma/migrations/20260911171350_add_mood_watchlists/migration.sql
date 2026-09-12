-- CreateEnum
CREATE TYPE "MoodReasonType" AS ENUM ('MOOD_MATCH', 'TASTE_MATCH', 'RECENT_INTEREST', 'CREATOR_MATCH', 'GENRE_MATCH', 'CONTEXT_MATCH', 'EXPLORATION', 'RUNTIME_MATCH');

-- CreateTable
CREATE TABLE "mood_watchlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyThisList" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "parsedIntent" JSONB NOT NULL,
    "exploration" TEXT NOT NULL DEFAULT 'balanced',
    "personalization" TEXT NOT NULL DEFAULT 'general',
    "aiCurated" BOOLEAN NOT NULL DEFAULT false,
    "modelVersion" TEXT,
    "promptVersion" TEXT NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mood_watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_watchlist_items" (
    "id" TEXT NOT NULL,
    "watchlistId" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reasonType" "MoodReasonType" NOT NULL DEFAULT 'GENRE_MATCH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mood_watchlists_userId_createdAt_idx" ON "mood_watchlists"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mood_watchlist_items_watchlistId_position_idx" ON "mood_watchlist_items"("watchlistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "mood_watchlist_items_watchlistId_contentType_contentId_key" ON "mood_watchlist_items"("watchlistId", "contentType", "contentId");

-- AddForeignKey
ALTER TABLE "mood_watchlists" ADD CONSTRAINT "mood_watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_watchlist_items" ADD CONSTRAINT "mood_watchlist_items_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "mood_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
