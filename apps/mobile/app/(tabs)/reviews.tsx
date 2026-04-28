import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { listExpressions, type ExpressionResponse } from "../../src/lib/api/expressions";
import {
  generatePracticePrompt,
  listPracticeLogs,
  scorePracticeAnswer,
  type PracticeHistoryResponse,
  type PracticePromptResponse,
  type PracticeScoreResponse,
} from "../../src/lib/api/practice";
import { listTodayReviews, type ReviewItemResponse } from "../../src/lib/api/reviews";

type ReviewStrategy = "system" | "low_score" | "stale" | "voice_gap" | "random";
type PracticeTestType = "translation" | "situation" | "pattern" | "think";

export default function ReviewsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [strategy, setStrategy] = useState<ReviewStrategy>("system");
  const [reviews, setReviews] = useState<ReviewItemResponse[]>([]);
  const [expressions, setExpressions] = useState<ExpressionResponse[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeHistoryResponse[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [prompt, setPrompt] = useState<PracticePromptResponse | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [score, setScore] = useState<PracticeScoreResponse | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [playing, setPlaying] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  const selectedReview = useMemo(
    () => reviews.find((item) => item.id === selectedReviewId) ?? reviews[0] ?? null,
    [reviews, selectedReviewId],
  );
  const selectedExpression = useMemo(
    () => expressions.find((item) => item.id === selectedReview?.id) ?? null,
    [expressions, selectedReview?.id],
  );

  const loadAll = useCallback(async (showRefreshing = false, nextStrategy?: ReviewStrategy) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const activeStrategy = nextStrategy ?? strategy;
      const [reviewList, expressionList, historyList] = await Promise.all([
        listTodayReviews(activeStrategy),
        listExpressions(),
        listPracticeLogs(20),
      ]);
      setReviews(reviewList);
      setExpressions(expressionList);
      setPracticeLogs(historyList);
      const nextSelectedId = reviewList.find((item) => item.id === selectedReviewId)?.id ?? reviewList[0]?.id ?? "";
      setSelectedReviewId(nextSelectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "복습 목록 조회에 실패했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedReviewId, strategy]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll]),
  );

  useEffect(() => {
    return () => {
      void stopPlayback();
    };
  }, []);

  useEffect(() => {
    setPrompt(null);
    setScore(null);
    setAnswerDraft("");
  }, [selectedReviewId]);

  async function handleRefresh(nextStrategy?: ReviewStrategy) {
    if (nextStrategy) {
      setStrategy(nextStrategy);
    }
    await loadAll(true, nextStrategy);
  }

  async function handleGeneratePrompt(testType?: PracticeTestType) {
    if (!selectedReview) return;

    const nextType = testType ?? (selectedReview.recommendedTestType as PracticeTestType);
    setPromptLoading(true);
    setError("");
    setMessage("");
    setScore(null);

    try {
      const created = await generatePracticePrompt(selectedReview.id, nextType);
      setPrompt(created);
      setAnswerDraft("");
      setMessage("복습 문제를 준비했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "복습 문제 생성에 실패했습니다.");
    } finally {
      setPromptLoading(false);
    }
  }

  async function handleScoreAnswer() {
    if (!selectedReview || !prompt) return;

    const trimmed = answerDraft.trim();
    if (!trimmed) {
      setError("답변을 입력해 주세요.");
      return;
    }

    setScoring(true);
    setError("");
    setMessage("");

    try {
      const result = await scorePracticeAnswer({
        expressionId: selectedReview.id,
        answer: trimmed,
        testType: prompt.testType,
        promptKorean: prompt.promptKorean,
        promptContext: prompt.promptContext,
        promptTarget: prompt.target,
      });
      setScore(result);
      setMessage("채점이 완료되었습니다.");
      const historyList = await listPracticeLogs(20);
      setPracticeLogs(historyList);
      setReviews((current) =>
        current.map((item) =>
          item.id === selectedReview.id
            ? {
                ...item,
                mastery: result.score,
                practiceAnswer: result.answer,
                lastReviewedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "채점에 실패했습니다.");
    } finally {
      setScoring(false);
    }
  }

  async function handlePlayReferenceTts() {
    if (!selectedExpression?.ttsUrl) {
      setError("정답 TTS가 아직 없습니다.");
      return;
    }

    setError("");
    setMessage("");

    try {
      if (playing) {
        await stopPlayback();
        return;
      }

      await stopPlayback();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: selectedExpression.ttsUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlaying(false);
            void sound.unloadAsync();
            soundRef.current = null;
          }
        },
      );
      soundRef.current = sound;
      setPlaying(true);
    } catch (err) {
      setPlaying(false);
      setError(err instanceof Error ? err.message : "정답 TTS 재생에 실패했습니다.");
    }
  }

  async function stopPlayback() {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlaying(false);
    if (!sound) return;

    try {
      await sound.stopAsync();
    } catch {
      // Best effort stop.
    }
    try {
      await sound.unloadAsync();
    } catch {
      // Best effort unload.
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.description}>복습 목록을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reviews</Text>
      <Text style={styles.description}>추천 복습 카드에서 문제를 만들고 바로 답해보는 모바일 연습 플레이어입니다.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>전략 / 새로고침</Text>
        <View style={styles.row}>
          {([
            ["system", "추천"],
            ["low_score", "낮은 점수"],
            ["stale", "오래된 카드"],
            ["voice_gap", "음성 적은 카드"],
            ["random", "랜덤"],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.chip, strategy === value && styles.chipSelected]}
              onPress={() => void handleRefresh(value)}
            >
              <Text style={[styles.chipText, strategy === value && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void handleRefresh()} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>목록 새로고침</Text>}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
      {message ? (
        <View style={styles.card}>
          <Text style={styles.success}>{message}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>복습 카드</Text>
        {reviews.length > 0 ? (
          reviews.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.reviewCard, selectedReview?.id === item.id && styles.reviewCardSelected]}
              onPress={() => setSelectedReviewId(item.id)}
            >
              <Text style={styles.reviewKorean}>{item.korean}</Text>
              <Text style={styles.reviewEnglish}>{item.english}</Text>
              <Text style={styles.metaText}>현재 mastery: {item.mastery} · 추천 유형: {formatTestType(item.recommendedTestType)}</Text>
              <Text style={styles.metaText}>{item.reviewReason}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.metaText}>복습할 카드가 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>현재 연습</Text>
        {selectedReview ? (
          <>
            <Text style={styles.reviewKorean}>{selectedReview.korean}</Text>
            <Text style={styles.metaText}>정답 기준: {selectedReview.english}</Text>
            <View style={styles.row}>
              {(["translation", "situation", "think"] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, prompt?.testType === type && styles.chipSelected]}
                  onPress={() => void handleGeneratePrompt(type)}
                  disabled={promptLoading}
                >
                  <Text style={[styles.chipText, prompt?.testType === type && styles.chipTextSelected]}>{formatTestType(type)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.primaryButton, promptLoading && styles.buttonDisabled]} onPress={() => void handleGeneratePrompt()} disabled={promptLoading}>
                {promptLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>문제 생성</Text>}
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, !selectedExpression?.ttsUrl && styles.buttonDisabled]}
                onPress={() => void handlePlayReferenceTts()}
                disabled={!selectedExpression?.ttsUrl}
              >
                <Text style={styles.secondaryButtonText}>{playing ? "정답 TTS 정지" : "정답 TTS 재생"}</Text>
              </Pressable>
            </View>

            {prompt ? (
              <View style={styles.promptCard}>
                <Text style={styles.promptTitle}>{prompt.promptKorean}</Text>
                {prompt.promptContext ? <Text style={styles.metaText}>{prompt.promptContext}</Text> : null}
                {prompt.tips ? <Text style={styles.metaText}>힌트: {prompt.tips}</Text> : null}
                {prompt.patternLabel ? <Text style={styles.metaText}>패턴: {prompt.patternLabel}</Text> : null}
                {prompt.patternDescription ? <Text style={styles.metaText}>{prompt.patternDescription}</Text> : null}
              </View>
            ) : (
              <Text style={styles.metaText}>먼저 문제 생성을 눌러 주세요.</Text>
            )}

            <TextInput
              style={styles.answerInput}
              multiline
              placeholder="영어 답변을 입력해 보세요"
              value={answerDraft}
              onChangeText={setAnswerDraft}
            />
            <Pressable
              style={[styles.primaryButton, (!prompt || scoring) && styles.buttonDisabled]}
              onPress={() => void handleScoreAnswer()}
              disabled={!prompt || scoring}
            >
              {scoring ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>채점하기</Text>}
            </Pressable>

            {score ? (
              <View style={styles.scoreCard}>
                <Text style={styles.scoreTitle}>총점 {score.score}</Text>
                <Text style={styles.metaText}>의미 {score.meaningScore} · 자연스러움 {score.naturalnessScore} · 문법 {score.grammarScore}</Text>
                <Text style={styles.feedbackText}>feedback: {score.feedback}</Text>
                <Text style={styles.feedbackText}>강점: {score.strengthComment}</Text>
                <Text style={styles.feedbackText}>교정: {score.correctionComment}</Text>
                {score.meaningComment ? <Text style={styles.feedbackText}>의미 코멘트: {score.meaningComment}</Text> : null}
                <Text style={styles.feedbackText}>추천 답변: {score.suggestedAnswer}</Text>
                {score.suggestedAnswerAlt ? <Text style={styles.feedbackText}>대안 답변: {score.suggestedAnswerAlt}</Text> : null}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.metaText}>먼저 복습 카드를 선택해 주세요.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 연습 기록</Text>
        {practiceLogs.length > 0 ? (
          practiceLogs.slice(0, 10).map((log) => (
            <View key={log.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{log.koreanText}</Text>
              <Text style={styles.metaText}>
                {formatTestType(log.testType)} · {log.mode} · 점수 {log.score}
              </Text>
              <Text style={styles.metaText}>내 답: {log.answer || "(비어 있음)"}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>아직 연습 기록이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatTestType(value: PracticeTestType | "translation" | "situation" | "think") {
  if (value === "translation") return "번역형";
  if (value === "situation") return "상황형";
  if (value === "think") return "Think in English";
  return "패턴형";
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f8fafc",
    padding: 24,
    gap: 16
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a"
  },
  description: {
    color: "#475569",
    lineHeight: 22
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 10
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  chipSelected: {
    backgroundColor: "#2563eb"
  },
  chipText: {
    color: "#1d4ed8",
    fontWeight: "700"
  },
  chipTextSelected: {
    color: "#ffffff"
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
    gap: 6
  },
  reviewCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#f8fbff"
  },
  reviewKorean: {
    color: "#0f172a",
    fontWeight: "800",
    lineHeight: 22
  },
  reviewEnglish: {
    color: "#334155",
    lineHeight: 21
  },
  promptCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f8fbff"
  },
  promptTitle: {
    color: "#0f172a",
    fontWeight: "800",
    lineHeight: 22
  },
  answerInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 110,
    textAlignVertical: "top",
    color: "#0f172a"
  },
  scoreCard: {
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f0fdf4"
  },
  scoreTitle: {
    color: "#166534",
    fontSize: 18,
    fontWeight: "800"
  },
  feedbackText: {
    color: "#14532d",
    lineHeight: 20
  },
  historyRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    gap: 4
  },
  historyTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  metaText: {
    color: "#64748b",
    lineHeight: 20
  },
  error: {
    color: "#dc2626",
    lineHeight: 20
  },
  success: {
    color: "#15803d",
    lineHeight: 20
  }
});
