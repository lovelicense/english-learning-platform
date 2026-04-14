import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { LearningAssetsService } from '../learning-assets/learning-assets.service';
import { OpenAiService } from '../openai/openai.service';
import { StorageService } from '../storage/storage.service';

function buildParticipantContext(
  participants: Array<{
    personProfile: {
      name: string;
      roleLabel?: string | null;
      relationshipToMe?: string | null;
      aliases?: string | null;
      notes?: string | null;
      isMe?: boolean;
    };
  }> = [],
  speakerProfiles: Array<{
    speakerLabel: string;
    personProfile: {
      name: string;
      roleLabel?: string | null;
    };
  }> = [],
) {
  const profileLines = participants.map(({ personProfile }) => {
    const bits = [
      personProfile.name,
      personProfile.isMe ? '사용자 본인' : null,
      personProfile.roleLabel ? `역할: ${personProfile.roleLabel}` : null,
      personProfile.relationshipToMe ? `사용자와의 관계: ${personProfile.relationshipToMe}` : null,
      personProfile.aliases ? `별칭: ${personProfile.aliases}` : null,
      personProfile.notes ? `메모: ${personProfile.notes}` : null,
    ].filter(Boolean);
    return `- ${bits.join(' / ')}`;
  });
  const speakerLines = speakerProfiles.map(
    ({ speakerLabel, personProfile }) =>
      `- ${speakerLabel} = ${personProfile.name}${personProfile.roleLabel ? ` (${personProfile.roleLabel})` : ''}`,
  );

  return [
    profileLines.length ? `등장 인물 정보:\n${profileLines.join('\n')}` : null,
    speakerLines.length ? `화자 매핑:\n${speakerLines.join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const RESPONSE_START_LIMIT_MS = 3000;

function formatResponseStartLatency(latencyMs: number) {
  const seconds = latencyMs / 1000;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}초`;
}

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly storage: StorageService,
    private readonly learningAssetsService: LearningAssetsService,
  ) {}

  async createVoicePresignedUpload(fileName: string, contentType?: string) {
    return this.storage.createPracticePresignedUpload(fileName, contentType);
  }

  async generatePrompt(userId: string, expressionId: string, testType: 'translation' | 'situation' | 'pattern') {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    return this.openai.generatePracticePrompt({
      koreanText: expression.koreanText,
      englishBase: expression.englishBase,
      englishEasy: expression.englishEasy,
      englishNatural: expression.englishNatural,
      note: expression.note ?? undefined,
      testType,
    });
  }

  async score(
    userId: string,
    expressionId: string,
    answer: string,
    testType: 'translation' | 'situation' | 'pattern' = 'translation',
    promptKorean?: string,
    promptContext?: string,
    promptReadyAtMs?: number,
    responseStartedAtMs?: number,
  ) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
      include: {
        utterance: {
          include: {
            recording: {
              include: {
                participants: {
                  include: { personProfile: true },
                },
                speakerProfiles: {
                  include: { personProfile: true },
                },
              },
            },
          },
        },
        savedSentence: {
          include: {
            participants: {
              include: { personProfile: true },
            },
          },
        },
      },
    } as any) as any;
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const responseLatencyMs =
      typeof promptReadyAtMs === 'number' && typeof responseStartedAtMs === 'number'
        ? Math.max(0, responseStartedAtMs - promptReadyAtMs)
        : null;
    const isResponseTimedOut = responseLatencyMs !== null && responseLatencyMs > RESPONSE_START_LIMIT_MS;

    const evaluation = await this.openai.evaluatePracticeAnswer({
      koreanPrompt: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      participantContext: buildParticipantContext(
        (expression.utterance?.recording as any)?.participants ?? (expression.savedSentence as any)?.participants ?? [],
        (expression.utterance?.recording as any)?.speakerProfiles ?? [],
      ),
      sourceContextNote: expression.utterance?.contextNote ?? expression.savedSentence?.contextNote ?? undefined,
      conversationSummary: expression.utterance?.recording?.analysisSummary ?? expression.savedSentence?.analysisSummary ?? undefined,
      currentIntent: expression.utterance?.analysisIntent ?? expression.savedSentence?.analysisIntent ?? undefined,
      targetEnglish: expression.englishBase,
      userAnswer: answer.trim(),
      mode: 'text',
      testType,
      note: expression.note ?? undefined,
      easyAnswer: expression.englishEasy,
      naturalAnswer: expression.englishNatural,
    });
    const effectiveScore = isResponseTimedOut ? 0 : evaluation.score;
    const effectiveMeaningScore = isResponseTimedOut ? 0 : evaluation.meaningScore;
    const effectiveNaturalnessScore = isResponseTimedOut ? 0 : evaluation.naturalnessScore;
    const effectiveGrammarScore = isResponseTimedOut ? 0 : evaluation.grammarScore;
    const feedback = isResponseTimedOut
      ? `답변 시작이 ${formatResponseStartLatency(responseLatencyMs ?? RESPONSE_START_LIMIT_MS)}로 3초 제한을 초과해 오답 처리했습니다.`
      : evaluation.feedback;

    const log = await this.createPracticeLogWithFallback({
      userId,
      expressionId,
      target: expression.englishBase,
      answer,
      mode: 'text',
      testType,
      promptKorean: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      recognizedAnswer: answer.trim(),
      score: effectiveScore,
      meaningScore: effectiveMeaningScore,
      naturalnessScore: effectiveNaturalnessScore,
      grammarScore: effectiveGrammarScore,
      feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
    });

    await this.learningAssetsService.promoteProgressFromPractice(userId, expressionId, effectiveScore);

    return {
      id: log.id,
      score: effectiveScore,
      meaningScore: effectiveMeaningScore,
      naturalnessScore: effectiveNaturalnessScore,
      grammarScore: effectiveGrammarScore,
      feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
      target: expression.englishBase,
      answer,
      responseLatencyMs,
      responseTimedOut: isResponseTimedOut,
      responseLimitMs: RESPONSE_START_LIMIT_MS,
    };
  }

  async scoreVoice(
    userId: string,
    expressionId: string,
    audioKey: string,
    fileName: string,
    testType: 'translation' | 'situation' | 'pattern' = 'translation',
    promptKorean?: string,
    promptContext?: string,
    promptReadyAtMs?: number,
    responseStartedAtMs?: number,
  ) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
      include: {
        utterance: {
          include: {
            recording: {
              include: {
                participants: {
                  include: { personProfile: true },
                },
                speakerProfiles: {
                  include: { personProfile: true },
                },
              },
            },
          },
        },
        savedSentence: {
          include: {
            participants: {
              include: { personProfile: true },
            },
          },
        },
      },
    } as any) as any;
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const buffer = await this.storage.getObjectBuffer(audioKey);
    const transcription = await this.openai.transcribeEnglishAudio(buffer, fileName);
    const answer = transcription.text.trim();
    console.info(
      `[Practice STT] expression_id=${expressionId} user_id=${userId} file=${fileName} recognized_answer=${JSON.stringify(answer.slice(0, 200))}`,
    );
    if (!answer) {
      throw new NotFoundException('음성에서 영어 답변을 인식하지 못했습니다.');
    }

    const responseLatencyMs =
      typeof promptReadyAtMs === 'number' && typeof responseStartedAtMs === 'number'
        ? Math.max(0, responseStartedAtMs - promptReadyAtMs)
        : null;
    const isResponseTimedOut = responseLatencyMs !== null && responseLatencyMs > RESPONSE_START_LIMIT_MS;

    const evaluation = await this.openai.evaluatePracticeAnswer({
      koreanPrompt: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      participantContext: buildParticipantContext(
        (expression.utterance?.recording as any)?.participants ?? (expression.savedSentence as any)?.participants ?? [],
        (expression.utterance?.recording as any)?.speakerProfiles ?? [],
      ),
      sourceContextNote: expression.utterance?.contextNote ?? expression.savedSentence?.contextNote ?? undefined,
      conversationSummary: expression.utterance?.recording?.analysisSummary ?? expression.savedSentence?.analysisSummary ?? undefined,
      currentIntent: expression.utterance?.analysisIntent ?? expression.savedSentence?.analysisIntent ?? undefined,
      targetEnglish: expression.englishBase,
      userAnswer: answer,
      mode: 'voice',
      testType,
      note: expression.note ?? undefined,
      easyAnswer: expression.englishEasy,
      naturalAnswer: expression.englishNatural,
    });
    const effectiveScore = isResponseTimedOut ? 0 : evaluation.score;
    const effectiveMeaningScore = isResponseTimedOut ? 0 : evaluation.meaningScore;
    const effectiveNaturalnessScore = isResponseTimedOut ? 0 : evaluation.naturalnessScore;
    const effectiveGrammarScore = isResponseTimedOut ? 0 : evaluation.grammarScore;
    const feedback = isResponseTimedOut
      ? `답변 시작이 ${formatResponseStartLatency(responseLatencyMs ?? RESPONSE_START_LIMIT_MS)}로 3초 제한을 초과해 오답 처리했습니다.`
      : evaluation.feedback;

    const log = await this.createPracticeLogWithFallback({
      userId,
      expressionId,
      target: expression.englishBase,
      answer,
      audioKey,
      mode: 'voice',
      testType,
      promptKorean: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      recognizedAnswer: answer,
      score: effectiveScore,
      meaningScore: effectiveMeaningScore,
      naturalnessScore: effectiveNaturalnessScore,
      grammarScore: effectiveGrammarScore,
      feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
    });

    await this.learningAssetsService.promoteProgressFromPractice(userId, expressionId, effectiveScore);

    return {
      id: log.id,
      score: effectiveScore,
      meaningScore: effectiveMeaningScore,
      naturalnessScore: effectiveNaturalnessScore,
      grammarScore: effectiveGrammarScore,
      feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
      target: expression.englishBase,
      answer,
      audioUrl: await this.storage.createPresignedDownload(audioKey),
      responseLatencyMs,
      responseTimedOut: isResponseTimedOut,
      responseLimitMs: RESPONSE_START_LIMIT_MS,
    };
  }

  private async createPracticeLogWithFallback(data: {
    userId: string;
    expressionId: string;
    target: string;
    answer: string;
    audioKey?: string;
    mode: 'text' | 'voice';
    testType: 'translation' | 'situation' | 'pattern';
    promptKorean: string;
    promptContext?: string;
    recognizedAnswer: string;
    score: number;
    meaningScore: number;
    naturalnessScore: number;
    grammarScore: number;
    feedback: string;
    strengthComment: string;
    correctionComment: string;
    suggestedAnswer: string;
    suggestedAnswerAlt?: string;
  }) {
    try {
      return await this.prisma.practiceLog.create({ data: data as any });
    } catch (error) {
      if (this.isMissingPracticeLogColumnError(error)) {
        return this.prisma.practiceLog.create({
          data: {
            userId: data.userId,
            expressionId: data.expressionId,
            target: data.target,
            answer: data.answer,
            audioKey: data.audioKey,
            score: data.score,
            feedback: data.feedback,
          } as any,
        });
      }
      throw error;
    }
  }

  private isMissingPracticeLogColumnError(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    const message = error.message.toLowerCase();
    return message.includes('column') && (
      message.includes('mode') ||
      message.includes('testtype') ||
      message.includes('promptkorean') ||
      message.includes('recognizedanswer') ||
      message.includes('meaningscore')
    );
  }
}
