import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { OpenAiService } from '../openai/openai.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly storage: StorageService,
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
  ) {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const evaluation = await this.openai.evaluatePracticeAnswer({
      koreanPrompt: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      targetEnglish: expression.englishBase,
      userAnswer: answer.trim(),
      mode: 'text',
      testType,
      note: expression.note ?? undefined,
      easyAnswer: expression.englishEasy,
      naturalAnswer: expression.englishNatural,
    });

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
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
    });

    return {
      id: log.id,
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
      target: expression.englishBase,
      answer,
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
  ) {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const buffer = await this.storage.getObjectBuffer(audioKey);
    const transcription = await this.openai.transcribeEnglishAudio(buffer, fileName);
    const answer = transcription.text.trim();
    if (!answer) {
      throw new NotFoundException('음성에서 영어 답변을 인식하지 못했습니다.');
    }

    const evaluation = await this.openai.evaluatePracticeAnswer({
      koreanPrompt: promptKorean?.trim() || expression.koreanText,
      promptContext: promptContext?.trim() || undefined,
      targetEnglish: expression.englishBase,
      userAnswer: answer,
      mode: 'voice',
      testType,
      note: expression.note ?? undefined,
      easyAnswer: expression.englishEasy,
      naturalAnswer: expression.englishNatural,
    });

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
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
    });

    return {
      id: log.id,
      score: evaluation.score,
      meaningScore: evaluation.meaningScore,
      naturalnessScore: evaluation.naturalnessScore,
      grammarScore: evaluation.grammarScore,
      feedback: evaluation.feedback,
      strengthComment: evaluation.strengthComment,
      correctionComment: evaluation.correctionComment,
      suggestedAnswer: evaluation.suggestedAnswer,
      suggestedAnswerAlt: evaluation.suggestedAnswerAlt,
      target: expression.englishBase,
      answer,
      audioUrl: await this.storage.createPresignedDownload(audioKey),
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
