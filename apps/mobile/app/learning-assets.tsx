import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { exportAssets, type ExportAssetType, type ExportFormat } from "../src/lib/api/exports";
import {
  getLearningAssetsCatalog,
  getLearningAssetsProgress,
  type LearningAssetsCatalog,
  type LearningAssetProgressSummary,
  type LearningAssetExpressionRef,
  type LearningProgressStatus,
} from "../src/lib/api/learning-assets";
import { mobileTheme } from "../src/theme/colors";

type AssetTab = "pattern" | "vocabulary";
type AssetFilter = "priority" | "all" | "missing" | "collected" | "automated";
type PatternAssetItem = LearningAssetsCatalog["patternCategories"][number]["templates"][number] & {
  categoryCode: string;
  categoryNameKo: string;
  level: "A1" | "A2";
};
type VocabularyAssetItem = LearningAssetsCatalog["vocabularyCategories"][number]["items"][number] & {
  categoryCode: string;
  categoryNameKo: string;
};

const EXPORT_DIRECTORY_NAME = "exports";
const theme = mobileTheme.colors;

export default function LearningAssetsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<LearningAssetProgressSummary | null>(null);
  const [catalog, setCatalog] = useState<LearningAssetsCatalog | null>(null);
  const [assetTab, setAssetTab] = useState<AssetTab>("pattern");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("priority");
  const [query, setQuery] = useState("");
  const [coreOnly, setCoreOnly] = useState(false);
  const [exportLoadingKey, setExportLoadingKey] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportMessage, setExportMessage] = useState("");

  const loadAll = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const [progressResult, catalogResult] = await Promise.all([
        getLearningAssetsProgress(),
        getLearningAssetsCatalog(),
      ]);
      setProgress(progressResult);
      setCatalog(catalogResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "학습 자산을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll]),
  );

  const patternTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items =
      catalog?.patternCategories.flatMap((category) =>
        category.templates.map((template) => ({
          ...template,
          categoryCode: category.code,
          categoryNameKo: category.nameKo,
          level: category.level,
        })),
      ) ?? [];

    return items.filter((item) => {
      if (coreOnly && !item.isCoreExpression) return false;
      if (assetFilter === "priority" && item.collected && item.automated) return false;
      if (assetFilter === "missing" && item.collected) return false;
      if (assetFilter === "collected" && !item.collected) return false;
      if (assetFilter === "automated" && !item.automated) return false;
      if (!normalized) return true;
      return [
        item.templateText,
        item.meaningKo ?? "",
        item.usageNote ?? "",
        item.categoryNameKo,
        item.exampleEn ?? "",
        item.exampleKo ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [assetFilter, catalog?.patternCategories, coreOnly, query]);

  const vocabularyItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items =
      catalog?.vocabularyCategories.flatMap((category) =>
        category.items.map((item) => ({
          ...item,
          categoryCode: category.code,
          categoryNameKo: category.nameKo,
        })),
      ) ?? [];

    return items.filter((item) => {
      if (coreOnly && !item.isCore) return false;
      if (assetFilter === "priority" && item.collected && item.automated) return false;
      if (assetFilter === "missing" && item.collected) return false;
      if (assetFilter === "collected" && !item.collected) return false;
      if (assetFilter === "automated" && !item.automated) return false;
      if (!normalized) return true;
      return [
        item.lemma,
        item.meaningKo ?? "",
        item.partOfSpeech ?? "",
        item.categoryNameKo,
        item.exampleEn ?? "",
        item.exampleKo ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [assetFilter, catalog?.vocabularyCategories, coreOnly, query]);

  const visibleWeakestCategories = useMemo(
    () => progress?.weakestCategories.slice(0, 4) ?? [],
    [progress?.weakestCategories],
  );
  const visibleUnmatchedExpressions = useMemo(
    () => (assetTab === "pattern" ? catalog?.unmatchedPatternExpressions : catalog?.unmatchedVocabularyExpressions)?.slice(0, 6) ?? [],
    [assetTab, catalog?.unmatchedPatternExpressions, catalog?.unmatchedVocabularyExpressions],
  );
  const currentListCount = assetTab === "pattern" ? patternTemplates.length : vocabularyItems.length;

  const handleExportAssets = useCallback(async (assetType: ExportAssetType, format: ExportFormat) => {
    const loadingKey = `${assetType}-${format}`;
    setExportLoadingKey(loadingKey);
    setExportError("");
    setExportMessage("");

    try {
      const exported = await exportAssets(assetType, format);
      const destination = await persistExportFile(exported.fileName, exported.body, exported.contentType);

      const assetLabel = assetType === "korean" ? "한글표현 자산" : "영어표현 자산";
      const formatLabel = format.toUpperCase();
      if (destination.kind === "shared") {
        setExportMessage(`${assetLabel} ${formatLabel} 파일을 준비했고 공유 화면으로 넘겼습니다.`);
      } else {
        setExportMessage(`${assetLabel} ${formatLabel} 파일을 ${destination.locationLabel} 저장했습니다.`);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "데이터 export에 실패했습니다.");
    } finally {
      setExportLoadingKey("");
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.brand} />
        <Text style={styles.description}>학습 자산을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>학습 자산</Text>
      <Text style={styles.title}>패턴 / 단어 진도</Text>
      <Text style={styles.description}>
        저장한 표현이 어떤 패턴과 단어에 연결됐는지, 그리고 지금 무엇을 먼저 보강하면 좋은지 모바일에서 바로 확인합니다.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>현재 요약</Text>
        <Text style={styles.heroText}>전체 진행률 {progress?.overall.overallProgress ?? 0}%</Text>
        <Text style={styles.heroText}>
          패턴 자동화 {progress?.overall.automatedPatternCount ?? 0}/{progress?.overall.patternTemplateCount ?? 0}
        </Text>
        <Text style={styles.heroText}>
          단어 사용 가능 {progress?.overall.usableVocabularyCount ?? 0}/{progress?.overall.vocabularyItemCount ?? 0}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>데이터 Export</Text>
        <Text style={styles.metaText}>
          한국어 원문 자산과 영어 표현 자산을 JSON 또는 CSV로 저장해 다른 AI 워크플로우나 개인 정리용으로 바로 가져갈 수 있습니다.
        </Text>
        <View style={styles.exportBlock}>
          <Text style={styles.assetTitle}>1. 한글표현 자산</Text>
          <Text style={styles.metaText}>
            원문 문장, 맥락 메모, 화자, 시간축, 관계/상황/톤, 연결된 영어 표현 정보를 함께 내보냅니다.
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.primaryButton, exportLoadingKey === "korean-json" && styles.buttonDisabled]}
              onPress={() => void handleExportAssets("korean", "json")}
              disabled={!!exportLoadingKey}
            >
              {exportLoadingKey === "korean-json" ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>JSON 저장</Text>}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, exportLoadingKey === "korean-csv" && styles.buttonDisabled]}
              onPress={() => void handleExportAssets("korean", "csv")}
              disabled={!!exportLoadingKey}
            >
              {exportLoadingKey === "korean-csv" ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>CSV 저장</Text>}
            </Pressable>
          </View>
        </View>
        <View style={styles.exportBlock}>
          <Text style={styles.assetTitle}>2. 영어표현 자산</Text>
          <Text style={styles.metaText}>
            기본형/쉬운형/자연형, 메모, 원문 연결, TTS 키, 연습 이력 요약, 패턴/단어 매칭 정보를 함께 내보냅니다.
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.primaryButton, exportLoadingKey === "english-json" && styles.buttonDisabled]}
              onPress={() => void handleExportAssets("english", "json")}
              disabled={!!exportLoadingKey}
            >
              {exportLoadingKey === "english-json" ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>JSON 저장</Text>}
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, exportLoadingKey === "english-csv" && styles.buttonDisabled]}
              onPress={() => void handleExportAssets("english", "csv")}
              disabled={!!exportLoadingKey}
            >
              {exportLoadingKey === "english-csv" ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>CSV 저장</Text>}
            </Pressable>
          </View>
        </View>
        <Text style={styles.metaText}>
          {Platform.OS === "android"
            ? "Android에서는 저장할 폴더를 먼저 고르고, 선택한 위치에 파일을 저장합니다."
            : "iOS에서는 파일을 저장한 뒤 바로 공유 화면으로 넘겨 다른 앱이나 Files로 보낼 수 있습니다."}
        </Text>
        {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
        {exportMessage ? <Text style={styles.success}>{exportMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>학습 자산 바로가기</Text>
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={() => setAssetTab("pattern")}>
            <Text style={styles.primaryButtonText}>패턴 먼저 보기</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setAssetTab("vocabulary")}>
            <Text style={styles.secondaryButtonText}>단어 먼저 보기</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void loadAll(true)} disabled={refreshing}>
            {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>새로고침</Text>}
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>패턴 자동화율</Text>
          <Text style={styles.metricValue}>{progress?.overall.patternAutomationRate ?? 0}%</Text>
          <Text style={styles.metaText}>
            {progress?.overall.automatedPatternCount ?? 0} / {progress?.overall.patternTemplateCount ?? 0}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>패턴 수집률</Text>
          <Text style={styles.metricValue}>{progress?.overall.patternCollectionRate ?? 0}%</Text>
          <Text style={styles.metaText}>
            {progress?.overall.collectedPatternCount ?? 0} / {progress?.overall.patternTemplateCount ?? 0}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>단어 사용 가능률</Text>
          <Text style={styles.metricValue}>{progress?.overall.vocabularyUsableRate ?? 0}%</Text>
          <Text style={styles.metaText}>
            {progress?.overall.usableVocabularyCount ?? 0} / {progress?.overall.vocabularyItemCount ?? 0}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>1초 응답 통과율</Text>
          <Text style={styles.metricValue}>{progress?.overall.responseWithin1sRate ?? 0}%</Text>
          <Text style={styles.metaText}>최근 성공 기록 기준</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>레벨 진행률</Text>
        {(progress?.levels ?? []).map((level) => (
          <View key={level.level} style={styles.levelCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.levelTitle}>{level.level}</Text>
              <Text style={styles.levelBadge}>{level.progress}%</Text>
            </View>
            <Text style={styles.metaText}>
              패턴 자동화 {level.patternAutomatedCount}/{level.patternTargetCount} · 단어 사용 가능 {level.vocabularyUsableCount}/{level.vocabularyTargetCount}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>가장 약한 유형</Text>
        <Text style={styles.metaText}>아직 덜 모였거나 자동화가 부족한 카테고리부터 보강하면 학습 효율이 높습니다.</Text>
        {visibleWeakestCategories.length > 0 ? (
          visibleWeakestCategories.map((item) => (
            <View key={`${item.kind}-${item.code}`} style={styles.assetCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.assetTitle}>{item.nameKo}</Text>
                <Text style={styles.assetTag}>{item.kind === "pattern" ? "패턴" : "단어"}</Text>
              </View>
              <Text style={styles.metaText}>
                목표 {item.targetCount} · 확보 {item.collectedCount} · 자동화 {item.automatedCount} · 부족 {item.gap}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>약점 데이터가 아직 충분하지 않습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>자산 라이브러리</Text>
        <View style={styles.row}>
          <Pressable style={[styles.filterChip, assetTab === "pattern" && styles.filterChipActive]} onPress={() => setAssetTab("pattern")}>
            <Text style={[styles.filterChipText, assetTab === "pattern" && styles.filterChipTextActive]}>패턴</Text>
          </Pressable>
          <Pressable style={[styles.filterChip, assetTab === "vocabulary" && styles.filterChipActive]} onPress={() => setAssetTab("vocabulary")}>
            <Text style={[styles.filterChipText, assetTab === "vocabulary" && styles.filterChipTextActive]}>단어</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder={assetTab === "pattern" ? "패턴, 의미, 예문 검색" : "단어, 뜻, 예문 검색"}
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.row}>
          {([
            ["priority", "우선 보강"],
            ["all", "전체"],
            ["missing", "미확보"],
            ["collected", "확보됨"],
            ["automated", "자동화"],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.filterChip, assetFilter === value && styles.filterChipActive]}
              onPress={() => setAssetFilter(value)}
            >
              <Text style={[styles.filterChipText, assetFilter === value && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.filterChip, coreOnly && styles.filterChipActive]} onPress={() => setCoreOnly((current) => !current)}>
            <Text style={[styles.filterChipText, coreOnly && styles.filterChipTextActive]}>핵심만</Text>
          </Pressable>
        </View>
        <Text style={styles.metaText}>
          현재 {currentListCount}개 표시 · {assetTab === "pattern" ? "패턴 템플릿" : "단어 자산"}을 눌러 관련 표현으로 바로 이동할 수 있습니다.
        </Text>

        {assetTab === "pattern"
          ? patternTemplates.slice(0, 20).map((item) => <PatternAssetCard key={item.id} item={item} />)
          : vocabularyItems.slice(0, 20).map((item) => <VocabularyAssetCard key={item.id} item={item} />)}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{assetTab === "pattern" ? "패턴 미매칭 표현" : "단어 미매칭 표현"}</Text>
        <Text style={styles.metaText}>
          {assetTab === "pattern"
            ? "아직 어떤 패턴에도 연결되지 않은 표현입니다. 새 패턴을 더 모으거나 표현을 다시 점검하는 데 도움이 됩니다."
            : "아직 단어 자산에 연결되지 않은 표현입니다. 단어 수집이나 표현 점검 후보로 볼 수 있습니다."}
        </Text>
        {visibleUnmatchedExpressions.length > 0 ? (
          visibleUnmatchedExpressions.map((expression) => (
            <ExpressionBridgeCard key={expression.id} expression={expression} />
          ))
        ) : (
          <Text style={styles.metaText}>지금은 미매칭 표현이 많지 않습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function ExpressionBridgeCard({ expression }: { expression: LearningAssetExpressionRef }) {
  return (
    <View style={styles.assetCard}>
      <Text style={styles.assetTitle}>{expression.koreanText}</Text>
      <Text style={styles.assetBody}>{expression.englishBase}</Text>
      <View style={styles.row}>
        <Pressable style={styles.smallPrimaryButton} onPress={() => router.push(`/expression/${expression.id}`)}>
          <Text style={styles.smallPrimaryButtonText}>표현 상세</Text>
        </Pressable>
        <Pressable style={styles.smallSecondaryButton} onPress={() => router.push(`/expression/${expression.id}/practice`)}>
          <Text style={styles.smallSecondaryButtonText}>표현 연습</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PatternAssetCard({ item }: { item: PatternAssetItem }) {
  const status = formatProgressStatus(item.progress?.status, item.collected, item.automated);
  return (
    <View style={styles.assetCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.assetTitle}>{item.templateText}</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(status)]}>
          <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(status)]}>{status}</Text>
        </View>
      </View>
      <Text style={styles.metaText}>{item.categoryNameKo} · {item.level}</Text>
      <View style={styles.row}>
        {item.isCoreExpression ? <Text style={styles.infoPill}>핵심 패턴</Text> : null}
        {item.difficulty ? <Text style={styles.infoPill}>난이도 {item.difficulty}</Text> : null}
        <Text style={styles.infoPill}>연결 표현 {item.expressions.length}개</Text>
      </View>
      {item.meaningKo ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>의미</Text>
          <Text style={styles.assetBody}>{item.meaningKo}</Text>
        </View>
      ) : null}
      {item.usageNote ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>사용 메모</Text>
          <Text style={styles.metaText}>{item.usageNote}</Text>
        </View>
      ) : null}
      {item.exampleEn || item.exampleKo ? (
        <View style={styles.exampleCard}>
          <Text style={styles.detailLabel}>예문</Text>
          {item.exampleEn ? <Text style={styles.assetBody}>{item.exampleEn}</Text> : null}
          {item.exampleKo ? <Text style={styles.metaText}>{item.exampleKo}</Text> : null}
        </View>
      ) : null}
      <RelatedExpressionPreview expressions={item.expressions} />
    </View>
  );
}

function VocabularyAssetCard({ item }: { item: VocabularyAssetItem }) {
  const status = formatProgressStatus(item.progress?.status, item.collected, item.automated);
  return (
    <View style={styles.assetCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.assetTitle}>{item.lemma}</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(status)]}>
          <Text style={[styles.statusBadgeText, getStatusBadgeTextStyle(status)]}>{status}</Text>
        </View>
      </View>
      <Text style={styles.metaText}>{item.categoryNameKo} · {item.level}</Text>
      <View style={styles.row}>
        {item.isCore ? <Text style={styles.infoPill}>핵심 단어</Text> : null}
        {item.partOfSpeech ? <Text style={styles.infoPill}>{item.partOfSpeech}</Text> : null}
        {item.frequencyRank ? <Text style={styles.infoPill}>빈도 {item.frequencyRank}</Text> : null}
        <Text style={styles.infoPill}>연결 표현 {item.expressions.length}개</Text>
      </View>
      {item.meaningKo ? (
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>뜻</Text>
          <Text style={styles.assetBody}>{item.meaningKo}</Text>
        </View>
      ) : null}
      {item.exampleEn || item.exampleKo ? (
        <View style={styles.exampleCard}>
          <Text style={styles.detailLabel}>예문</Text>
          {item.exampleEn ? <Text style={styles.assetBody}>{item.exampleEn}</Text> : null}
          {item.exampleKo ? <Text style={styles.metaText}>{item.exampleKo}</Text> : null}
        </View>
      ) : null}
      <RelatedExpressionPreview expressions={item.expressions} />
    </View>
  );
}

function RelatedExpressionPreview({ expressions }: { expressions: LearningAssetExpressionRef[] }) {
  if (expressions.length === 0) {
    return <Text style={styles.metaText}>아직 연결된 표현이 없습니다.</Text>;
  }

  const preview = expressions.slice(0, 3);
  return (
    <View style={styles.relatedSection}>
      <Text style={styles.detailLabel}>연결된 표현 미리보기</Text>
      {preview.map((expression) => (
        <View key={expression.id} style={styles.relatedExpressionCard}>
          <Text style={styles.relatedExpressionKo}>{expression.koreanText}</Text>
          <Text style={styles.relatedExpressionEn}>{expression.englishBase}</Text>
          <View style={styles.row}>
            <Pressable style={styles.smallPrimaryButton} onPress={() => router.push(`/expression/${expression.id}`)}>
              <Text style={styles.smallPrimaryButtonText}>상세</Text>
            </Pressable>
            <Pressable style={styles.smallSecondaryButton} onPress={() => router.push(`/expression/${expression.id}/practice`)}>
              <Text style={styles.smallSecondaryButtonText}>연습</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {expressions.length > preview.length ? (
        <Text style={styles.metaText}>추가 연결 표현 {expressions.length - preview.length}개</Text>
      ) : null}
    </View>
  );
}

function formatProgressStatus(
  status?: LearningProgressStatus | null,
  collected?: boolean,
  automated?: boolean,
) {
  if (automated || status === "AUTOMATED") return "자동화";
  if (status === "USABLE_IN_SPEAKING") return "말하기 가능";
  if (status === "PRACTICING") return "연습 중";
  if (status === "RECOGNIZED") return "인식됨";
  if (collected || status === "COLLECTED") return "수집됨";
  return "미확보";
}

function getStatusBadgeStyle(status: string) {
  if (status === "자동화") return { backgroundColor: theme.successSoft };
  if (status === "말하기 가능") return { backgroundColor: theme.brandSoft };
  if (status === "연습 중") return { backgroundColor: theme.accentSoft };
  if (status === "인식됨") return { backgroundColor: theme.surfaceMuted };
  if (status === "수집됨") return { backgroundColor: theme.surfaceMuted };
  return { backgroundColor: theme.dangerSoft };
}

function getStatusBadgeTextStyle(status: string) {
  if (status === "자동화") return { color: theme.success };
  if (status === "말하기 가능") return { color: theme.brandStrong };
  if (status === "연습 중") return { color: theme.accentStrong };
  if (status === "인식됨") return { color: theme.textSoft };
  if (status === "수집됨") return { color: theme.textSoft };
  return { color: theme.danger };
}

async function persistExportFile(fileName: string, body: string, contentType: string) {
  if (Platform.OS === "android") {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted || !permissions.directoryUri) {
      throw new Error("저장할 폴더를 선택해야 export 파일을 저장할 수 있습니다.");
    }

    const { baseName, extension } = splitFileName(fileName);
    const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      baseName,
      contentType.split(";")[0] ?? guessMimeType(extension),
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, body, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      kind: "saved" as const,
      locationLabel: "선택한 폴더에",
    };
  }

  const baseDirectory = FileSystem.documentDirectory;
  if (!baseDirectory) {
    throw new Error("기기 문서 저장 공간을 찾지 못했습니다.");
  }

  const exportDirectory = `${baseDirectory}${EXPORT_DIRECTORY_NAME}`;
  await FileSystem.makeDirectoryAsync(exportDirectory, { intermediates: true });

  const fileUri = `${exportDirectory}/${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, body, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Share.share(
    {
      title: fileName,
      url: fileUri,
      message: `English Learning export: ${fileName}`,
    },
    {
      subject: fileName,
    },
  );

  return {
    kind: "shared" as const,
    locationLabel: fileUri,
  };
}

function splitFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return {
      baseName: fileName,
      extension: "",
    };
  }

  return {
    baseName: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex + 1).toLowerCase(),
  };
}

function guessMimeType(extension: string) {
  if (extension === "csv") {
    return "text/csv";
  }

  return "application/json";
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: theme.background,
    gap: 18,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
    padding: 24,
    gap: 12,
  },
  eyebrow: {
    color: theme.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.text,
  },
  description: {
    color: theme.textSoft,
    lineHeight: 22,
  },
  heroCard: {
    backgroundColor: theme.brandStrong,
    borderRadius: 24,
    padding: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1f8f85",
  },
  heroTitle: {
    color: theme.textOnDark,
    fontSize: 20,
    fontWeight: "800",
  },
  heroText: {
    color: "#dcece7",
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
  },
  exportBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: theme.surfaceSoft,
  },
  metricsGrid: {
    gap: 12,
  },
  metricCard: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  metricLabel: {
    color: theme.textSoft,
    fontWeight: "700",
  },
  metricValue: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "800",
  },
  levelCard: {
    borderWidth: 1,
    borderColor: theme.brandSoft,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    backgroundColor: theme.surfaceBrand,
  },
  levelTitle: {
    color: theme.text,
    fontWeight: "800",
  },
  levelBadge: {
    color: theme.brandStrong,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  primaryButton: {
    backgroundColor: theme.brand,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.textOnBrand,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryButtonText: {
    color: theme.text,
    fontWeight: "800",
  },
  smallPrimaryButton: {
    backgroundColor: theme.brand,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  smallPrimaryButtonText: {
    color: theme.textOnBrand,
    fontWeight: "800",
  },
  smallSecondaryButton: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  smallSecondaryButtonText: {
    color: theme.text,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  filterChip: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.brandSoft,
    borderColor: theme.brand,
  },
  filterChipText: {
    color: theme.textSoft,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: theme.brandStrong,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
  },
  assetCard: {
    borderWidth: 1,
    borderColor: theme.brandSoft,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: theme.surfaceBrand,
  },
  assetTitle: {
    color: theme.text,
    fontWeight: "800",
    flex: 1,
  },
  assetBody: {
    color: theme.textSoft,
    lineHeight: 21,
  },
  detailBlock: {
    gap: 4,
  },
  detailLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  exampleCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: theme.surface,
  },
  assetTag: {
    color: theme.brandStrong,
    fontWeight: "800",
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusBadgeText: {
    fontWeight: "800",
    fontSize: 12,
  },
  infoPill: {
    backgroundColor: theme.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: theme.textSoft,
    fontWeight: "700",
    overflow: "hidden",
  },
  relatedSection: {
    gap: 8,
  },
  relatedExpressionCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    backgroundColor: theme.surface,
  },
  relatedExpressionKo: {
    color: theme.textSoft,
    lineHeight: 20,
  },
  relatedExpressionEn: {
    color: theme.text,
    fontWeight: "700",
    lineHeight: 21,
  },
  metaText: {
    color: theme.textMuted,
    lineHeight: 20,
  },
  error: {
    color: theme.danger,
    lineHeight: 20,
  },
  success: {
    color: theme.success,
    lineHeight: 20,
  },
});
