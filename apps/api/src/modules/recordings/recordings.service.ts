import { Injectable, NotFoundException } from '@nestjs/common';
import { RecordingStatus } from '@prisma/client';
import { OpenAiService } from '../openai/openai.service';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

type RecordingAnalysisInput = {
  relationship?: string;
  situation?: string;
  tone?: string;
};

@Injectable()
export class RecordingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly openai: OpenAiService,
  ) {}

  async createPresignedUpload(userId: string, fileName: string, contentType?: string) {
    const presigned = await this.storage.createPresignedUpload(fileName, contentType);
    const recording = await this.prisma.recording.create({
      data: {
        userId,
        audioKey: presigned.key,
        fileName,
        status: RecordingStatus.UPLOADED,
      },
    });
    return { ...presigned, recordingId: recording.id };
  }

  async list(userId: string) {
    return this.prisma.recording.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        _count: {
          select: { utterances: true },
        },
      },
    });
  }

  async processRecording(userId: string, recordingId: string, diarization = false) {
    const recording = await this.prisma.recording.findFirst({ where: { id: recordingId, userId } });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    await this.prisma.recording.update({ where: { id: recording.id }, data: { status: RecordingStatus.PROCESSING, diarization } });

    const buffer = await this.storage.getObjectBuffer(recording.audioKey);
    console.info(
      `[Recording process:start] recordingId=${recordingId} fileName=${recording.fileName} bytes=${buffer.byteLength} diarization=${diarization}`,
    );
    const transcription = await this.openai.transcribeAudio(buffer, recording.fileName, diarization);
    console.info(
      `[Recording process:done] recordingId=${recordingId} diarization=${diarization} utterances=${transcription.utterances.length} first_start_ms=${
        transcription.utterances[0]?.startMs ?? 0
      } last_end_ms=${transcription.utterances[transcription.utterances.length - 1]?.endMs ?? 0}`,
    );

    await this.prisma.$transaction([
      this.prisma.utterance.deleteMany({ where: { recordingId } }),
      ...transcription.utterances.map((u) =>
        this.prisma.utterance.create({
          data: {
            recordingId,
            speakerLabel: u.speakerLabel,
            koreanText: u.koreanText,
            startMs: u.startMs,
            endMs: u.endMs,
            isMine: u.speakerLabel === 'speaker_1',
          },
        }),
      ),
      this.prisma.recording.update({ where: { id: recordingId }, data: { status: RecordingStatus.PROCESSED } }),
    ]);

    return this.getOne(userId, recordingId);
  }

  async getOne(userId: string, id: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { id, userId },
      include: { utterances: { orderBy: { startMs: 'asc' } } },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');
    return {
      ...recording,
      audioUrl: await this.storage.createPresignedDownload(recording.audioKey),
    };
  }

  async analyzeConversation(userId: string, recordingId: string, input: RecordingAnalysisInput) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
      include: { utterances: { orderBy: { startMs: 'asc' } } },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');
    if (recording.utterances.length === 0) throw new NotFoundException('분석할 대화 문장이 없습니다.');

    return this.openai.analyzeConversation({
      relationship: input.relationship?.trim() || undefined,
      situation: input.situation?.trim() || undefined,
      tone: input.tone?.trim() || undefined,
      turns: recording.utterances.map((utterance) => ({
        utteranceId: utterance.id,
        speakerLabel: utterance.speakerLabel,
        koreanText: utterance.koreanText,
        isMine: utterance.isMine,
      })),
    });
  }

  async updateUtterance(userId: string, utteranceId: string, koreanText: string) {
    const utterance = await this.prisma.utterance.findFirst({
      where: { id: utteranceId, recording: { userId } },
    });
    if (!utterance) throw new NotFoundException('발화 문장을 찾을 수 없습니다.');

    return this.prisma.utterance.update({
      where: { id: utteranceId },
      data: { koreanText: koreanText.trim() },
    });
  }

  async removeUtterance(userId: string, utteranceId: string) {
    const utterance = await this.prisma.utterance.findFirst({
      where: { id: utteranceId, recording: { userId } },
      include: {
        expressions: {
          select: { id: true },
        },
      },
    });
    if (!utterance) throw new NotFoundException('발화 문장을 찾을 수 없습니다.');

    const expressionIds = utterance.expressions.map((expression) => expression.id);

    await this.prisma.$transaction([
      this.prisma.practiceLog.deleteMany({
        where: { expressionId: { in: expressionIds } },
      }),
      this.prisma.expression.deleteMany({
        where: { id: { in: expressionIds } },
      }),
      this.prisma.utterance.delete({
        where: { id: utteranceId },
      }),
    ]);

    return {
      success: true,
      utteranceId,
      deletedExpressionCount: expressionIds.length,
    };
  }

  async updateMineSpeaker(userId: string, recordingId: string, speakerLabel: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
      include: {
        utterances: {
          orderBy: { startMs: 'asc' },
        },
      },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const normalizedSpeakerLabel = speakerLabel.trim();
    const hasSpeaker = recording.utterances.some((utterance) => utterance.speakerLabel === normalizedSpeakerLabel);
    if (!hasSpeaker) throw new NotFoundException('선택한 화자를 찾을 수 없습니다.');

    await this.prisma.$transaction([
      this.prisma.utterance.updateMany({
        where: { recordingId },
        data: { isMine: false },
      }),
      this.prisma.utterance.updateMany({
        where: { recordingId, speakerLabel: normalizedSpeakerLabel },
        data: { isMine: true },
      }),
    ]);

    return this.getOne(userId, recordingId);
  }

  async updateSpeakerLabel(userId: string, recordingId: string, speakerLabel: string, nextSpeakerLabel: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
      include: {
        utterances: {
          orderBy: { startMs: 'asc' },
        },
      },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const normalizedSpeakerLabel = speakerLabel.trim();
    const normalizedNextSpeakerLabel = nextSpeakerLabel.trim();
    const hasSpeaker = recording.utterances.some((utterance) => utterance.speakerLabel === normalizedSpeakerLabel);
    if (!hasSpeaker) throw new NotFoundException('선택한 화자를 찾을 수 없습니다.');

    if (
      normalizedNextSpeakerLabel !== normalizedSpeakerLabel &&
      recording.utterances.some((utterance) => utterance.speakerLabel === normalizedNextSpeakerLabel)
    ) {
      throw new NotFoundException('같은 녹음 안에 이미 같은 이름의 화자가 있습니다.');
    }

    await this.prisma.utterance.updateMany({
      where: { recordingId, speakerLabel: normalizedSpeakerLabel },
      data: { speakerLabel: normalizedNextSpeakerLabel },
    });

    return this.getOne(userId, recordingId);
  }

  async remove(userId: string, recordingId: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
      include: { utterances: { select: { id: true } } },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const utteranceIds = recording.utterances.map((utterance) => utterance.id);

    await this.prisma.$transaction([
      this.prisma.expression.updateMany({
        where: { utteranceId: { in: utteranceIds } },
        data: { utteranceId: null },
      }),
      this.prisma.utterance.deleteMany({ where: { recordingId } }),
      this.prisma.recording.delete({ where: { id: recordingId } }),
    ]);

    return { success: true, recordingId };
  }
}
