import { Injectable, NotFoundException } from '@nestjs/common';
import { GenerateRecordingExpressionsDto } from './dto/generate-recording-expressions.dto';
import { OpenAiService } from '../openai/openai.service';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LearningAssetsService } from '../learning-assets/learning-assets.service';

type ExpressionContextTurn = {
  utteranceId?: string;
  speakerLabel: string;
  koreanText: string;
  isMine: boolean;
};

type ExpressionGenerationContext = {
  sourceContextNote?: string;
  participantContext?: string;
  relationship?: string;
  situation?: string;
  tone?: string;
};

type SingleSentenceAnalysis = {
  summary: string;
  intent: string;
};

type RecordingUtteranceContext = {
  id: string;
  speakerLabel: string;
  koreanText: string;
  contextNote?: string | null;
  isMine: boolean;
  analysisIntent?: string | null;
};

type CachedRecordingAnalysis = {
  summary: string;
  intents: Array<{
    utteranceId?: string;
    speakerLabel?: string;
    koreanText: string;
    intent: string;
  }>;
};

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
export class ExpressionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly storage: StorageService,
    private readonly learningAssetsService: LearningAssetsService,
  ) {}

  private async generateExpressionTtsAssets(expression: {
    id: string;
    englishBase: string;
    koreanText: string;
  }) {
    const [englishAudio, koreanAudio] = await Promise.all([
      this.openai.generateTts(expression.englishBase),
      this.openai.generateTts(expression.koreanText),
    ]);

    const englishKey = `tts/${expression.id}.mp3`;
    const koreanKey = `tts/${expression.id}.ko.mp3`;

    await Promise.all([
      this.storage.uploadBuffer(englishKey, englishAudio, 'audio/mpeg'),
      this.storage.uploadBuffer(koreanKey, koreanAudio, 'audio/mpeg'),
    ]);

    return {
      ttsKey: englishKey,
      koreanTtsKey: koreanKey,
    };
  }

  async generate(userId: string, input: { utteranceId?: string; savedSentenceId?: string; koreanText?: string; sourceContextNote?: string; participantContext?: string; relationship?: string; situation?: string; tone?: string; personProfileIds?: string[] }) {
    let utteranceId = input.utteranceId;
    let savedSentenceId = input.savedSentenceId;
    let koreanText = input.koreanText?.trim();
    const requestedPersonProfileIds = Array.from(new Set((input.personProfileIds ?? []).filter(Boolean)));
    const generationContext = this.toGenerationContext(input);
    let expressionInput:
      | string
      | {
          koreanText: string;
          speakerLabel?: string;
          isMine?: boolean;
          sourceContextNote?: string;
          relationship?: string;
          situation?: string;
          tone?: string;
          conversationSummary?: string;
          currentIntent?: string;
          previousTurns?: ExpressionContextTurn[];
          nextTurns?: ExpressionContextTurn[];
        }
      | undefined;

    if (utteranceId) {
      const utterance = await this.prisma.utterance.findFirst({
        where: { id: utteranceId, recording: { userId } },
        include: {
          recording: {
            include: {
              utterances: {
                orderBy: { startMs: 'asc' },
              },
              participants: {
                include: { personProfile: true },
              } as any,
              speakerProfiles: {
                include: { personProfile: true },
              } as any,
            },
          },
        },
      } as any) as any;
      if (!utterance) throw new NotFoundException('발화 문장을 찾을 수 없습니다.');
      koreanText = utterance.koreanText;

      const orderedUtterances = utterance.recording.utterances.map((item: any) => ({
        id: item.id,
        speakerLabel: item.speakerLabel,
        koreanText: item.koreanText,
        isMine: item.isMine,
        contextNote: (item as any).contextNote,
        analysisIntent: (item as any).analysisIntent,
      }));
      const analysis = await this.getOrCreateRecordingAnalysis(utterance.recording.id, orderedUtterances, generationContext);
      expressionInput = this.buildExpressionInputForUtterance(
        utterance,
        orderedUtterances,
        {
          ...generationContext,
          participantContext: buildParticipantContext(
            (utterance.recording as any).participants ?? [],
            (utterance.recording as any).speakerProfiles ?? [],
          ),
        },
        analysis,
      );
    } else if (savedSentenceId) {
      const savedSentence = await (this.prisma as any).savedSentence.findFirst({
        where: { id: savedSentenceId, userId },
        include: {
          participants: {
            include: { personProfile: true },
          },
        },
      } as any);
      if (!savedSentence) throw new NotFoundException('저장한 문장을 찾을 수 없습니다.');

      koreanText = savedSentence.koreanText;
      const analysis = await this.getOrCreateSavedSentenceAnalysis(savedSentence.id, {
        koreanText: savedSentence.koreanText,
        relationship: generationContext.relationship ?? savedSentence.relationship ?? undefined,
        situation: generationContext.situation ?? savedSentence.situation ?? undefined,
        tone: generationContext.tone ?? savedSentence.tone ?? undefined,
      });
      expressionInput = this.buildExpressionInputForSavedSentence(
        savedSentence.koreanText,
        {
          sourceContextNote: generationContext.sourceContextNote ?? savedSentence.contextNote ?? undefined,
          participantContext:
            generationContext.participantContext ??
            buildParticipantContext((savedSentence as any).participants ?? []),
          relationship: generationContext.relationship ?? savedSentence.relationship ?? undefined,
          situation: generationContext.situation ?? savedSentence.situation ?? undefined,
          tone: generationContext.tone ?? savedSentence.tone ?? undefined,
        },
        analysis,
      );
    }

    if (!koreanText) throw new NotFoundException('한국어 문장이 필요합니다.');
    if (!expressionInput) {
      const profiles = requestedPersonProfileIds.length
        ? await (this.prisma as any).personProfile.findMany({
            where: { userId, id: { in: requestedPersonProfileIds } },
          })
        : [];
      if (profiles.length !== requestedPersonProfileIds.length) {
        throw new NotFoundException('선택한 인물 정보를 찾을 수 없습니다.');
      }
      const savedSentence = await (this.prisma as any).savedSentence.create({
        data: {
          userId,
          koreanText,
          contextNote: generationContext.sourceContextNote ?? null,
          relationship: generationContext.relationship ?? null,
          situation: generationContext.situation ?? null,
          tone: generationContext.tone ?? null,
          participants: requestedPersonProfileIds.length
            ? {
                create: requestedPersonProfileIds.map((personProfileId) => ({
                  personProfileId,
                })),
              }
            : undefined,
        },
        include: {
          participants: {
            include: { personProfile: true },
          },
        },
      } as any);
      savedSentenceId = savedSentence.id;
      const analysis = await this.getOrCreateSavedSentenceAnalysis(savedSentence.id, {
        koreanText,
        participantContext:
          generationContext.participantContext ??
          buildParticipantContext((savedSentence as any).participants ?? []),
        ...generationContext,
      });
      expressionInput = this.buildExpressionInputForSavedSentence(
        koreanText,
        {
          ...generationContext,
          participantContext:
            generationContext.participantContext ??
            buildParticipantContext((savedSentence as any).participants ?? []),
        },
        analysis,
      );
    }

    const generated = await this.openai.generateExpressions(expressionInput);
    const expression = await this.prisma.expression.create({
      data: {
        userId,
        utteranceId,
        savedSentenceId,
        koreanText,
        englishBase: generated.base,
        englishEasy: generated.easy,
        englishNatural: generated.natural,
        thinkInEnglish: generated.thinkInEnglish,
        note: generated.note,
      },
    } as any);

    await this.learningAssetsService.syncExpressionAssets(userId, expression.id);

    return expression;
  }

  async savePracticeExpression(
    userId: string,
    input: {
      koreanText: string;
      englishBase: string;
      englishEasy?: string;
      englishNatural?: string;
      thinkInEnglish?: string;
      note?: string;
      promptContext?: string;
    },
  ) {
    const koreanText = input.koreanText.trim();
    const englishBase = input.englishBase.trim();
    const englishEasy = input.englishEasy?.trim() || englishBase;
    const englishNatural = input.englishNatural?.trim() || englishBase;
    const note = input.note?.trim() || null;
    const promptContext = input.promptContext?.trim() || null;

    if (!koreanText || !englishBase) {
      throw new NotFoundException('저장할 한국어 문장과 영어 표현이 필요합니다.');
    }

    const thinkInEnglish =
      input.thinkInEnglish?.trim() ||
      (await this.openai.generateThinkInEnglish({
        koreanText,
        englishBase,
        englishNatural,
        note: note ?? undefined,
      }));

    const savedSentence = await (this.prisma as any).savedSentence.create({
      data: {
        userId,
        koreanText,
        contextNote: promptContext,
      },
    } as any);

    const expression = await this.prisma.expression.create({
      data: {
        userId,
        savedSentenceId: savedSentence.id,
        koreanText,
        englishBase,
        englishEasy,
        englishNatural,
        thinkInEnglish,
        note,
      },
    } as any);

    const assets = await this.generateExpressionTtsAssets(expression);
    const updated = await this.prisma.expression.update({
      where: { id: expression.id },
      data: {
        ttsKey: assets.ttsKey,
        koreanTtsKey: assets.koreanTtsKey,
      },
    } as any);

    await this.learningAssetsService.syncExpressionAssets(userId, expression.id);

    return {
      ...updated,
      ttsUrl: await this.storage.createPresignedDownload(assets.ttsKey, 3600, 'audio/mpeg'),
      koreanTtsUrl: await this.storage.createPresignedDownload(assets.koreanTtsKey, 3600, 'audio/mpeg'),
    };
  }

  async generateForRecording(userId: string, input: GenerateRecordingExpressionsDto) {
    const generationContext = this.toGenerationContext(input);
    const recording = await this.prisma.recording.findFirst({
      where: { id: input.recordingId, userId },
        include: {
          utterances: {
            orderBy: { startMs: 'asc' },
            include: {
              expressions: {
                select: { id: true },
              },
            },
          },
          participants: {
            include: { personProfile: true },
          } as any,
          speakerProfiles: {
            include: { personProfile: true },
          } as any,
        },
    } as any) as any;
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const speakerScope = input.speakerScope ?? 'mine';
    const includeExisting = input.includeExisting ?? false;
    const orderedUtterances: RecordingUtteranceContext[] = recording.utterances.map((utterance: any) => ({
      id: utterance.id,
      speakerLabel: utterance.speakerLabel,
      koreanText: utterance.koreanText,
      isMine: utterance.isMine,
      analysisIntent: (utterance as any).analysisIntent,
    }));
    const targetUtterances = recording.utterances.filter((utterance: any) => {
      if (!utterance.koreanText.trim()) return false;
      if (speakerScope === 'mine' && !utterance.isMine) return false;
      if (speakerScope === 'others' && utterance.isMine) return false;
      if (!includeExisting && utterance.expressions.length > 0) return false;
      return true;
    });

    if (targetUtterances.length === 0) {
      return {
        recordingId: recording.id,
        createdCount: 0,
        skippedCount: recording.utterances.length,
        totalRequested: 0,
        expressions: [],
      };
    }

    const analysis = await this.getOrCreateRecordingAnalysis(recording.id, orderedUtterances, {
      ...generationContext,
      participantContext: buildParticipantContext((recording as any).participants ?? [], (recording as any).speakerProfiles ?? []),
    });

    const expressions: Array<{
      id: string;
      userId: string;
      utteranceId: string | null;
      koreanText: string;
      englishBase: string;
      englishEasy: string;
      englishNatural: string;
      note: string | null;
      ttsKey: string | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    for (const utterance of targetUtterances) {
      const generated = await this.openai.generateExpressions(
        this.buildExpressionInputForUtterance(utterance, orderedUtterances, generationContext, analysis),
      );
      const expression = await this.prisma.expression.create({
        data: {
          userId,
          utteranceId: utterance.id,
          koreanText: utterance.koreanText.trim(),
          englishBase: generated.base,
          englishEasy: generated.easy,
          englishNatural: generated.natural,
          thinkInEnglish: generated.thinkInEnglish,
          note: generated.note,
        },
      });
      await this.learningAssetsService.syncExpressionAssets(userId, expression.id);
      expressions.push(expression);
    }

    return {
      recordingId: recording.id,
      createdCount: expressions.length,
      skippedCount: recording.utterances.length - expressions.length,
      totalRequested: targetUtterances.length,
      expressions,
    };
  }

  private toGenerationContext(input: { sourceContextNote?: string; participantContext?: string; relationship?: string; situation?: string; tone?: string }): ExpressionGenerationContext {
    const sourceContextNote = input.sourceContextNote?.trim();
    const relationship = input.relationship?.trim();
    const situation = input.situation?.trim();
    const tone = input.tone?.trim();

    return {
      ...(sourceContextNote ? { sourceContextNote } : {}),
      ...(input.participantContext?.trim() ? { participantContext: input.participantContext.trim() } : {}),
      ...(relationship ? { relationship } : {}),
      ...(situation ? { situation } : {}),
      ...(tone ? { tone } : {}),
    };
  }

  private buildExpressionInputForUtterance(
    utterance: RecordingUtteranceContext,
    orderedUtterances: RecordingUtteranceContext[],
    generationContext: ExpressionGenerationContext,
    analysis: CachedRecordingAnalysis,
  ) {
    const currentIndex = orderedUtterances.findIndex((item) => item.id === utterance.id);
    const currentIntent =
      analysis.intents.find((item) => item.utteranceId === utterance.id)?.intent ??
      analysis.intents.find(
        (item) => item.speakerLabel === utterance.speakerLabel && item.koreanText === utterance.koreanText,
      )?.intent;
    const previousTurns = orderedUtterances
      .slice(Math.max(0, currentIndex - 2), currentIndex)
      .map((item) => this.toContextTurn(item));
    const nextTurns = orderedUtterances
      .slice(currentIndex + 1, currentIndex + 3)
      .map((item) => this.toContextTurn(item));

    return {
      koreanText: utterance.koreanText,
      speakerLabel: utterance.speakerLabel,
      isMine: utterance.isMine,
      sourceContextNote: utterance.contextNote ?? undefined,
      ...generationContext,
      conversationSummary: analysis.summary,
      currentIntent,
      previousTurns,
      nextTurns,
    };
  }

  private buildExpressionInputForSavedSentence(
    koreanText: string,
    generationContext: ExpressionGenerationContext & { sourceContextNote?: string },
    analysis: SingleSentenceAnalysis,
  ) {
    return {
      koreanText,
      speakerLabel: '나',
      isMine: true,
      sourceContextNote: generationContext.sourceContextNote,
      ...generationContext,
      conversationSummary: analysis.summary,
      currentIntent: analysis.intent,
      previousTurns: [],
      nextTurns: [],
    };
  }

  private toContextTurn(turn: {
    id: string;
    speakerLabel: string;
    koreanText: string;
    isMine: boolean;
  }): ExpressionContextTurn {
    return {
      utteranceId: turn.id,
      speakerLabel: turn.speakerLabel,
      koreanText: turn.koreanText,
      isMine: turn.isMine,
    };
  }

  private async getOrCreateRecordingAnalysis(
    recordingId: string,
    orderedUtterances: RecordingUtteranceContext[],
    generationContext: ExpressionGenerationContext,
  ): Promise<CachedRecordingAnalysis> {
    const recording = await this.prisma.recording.findUnique({
      where: { id: recordingId },
    }) as any;

    const relationship = generationContext.relationship ?? null;
    const situation = generationContext.situation ?? null;
    const tone = generationContext.tone ?? null;

    const canReuse =
      Boolean(recording?.analysisSummary) &&
      recording?.analysisRelationship === relationship &&
      recording?.analysisSituation === situation &&
      recording?.analysisTone === tone &&
      orderedUtterances.every((utterance) => Boolean(utterance.analysisIntent));

    if (canReuse) {
      return {
        summary: recording?.analysisSummary ?? '',
        intents: orderedUtterances.map((utterance) => ({
          utteranceId: utterance.id,
          speakerLabel: utterance.speakerLabel,
          koreanText: utterance.koreanText,
          intent: utterance.analysisIntent ?? '',
        })),
      };
    }

    const analysis = await this.openai.analyzeConversation({
      ...generationContext,
      turns: orderedUtterances.map((utterance) => this.toContextTurn(utterance)),
    });

    const validUtteranceIds = new Set(orderedUtterances.map((utterance) => utterance.id));
    const intentUpdates = analysis.intents
      .map((item, index) => {
        const matchedUtteranceId = item.utteranceId && validUtteranceIds.has(item.utteranceId)
          ? item.utteranceId
          : orderedUtterances.find(
              (utterance) => utterance.speakerLabel === item.speakerLabel && utterance.koreanText === item.koreanText,
            )?.id ?? orderedUtterances[index]?.id;
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
          analysisRelationship: relationship,
          analysisSituation: situation,
          analysisTone: tone,
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

  private async getOrCreateSavedSentenceAnalysis(
    savedSentenceId: string,
    input: {
      koreanText: string;
      participantContext?: string;
      relationship?: string;
      situation?: string;
      tone?: string;
    },
  ): Promise<SingleSentenceAnalysis> {
    const savedSentence = await (this.prisma as any).savedSentence.findUnique({
      where: { id: savedSentenceId },
    } as any);

    const relationship = input.relationship ?? null;
    const situation = input.situation ?? null;
    const tone = input.tone ?? null;

    const canReuse =
      Boolean(savedSentence?.analysisIntent) &&
      savedSentence?.relationship === relationship &&
      savedSentence?.situation === situation &&
      savedSentence?.tone === tone;

    if (canReuse) {
      return {
        summary:
          savedSentence?.analysisSummary ??
          '직접 저장한 단일 문장의 상황과 의도를 짧게 정리한 내용입니다.',
        intent: savedSentence?.analysisIntent ?? '',
      };
    }

    const analysis = await this.openai.analyzeConversation({
      participantContext: input.participantContext,
      relationship: input.relationship,
      situation: input.situation,
      tone: input.tone,
      turns: [
        {
          utteranceId: savedSentenceId,
          speakerLabel: '나',
          koreanText: input.koreanText,
          isMine: true,
        },
      ],
    });
    const intent = analysis.intents[0]?.intent ?? '자신의 상황이나 요청을 전달함';

    await (this.prisma as any).savedSentence.update({
      where: { id: savedSentenceId },
      data: {
        relationship,
        situation,
        tone,
        analysisSummary: analysis.summary,
        analysisIntent: intent,
        analysisUpdatedAt: new Date(),
      },
    } as any);

    return {
      summary: analysis.summary,
      intent,
    };
  }

  async generateTts(userId: string, expressionId: string) {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const assets = await this.generateExpressionTtsAssets(expression);
    const updated = await this.prisma.expression.update({
      where: { id: expression.id },
      data: {
        ttsKey: assets.ttsKey,
        koreanTtsKey: assets.koreanTtsKey,
      },
    } as any);
    const ttsUrl = await this.storage.createPresignedDownload(assets.ttsKey, 3600, 'audio/mpeg');
    const koreanTtsUrl = await this.storage.createPresignedDownload(assets.koreanTtsKey, 3600, 'audio/mpeg');
    return {
      expressionId,
      ttsKey: assets.ttsKey,
      ttsUrl,
      koreanTtsKey: assets.koreanTtsKey,
      koreanTtsUrl,
      expression: updated.englishBase,
    };
  }

  async generateTtsForRecording(userId: string, recordingId: string, onlyMissing = true) {
    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, userId },
      include: {
        utterances: {
          select: {
            expressions: {
              where: { userId },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const expressions = recording.utterances.flatMap((utterance) => utterance.expressions);
    const targets = expressions.filter((expression) => (onlyMissing ? !expression.ttsKey || !(expression as any).koreanTtsKey : true));
    const generated: Array<{
      expressionId: string;
      ttsKey: string;
      ttsUrl: string;
      koreanTtsKey: string;
      koreanTtsUrl: string;
      expression: string;
    }> = [];

    for (const expression of targets) {
      const assets = await this.generateExpressionTtsAssets(expression);
      const updated = await this.prisma.expression.update({
        where: { id: expression.id },
        data: {
          ttsKey: assets.ttsKey,
          koreanTtsKey: assets.koreanTtsKey,
        },
      } as any);
      generated.push({
        expressionId: updated.id,
        ttsKey: assets.ttsKey,
        ttsUrl: await this.storage.createPresignedDownload(assets.ttsKey, 3600, 'audio/mpeg'),
        koreanTtsKey: assets.koreanTtsKey,
        koreanTtsUrl: await this.storage.createPresignedDownload(assets.koreanTtsKey, 3600, 'audio/mpeg'),
        expression: updated.englishBase,
      });
    }

    return {
      recordingId,
      updatedCount: generated.length,
      skippedCount: expressions.length - generated.length,
      totalRequested: targets.length,
      expressions: generated,
    };
  }

  async backfillThinkInEnglish(userId: string, onlyMissing = true) {
    const expressions = await this.prisma.expression.findMany({
      where: {
        userId,
        ...(onlyMissing ? { OR: [{ thinkInEnglish: null }, { thinkInEnglish: '' }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    } as any);

    const updatedIds: string[] = [];

    for (const expression of expressions) {
      const thinkInEnglish = await this.openai.generateThinkInEnglish({
        koreanText: expression.koreanText,
        englishBase: expression.englishBase,
        englishNatural: expression.englishNatural ?? undefined,
        note: expression.note ?? undefined,
      });

      await this.prisma.expression.update({
        where: { id: expression.id },
        data: { thinkInEnglish },
      } as any);

      updatedIds.push(expression.id);
    }

    return {
      updatedCount: updatedIds.length,
      skippedCount: 0,
      totalRequested: expressions.length,
      expressionIds: updatedIds,
    };
  }

  async refreshStudyAids(userId: string, expressionId: string) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
    });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const thinkInEnglish = await this.openai.generateThinkInEnglish({
      koreanText: expression.koreanText,
      englishBase: expression.englishBase,
      englishNatural: expression.englishNatural ?? undefined,
      note: expression.note ?? undefined,
    });
    const note = await this.openai.generateExpressionUsageNote({
      koreanText: expression.koreanText,
      englishBase: expression.englishBase,
      englishNatural: expression.englishNatural ?? undefined,
      thinkInEnglish,
    });

    await this.prisma.expression.update({
      where: { id: expression.id },
      data: {
        thinkInEnglish,
        note,
        userMemo: null,
      },
    } as any);

    return this.list(userId).then((items) => items.find((item) => item.id === expression.id));
  }

  async list(userId: string) {
    const expressions = await this.prisma.expression.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        practiceLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            score: true,
          },
        },
        _count: {
          select: {
            practiceLogs: true,
          },
        },
        utterance: {
          include: {
            recording: true,
          },
        },
        savedSentence: true,
      },
    } as any);

    return Promise.all(
      (expressions as any[]).map(async (expression) => ({
        ...expression,
        practiceCount: expression._count?.practiceLogs ?? 0,
        latestPracticeScore: expression.practiceLogs?.[0]?.score ?? null,
        sourceAnalysisIntent: expression.utterance?.analysisIntent ?? expression.savedSentence?.analysisIntent ?? null,
        sourceAnalysisSummary:
          expression.utterance?.recording?.analysisSummary ?? expression.savedSentence?.analysisSummary ?? null,
        sourceRelationship:
          expression.utterance?.recording?.analysisRelationship ?? expression.savedSentence?.relationship ?? null,
        sourceSituation:
          expression.utterance?.recording?.analysisSituation ?? expression.savedSentence?.situation ?? null,
        sourceTone:
          expression.utterance?.recording?.analysisTone ?? expression.savedSentence?.tone ?? null,
        sourceContextNote:
          expression.utterance?.contextNote ?? expression.savedSentence?.contextNote ?? null,
        ttsUrl: expression.ttsKey ? await this.storage.createPresignedDownload(expression.ttsKey, 3600, 'audio/mpeg') : null,
        koreanTtsUrl: expression.koreanTtsKey
          ? await this.storage.createPresignedDownload(expression.koreanTtsKey, 3600, 'audio/mpeg')
          : null,
      })),
    );
  }

  async updateMemo(userId: string, expressionId: string, userMemo?: string) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
    });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const normalizedMemo = userMemo?.trim() ?? '';
    return this.prisma.expression.update({
      where: { id: expressionId },
      data: {
        userMemo: normalizedMemo ? normalizedMemo : null,
      } as any,
    } as any);
  }

  async remove(userId: string, expressionId: string) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
    });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    await this.prisma.$transaction([
      this.prisma.practiceLog.deleteMany({ where: { expressionId } }),
      this.prisma.expression.delete({ where: { id: expressionId } }),
    ]);

    return { success: true, expressionId };
  }
}
