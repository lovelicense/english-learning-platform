import { Injectable, NotFoundException } from '@nestjs/common';
import { GenerateRecordingExpressionsDto } from './dto/generate-recording-expressions.dto';
import { OpenAiService } from '../openai/openai.service';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

type ExpressionContextTurn = {
  utteranceId?: string;
  speakerLabel: string;
  koreanText: string;
  isMine: boolean;
};

type ExpressionGenerationContext = {
  relationship?: string;
  situation?: string;
  tone?: string;
};

type RecordingUtteranceContext = {
  id: string;
  speakerLabel: string;
  koreanText: string;
  isMine: boolean;
};

@Injectable()
export class ExpressionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly storage: StorageService,
  ) {}

  async generate(userId: string, input: { utteranceId?: string; koreanText?: string; relationship?: string; situation?: string; tone?: string }) {
    let utteranceId = input.utteranceId;
    let koreanText = input.koreanText?.trim();
    const generationContext = this.toGenerationContext(input);
    let expressionInput:
      | string
      | {
          koreanText: string;
          speakerLabel?: string;
          isMine?: boolean;
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
            },
          },
        },
      });
      if (!utterance) throw new NotFoundException('발화 문장을 찾을 수 없습니다.');
      koreanText = utterance.koreanText;

      const orderedUtterances = utterance.recording.utterances.map((item) => ({
        id: item.id,
        speakerLabel: item.speakerLabel,
        koreanText: item.koreanText,
        isMine: item.isMine,
      }));
      const analysis = await this.openai.analyzeConversation({
        ...generationContext,
        turns: orderedUtterances.map((item) => this.toContextTurn(item)),
      });
      expressionInput = this.buildExpressionInputForUtterance(utterance, orderedUtterances, generationContext, analysis);
    }

    if (!koreanText) throw new NotFoundException('한국어 문장이 필요합니다.');
    if (!expressionInput) {
      expressionInput = {
        koreanText,
        ...generationContext,
      };
    }

    const generated = await this.openai.generateExpressions(expressionInput);
    const expression = await this.prisma.expression.create({
      data: {
        userId,
        utteranceId,
        koreanText,
        englishBase: generated.base,
        englishEasy: generated.easy,
        englishNatural: generated.natural,
        note: generated.note,
      },
    });

    return expression;
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
      },
    });
    if (!recording) throw new NotFoundException('녹음 파일을 찾을 수 없습니다.');

    const speakerScope = input.speakerScope ?? 'mine';
    const includeExisting = input.includeExisting ?? false;
    const orderedUtterances: RecordingUtteranceContext[] = recording.utterances.map((utterance) => ({
      id: utterance.id,
      speakerLabel: utterance.speakerLabel,
      koreanText: utterance.koreanText,
      isMine: utterance.isMine,
    }));
    const targetUtterances = recording.utterances.filter((utterance) => {
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

    const analysis = await this.openai.analyzeConversation({
      ...generationContext,
      turns: orderedUtterances.map((utterance) => this.toContextTurn(utterance)),
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
          note: generated.note,
        },
      });
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

  private toGenerationContext(input: { relationship?: string; situation?: string; tone?: string }): ExpressionGenerationContext {
    const relationship = input.relationship?.trim();
    const situation = input.situation?.trim();
    const tone = input.tone?.trim();

    return {
      ...(relationship ? { relationship } : {}),
      ...(situation ? { situation } : {}),
      ...(tone ? { tone } : {}),
    };
  }

  private buildExpressionInputForUtterance(
    utterance: RecordingUtteranceContext,
    orderedUtterances: RecordingUtteranceContext[],
    generationContext: ExpressionGenerationContext,
    analysis: {
      summary: string;
      intents: Array<{
        utteranceId?: string;
        speakerLabel?: string;
        koreanText: string;
        intent: string;
      }>;
    },
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
      ...generationContext,
      conversationSummary: analysis.summary,
      currentIntent,
      previousTurns,
      nextTurns,
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

  async generateTts(userId: string, expressionId: string) {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const audio = await this.openai.generateTts(expression.englishBase);
    const key = `tts/${expression.id}.mp3`;
    await this.storage.uploadBuffer(key, audio, 'audio/mpeg');
    const updated = await this.prisma.expression.update({ where: { id: expression.id }, data: { ttsKey: key } });
    const ttsUrl = await this.storage.createPresignedDownload(key, 3600, 'audio/mpeg');
    return { expressionId, ttsKey: key, ttsUrl, expression: updated.englishBase };
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
    const targets = expressions.filter((expression) => (onlyMissing ? !expression.ttsKey : true));
    const generated: Array<{
      expressionId: string;
      ttsKey: string;
      ttsUrl: string;
      expression: string;
    }> = [];

    for (const expression of targets) {
      const audio = await this.openai.generateTts(expression.englishBase);
      const key = `tts/${expression.id}.mp3`;
      await this.storage.uploadBuffer(key, audio, 'audio/mpeg');
      const updated = await this.prisma.expression.update({ where: { id: expression.id }, data: { ttsKey: key } });
      generated.push({
        expressionId: updated.id,
        ttsKey: key,
        ttsUrl: await this.storage.createPresignedDownload(key, 3600, 'audio/mpeg'),
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

  async list(userId: string) {
    const expressions = await this.prisma.expression.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });

    return Promise.all(
      expressions.map(async (expression) => ({
        ...expression,
        ttsUrl: expression.ttsKey ? await this.storage.createPresignedDownload(expression.ttsKey, 3600, 'audio/mpeg') : null,
      })),
    );
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
