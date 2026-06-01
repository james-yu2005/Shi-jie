-- AddColumn: SM-2 spaced repetition fields to Flashcard
ALTER TABLE "Flashcard" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "Flashcard" ADD COLUMN "interval" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Flashcard" ADD COLUMN "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "Flashcard" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: index on (userId, dueAt) for efficient review queries
CREATE INDEX "Flashcard_userId_dueAt_idx" ON "Flashcard"("userId", "dueAt");
