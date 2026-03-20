import { Injectable, NotFoundException } from '@nestjs/common';
import { RecordingStatus } from '@prisma/client';
import { OpenAiService } from '../openai/openai.service';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

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

  async processRecording(userId: string, recordingId: string, diarization = false) {
    const recording = await this.prisma.recording.findFirst({ where: { id: recordingId, userId } });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    await this.prisma.recording.update({ where: { id: recording.id }, data: { status: RecordingStatus.PROCESSING, diarization } });

    const buffer = await this.storage.getObjectBuffer(recording.audioKey);
    const transcription = await this.openai.transcribeAudio(buffer, recording.fileName, diarization);

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
    return recording;
  }
}
