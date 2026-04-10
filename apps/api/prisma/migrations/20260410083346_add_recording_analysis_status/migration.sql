-- CreateEnum
CREATE TYPE "RecordingAnalysisStatus" AS ENUM ('NOT_ANALYZED', 'OK', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "analysisStatus" "RecordingAnalysisStatus" NOT NULL DEFAULT 'NOT_ANALYZED',
ADD COLUMN     "analysisStatusReason" TEXT;
