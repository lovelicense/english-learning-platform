import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { listExpressions, type ExpressionResponse } from "../../src/lib/api/expressions";

type ExpressionFilter = "all" | "tts_ready" | "needs_tts" | "needs_practice" | "recent";

export default function ExpressionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expressions, setExpressions] = useState<ExpressionResponse[]>([]);
  const [activeFilter, setActiveFilter] = useState<ExpressionFilter>("all");
  const [playingExpressionId, setPlayingExpressionId] = useState("");
  const [playlistPlaying, setPlaylistPlaying] = useState(false);
  const [playlistCurrentIndex, setPlaylistCurrentIndex] = useState(-1);
  const [playlistRepeatOnce, setPlaylistRepeatOnce] = useState(false);
  const [playlistGapMs, setPlaylistGapMs] = useState<0 | 1500 | 3000>(1500);

  const soundRef = useRef<Audio.Sound | null>(null);
  const playlistRef = useRef<ExpressionResponse[]>([]);
  const playlistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prioritizedExpressions = useMemo(() => {
    return [...expressions].sort((a, b) => {
      const aNeedsTts = a.ttsUrl ? 0 : 1;
      const bNeedsTts = b.ttsUrl ? 0 : 1;
      const aPractice = a.practiceCount ?? 0;
      const bPractice = b.practiceCount ?? 0;
      const aScore = a.latestPracticeScore ?? -1;
      const bScore = b.latestPracticeScore ?? -1;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (aNeedsTts !== bNeedsTts) return bNeedsTts - aNeedsTts;
      if (aPractice !== bPractice) return aPractice - bPractice;
      if (aScore !== bScore) return aScore - bScore;
      return bCreated - aCreated;
    });
  }, [expressions]);

  const filteredExpressions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const baseList = prioritizedExpressions.filter((item) => {
      if (activeFilter === "tts_ready") return Boolean(item.ttsUrl);
      if (activeFilter === "needs_tts") return !item.ttsUrl;
      if (activeFilter === "needs_practice") return (item.practiceCount ?? 0) === 0 || (item.latestPracticeScore ?? 0) < 80;
      if (activeFilter === "recent") return true;
      return true;
    });
    const filteredByMode = activeFilter === "recent" ? [...baseList].sort((a, b) => {
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    }) : baseList;

    if (!normalized) return filteredByMode;
    return filteredByMode.filter((item) =>
      [
        item.koreanText,
        item.englishBase,
        item.englishEasy,
        item.englishNatural,
        item.note ?? "",
        item.userMemo ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [prioritizedExpressions, activeFilter, query]);

  const recommendedExpressions = useMemo(() => prioritizedExpressions.slice(0, 3), [prioritizedExpressions]);
  const ttsReadyCount = useMemo(() => expressions.filter((item) => item.ttsUrl).length, [expressions]);
  const ttsReadyExpressions = useMemo(() => prioritizedExpressions.filter((item) => item.ttsUrl), [prioritizedExpressions]);

  const loadExpressions = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const list = await listExpressions();
      setExpressions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 목록 조회에 실패했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExpressions();
    }, [loadExpressions]),
  );

  useEffect(() => {
    return () => {
      void stopPlayback();
    };
  }, []);

  async function handlePlayExpression(expression: ExpressionResponse) {
    if (!expression.ttsUrl) {
      setError("먼저 TTS가 생성된 표현만 재생할 수 있습니다.");
      return;
    }

    setError("");
    try {
      if (playingExpressionId === expression.id) {
        await stopPlayback();
        return;
      }

      setPlaylistPlaying(false);
      setPlaylistCurrentIndex(-1);
      playlistRef.current = [];
      await stopPlayback();
      await playExpressionAudio(expression, false);
    } catch (err) {
      setPlayingExpressionId("");
      setError(err instanceof Error ? err.message : "TTS 재생에 실패했습니다.");
    }
  }

  async function handlePlayTtsPlaylist() {
    if (ttsReadyExpressions.length === 0) {
      setError("먼저 TTS가 준비된 표현이 필요합니다.");
      return;
    }

    if (playlistPlaying) {
      await stopPlayback();
      return;
    }

    setError("");
    setActiveFilter("tts_ready");
    playlistRef.current = ttsReadyExpressions;
    setPlaylistPlaying(true);
    setPlaylistCurrentIndex(0);

    try {
      await stopPlayback();
      await playExpressionAudio(ttsReadyExpressions[0], true);
    } catch (err) {
      setPlaylistPlaying(false);
      setPlaylistCurrentIndex(-1);
      playlistRef.current = [];
      setError(err instanceof Error ? err.message : "전체 재생 시작에 실패했습니다.");
    }
  }

  async function playExpressionAudio(expression: ExpressionResponse, partOfPlaylist: boolean) {
    if (!expression.ttsUrl) return;

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      { uri: expression.ttsUrl },
      { shouldPlay: true },
      (status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          void handlePlaybackFinished(expression.id, partOfPlaylist);
        }
      },
    );
    soundRef.current = sound;
    setPlayingExpressionId(expression.id);
  }

  async function handlePlaybackFinished(finishedExpressionId: string, wasPlaylistPlayback: boolean) {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingExpressionId("");

    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {
        // Best effort unload.
      }
    }

    if (!wasPlaylistPlayback) {
      return;
    }

    const playlist = playlistRef.current;
    const currentIndex = playlist.findIndex((item) => item.id === finishedExpressionId);
    const nextExpression = currentIndex >= 0 ? playlist[currentIndex + 1] ?? null : null;

    if (!nextExpression) {
      if (playlistRepeatOnce && playlist.length > 0) {
        setPlaylistRepeatOnce(false);
        setPlaylistCurrentIndex(0);
        scheduleNextPlaylistPlayback(playlist[0]);
        return;
      }
      setPlaylistPlaying(false);
      setPlaylistCurrentIndex(-1);
      playlistRef.current = [];
      return;
    }

    setPlaylistCurrentIndex(currentIndex + 1);
    try {
      scheduleNextPlaylistPlayback(nextExpression);
    } catch (err) {
      setPlaylistPlaying(false);
      setPlaylistCurrentIndex(-1);
      playlistRef.current = [];
      setError(err instanceof Error ? err.message : "다음 표현 재생에 실패했습니다.");
    }
  }

  function scheduleNextPlaylistPlayback(expression: ExpressionResponse) {
    clearPlaylistTimeout();
    if (playlistGapMs <= 0) {
      void playExpressionAudio(expression, true);
      return;
    }

    playlistTimeoutRef.current = setTimeout(() => {
      playlistTimeoutRef.current = null;
      void playExpressionAudio(expression, true);
    }, playlistGapMs);
  }

  function clearPlaylistTimeout() {
    if (!playlistTimeoutRef.current) return;
    clearTimeout(playlistTimeoutRef.current);
    playlistTimeoutRef.current = null;
  }

  async function stopPlayback() {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingExpressionId("");
    setPlaylistPlaying(false);
    setPlaylistCurrentIndex(-1);
    playlistRef.current = [];
    clearPlaylistTimeout();
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
        <Text style={styles.description}>표현 목록을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Expressions</Text>
      <Text style={styles.description}>저장한 영어 표현을 다시 찾아 듣고, 상세 화면에서 메모와 TTS를 관리합니다.</Text>

      <Pressable style={styles.quickSaveCard} onPress={() => router.push("/quick-sentence")}>
        <Text style={styles.quickSaveLabel}>Quick Save</Text>
        <Text style={styles.quickSaveTitle}>빠른 문장 저장</Text>
        <Text style={styles.quickSaveText}>녹음 없이 한국어 문장을 먼저 남기고, 바로 영어 표현으로 바꿉니다.</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>검색 / 새로고침</Text>
        <TextInput
          style={styles.input}
          placeholder="한글, 영어 표현, 메모로 검색"
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.row}>
          {([
            ["all", "전체"],
            ["tts_ready", "TTS 완료"],
            ["needs_tts", "TTS 필요"],
            ["needs_practice", "복습 우선"],
            ["recent", "최근 생성"],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.filterChip, activeFilter === value && styles.filterChipActive]}
              onPress={() => setActiveFilter(value)}
            >
              <Text style={[styles.filterChipText, activeFilter === value && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void loadExpressions(true)} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>목록 새로고침</Text>}
        </Pressable>
        <Text style={styles.metaText}>총 {expressions.length}개 · 현재 {filteredExpressions.length}개 표시</Text>
      </View>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>듣기 가능한 표현</Text>
        <Text style={styles.metaText}>현재 TTS가 준비된 표현은 {ttsReadyCount}개입니다.</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.primaryButton, ttsReadyCount === 0 && styles.buttonDisabled]}
            onPress={() => setActiveFilter("tts_ready")}
            disabled={ttsReadyCount === 0}
          >
            <Text style={styles.primaryButtonText}>TTS 완료만 보기</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, ttsReadyCount === 0 && styles.buttonDisabled]}
            onPress={() => void handlePlayTtsPlaylist()}
            disabled={ttsReadyCount === 0}
          >
            <Text style={styles.secondaryButtonText}>{playlistPlaying ? "전체 재생 정지" : "전체 연속 재생"}</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.filterChip, playlistRepeatOnce && styles.filterChipActive]}
            onPress={() => setPlaylistRepeatOnce((current) => !current)}
          >
            <Text style={[styles.filterChipText, playlistRepeatOnce && styles.filterChipTextActive]}>한 번 더 반복</Text>
          </Pressable>
          {([
            [0, "텀 없음"],
            [1500, "1.5초 텀"],
            [3000, "3초 텀"],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.filterChip, playlistGapMs === value && styles.filterChipActive]}
              onPress={() => setPlaylistGapMs(value)}
            >
              <Text style={[styles.filterChipText, playlistGapMs === value && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.metaText}>이동 중 듣기 학습용 목록을 바로 좁혀볼 수 있습니다.</Text>
        {playlistPlaying && playlistCurrentIndex >= 0 ? (
          <Text style={styles.playlistStatusText}>
            재생 중: {playlistCurrentIndex + 1} / {playlistRef.current.length}
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>먼저 보기 추천</Text>
        <Text style={styles.metaText}>TTS가 없거나 아직 충분히 연습하지 않은 표현을 위로 올렸습니다.</Text>
        {recommendedExpressions.length > 0 ? (
          recommendedExpressions.map((expression, index) => (
            <View key={expression.id} style={[styles.expressionCard, index === 0 && styles.recommendedCard]}>
              <Text style={styles.recommendLabel}>{index === 0 ? "가장 먼저 보기" : `추천 ${index + 1}`}</Text>
              <Text style={styles.expressionKorean}>{expression.koreanText}</Text>
              <Text style={styles.expressionBase}>{expression.englishBase}</Text>
              <Text style={styles.metaText}>
                TTS: {expression.ttsUrl ? "있음" : "없음"} · 연습 {expression.practiceCount ?? 0}회 · 최근 점수 {expression.latestPracticeScore ?? "-"}
              </Text>
              <View style={styles.cardActionRow}>
                <Pressable style={styles.smallPrimaryButton} onPress={() => router.push(`/expression/${expression.id}`)}>
                  <Text style={styles.smallPrimaryButtonText}>상세 보기</Text>
                </Pressable>
                <Pressable style={styles.smallSecondaryButton} onPress={() => router.push(`/expression/${expression.id}/practice`)}>
                  <Text style={styles.smallSecondaryButtonText}>바로 연습</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>아직 추천할 표현이 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>표현 목록</Text>
        {filteredExpressions.length > 0 ? (
          filteredExpressions.map((expression) => (
            <View key={expression.id} style={styles.expressionCard}>
              <Text style={styles.expressionKorean}>{expression.koreanText}</Text>
              <Text style={styles.expressionBase}>{expression.englishBase}</Text>
              <Text style={styles.expressionSub}>easy: {expression.englishEasy}</Text>
              <Text style={styles.expressionSub}>natural: {expression.englishNatural}</Text>
              <Text style={styles.metaText}>
                TTS: {expression.ttsUrl ? "있음" : "없음"} · 연습 {expression.practiceCount ?? 0}회 · 최근 점수 {expression.latestPracticeScore ?? "-"}
              </Text>
              <Text style={styles.priorityText}>{getExpressionPriorityLabel(expression)}</Text>
              {expression.userMemo ? <Text style={styles.memoText}>memo: {expression.userMemo}</Text> : null}
              <View style={styles.cardActionRow}>
                <Pressable
                  style={[styles.smallSecondaryButton, !expression.ttsUrl && styles.buttonDisabled]}
                  onPress={() => void handlePlayExpression(expression)}
                  disabled={!expression.ttsUrl}
                >
                  <Text style={styles.smallSecondaryButtonText}>
                    {playingExpressionId === expression.id ? "TTS 정지" : "TTS 듣기"}
                  </Text>
                </Pressable>
                <Pressable style={styles.smallPrimaryButton} onPress={() => router.push(`/expression/${expression.id}`)}>
                  <Text style={styles.smallPrimaryButtonText}>상세 보기</Text>
                </Pressable>
                <Pressable style={styles.smallSecondaryButton} onPress={() => router.push(`/expression/${expression.id}/practice`)}>
                  <Text style={styles.smallSecondaryButtonText}>바로 연습</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>조건에 맞는 표현이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
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
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  filterChip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  filterChipActive: {
    backgroundColor: "#dbeafe"
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "700"
  },
  filterChipTextActive: {
    color: "#1d4ed8"
  },
  expressionCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f8fbff"
  },
  recommendedCard: {
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff"
  },
  recommendLabel: {
    color: "#2563eb",
    fontWeight: "800",
    fontSize: 12
  },
  expressionKorean: {
    color: "#475569",
    lineHeight: 20
  },
  expressionBase: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 24
  },
  expressionSub: {
    color: "#334155",
    lineHeight: 20
  },
  quickSaveCard: {
    backgroundColor: "#0f172a",
    borderRadius: 22,
    padding: 18,
    gap: 6
  },
  quickSaveLabel: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  quickSaveTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800"
  },
  quickSaveText: {
    color: "#cbd5e1",
    lineHeight: 20
  },
  metaText: {
    color: "#64748b",
    lineHeight: 20
  },
  memoText: {
    color: "#0f172a",
    lineHeight: 20
  },
  priorityText: {
    color: "#1d4ed8",
    lineHeight: 20,
    fontWeight: "700"
  },
  playlistStatusText: {
    color: "#2563eb",
    fontWeight: "700",
    lineHeight: 20
  },
  cardActionRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12
  },
  smallPrimaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  smallPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  smallSecondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center"
  },
  smallSecondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800"
  },
  error: {
    color: "#dc2626",
    lineHeight: 20
  }
});

function getExpressionPriorityLabel(expression: ExpressionResponse) {
  if (!expression.ttsUrl) return "우선순위: TTS를 먼저 만들어 두면 듣기 학습이 쉬워집니다.";
  if ((expression.practiceCount ?? 0) === 0) return "우선순위: 아직 연습 전이라 첫 연습 후보입니다.";
  if ((expression.latestPracticeScore ?? 100) < 80) return "우선순위: 최근 점수가 낮아 다시 보는 편이 좋습니다.";
  return "우선순위: 저장된 표현으로 다시 듣기/연습하기 좋습니다.";
}
