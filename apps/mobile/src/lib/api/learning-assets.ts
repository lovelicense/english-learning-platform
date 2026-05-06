import { apiFetch } from "./client";

export type LearningProgressStatus = "COLLECTED" | "RECOGNIZED" | "PRACTICING" | "USABLE_IN_SPEAKING" | "AUTOMATED";

export type LearningAssetExpressionRef = {
  id: string;
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  utteranceId?: string | null;
  savedSentenceId?: string | null;
  createdAt?: string | null;
};

export type LearningAssetProgressSummary = {
  overall: {
    patternTemplateCount: number;
    vocabularyItemCount: number;
    collectedPatternCount: number;
    automatedPatternCount: number;
    collectedVocabularyCount: number;
    usableVocabularyCount: number;
    patternCollectionRate: number;
    patternAutomationRate: number;
    vocabularyCollectionRate: number;
    vocabularyUsableRate: number;
    responseWithin1sRate: number;
    overallProgress: number;
  };
  levels: Array<{
    level: "A1" | "A2";
    patternTargetCount: number;
    patternCollectedCount: number;
    patternAutomatedCount: number;
    vocabularyTargetCount: number;
    vocabularyCollectedCount: number;
    vocabularyUsableCount: number;
    progress: number;
  }>;
  weakestCategories: Array<{
    kind: "pattern" | "vocabulary";
    level?: "A1" | "A2";
    code: string;
    nameKo: string;
    targetCount: number;
    collectedCount: number;
    automatedCount: number;
    gap: number;
  }>;
};

export type LearningAssetsCatalog = {
  patternCategories: Array<{
    id: string;
    level: "A1" | "A2";
    code: string;
    nameKo: string;
    nameEn: string;
    description?: string | null;
    targetCount: number;
    sortOrder: number;
    templates: Array<{
      id: string;
      templateText: string;
      meaningKo?: string | null;
      usageNote?: string | null;
      difficulty?: string | null;
      exampleEn?: string | null;
      exampleKo?: string | null;
      isCoreExpression: boolean;
      progress: {
        status: LearningProgressStatus;
        successCount: number;
        failCount: number;
        responseWithin1sCount: number;
        lastPracticedAt?: string | null;
      } | null;
      expressions: LearningAssetExpressionRef[];
      collected: boolean;
      automated: boolean;
    }>;
  }>;
  vocabularyCategories: Array<{
    id: string;
    code: string;
    nameKo: string;
    nameEn: string;
    description?: string | null;
    sortOrder: number;
    items: Array<{
      id: string;
      level: "A1" | "A2";
      lemma: string;
      partOfSpeech?: string | null;
      meaningKo?: string | null;
      exampleEn?: string | null;
      exampleKo?: string | null;
      frequencyRank?: number | null;
      isCore: boolean;
      progress: {
        status: LearningProgressStatus;
        successCount: number;
        failCount: number;
        responseWithin1sCount: number;
        lastPracticedAt?: string | null;
      } | null;
      expressions: LearningAssetExpressionRef[];
      collected: boolean;
      automated: boolean;
    }>;
  }>;
  unmatchedPatternExpressions: LearningAssetExpressionRef[];
  unmatchedVocabularyExpressions: LearningAssetExpressionRef[];
};

export async function getLearningAssetsProgress() {
  return apiFetch<LearningAssetProgressSummary>("/learning-assets/progress");
}

export async function getLearningAssetsCatalog() {
  return apiFetch<LearningAssetsCatalog>("/learning-assets/catalog");
}
