import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { StorageService } from '../storage/storage.service';

type ReviewStrategy = 'system' | 'low_score' | 'stale' | 'voice_gap' | 'random';

function normalizeReviewStrategy(value?: string): ReviewStrategy {
  if (value === 'low_score' || value === 'stale' || value === 'voice_gap' || value === 'random') {
    return value;
  }
  return 'system';
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getToday(userId: string, strategyInput?: string) {
    const strategy = normalizeReviewStrategy(strategyInput);
    const expressions = await this.prisma.expression.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const expressionIds = expressions.map((expression) => expression.id);
    const practiceLogs = expressionIds.length
      ? await this.prisma.practiceLog.findMany({
          where: {
            userId,
            expressionId: { in: expressionIds },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            expressionId: true,
            score: true,
            answer: true,
            audioKey: true,
            createdAt: true,
          },
        })
      : [];

    const latestLogByExpressionId = new Map<string, (typeof practiceLogs)[number]>();
    const logsByExpressionId = new Map<string, typeof practiceLogs>();
    for (const log of practiceLogs) {
      if (!latestLogByExpressionId.has(log.expressionId)) {
        latestLogByExpressionId.set(log.expressionId, log);
      }
      const current = logsByExpressionId.get(log.expressionId) ?? [];
      current.push(log);
      logsByExpressionId.set(log.expressionId, current);
    }

    const ranked = expressions.map((e) => {
        const latestLog = latestLogByExpressionId.get(e.id) ?? null;
        const recentLogs = (logsByExpressionId.get(e.id) ?? []).slice(0, 3);
        const mastery = latestLog?.score ?? 0;
        const averageRecentScore =
          recentLogs.length > 0
            ? Math.round(recentLogs.reduce((sum, log) => sum + log.score, 0) / recentLogs.length)
            : 0;
        const hasVoiceHistory = recentLogs.some((log) => Boolean(log.audioKey));
        const hasRepeatedLowScores = recentLogs.filter((log) => log.score < 70).length >= 2;

        let recommendedTestType: 'translation' | 'situation' | 'think' = 'translation';
        let reviewReason = '핵심 표현을 먼저 정확히 익히는 번역형 연습이 좋습니다.';

        if (recentLogs.length === 0) {
          recommendedTestType = 'translation';
          reviewReason = '아직 테스트 기록이 없어서 먼저 번역형으로 의미와 표현을 익히는 것이 좋습니다.';
        } else if (hasRepeatedLowScores) {
          recommendedTestType = 'translation';
          reviewReason = '최근 여러 번 핵심 표현이 흔들려서, 먼저 번역형으로 정확도를 다지는 것이 좋습니다.';
        } else if (e.thinkInEnglish && averageRecentScore >= 80) {
          recommendedTestType = 'think';
          reviewReason = '표현의 사용 맥락을 영어 설명만 보고도 떠올릴 수 있게, think in english 복습을 해보는 것이 좋습니다.';
        } else if (averageRecentScore >= 85 && hasVoiceHistory) {
          recommendedTestType = 'situation';
          reviewReason = '최근 점수가 안정적이고 말하기 기록도 있어서, 상황형으로 응용 말하기를 해보는 것이 좋습니다.';
        } else if (averageRecentScore >= 75) {
          recommendedTestType = 'situation';
          reviewReason = '기본 표현은 어느 정도 익숙해 보여서, 상황형으로 문맥 응용 연습을 해보는 것이 좋습니다.';
        } else if (!hasVoiceHistory && averageRecentScore >= 65) {
          recommendedTestType = 'translation';
          reviewReason = '기본 의미는 잡히고 있지만 아직 말하기 기록이 적어서, 먼저 번역형으로 안정화한 뒤 음성 연습으로 넘어가면 좋습니다.';
        }

        const voiceAttempts = recentLogs.filter((log) => Boolean(log.audioKey)).length;

        return {
          id: e.id,
          korean: e.koreanText,
          english: e.englishBase,
          mastery,
          ttsKey: e.ttsKey,
          recommendedTestType,
          reviewReason,
          lastReviewedAt: latestLog?.createdAt?.toISOString?.() ?? null,
          practiceAnswer: latestLog?.answer ?? null,
          latestAudioKey: latestLog?.audioKey ?? null,
          createdAt: e.createdAt,
          voiceAttempts,
          reviewCount: recentLogs.length,
        };
      });

    let selected = ranked;
    if (strategy === 'system') {
      selected = ranked.slice(0, 10);
    } else if (strategy === 'low_score') {
      selected = [...ranked]
        .sort((a, b) => {
          if (a.mastery !== b.mastery) return a.mastery - b.mastery;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, 10);
    } else if (strategy === 'stale') {
      selected = [...ranked]
        .sort((a, b) => {
          const aTime = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
          const bTime = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
          if (aTime !== bTime) return aTime - bTime;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, 10);
    } else if (strategy === 'voice_gap') {
      selected = [...ranked]
        .sort((a, b) => {
          if (a.voiceAttempts !== b.voiceAttempts) return a.voiceAttempts - b.voiceAttempts;
          if (a.mastery !== b.mastery) return a.mastery - b.mastery;
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, 10);
    } else if (strategy === 'random') {
      selected = shuffleArray(ranked).slice(0, 10);
    }

    return Promise.all(
      selected.map(async (item) => ({
        id: item.id,
        korean: item.korean,
        english: item.english,
        mastery: item.mastery,
        ttsKey: item.ttsKey,
        recommendedTestType: item.recommendedTestType,
        reviewReason: item.reviewReason,
        lastReviewedAt: item.lastReviewedAt,
        practiceAnswer: item.practiceAnswer,
        practiceAudioUrl: item.latestAudioKey
          ? await this.storage.createPresignedDownload(item.latestAudioKey)
          : null,
      })),
    );
  }
}
