ALTER TABLE "ConversationSession"
ADD COLUMN "userRole" TEXT,
ADD COLUMN "aiRole" TEXT,
ADD COLUMN "conversationTopic" TEXT,
ADD COLUMN "situationDescription" TEXT,
ADD COLUMN "userStartText" TEXT;

ALTER TABLE "DialoguePracticeSet"
ADD COLUMN "userRole" TEXT,
ADD COLUMN "aiRole" TEXT,
ADD COLUMN "conversationTopic" TEXT,
ADD COLUMN "situationDescription" TEXT,
ADD COLUMN "userStartText" TEXT;
