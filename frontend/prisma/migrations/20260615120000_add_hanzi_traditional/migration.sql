-- Add traditional script column for dual-form storage (simplified in hanzi).
ALTER TABLE "Flashcard" ADD COLUMN "hanziTraditional" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KgNode" ADD COLUMN "hanziTraditional" TEXT NOT NULL DEFAULT '';
