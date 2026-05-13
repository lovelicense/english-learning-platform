import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  RecordingJobPriority,
  RecordingJobStatus,
  RecordingJobTargetType,
  RecordingJobType,
  RecordingPartStatus,
  RecordingStatus,
  RecordingSessionStatus,
  RecordingSource,
} from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class RecordingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private buildRecordingDisplayName(baseTitle: string, partNumber: number, totalParts: number) {
    const normalizedTitle = baseTitle.trim();
    if (!normalizedTitle) {
      return null;
    }
    if (totalParts <= 1) {
      return normalizedTitle;
    }
    return `${normalizedTitle} (${partNumber}/${totalParts})`;
  }

  private async syncRecordingDisplayNames(sessionId: string) {
    const session = await this.prisma.recordingSession.findUnique({
      where: { id: sessionId },
      include: {
        parts: {
          where: {
            recordingId: {
              not: null,
            },
          },
          orderBy: { partNumber: 'asc' },
        },
      },
    });

    const baseTitle = session?.title?.trim();
    if (!session || !baseTitle || session.parts.length === 0) {
      return;
    }

    const totalParts = Math.max(session.expectedPartCount ?? session.parts.length, session.parts.length, 1);
    await this.prisma.$transaction(
      session.parts
        .filter((part) => Boolean(part.recordingId))
        .map((part) =>
          this.prisma.recording.update({
            where: { id: part.recordingId! },
            data: {
              displayName: this.buildRecordingDisplayName(baseTitle, part.partNumber, totalParts),
            },
          } as any),
        ),
    );
  }

  async createSession(userId: string, input: { source: RecordingSource; title?: string }) {
    const session = await this.prisma.recordingSession.create({
      data: {
        userId,
        source: input.source,
        title: input.title?.trim() || null,
        status: RecordingSessionStatus.CREATED,
      },
    });

    return {
      sessionId: session.id,
      status: session.status,
      recommendedPartDurationMs: 5 * 60 * 1000,
      maxDurationMs: input.source === RecordingSource.MOBILE ? 60 * 60 * 1000 : 30 * 60 * 1000,
    };
  }

  async createPartPresign(
    userId: string,
    sessionId: string,
    input: { partNumber: number; fileName: string; contentType?: string; sizeBytes?: number },
  ) {
    const session = await this.prisma.recordingSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('녹음 세션을 찾을 수 없습니다.');
    if (
      session.status === RecordingSessionStatus.CANCELLED ||
      session.status === RecordingSessionStatus.PROCESSED
    ) {
      throw new BadRequestException('이미 종료된 세션에는 새 파일을 업로드할 수 없습니다.');
    }

    const key = `recording-sessions/${sessionId}/parts/${String(input.partNumber).padStart(4, '0')}-${Date.now()}-${input.fileName}`;
    const presigned = await this.storage.createPresignedUploadForKey(key, input.contentType || 'audio/webm');

    const part = await this.prisma.recordingPart.upsert({
      where: {
        sessionId_partNumber: {
          sessionId,
          partNumber: input.partNumber,
        },
      },
      create: {
        sessionId,
        partNumber: input.partNumber,
        audioKey: presigned.key,
        fileName: input.fileName,
        contentType: input.contentType || 'audio/webm',
        sizeBytes: input.sizeBytes,
        status: RecordingPartStatus.PRESIGNED,
      },
      update: {
        audioKey: presigned.key,
        fileName: input.fileName,
        contentType: input.contentType || 'audio/webm',
        sizeBytes: input.sizeBytes ?? undefined,
        status: RecordingPartStatus.PRESIGNED,
        errorMessage: null,
      },
    });

    await this.prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: RecordingSessionStatus.UPLOADING,
      },
    });

    return {
      sessionId,
      partId: part.id,
      partNumber: part.partNumber,
      audioKey: presigned.key,
      uploadUrl: presigned.uploadUrl,
      expiresInSeconds: 300,
    };
  }

  async completePart(
    userId: string,
    sessionId: string,
    partId: string,
    input: { durationMs?: number; sizeBytes?: number },
  ) {
    const session = await this.prisma.recordingSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('녹음 세션을 찾을 수 없습니다.');

    const part = await this.prisma.recordingPart.findFirst({
      where: { id: partId, sessionId, session: { userId } },
    });
    if (!part) throw new NotFoundException('녹음 파트를 찾을 수 없습니다.');

    const recording =
      part.recordingId != null
        ? await this.prisma.recording.update({
            where: { id: part.recordingId },
            data: {
              audioKey: part.audioKey,
              fileName: part.fileName,
              status: RecordingStatus.UPLOADED,
            },
          })
        : await this.prisma.recording.create({
            data: {
              userId,
              audioKey: part.audioKey,
              fileName: part.fileName,
              displayName: session.title?.trim() || null,
              status: RecordingStatus.UPLOADED,
            },
          } as any);

    const updated = await this.prisma.recordingPart.update({
      where: { id: partId },
      data: {
        recordingId: recording.id,
        durationMs: input.durationMs,
        sizeBytes: input.sizeBytes ?? part.sizeBytes,
        status: RecordingPartStatus.UPLOADED,
        errorMessage: null,
      },
    });

    const uploadedPartCount = await this.prisma.recordingPart.count({
      where: { sessionId, status: RecordingPartStatus.UPLOADED },
    });

    await this.prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: RecordingSessionStatus.UPLOADING,
        uploadedPartCount,
      },
    });

    return {
      sessionId,
      partId: updated.id,
      recordingId: recording.id,
      status: updated.status,
      uploadedPartCount,
    };
  }

  async finalizeSession(
    userId: string,
    sessionId: string,
    input: { expectedPartCount?: number; totalDurationMs?: number },
  ) {
    const session = await this.prisma.recordingSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('녹음 세션을 찾을 수 없습니다.');

    const finalized = await this.prisma.recordingSession.update({
      where: { id: sessionId },
      data: {
        status: RecordingSessionStatus.UPLOADED,
        expectedPartCount: input.expectedPartCount,
        totalDurationMs: input.totalDurationMs,
        completedAt: new Date(),
      },
    });

    await this.syncRecordingDisplayNames(sessionId);

    return {
      sessionId: finalized.id,
      status: finalized.status,
      expectedPartCount: finalized.expectedPartCount,
      uploadedPartCount: finalized.uploadedPartCount,
      totalDurationMs: finalized.totalDurationMs,
    };
  }

  async enqueueProcessing(
    userId: string,
    sessionId: string,
    input: { diarization?: boolean },
  ) {
    const session = await this.prisma.recordingSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        parts: {
          orderBy: { partNumber: 'asc' },
          include: {
            jobs: {
              where: {
                type: RecordingJobType.TRANSCRIBE_PART,
                status: {
                  in: [RecordingJobStatus.QUEUED, RecordingJobStatus.PROCESSING, RecordingJobStatus.COMPLETED],
                },
              },
            },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('녹음 세션을 찾을 수 없습니다.');
    if (session.parts.length === 0) {
      throw new BadRequestException('업로드가 완료된 녹음 파트가 없습니다.');
    }

    const uploadedParts = session.parts.filter(
      (part) => part.status === RecordingPartStatus.UPLOADED && part.jobs.length === 0,
    );
    if (uploadedParts.length === 0) {
      return {
        sessionId,
        status: session.status,
        queuedJobCount: 0,
      };
    }

    await this.prisma.$transaction([
      this.prisma.recordingSession.update({
        where: { id: sessionId },
        data: { status: RecordingSessionStatus.QUEUED, errorMessage: null },
      }),
      ...uploadedParts.map((part) =>
        this.prisma.recordingJob.create({
          data: {
            userId,
            sessionId,
            partId: part.id,
            type: RecordingJobType.TRANSCRIBE_PART,
            targetType: RecordingJobTargetType.RECORDING_PART,
            targetId: part.id,
            status: RecordingJobStatus.QUEUED,
            priority: RecordingJobPriority.NORMAL,
            payload: {
              diarization: input.diarization ?? true,
              sessionId,
              partId: part.id,
              audioKey: part.audioKey,
              fileName: part.fileName,
              partNumber: part.partNumber,
            },
          },
        }),
      ),
    ]);

    return {
      sessionId,
      status: RecordingSessionStatus.QUEUED,
      queuedJobCount: uploadedParts.length,
    };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.prisma.recordingSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        parts: {
          orderBy: { partNumber: 'asc' },
        },
        jobs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!session) throw new NotFoundException('녹음 세션을 찾을 수 없습니다.');

    return session;
  }
}
