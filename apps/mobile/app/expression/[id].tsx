import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  deleteExpression,
  generateExpressionTts,
  listExpressions,
  type ExpressionResponse,
  updateExpressionMemo,
} from "../../src/lib/api/expressions";

export default function ExpressionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const expressionId = params.id ?? "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expression, setExpression] = useState<ExpressionResponse | null>(null);
  const [memoDraft, setMemoDraft] = useState("");

  const soundRef = useRef<Audio.Sound | null>(null);

  const sourceSummary = useMemo(() => {
    if (!expression) return [];
    return [
      { label: "의도", value: expression.sourceAnalysisIntent ?? "-" },
      { label: "요약", value: expression.sourceAnalysisSummary ?? "-" },
      { label: "관계", value: expression.sourceRelationship ?? "-" },
      { label: "상황", value: expression.sourceSituation ?? "-" },
      { label: "톤", value: expression.sourceTone ?? "-" },
      { label: "맥락 메모", value: expression.sourceContextNote ?? "-" },
    ];
  }, [expression]);
  const nextActionHint = useMemo(() => {
    if (!expression) return "";
    if (!expression.ttsUrl) return "먼저 TTS를 만들어 두면 이후 듣기 학습과 복습 진입이 쉬워집니다.";
    if ((expression.practiceCount ?? 0) === 0) return "이 표현은 아직 연습 전입니다. 바로 `표현 연습`으로 들어가 첫 시도를 해보는 게 좋습니다.";
    if ((expression.latestPracticeScore ?? 100) < 80) return "최근 점수가 낮아서 다시 연습해볼 가치가 큽니다.";
    return "이 표현은 다시 듣기와 가벼운 복습에 바로 활용할 수 있습니다.";
  }, [expression]);
  const hasMemoChange = useMemo(() => (expression?.userMemo ?? "") !== memoDraft, [expression?.userMemo, memoDraft]);

  const loadExpression = useCallback(async (showRefreshing = false) => {
    if (!expressionId) {
      setError("표현 id가 없습니다.");
      setLoading(false);
      return;
    }

    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const list = await listExpressions();
      const found = list.find((item) => item.id === expressionId) ?? null;
      if (!found) {
        throw new Error("표현을 찾을 수 없습니다.");
      }
      setExpression(found);
      setMemoDraft(found.userMemo ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 상세 조회에 실패했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expressionId]);

  useEffect(() => {
    void loadExpression();
  }, [loadExpression]);

  useEffect(() => {
    return () => {
      void stopPlayback();
    };
  }, []);

  async function handleSaveMemo() {
    if (!expression) return;

    setSavingMemo(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateExpressionMemo(expression.id, memoDraft.trim());
      setExpression((current) => (current ? { ...current, userMemo: updated.userMemo ?? null } : current));
      setMemoDraft(updated.userMemo ?? "");
      setMessage("메모를 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "메모 저장에 실패했습니다.");
    } finally {
      setSavingMemo(false);
    }
  }

  async function handleGenerateTts() {
    if (!expression) return;

    setTtsLoading(true);
    setError("");
    setMessage("");
    try {
      const tts = await generateExpressionTts(expression.id);
      setExpression((current) =>
        current
          ? {
              ...current,
              ttsKey: tts.ttsKey,
              ttsUrl: tts.ttsUrl,
              koreanTtsKey: tts.koreanTtsKey,
              koreanTtsUrl: tts.koreanTtsUrl,
            }
          : current,
      );
      setMessage("TTS를 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS 생성에 실패했습니다.");
    } finally {
      setTtsLoading(false);
    }
  }

  async function handlePlayTts() {
    if (!expression?.ttsUrl) {
      setError("먼저 TTS를 생성해 주세요.");
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
        { uri: expression.ttsUrl },
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
      setError(err instanceof Error ? err.message : "TTS 재생에 실패했습니다.");
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
      // Best effort.
    }
    try {
      await sound.unloadAsync();
    } catch {
      // Best effort.
    }
  }

  function handleDeleteExpression() {
    if (!expression || deleting) return;

    const confirmDelete = async () => {
      setDeleting(true);
      setError("");
      setMessage("");
      try {
        await stopPlayback();
        await deleteExpression(expression.id);
        router.replace("/expressions");
      } catch (err) {
        setError(err instanceof Error ? err.message : "표현 삭제에 실패했습니다.");
      } finally {
        setDeleting(false);
      }
    };

    const deleteMessage = `"${expression.englishBase}" 표현을 삭제할까요? 오늘의 복습 기록에서도 제외됩니다.`;

    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      if (window.confirm(deleteMessage)) {
        void confirmDelete();
      }
      return;
    }

    Alert.alert("표현 삭제", deleteMessage, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void confirmDelete() },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.description}>표현 상세를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>표현 상세</Text>
      <Text style={styles.description}>영어 표현, TTS, 메모를 한 화면에서 다시 확인합니다.</Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>뒤로</Text>
        </Pressable>
        {expression ? (
          <Pressable style={styles.primaryButton} onPress={() => router.push(`/expression/${expression.id}/practice`)}>
            <Text style={styles.primaryButtonText}>표현 연습</Text>
          </Pressable>
        ) : null}
        <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void loadExpression(true)} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>새로고침</Text>}
        </Pressable>
        {expression ? (
          <Pressable style={[styles.dangerButton, deleting && styles.buttonDisabled]} onPress={() => handleDeleteExpression()} disabled={deleting}>
            {deleting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>삭제</Text>}
          </Pressable>
        ) : null}
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

      <View style={styles.highlightCard}>
        <Text style={styles.highlightLabel}>다음 학습 액션</Text>
        <Text style={styles.highlightValue}>{nextActionHint || "표현을 불러오는 중입니다."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기본 표현</Text>
        <Text style={styles.korean}>{expression?.koreanText ?? "-"}</Text>
        <Text style={styles.base}>{expression?.englishBase ?? "-"}</Text>
        <Text style={styles.sub}>쉬운형: {expression?.englishEasy ?? "-"}</Text>
        <Text style={styles.sub}>자연형: {expression?.englishNatural ?? "-"}</Text>
        {expression?.thinkInEnglish ? <Text style={styles.sub}>Think in English: {expression.thinkInEnglish}</Text> : null}
        {expression?.note ? <Text style={styles.sub}>note: {expression.note}</Text> : null}
        <Text style={styles.metaText}>연습 {expression?.practiceCount ?? 0}회 · 최근 점수 {expression?.latestPracticeScore ?? "-"}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.primaryButton} onPress={() => expression ? router.push(`/expression/${expression.id}/practice`) : undefined}>
            <Text style={styles.primaryButtonText}>바로 연습하기</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, !expression?.ttsUrl && styles.buttonDisabled]} onPress={() => void handlePlayTts()} disabled={!expression?.ttsUrl}>
            <Text style={styles.secondaryButtonText}>{playing ? "정지" : "정답 먼저 듣기"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>TTS</Text>
        <Text style={styles.metaText}>현재 상태: {expression?.ttsUrl ? "생성됨" : "아직 없음"}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={[styles.primaryButton, ttsLoading && styles.buttonDisabled]} onPress={() => void handleGenerateTts()} disabled={ttsLoading}>
            {ttsLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{expression?.ttsUrl ? "TTS 재생성" : "TTS 생성"}</Text>}
          </Pressable>
          <Pressable style={[styles.secondaryButton, !expression?.ttsUrl && styles.buttonDisabled]} onPress={() => void handlePlayTts()} disabled={!expression?.ttsUrl}>
            <Text style={styles.secondaryButtonText}>{playing ? "정지" : "TTS 재생"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>내 메모</Text>
        <TextInput
          style={styles.memoInput}
          multiline
          placeholder="이 표현을 언제 쓰는지, 주의할 점을 적어두세요"
          value={memoDraft}
          onChangeText={setMemoDraft}
        />
        {hasMemoChange ? <Text style={styles.pendingText}>저장하지 않은 메모 변경이 있습니다.</Text> : null}
        <Pressable style={[styles.primaryButton, savingMemo && styles.buttonDisabled]} onPress={() => void handleSaveMemo()} disabled={savingMemo}>
          {savingMemo ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>메모 저장</Text>}
        </Pressable>
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.cardTitle}>정리 액션</Text>
        <Text style={styles.metaText}>표현을 삭제하면 목록과 오늘의 복습에서 함께 제외됩니다. 패턴/단어 학습 이력은 유지됩니다.</Text>
        <Pressable style={[styles.dangerButton, deleting && styles.buttonDisabled]} onPress={() => handleDeleteExpression()} disabled={deleting}>
          {deleting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>이 표현 삭제</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>원문 맥락</Text>
        {sourceSummary.map((item) => (
          <Text key={item.label} style={styles.sub}>
            {item.label}: {item.value}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
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
  dangerCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 20,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#fed7aa"
  },
  highlightCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  highlightLabel: {
    color: "#2563eb",
    fontWeight: "800",
    fontSize: 12
  },
  highlightValue: {
    color: "#0f172a",
    lineHeight: 22,
    fontWeight: "700"
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  korean: {
    color: "#475569",
    lineHeight: 22
  },
  base: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 26
  },
  sub: {
    color: "#334155",
    lineHeight: 21
  },
  metaText: {
    color: "#64748b",
    lineHeight: 20
  },
  memoInput: {
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
  pendingText: {
    color: "#b45309",
    lineHeight: 20
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
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
  dangerButton: {
    backgroundColor: "#dc2626",
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
  error: {
    color: "#dc2626",
    lineHeight: 20
  },
  success: {
    color: "#15803d",
    lineHeight: 20
  }
});
