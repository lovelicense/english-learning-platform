import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getToday(userId: string) {
    const expressions = await this.prisma.expression.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { practiceLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    return expressions.map((e) => ({
      id: e.id,
      korean: e.koreanText,
      english: e.englishBase,
      mastery: e.practiceLogs[0]?.score ?? 0,
      ttsKey: e.ttsKey,
    }));
  }
}
