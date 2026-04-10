-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleLabel" TEXT,
    "relationshipToMe" TEXT,
    "aliases" TEXT,
    "notes" TEXT,
    "isMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingParticipant" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "personProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSpeakerProfile" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "speakerLabel" TEXT NOT NULL,
    "personProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingSpeakerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_userId_name_key" ON "PersonProfile"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingParticipant_recordingId_personProfileId_key" ON "RecordingParticipant"("recordingId", "personProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSpeakerProfile_recordingId_speakerLabel_key" ON "RecordingSpeakerProfile"("recordingId", "speakerLabel");

-- AddForeignKey
ALTER TABLE "PersonProfile" ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingParticipant" ADD CONSTRAINT "RecordingParticipant_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingParticipant" ADD CONSTRAINT "RecordingParticipant_personProfileId_fkey" FOREIGN KEY ("personProfileId") REFERENCES "PersonProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSpeakerProfile" ADD CONSTRAINT "RecordingSpeakerProfile_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSpeakerProfile" ADD CONSTRAINT "RecordingSpeakerProfile_personProfileId_fkey" FOREIGN KEY ("personProfileId") REFERENCES "PersonProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
