ALTER TABLE "Expression"
ADD COLUMN "situationPromptKorean" TEXT,
ADD COLUMN "situationPromptContext" TEXT,
ADD COLUMN "situationPromptTips" TEXT,
ADD COLUMN "situationPromptVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "situationPromptGeneratedAt" TIMESTAMP(3);
