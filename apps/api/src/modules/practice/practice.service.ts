import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  async score(userId: string, expressionId: string, answer: string) {
    const expression = await this.prisma.expression.findFirst({ where: { id: expressionId, userId } });
    if (!expression) throw new NotFoundException('표현을 찾을 수 없습니다.');

    const cleanTarget = expression.englishBase.trim().toLowerCase();
    const cleanAnswer = answer.trim().toLowerCase();
    const words = cleanTarget.split(/\s+/).filter(Boolean);
    const overlap = words.filter((word) => cleanAnswer.includes(word)).length;
    const score = cleanAnswer === cleanTarget ? 100 : Math.min(95, Math.max(20, overlap * 18));
    const feedback = score >= 90
      ? '아주 좋아요. 거의 완벽합니다.'
      : score >= 70
      ? '핵심 표현은 잘 들어갔어요. 조금 더 자연스럽게 다듬으면 됩니다.'
      : '핵심 표현을 다시 익혀보면 좋겠습니다.';

    const log = await this.prisma.practiceLog.create({
      data: {
        userId,
        expressionId,
        target: expression.englishBase,
        answer,
        score,
        feedback,
      },
    });

    return { id: log.id, score, feedback, target: expression.englishBase };
  }
}
