-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('LIKE', 'DISLIKE', 'MORE_LIKE_THIS', 'LESS_LIKE_THIS', 'NOT_FOR_ME', 'HIDE_CREATOR', 'MUTE_GENRE', 'MUTE_MOOD', 'USEFUL');

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedbackType" "FeedbackType" NOT NULL,
    "contentType" "ContentType",
    "contentId" TEXT,
    "targetLabel" TEXT,
    "source" TEXT NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feedback_userId_createdAt_idx" ON "user_feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "user_feedback_userId_feedbackType_idx" ON "user_feedback"("userId", "feedbackType");

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
