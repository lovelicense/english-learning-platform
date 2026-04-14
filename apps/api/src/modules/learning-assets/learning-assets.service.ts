import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

type AssetProgressLevel = 'A1' | 'A2';
type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type LearningProgressStatus = 'COLLECTED' | 'RECOGNIZED' | 'PRACTICING' | 'USABLE_IN_SPEAKING' | 'AUTOMATED';

function levelToString(level: CefrLevel): AssetProgressLevel {
  return level === 'A1' ? 'A1' : 'A2';
}

function statusRank(status: LearningProgressStatus) {
  switch (status) {
    case 'COLLECTED':
      return 1;
    case 'RECOGNIZED':
      return 2;
    case 'PRACTICING':
      return 3;
    case 'USABLE_IN_SPEAKING':
      return 4;
    case 'AUTOMATED':
      return 5;
    default:
      return 0;
  }
}

function normalizeEnglishText(text: string) {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9~'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function templateMatchesEnglish(templateText: string, englishText: string) {
  const normalizedTemplate = normalizeEnglishText(templateText);
  const normalizedEnglish = normalizeEnglishText(englishText);
  if (!normalizedTemplate) return false;
  if (!normalizedTemplate.includes('~')) {
    return normalizedEnglish.includes(normalizedTemplate);
  }

  const parts = normalizedTemplate
    .split('~')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  let cursor = 0;
  for (const part of parts) {
    const index = normalizedEnglish.indexOf(part, cursor);
    if (index < 0) return false;
    cursor = index + part.length;
  }
  return true;
}

function normalizeLemmaForMatch(lemma: string) {
  return normalizeEnglishText(lemma).replace(/['-]/g, ' ');
}

function wordBoundaryPattern(lemma: string) {
  const escaped = lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

@Injectable()
export class LearningAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(userId: string) {
    const [patternCategories, vocabularyCategories, expressions] = await Promise.all([
      this.prisma.patternCategory.findMany({
        where: { active: true },
        include: {
          templates: {
            where: { active: true },
            include: {
              expressionMatches: {
                include: {
                  expression: {
                    select: {
                      id: true,
                      koreanText: true,
                      englishBase: true,
                      englishEasy: true,
                      englishNatural: true,
                      utteranceId: true,
                      savedSentenceId: true,
                      createdAt: true,
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.vocabularyCategory.findMany({
        where: { active: true },
        include: {
          items: {
            where: { active: true },
            include: {
              expressionMatches: {
                include: {
                  expression: {
                    select: {
                      id: true,
                      koreanText: true,
                      englishBase: true,
                      englishEasy: true,
                      englishNatural: true,
                      utteranceId: true,
                      savedSentenceId: true,
                      createdAt: true,
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: [{ frequencyRank: 'asc' }, { lemma: 'asc' }],
          },
        },
        orderBy: [{ sortOrder: 'asc' }],
      }),
      this.prisma.expression.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          koreanText: true,
          englishBase: true,
          englishEasy: true,
          englishNatural: true,
          utteranceId: true,
          savedSentenceId: true,
          createdAt: true,
          patternMatches: {
            select: { id: true },
          },
          vocabularyMatches: {
            select: { id: true },
          },
        },
      }),
    ]);

    const patternProgresses = await this.prisma.userPatternProgress.findMany({
      where: { userId },
      select: {
        patternTemplateId: true,
        status: true,
        successCount: true,
        failCount: true,
        responseWithin1sCount: true,
        lastPracticedAt: true,
      },
    });
    const vocabularyProgresses = await this.prisma.userVocabularyProgress.findMany({
      where: { userId },
      select: {
        vocabularyItemId: true,
        status: true,
        successCount: true,
        failCount: true,
        responseWithin1sCount: true,
        lastPracticedAt: true,
      },
    });

    const patternProgressByTemplateId = new Map(
      patternProgresses.map((progress) => [progress.patternTemplateId, progress]),
    );
    const vocabularyProgressByItemId = new Map(
      vocabularyProgresses.map((progress) => [progress.vocabularyItemId, progress]),
    );
    const unmatchedPatternExpressions = expressions
      .filter((expression) => expression.patternMatches.length === 0)
      .map((expression) => ({
        id: expression.id,
        koreanText: expression.koreanText,
        englishBase: expression.englishBase,
        englishEasy: expression.englishEasy,
        englishNatural: expression.englishNatural,
        utteranceId: expression.utteranceId,
        savedSentenceId: expression.savedSentenceId,
        createdAt: expression.createdAt,
      }));
    const unmatchedVocabularyExpressions = expressions
      .filter((expression) => expression.vocabularyMatches.length === 0)
      .map((expression) => ({
        id: expression.id,
        koreanText: expression.koreanText,
        englishBase: expression.englishBase,
        englishEasy: expression.englishEasy,
        englishNatural: expression.englishNatural,
        utteranceId: expression.utteranceId,
        savedSentenceId: expression.savedSentenceId,
        createdAt: expression.createdAt,
      }));

    return {
      patternCategories: patternCategories.map((category) => ({
        id: category.id,
        level: levelToString(category.level),
        code: category.code,
        nameKo: category.nameKo,
        nameEn: category.nameEn,
        description: category.description,
        targetCount: category.targetCount,
        sortOrder: category.sortOrder,
        templates: category.templates.map((template) => {
          const progress = patternProgressByTemplateId.get(template.id) ?? null;
          const expressions = template.expressionMatches.map((match) => ({
            id: match.expression.id,
            koreanText: match.expression.koreanText,
            englishBase: match.expression.englishBase,
            englishEasy: match.expression.englishEasy,
            englishNatural: match.expression.englishNatural,
            utteranceId: match.expression.utteranceId,
            savedSentenceId: match.expression.savedSentenceId,
            createdAt: match.expression.createdAt,
          }));
          return {
            id: template.id,
            templateText: template.templateText,
            meaningKo: template.meaningKo,
            usageNote: template.usageNote,
            difficulty: template.difficulty,
            exampleEn: template.exampleEn,
            exampleKo: template.exampleKo,
            progress: progress
              ? {
                  status: progress.status,
                  successCount: progress.successCount,
                  failCount: progress.failCount,
                  responseWithin1sCount: progress.responseWithin1sCount,
                  lastPracticedAt: progress.lastPracticedAt,
                }
              : null,
            expressions,
            collected: expressions.length > 0,
            automated: progress?.status === 'AUTOMATED',
          };
        }),
      })),
      vocabularyCategories: vocabularyCategories.map((category) => ({
        id: category.id,
        code: category.code,
        nameKo: category.nameKo,
        nameEn: category.nameEn,
        description: category.description,
        sortOrder: category.sortOrder,
        items: category.items.map((item) => {
          const progress = vocabularyProgressByItemId.get(item.id) ?? null;
          const expressions = item.expressionMatches.map((match) => ({
            id: match.expression.id,
            koreanText: match.expression.koreanText,
            englishBase: match.expression.englishBase,
            englishEasy: match.expression.englishEasy,
            englishNatural: match.expression.englishNatural,
            utteranceId: match.expression.utteranceId,
            savedSentenceId: match.expression.savedSentenceId,
            createdAt: match.expression.createdAt,
          }));
          return {
            id: item.id,
            level: levelToString(item.level),
            lemma: item.lemma,
            partOfSpeech: item.partOfSpeech,
            meaningKo: item.meaningKo,
            exampleEn: item.exampleEn,
            exampleKo: item.exampleKo,
            frequencyRank: item.frequencyRank,
            isCore: item.isCore,
            progress: progress
              ? {
                  status: progress.status,
                  successCount: progress.successCount,
                  failCount: progress.failCount,
                  responseWithin1sCount: progress.responseWithin1sCount,
                  lastPracticedAt: progress.lastPracticedAt,
                }
              : null,
            expressions,
            collected: expressions.length > 0,
            automated: progress?.status === 'AUTOMATED',
          };
        }),
      })),
      unmatchedPatternExpressions,
      unmatchedVocabularyExpressions,
    };
  }

  async getProgress(userId: string) {
    const [patternCategories, patternProgresses, vocabularyCategories, vocabularyProgresses, expressions] = await Promise.all([
      this.prisma.patternCategory.findMany({
        where: { active: true },
        include: {
          templates: {
            where: { active: true },
            select: { id: true },
          },
        },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.userPatternProgress.findMany({
        where: { userId },
        select: { patternTemplateId: true, status: true, successCount: true, responseWithin1sCount: true },
      }),
      this.prisma.vocabularyCategory.findMany({
        where: { active: true },
        include: {
          items: {
            where: { active: true },
            select: { id: true, level: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }],
      }),
      this.prisma.userVocabularyProgress.findMany({
        where: { userId },
        select: { vocabularyItemId: true, status: true, successCount: true, responseWithin1sCount: true },
      }),
      this.prisma.expression.findMany({
        where: { userId },
        select: {
          id: true,
          patternMatches: {
            select: {
              patternTemplateId: true,
            },
          },
          vocabularyMatches: {
            select: {
              vocabularyItemId: true,
            },
          },
        },
      }),
    ]);

    const patternProgressByTemplateId = new Map(
      patternProgresses.map((progress) => [progress.patternTemplateId, progress]),
    );
    const vocabularyProgressByItemId = new Map(
      vocabularyProgresses.map((progress) => [progress.vocabularyItemId, progress]),
    );
    const activePatternTemplateIds = new Set(
      expressions.flatMap((expression) => expression.patternMatches.map((match) => match.patternTemplateId)),
    );
    const activeVocabularyItemIds = new Set(
      expressions.flatMap((expression) => expression.vocabularyMatches.map((match) => match.vocabularyItemId)),
    );

    const patternCategoriesSummary = patternCategories.map((category) => {
      const total = category.templates.length;
      const collected = category.templates.filter((template) => activePatternTemplateIds.has(template.id)).length;
      const automated = category.templates.filter(
        (template) => patternProgressByTemplateId.get(template.id)?.status === 'AUTOMATED',
      ).length;
      const practicing = category.templates.filter((template) =>
        ['PRACTICING', 'USABLE_IN_SPEAKING', 'AUTOMATED'].includes(
          patternProgressByTemplateId.get(template.id)?.status ?? '',
        ),
      ).length;
      return {
        level: levelToString(category.level),
        code: category.code,
        nameKo: category.nameKo,
        targetCount: category.targetCount,
        total,
        collectedCount: collected,
        practicingCount: practicing,
        automatedCount: automated,
        gap: Math.max(0, total - collected),
      };
    });

    const vocabularyCategoriesSummary = vocabularyCategories.map((category) => {
      const total = category.items.length;
      const collected = category.items.filter((item) => activeVocabularyItemIds.has(item.id)).length;
      const usable = category.items.filter((item) =>
        ['USABLE_IN_SPEAKING', 'AUTOMATED'].includes(vocabularyProgressByItemId.get(item.id)?.status ?? ''),
      ).length;
      const automated = category.items.filter((item) => vocabularyProgressByItemId.get(item.id)?.status === 'AUTOMATED').length;
      return {
        code: category.code,
        nameKo: category.nameKo,
        total,
        collectedCount: collected,
        usableCount: usable,
        automatedCount: automated,
        gap: Math.max(0, total - collected),
      };
    });

    const patternTemplateCount = await this.prisma.patternTemplate.count({ where: { active: true } });
    const vocabularyItemCount = await this.prisma.vocabularyItem.count({ where: { active: true } });

    const collectedPatternCount = activePatternTemplateIds.size;
    const automatedPatternCount = patternProgresses.filter((item) => item.status === 'AUTOMATED').length;
    const collectedVocabularyCount = activeVocabularyItemIds.size;
    const usableVocabularyCount = vocabularyProgresses.filter((item) =>
      ['USABLE_IN_SPEAKING', 'AUTOMATED'].includes(item.status),
    ).length;

    const totalSuccessCount = [...patternProgresses, ...vocabularyProgresses].reduce(
      (sum, progress) => sum + progress.successCount,
      0,
    );
    const totalTimedSuccessCount = [...patternProgresses, ...vocabularyProgresses].reduce(
      (sum, progress) => sum + progress.responseWithin1sCount,
      0,
    );
    const responseWithin1sRate =
      totalSuccessCount > 0 ? Math.round((totalTimedSuccessCount / totalSuccessCount) * 100) : 0;

    const patternCollectionRate = patternTemplateCount > 0 ? Math.round((collectedPatternCount / patternTemplateCount) * 100) : 0;
    const patternAutomationRate = patternTemplateCount > 0 ? Math.round((automatedPatternCount / patternTemplateCount) * 100) : 0;
    const vocabularyCollectionRate = vocabularyItemCount > 0 ? Math.round((collectedVocabularyCount / vocabularyItemCount) * 100) : 0;
    const vocabularyUsableRate = vocabularyItemCount > 0 ? Math.round((usableVocabularyCount / vocabularyItemCount) * 100) : 0;

    const overallProgress = Math.round(
      patternAutomationRate * 0.45 +
        vocabularyUsableRate * 0.25 +
        patternCollectionRate * 0.2 +
        vocabularyCollectionRate * 0.1,
    );

    const levelTargets: Array<{
      level: AssetProgressLevel;
      patternTargetCount: number;
      patternCollectedCount: number;
      patternAutomatedCount: number;
      vocabularyTargetCount: number;
      vocabularyCollectedCount: number;
      vocabularyUsableCount: number;
      progress: number;
    }> = (['A1', 'A2'] as const).map((level) => {
      const levelPatternIds = new Set(
        patternCategories
          .filter((category) => levelToString(category.level) === level)
          .flatMap((category) => category.templates.map((template) => template.id)),
      );
      const levelVocabularyIds = new Set(
        vocabularyCategories
          .flatMap((category) => category.items)
          .filter((item) => levelToString(item.level) === level)
          .map((item) => item.id),
      );

      const levelPatternProgress = patternProgresses.filter((progress) => levelPatternIds.has(progress.patternTemplateId));
      const levelVocabularyProgress = vocabularyProgresses.filter((progress) => levelVocabularyIds.has(progress.vocabularyItemId));
      const patternTargetCount = levelPatternIds.size;
      const patternCollectedCount = [...levelPatternIds].filter((templateId) => activePatternTemplateIds.has(templateId)).length;
      const patternAutomatedCount = levelPatternProgress.filter((item) => item.status === 'AUTOMATED').length;
      const vocabularyTargetCount = levelVocabularyIds.size;
      const vocabularyCollectedCount = [...levelVocabularyIds].filter((itemId) => activeVocabularyItemIds.has(itemId)).length;
      const vocabularyUsableCount = levelVocabularyProgress.filter((item) => ['USABLE_IN_SPEAKING', 'AUTOMATED'].includes(item.status)).length;

      const progress = Math.round(
        (patternTargetCount > 0 ? (patternAutomatedCount / patternTargetCount) * 55 : 0) +
          (vocabularyTargetCount > 0 ? (vocabularyUsableCount / vocabularyTargetCount) * 25 : 0) +
          (patternTargetCount > 0 ? (patternCollectedCount / patternTargetCount) * 10 : 0) +
          (vocabularyTargetCount > 0 ? (vocabularyCollectedCount / vocabularyTargetCount) * 10 : 0),
      );

      return {
        level,
        patternTargetCount,
        patternCollectedCount,
        patternAutomatedCount,
        vocabularyTargetCount,
        vocabularyCollectedCount,
        vocabularyUsableCount,
        progress: Math.min(100, progress),
      };
    });

    const weakestPatternCategories = patternCategoriesSummary
      .slice()
      .sort((left, right) => right.gap - left.gap)
      .slice(0, 3)
      .map((item) => ({
        kind: 'pattern' as const,
        level: item.level,
        code: item.code,
        nameKo: item.nameKo,
        targetCount: item.targetCount,
        collectedCount: item.collectedCount,
        automatedCount: item.automatedCount,
        gap: item.gap,
      }));
    const weakestVocabularyCategories = vocabularyCategoriesSummary
      .slice()
      .sort((left, right) => right.gap - left.gap)
      .slice(0, 3)
      .map((item) => ({
        kind: 'vocabulary' as const,
        code: item.code,
        nameKo: item.nameKo,
        targetCount: item.total,
        collectedCount: item.collectedCount,
        automatedCount: item.automatedCount,
        gap: item.gap,
      }));

    return {
      overall: {
        patternTemplateCount,
        vocabularyItemCount,
        collectedPatternCount,
        automatedPatternCount,
        collectedVocabularyCount,
        usableVocabularyCount,
        patternCollectionRate,
        patternAutomationRate,
        vocabularyCollectionRate,
        vocabularyUsableRate,
        responseWithin1sRate,
        overallProgress,
      },
      levels: levelTargets,
      weakestCategories: [...weakestPatternCategories, ...weakestVocabularyCategories].slice(0, 6),
    };
  }

  async syncExpressionAssets(userId: string, expressionId: string) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
      include: {
        patternMatches: true,
        vocabularyMatches: true,
      },
    } as any) as any;
    if (!expression) return;

    const activePatternTemplates = await this.prisma.patternTemplate.findMany({
      where: { active: true },
      select: { id: true, templateText: true },
    });
    const activeVocabularyItems = await this.prisma.vocabularyItem.findMany({
      where: { active: true },
      select: { id: true, lemma: true, partOfSpeech: true, level: true },
    });

    const englishBase = expression.englishBase ?? '';
    const matchedPatternTemplateIds = activePatternTemplates
      .filter((template) => templateMatchesEnglish(template.templateText, englishBase))
      .map((template) => template.id);

    const normalizedEnglish = normalizeEnglishText(englishBase);
    const matchedVocabularyItemIds = activeVocabularyItems
      .filter((item) => {
        const normalizedLemma = normalizeLemmaForMatch(item.lemma);
        if (!normalizedLemma) return false;
        return wordBoundaryPattern(normalizedLemma).test(normalizedEnglish);
      })
      .map((item) => item.id);

    for (const patternTemplateId of matchedPatternTemplateIds) {
      await this.prisma.expressionPatternMatch.upsert({
        where: {
          expressionId_patternTemplateId: {
            expressionId,
            patternTemplateId,
          },
        },
        create: {
          expressionId,
          patternTemplateId,
          matchedBy: 'RULE',
          confidence: 0.9,
          isPrimary: false,
        },
        update: {
          matchedBy: 'RULE',
          confidence: 0.9,
        },
      });

      const current = await this.prisma.userPatternProgress.findUnique({
        where: {
          userId_patternTemplateId: {
            userId,
            patternTemplateId,
          },
        },
      });
      await this.prisma.userPatternProgress.upsert({
        where: {
          userId_patternTemplateId: {
            userId,
            patternTemplateId,
          },
        },
        create: {
          userId,
          patternTemplateId,
          status: current?.status ?? 'COLLECTED',
          successCount: current?.successCount ?? 0,
          failCount: current?.failCount ?? 0,
          responseWithin1sCount: current?.responseWithin1sCount ?? 0,
          lastPracticedAt: current?.lastPracticedAt ?? null,
        },
        update: {
          status: current?.status ?? 'COLLECTED',
        },
      });
    }

    for (const vocabularyItemId of matchedVocabularyItemIds) {
      await this.prisma.expressionVocabularyMatch.upsert({
        where: {
          expressionId_vocabularyItemId: {
            expressionId,
            vocabularyItemId,
          },
        },
        create: {
          expressionId,
          vocabularyItemId,
          matchedBy: 'RULE',
          confidence: 0.9,
        },
        update: {
          matchedBy: 'RULE',
          confidence: 0.9,
        },
      });

      const current = await this.prisma.userVocabularyProgress.findUnique({
        where: {
          userId_vocabularyItemId: {
            userId,
            vocabularyItemId,
          },
        },
      });
      await this.prisma.userVocabularyProgress.upsert({
        where: {
          userId_vocabularyItemId: {
            userId,
            vocabularyItemId,
          },
        },
        create: {
          userId,
          vocabularyItemId,
          status: current?.status ?? 'COLLECTED',
          successCount: current?.successCount ?? 0,
          failCount: current?.failCount ?? 0,
          responseWithin1sCount: current?.responseWithin1sCount ?? 0,
          lastPracticedAt: current?.lastPracticedAt ?? null,
        },
        update: {
          status: current?.status ?? 'COLLECTED',
        },
      });
    }

    return {
      matchedPatternTemplateIds,
      matchedVocabularyItemIds,
    };
  }

  async promoteProgressFromPractice(userId: string, expressionId: string, score: number) {
    const expression = await this.prisma.expression.findFirst({
      where: { id: expressionId, userId },
      include: {
        patternMatches: true,
        vocabularyMatches: true,
      },
    } as any) as any;
    if (!expression) return;

    const nextStatus: LearningProgressStatus =
      score >= 90 ? 'AUTOMATED' : score >= 75 ? 'USABLE_IN_SPEAKING' : score >= 60 ? 'PRACTICING' : 'RECOGNIZED';
    const successBoost = score >= 60 ? 1 : 0;
    const responseBoost = score >= 80 ? 1 : 0;

    for (const patternMatch of expression.patternMatches ?? []) {
      const current = await this.prisma.userPatternProgress.findUnique({
        where: {
          userId_patternTemplateId: {
            userId,
            patternTemplateId: patternMatch.patternTemplateId,
          },
        },
      });
      const currentStatus = current?.status ?? 'COLLECTED';
      await this.prisma.userPatternProgress.upsert({
        where: {
          userId_patternTemplateId: {
            userId,
            patternTemplateId: patternMatch.patternTemplateId,
          },
        },
        create: {
          userId,
          patternTemplateId: patternMatch.patternTemplateId,
          status: currentStatus === 'COLLECTED' ? nextStatus : nextStatus,
          successCount: successBoost,
          failCount: successBoost ? 0 : 1,
          responseWithin1sCount: responseBoost,
          lastPracticedAt: new Date(),
        },
        update: {
          status: current?.status && statusRank(current.status) > statusRank(nextStatus) ? current.status : nextStatus,
          successCount: { increment: successBoost },
          failCount: { increment: successBoost ? 0 : 1 },
          responseWithin1sCount: { increment: responseBoost },
          lastPracticedAt: new Date(),
        },
      });
    }

    for (const vocabularyMatch of expression.vocabularyMatches ?? []) {
      const current = await this.prisma.userVocabularyProgress.findUnique({
        where: {
          userId_vocabularyItemId: {
            userId,
            vocabularyItemId: vocabularyMatch.vocabularyItemId,
          },
        },
      });
      await this.prisma.userVocabularyProgress.upsert({
        where: {
          userId_vocabularyItemId: {
            userId,
            vocabularyItemId: vocabularyMatch.vocabularyItemId,
          },
        },
        create: {
          userId,
          vocabularyItemId: vocabularyMatch.vocabularyItemId,
          status: nextStatus,
          successCount: successBoost,
          failCount: successBoost ? 0 : 1,
          responseWithin1sCount: responseBoost,
          lastPracticedAt: new Date(),
        },
        update: {
          status: current?.status && statusRank(current.status) > statusRank(nextStatus) ? current.status : nextStatus,
          successCount: { increment: successBoost },
          failCount: { increment: successBoost ? 0 : 1 },
          responseWithin1sCount: { increment: responseBoost },
          lastPracticedAt: new Date(),
        },
      });
    }
  }
}
