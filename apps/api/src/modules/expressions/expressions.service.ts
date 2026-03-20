import { Injectable, NotFoundException } from '@nestjs/common';
import { OpenAiService } from '../openai/openai.service';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ExpressionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly storage: StorageService,
  ) {}

  async generate(userId: string, input: { utteranceId?: string; koreanText?: string }) {
    let utteranceId = input.utteranceId;
    let koreanText = input.koreanText?.trim();

    if (utteranceId) {
      const utterance = await this.prisma.utterance.findFirst({
        where: { id: utteranceId, recording: { userId } },
      });
      if (!utterance) throw new NotFoundException('발화 문장을 찾을 수 없습니다.');
      koreanText = utterance.koreanText;
    }

    if (!koreanText) throw new NotFoundException('한국어 문장이 필요합니다.');

    const generated = await this.openai.generateExpressions(koreanText);
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

  async generateTts(userId: string, expressionId: string) {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const audio = await this.openai.generateTts(expression.englishBase);
    const key = `tts/${expression.id}.mp3`;
    await this.storage.uploadBuffer(key, audio, 'audio/mpeg');
    const updated = await this.prisma.expression.update({ where: { id: expression.id }, data: { ttsKey: key } });
    return { expressionId, ttsKey: key, ttsUrl: this.storage.getPublicUrl(key), expression: updated.englishBase };
  }

  async list(userId: string) {
    return this.prisma.expression.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}
