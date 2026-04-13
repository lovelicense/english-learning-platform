import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { RecordingStatus } from '@prisma/client';
import { OpenAiService } from '../openai/openai.service';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

type RecordingAnalysisInput = {
  relationship?: string;
  situation?: string;
  tone?: string;
};

type PersonContextProfile = {
  id: string;
  name: string;
  roleLabel?: string | null;
  relationshipToMe?: string | null;
  aliases?: string | null;
  notes?: string | null;
  isMe?: boolean;
};

function buildParticipantContext(
  participants: PersonContextProfile[] = [],
  speakerProfiles: Array<{ speakerLabel: string; personProfile: PersonContextProfile }> = [],
) {
  const profileLines = participants.map((profile) => {
    const bits = [
      profile.name,
      profile.isMe ? '사용자 본인' : null,
      profile.roleLabel ? `역할: ${profile.roleLabel}` : null,
      profile.relationshipToMe ? `사용자와의 관계: ${profile.relationshipToMe}` : null,
      profile.aliases ? `별칭: ${profile.aliases}` : null,
      profile.notes ? `메모: ${profile.notes}` : null,
    ].filter(Boolean);
    return `- ${bits.join(' / ')}`;
  });

  const speakerLines = speakerProfiles.map(
    (mapping) => `- ${mapping.speakerLabel} = ${mapping.personProfile.name}${mapping.personProfile.roleLabel ? ` (${mapping.personProfile.roleLabel})` : ''}`,
  );

  return [profileLines.length ? `등장 인물 정보:\n${profileLines.join('\n')}` : null, speakerLines.length ? `화자 매핑:\n${speakerLines.join('\n')}` : null]
    .filter(Boolean)
    .join('\n\n');
}

type RecordingAnalysisResult = {
  summary: string;
  intents: Array<{
    utteranceId?: string;
    speakerLabel?: string;
    koreanText: string;
    intent: string;
  }>;
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
      this.prisma.recording.update({
        where: { id: recordingId },
        data: {
          status: RecordingStatus.PROCESSED,
          analysisSummary: null,
          analysisRelationship: null,
          analysisSituation: null,
          analysisTone: null,
          analysisStatus: 'NOT_ANALYZED',
          analysisStatusReason: null,
          analysisUpdatedAt: null,
        } as any,
      } as any),
    ]);

    return this.getOne(userId, recordingId);
  }

  async getOne(userId: string, id: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { id, userId },
      include: {
        utterances: { orderBy: { startMs: 'asc' } },
        participants: {
          include: {
            personProfile: true,
          },
          orderBy: { createdAt: 'asc' },
        } as any,
        speakerProfiles: {
          include: {
            personProfile: true,
          },
          orderBy: { speakerLabel: 'asc' },
        } as any,
      } as any,
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
      include: {
        utterances: { orderBy: { startMs: 'asc' } },
        participants: {
          include: { personProfile: true },
        } as any,
        speakerProfiles: {
          include: { personProfile: true },
        } as any,
      } as any,
    } as any) as any;
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');
    if (recording.utterances.length === 0) throw new NotFoundException('분석할 대화 문장이 없습니다.');

    return this.analyzeAndPersistRecording(recording.id, {
      relationship: input.relationship?.trim() || undefined,
      situation: input.situation?.trim() || undefined,
      tone: input.tone?.trim() || undefined,
      participantContext: buildParticipantContext(
        recording.participants.map((item: any) => item.personProfile),
        recording.speakerProfiles,
      ),
      turns: recording.utterances.map((utterance: any) => ({
        utteranceId: utterance.id,
        speakerLabel: utterance.speakerLabel,
        koreanText: utterance.koreanText,
        isMine: utterance.isMine,
      })),
    });
  }

  async updateUtterance(
    userId: string,
    utteranceId: string,
    input: {
      koreanText?: string;
      speakerLabel?: string;
      contextNote?: string;
      markAnalysisReview?: boolean;
    },
  ) {
    const utterance = await this.prisma.utterance.findFirst({
      where: { id: utteranceId, recording: { userId } },
    });
    if (!utterance) throw new NotFoundException('발화 문장을 찾을 수 없습니다.');

    const nextKoreanText = input.koreanText?.trim();
    const nextSpeakerLabel = input.speakerLabel?.trim();
    const nextContextNote = input.contextNote?.trim() ?? '';
    if (!nextKoreanText && !nextSpeakerLabel && typeof input.contextNote !== 'string') {
      throw new NotFoundException('저장할 발화 정보가 없습니다.');
    }

    let nextIsMine = utterance.isMine;
    if (nextSpeakerLabel) {
      const recordingUtterances = await this.prisma.utterance.findMany({
        where: { recordingId: utterance.recordingId },
        select: { id: true, speakerLabel: true, isMine: true },
      });
      const hasSpeaker = recordingUtterances.some(
        (recordingUtterance) =>
          recordingUtterance.speakerLabel === nextSpeakerLabel || recordingUtterance.id === utteranceId,
      );
      if (!hasSpeaker) {
        throw new BadRequestException('변경할 대상 화자를 찾을 수 없습니다.');
      }
      nextIsMine = recordingUtterances.some(
        (recordingUtterance) => recordingUtterance.id !== utteranceId && recordingUtterance.speakerLabel === nextSpeakerLabel && recordingUtterance.isMine,
      );
    }

    const updated = await this.prisma.utterance.update({
      where: { id: utteranceId },
      data: {
        ...(nextKoreanText ? { koreanText: nextKoreanText } : {}),
        ...(nextSpeakerLabel ? { speakerLabel: nextSpeakerLabel, isMine: nextIsMine } : {}),
        ...(typeof input.contextNote === 'string' ? { contextNote: nextContextNote ? nextContextNote : null } : {}),
      },
    });
    if (input.markAnalysisReview ?? true) {
      await this.prisma.recording.update({
        where: { id: utterance.recordingId },
        data: {
          analysisStatus: 'NEEDS_REVIEW',
          analysisStatusReason: nextSpeakerLabel ? 'UTTERANCE_SPEAKER_CHANGED' : 'UTTERANCE_UPDATED',
        } as any,
      } as any);
    }
    return updated;
  }

  async removeUtterance(userId: string, utteranceId: string, markAnalysisReview = true) {
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

    const operations: any[] = [
      this.prisma.practiceLog.deleteMany({
        where: { expressionId: { in: expressionIds } },
      }),
      this.prisma.expression.deleteMany({
        where: { id: { in: expressionIds } },
      }),
      this.prisma.utterance.delete({
        where: { id: utteranceId },
      }),
    ];

    if (markAnalysisReview) {
      operations.push(
        this.prisma.recording.update({
          where: { id: utterance.recordingId },
          data: {
            analysisStatus: 'NEEDS_REVIEW',
            analysisStatusReason: 'UTTERANCE_DELETED',
          } as any,
        } as any),
      );
    }

    await this.prisma.$transaction(operations);

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
    const hasSpeaker = recording.utterances.some((utterance: any) => utterance.speakerLabel === normalizedSpeakerLabel);
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
      this.prisma.recording.update({
        where: { id: recordingId },
        data: {
          analysisStatus: 'NEEDS_REVIEW',
          analysisStatusReason: 'SPEAKER_CHANGED',
        } as any,
      } as any),
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
    const hasSpeaker = recording.utterances.some((utterance: any) => utterance.speakerLabel === normalizedSpeakerLabel);
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
    await this.prisma.recording.update({
      where: { id: recordingId },
      data: {
        analysisStatus: 'NEEDS_REVIEW',
        analysisStatusReason: 'SPEAKER_LABEL_CHANGED',
      } as any,
    } as any);

    return this.getOne(userId, recordingId);
  }

  async updateAnalysisStatus(
    userId: string,
    recordingId: string,
    status: 'OK' | 'NEEDS_REVIEW',
    reason?: string,
  ) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    return this.prisma.recording.update({
      where: { id: recordingId },
      data: {
        analysisStatus: status,
        analysisStatusReason: status === 'OK' ? null : reason?.trim() || null,
      } as any,
    } as any);
  }

  async updateParticipants(userId: string, recordingId: string, personProfileIds: string[]) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const profiles = await (this.prisma as any).personProfile.findMany({
      where: { userId, id: { in: personProfileIds } },
      select: { id: true },
    });
    if (profiles.length !== personProfileIds.length) {
      throw new NotFoundException('선택한 인물 프로필을 찾을 수 없습니다.');
    }

    await this.prisma.$transaction([
      (this.prisma as any).recordingParticipant.deleteMany({
        where: { recordingId },
      }),
      ...personProfileIds.map((personProfileId) =>
        (this.prisma as any).recordingParticipant.create({
          data: { recordingId, personProfileId },
        }),
      ),
      this.prisma.recording.update({
        where: { id: recordingId },
        data: {
          analysisStatus: 'NEEDS_REVIEW',
          analysisStatusReason: 'CONTEXT_UPDATED',
        } as any,
      } as any),
    ]);

    return this.getOne(userId, recordingId);
  }

  async updateSpeakerProfile(userId: string, recordingId: string, speakerLabel: string, personProfileId?: string) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
      include: { utterances: true },
    } as any) as any;
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const normalizedSpeakerLabel = speakerLabel.trim();
    const hasSpeaker = recording.utterances.some((utterance: any) => utterance.speakerLabel === normalizedSpeakerLabel);
    if (!hasSpeaker) throw new NotFoundException('선택한 화자를 찾을 수 없습니다.');

    if (personProfileId) {
      const profile = await (this.prisma as any).personProfile.findFirst({
        where: { id: personProfileId, userId },
      });
      if (!profile) throw new NotFoundException('선택한 인물 프로필을 찾을 수 없습니다.');

      await (this.prisma as any).recordingSpeakerProfile.upsert({
        where: {
          recordingId_speakerLabel: {
            recordingId,
            speakerLabel: normalizedSpeakerLabel,
          },
        },
        update: { personProfileId },
        create: { recordingId, speakerLabel: normalizedSpeakerLabel, personProfileId },
      });
    } else {
      await (this.prisma as any).recordingSpeakerProfile.deleteMany({
        where: { recordingId, speakerLabel: normalizedSpeakerLabel },
      });
    }

    await this.prisma.recording.update({
      where: { id: recordingId },
      data: {
        analysisStatus: 'NEEDS_REVIEW',
        analysisStatusReason: 'CONTEXT_UPDATED',
      } as any,
    } as any);

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

  async analyzeAndPersistRecording(
    recordingId: string,
    input: {
      relationship?: string;
      situation?: string;
      tone?: string;
      participantContext?: string;
      turns: Array<{
        utteranceId?: string;
        speakerLabel: string;
        koreanText: string;
        isMine?: boolean;
      }>;
    },
  ): Promise<RecordingAnalysisResult> {
    const analysis = await this.openai.analyzeConversation(input);
    const validUtteranceIds = new Set(
      input.turns
        .map((turn) => turn.utteranceId)
        .filter((utteranceId): utteranceId is string => Boolean(utteranceId)),
    );
    const intentUpdates = analysis.intents
      .map((item, index) => {
        const matchedUtteranceId = item.utteranceId && validUtteranceIds.has(item.utteranceId)
          ? item.utteranceId
          : input.turns.find(
              (turn) => turn.speakerLabel === item.speakerLabel && turn.koreanText === item.koreanText,
            )?.utteranceId ?? input.turns[index]?.utteranceId;
        const utteranceId = matchedUtteranceId && validUtteranceIds.has(matchedUtteranceId) ? matchedUtteranceId : null;
        if (!utteranceId) return null;
        return this.prisma.utterance.updateMany({
          where: { id: utteranceId, recordingId },
          data: { analysisIntent: item.intent } as any,
        } as any);
      })
      .filter(Boolean) as Array<ReturnType<typeof this.prisma.utterance.updateMany>>;

    await this.prisma.$transaction([
      this.prisma.recording.update({
        where: { id: recordingId },
        data: {
          analysisSummary: analysis.summary,
          analysisRelationship: input.relationship ?? null,
          analysisSituation: input.situation ?? null,
          analysisTone: input.tone ?? null,
          analysisStatus: 'OK',
          analysisStatusReason: null,
          analysisUpdatedAt: new Date(),
        } as any,
      } as any),
      this.prisma.utterance.updateMany({
        where: { recordingId },
        data: { analysisIntent: null } as any,
      } as any),
      ...intentUpdates,
    ]);

    return analysis;
  }

  private async invalidateRecordingAnalysis(recordingId: string) {
    await this.prisma.$transaction([
      this.prisma.recording.update({
        where: { id: recordingId },
        data: {
          analysisSummary: null,
          analysisRelationship: null,
          analysisSituation: null,
          analysisTone: null,
          analysisStatus: 'NOT_ANALYZED',
          analysisStatusReason: null,
          analysisUpdatedAt: null,
        } as any,
      } as any),
      this.prisma.utterance.updateMany({
        where: { recordingId },
        data: { analysisIntent: null } as any,
      } as any),
    ]);
  }
}
