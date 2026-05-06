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

  async listLogs(userId: string, limit = 20) {
    const logs = await this.prisma.practiceLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
      include: {
        expression: {
          select: {
            koreanText: true,
            englishBase: true,
          },
        },
      },
    });

    return Promise.all(
      logs.map(async (log) => ({
        id: log.id,
        expressionId: log.expressionId,
        koreanText: log.expression.koreanText,
        englishBase: log.expression.englishBase,
        answer: log.answer,
        recognizedAnswer: log.recognizedAnswer,
        target: log.target,
        mode: log.mode,
        testType: log.testType,
        promptKorean: log.promptKorean,
        promptContext: log.promptContext,
        score: log.score,
        meaningScore: log.meaningScore,
        naturalnessScore: log.naturalnessScore,
        grammarScore: log.grammarScore,
        feedback: log.feedback,
        strengthComment: log.strengthComment,
        correctionComment: log.correctionComment,
        meaningComment: (log as any).meaningComment ?? null,
        suggestedAnswer: log.suggestedAnswer,
        suggestedAnswerAlt: log.suggestedAnswerAlt,
        createdAt: log.createdAt.toISOString(),
        audioUrl: log.audioKey ? await this.storage.createPresignedDownload(log.audioKey) : null,
      })),
    );
  }

  async generatePrompt(userId: string, expressionId: string, testType: 'translation' | 'situation' | 'pattern' | 'think') {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    if (testType === 'think') {
      const thinkInEnglish =
        expression.thinkInEnglish?.trim() ||
        (await this.openai.generateThinkInEnglish({
          koreanText: expression.koreanText,
          englishBase: expression.englishBase,
          englishNatural: expression.englishNatural ?? undefined,
          note: expression.note ?? undefined,
        }));

      if (!expression.thinkInEnglish?.trim()) {
        await this.prisma.expression.update({
          where: { id: expression.id },
          data: { thinkInEnglish },
        } as any);
      }

      return {
        testType: 'think' as const,
        promptKorean: thinkInEnglish,
        promptContext: '영어 설명을 읽고 떠오르는 핵심 영어 문장을 말해보세요.',
        tips: '설명 속 상황과 뉘앙스를 보고, 가장 어울리는 영어 문장을 복원해 보세요.',
        target: expression.englishBase,
        targetAlt: expression.englishNatural ?? expression.englishEasy ?? expression.englishBase,
      };
    }

    if (testType === 'situation') {
      const storedSituationPrompt = await this.prisma.$queryRaw<
        Array<{
          situationPromptKorean: string | null;
          situationPromptContext: string | null;
          situationPromptTips: string | null;
        }>
      >(
        Prisma.sql`
          SELECT
            "situationPromptKorean",
            "situationPromptContext",
            "situationPromptTips"
          FROM "Expression"
          WHERE "id" = ${expression.id}
          LIMIT 1
        `,
      );
      const cachedPrompt = storedSituationPrompt[0];
      if (cachedPrompt?.situationPromptKorean) {
        return {
          testType: 'situation' as const,
          promptKorean: cachedPrompt.situationPromptKorean,
          promptContext: cachedPrompt.situationPromptContext ?? undefined,
          tips: cachedPrompt.situationPromptTips ?? undefined,
          target: expression.englishBase,
        };
      }
    }

    const prompt = await this.openai.generatePracticePrompt({
      koreanText: expression.koreanText,
      englishBase: expression.englishBase,
      englishEasy: expression.englishEasy,
      englishNatural: expression.englishNatural,
      note: expression.note ?? undefined,
      testType,
    });

    if (testType === 'situation') {
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE "Expression"
          SET
            "situationPromptKorean" = ${prompt.promptKorean},
            "situationPromptContext" = ${prompt.promptContext ?? null},
            "situationPromptTips" = ${prompt.tips ?? null},
            "situationPromptGeneratedAt" = ${new Date()}
          WHERE "id" = ${expression.id}
        `,
      );
    }

    return prompt;
  }

  async score(
    userId: string,
    expressionId: string,
    answer: string,
    testType: 'translation' | 'situation' | 'pattern' | 'think' = 'translation',
    promptKorean?: string,
    promptContext?: string,
    promptTarget?: string,
    promptTargetAlt?: string,
    promptReferenceTarget?: string,
    promptPatternLabel?: string,
    promptPatternDescription?: string,
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

    const scoringTarget = promptTarget?.trim() || expression.englishBase;
    const scoringTargetAlt = promptTargetAlt?.trim() || undefined;
    const referenceTarget = promptReferenceTarget?.trim() || undefined;
    const patternNote =
      testType === 'pattern'
        ? [promptPatternLabel?.trim(), promptPatternDescription?.trim()].filter(Boolean).join('\n') || undefined
        : undefined;

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
      targetEnglish: scoringTarget,
      userAnswer: answer.trim(),
      mode: 'text',
      testType,
      note: testType === 'pattern' ? patternNote : expression.note ?? undefined,
      easyAnswer: testType === 'pattern' ? scoringTargetAlt : expression.englishEasy,
      naturalAnswer: testType === 'pattern' ? scoringTargetAlt ?? scoringTarget : expression.englishNatural,
      referenceEnglish: testType === 'pattern' ? referenceTarget : undefined,
    });
    const log = await this.createPracticeLogWithFallback({
      userId,
      expressionId,
      target: scoringTarget,
      answer,
      mode: 'text',
      testType,
      promptKorean: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      recognizedAnswer: answer.trim(),
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      meaningComment: evaluation.meaningComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
    });

    await this.learningAssetsService.promoteProgressFromPractice(userId, expressionId, evaluation.score);

    return {
      id: log.id,
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      meaningComment: evaluation.meaningComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
      target: scoringTarget,
      answer,
      responseLatencyMs: null,
      responseTimedOut: false,
      responseLimitMs: null,
    };
  }

  async scoreVoice(
    userId: string,
    expressionId: string,
    audioKey: string,
    fileName: string,
    testType: 'translation' | 'situation' | 'pattern' | 'think' = 'translation',
    promptKorean?: string,
    promptContext?: string,
    promptTarget?: string,
    promptTargetAlt?: string,
    promptReferenceTarget?: string,
    promptPatternLabel?: string,
    promptPatternDescription?: string,
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
    const scoringTarget = promptTarget?.trim() || expression.englishBase;
    const scoringTargetAlt = promptTargetAlt?.trim() || undefined;
    const referenceTarget = promptReferenceTarget?.trim() || undefined;
    const patternNote =
      testType === 'pattern'
        ? [promptPatternLabel?.trim(), promptPatternDescription?.trim()].filter(Boolean).join('\n') || undefined
        : undefined;

    if (!answer) {
      const feedback = '음성에서 영어 답변을 인식하지 못해 무응답으로 0점 처리했습니다.';

      const strengthComment = '이번 답변에서는 인식된 영어 발화가 없어 평가할 내용을 찾지 못했습니다.';
      const correctionComment = '정답 기준 문장을 한 번 들은 뒤, 더 또렷하게 짧게 말해보세요.';
      const meaningComment = '핵심 의미를 전달한 영어 답변이 인식되지 않았습니다.';
      const suggestedAnswerAlt =
        testType === 'pattern'
          ? scoringTargetAlt ?? scoringTarget
          : expression.englishNatural ?? expression.englishEasy ?? expression.englishBase;

      const log = await this.createPracticeLogWithFallback({
        userId,
        expressionId,
        target: scoringTarget,
        answer: '',
        audioKey,
        mode: 'voice',
        testType,
        promptKorean: promptKorean?.trim() || expression.koreanText,
        promptContext: promptContext?.trim() || undefined,
        recognizedAnswer: '',
        score: 0,
        meaningScore: 0,
        naturalnessScore: 0,
        grammarScore: 0,
        feedback,
        strengthComment,
        correctionComment,
        meaningComment,
        suggestedAnswer: scoringTarget,
        suggestedAnswerAlt,
      });

      await this.learningAssetsService.promoteProgressFromPractice(userId, expressionId, 0);

      return {
        id: log.id,
        score: 0,
        meaningScore: 0,
        naturalnessScore: 0,
        grammarScore: 0,
        feedback,
        strengthComment,
        correctionComment,
        meaningComment,
        suggestedAnswer: scoringTarget,
        suggestedAnswerAlt,
        target: scoringTarget,
        answer: '',
        audioUrl: await this.storage.createPresignedDownload(audioKey),
        responseLatencyMs: null,
        responseTimedOut: false,
        responseLimitMs: null,
      };
    }

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
      targetEnglish: scoringTarget,
      userAnswer: answer,
      mode: 'voice',
      testType,
      note: testType === 'pattern' ? patternNote : expression.note ?? undefined,
      easyAnswer: testType === 'pattern' ? scoringTargetAlt : expression.englishEasy,
      naturalAnswer: testType === 'pattern' ? scoringTargetAlt ?? scoringTarget : expression.englishNatural,
      referenceEnglish: testType === 'pattern' ? referenceTarget : undefined,
    });
    const log = await this.createPracticeLogWithFallback({
      userId,
      expressionId,
      target: scoringTarget,
      answer,
      audioKey,
      mode: 'voice',
      testType,
      promptKorean: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      recognizedAnswer: answer,
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      meaningComment: evaluation.meaningComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
    });

    await this.learningAssetsService.promoteProgressFromPractice(userId, expressionId, evaluation.score);

    return {
      id: log.id,
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      meaningComment: evaluation.meaningComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
      target: scoringTarget,
      answer,
      audioUrl: await this.storage.createPresignedDownload(audioKey),
      responseLatencyMs: null,
      responseTimedOut: false,
      responseLimitMs: null,
    };
  }

  private async createPracticeLogWithFallback(data: {
    userId: string;
    expressionId: string;
    target: string;
    answer: string;
    audioKey?: string;
    mode: 'text' | 'voice';
    testType: 'translation' | 'situation' | 'pattern' | 'think';
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
    meaningComment: string;
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
      message.includes('meaningscore') ||
      message.includes('meaningcomment')
    );
  }
}
