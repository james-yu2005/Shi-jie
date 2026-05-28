-- CreateTable
CREATE TABLE "KgNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hanzi" TEXT NOT NULL,
    "pinyin" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "radicals" JSONB NOT NULL DEFAULT '[]',
    "components" JSONB NOT NULL DEFAULT '[]',
    "semanticTags" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KgNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KgEdge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KgEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KgNode_userId_idx" ON "KgNode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KgNode_userId_hanzi_key" ON "KgNode"("userId", "hanzi");

-- CreateIndex
CREATE INDEX "KgEdge_userId_idx" ON "KgEdge"("userId");

-- CreateIndex
CREATE INDEX "KgEdge_sourceId_idx" ON "KgEdge"("sourceId");

-- CreateIndex
CREATE INDEX "KgEdge_targetId_idx" ON "KgEdge"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "KgEdge_userId_sourceId_targetId_type_key" ON "KgEdge"("userId", "sourceId", "targetId", "type");

-- AddForeignKey
ALTER TABLE "KgNode" ADD CONSTRAINT "KgNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KgEdge" ADD CONSTRAINT "KgEdge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KgEdge" ADD CONSTRAINT "KgEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KgEdge" ADD CONSTRAINT "KgEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "KgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
