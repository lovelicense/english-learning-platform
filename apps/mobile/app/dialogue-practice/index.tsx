import { Audio } from "expo-av";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  listDialoguePracticeSets,
  updateDialoguePracticeSetTitle,
  type DialoguePracticeSetResponse,
} from "../../src/lib/api/ai-conversations";
import { mobileTheme } from "../../src/theme/colors";

type DialogueSort = "recent" | "turns";
const theme = mobileTheme.colors;

function formatRelativeDate(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return dateString;
  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function buildSearchText(set: DialoguePracticeSetResponse) {
  return [
    set.title,
    set.conversationTopic,
    set.situationDescription,
    set.userStartText,
    set.turns[0]?.aiPrompt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function DialoguePracticeLibraryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<DialogueSort>("recent");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [savingTitleId, setSavingTitleId] = useState("");
  const [practiceSets, setPracticeSets] = useState<DialoguePracticeSetResponse[]>([]);
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const soundRef = useRef<Audio.Sound | null>(null);

  const filteredSets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = !normalized ? practiceSets : practiceSets.filter((set) => buildSearchText(set).includes(normalized));
    return [...filtered].sort((left, right) => {
      if (sort === "turns" && right.turns.length !== left.turns.length) {
        return right.turns.length - left.turns.length;
      }
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }, [practiceSets, query, sort]);

  const loadSets = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const next = await listDialoguePracticeSets();
      setPracticeSets(next);
      setTitleDrafts(Object.fromEntries(next.map((set) => [set.id, set.title])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "다이얼로그 연습 세트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSets();
    }, [loadSets]),
  );

  useEffect(() => {
    return () => {
      void stopPlayback();
    };
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSets(true)} tintColor={theme.brand} />}
    >
      <Text style={styles.eyebrow}>다이얼로그 연습</Text>
      <Text style={styles.title}>전역 연습 세트 라이브러리</Text>
      <Text style={styles.description}>
        영어 AI 대화에서 저장한 모든 다이얼로그 세트를 한곳에서 다시 찾고, 제목을 정리하고, 바로 연습으로 이어갈 수 있습니다.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>현재 준비 상태</Text>
        <Text style={styles.summaryText}>등록된 세트: {practiceSets.length}개</Text>
        <Text style={styles.summaryText}>검색 결과: {filteredSets.length}개</Text>
        <Text style={styles.summaryText}>좋은 대화를 저장해두고, 나중에 짧게 다시 말해보는 재연습 라이브러리입니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세트 찾기</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="제목, 주제, 첫 질문으로 검색"
        />
        <View style={styles.inlineRow}>
          <Pressable style={[styles.filterChip, sort === "recent" && styles.filterChipActive]} onPress={() => setSort("recent")}>
            <Text style={[styles.filterChipText, sort === "recent" && styles.filterChipTextActive]}>최근 수정순</Text>
          </Pressable>
          <Pressable style={[styles.filterChip, sort === "turns" && styles.filterChipActive]} onPress={() => setSort("turns")}>
            <Text style={[styles.filterChipText, sort === "turns" && styles.filterChipTextActive]}>turn 많은 순</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>다이얼로그 연습 세트</Text>
        {loading ? (
          <ActivityIndicator color={theme.brand} />
        ) : filteredSets.length > 0 ? (
          filteredSets.map((set) => {
            const draft = titleDrafts[set.id] ?? "";
            const titleChanged = draft.trim() !== set.title.trim();
            return (
              <View key={set.id} style={styles.setCard}>
                <View style={styles.setHeader}>
                  <Text style={styles.setTitle}>{set.title}</Text>
                  <Text style={styles.setMeta}>{formatRelativeDate(set.updatedAt)}</Text>
                </View>
                <Text style={styles.setMeta}>
                  {set.turns.length} turns{set.conversationSessionId ? " · AI 세션 연결됨" : ""}
                </Text>
                {set.conversationTopic ? <Text style={styles.cardText}>주제: {set.conversationTopic}</Text> : null}
                {set.situationDescription ? <Text style={styles.cardText}>상황: {set.situationDescription}</Text> : null}
                {set.turns[0]?.aiPrompt ? <Text style={styles.promptPreview}>Q1. {set.turns[0].aiPrompt}</Text> : null}

                <View style={styles.editCard}>
                  <Text style={styles.editTitle}>제목 정리</Text>
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={(value) =>
                      setTitleDrafts((current) => ({
                        ...current,
                        [set.id]: value,
                      }))
                    }
                    placeholder="다이얼로그 제목"
                  />
                  <View style={styles.inlineRow}>
                    <Pressable
                      style={[styles.secondaryButton, (!draft.trim() || !titleChanged || savingTitleId === set.id) && styles.buttonDisabled]}
                      onPress={() => void handleSaveTitle(set.id)}
                      disabled={!draft.trim() || !titleChanged || savingTitleId === set.id}
                    >
                      {savingTitleId === set.id ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>제목 저장</Text>}
                    </Pressable>
                    <Pressable style={styles.ghostButton} onPress={() => router.push(`/dialogue-practice/${set.id}`)}>
                      <Text style={styles.ghostButtonText}>상세 / 연습 열기</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.inlineRow}>
                  {set.turns[0]?.aiPromptTtsUrl ? (
                    <Pressable
                      style={[styles.secondaryButton, playingKey === set.id && styles.buttonDisabled]}
                      onPress={() => void handlePlayPreview(set)}
                    >
                      <Text style={styles.secondaryButtonText}>{playingKey === set.id ? "재생 중..." : "첫 질문 듣기"}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.primaryButton} onPress={() => router.push(`/dialogue-practice/${set.id}`)}>
                    <Text style={styles.primaryButtonText}>연습 시작</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.helperText}>
            {query.trim() ? "검색 결과가 없습니다." : "아직 저장된 다이얼로그 연습 세트가 없습니다."}
          </Text>
        )}
      </View>

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );

  async function handleSaveTitle(id: string) {
    const title = titleDrafts[id]?.trim();
    if (!title) {
      setError("저장할 제목을 입력해 주세요.");
      return;
    }

    setSavingTitleId(id);
    setError("");
    setMessage("");
    try {
      const updated = await updateDialoguePracticeSetTitle(id, title);
      setPracticeSets((current) => current.map((item) => (item.id === id ? updated : item)));
      setTitleDrafts((current) => ({
        ...current,
        [id]: updated.title,
      }));
      setMessage("다이얼로그 제목을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "다이얼로그 제목 저장에 실패했습니다.");
    } finally {
      setSavingTitleId("");
    }
  }

  async function handlePlayPreview(set: DialoguePracticeSetResponse) {
    const previewUrl = set.turns[0]?.aiPromptTtsUrl;
    if (!previewUrl) return;
    try {
      if (playingKey === set.id) {
        await stopPlayback();
        return;
      }
      await stopPlayback();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlayingKey(null);
            void sound.unloadAsync();
            soundRef.current = null;
          }
        },
      );
      soundRef.current = sound;
      setPlayingKey(set.id);
    } catch (err) {
      setPlayingKey(null);
      setError(err instanceof Error ? err.message : "첫 질문 재생에 실패했습니다.");
    }
  }

  async function stopPlayback() {
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingKey(null);
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
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: theme.background,
    gap: 18,
  },
  eyebrow: {
    color: theme.brand,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
  },
  description: {
    color: theme.textSoft,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: theme.surfaceBrand,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.brandSoft,
  },
  summaryTitle: {
    color: theme.brandStrong,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryText: {
    color: theme.brandStrong,
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cardText: {
    color: theme.textSoft,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surfaceSoft,
    color: theme.text,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.surface,
  },
  filterChipActive: {
    backgroundColor: theme.brand,
    borderColor: theme.brand,
  },
  filterChipText: {
    color: theme.textSoft,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: theme.textOnBrand,
  },
  setCard: {
    borderRadius: 16,
    backgroundColor: theme.surfaceSoft,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  setTitle: {
    flex: 1,
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
  },
  setMeta: {
    color: theme.textMuted,
    lineHeight: 18,
  },
  promptPreview: {
    color: theme.textSoft,
    lineHeight: 21,
    fontSize: 15,
  },
  editCard: {
    borderRadius: 14,
    backgroundColor: theme.surface,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  editTitle: {
    color: theme.text,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.brand,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: theme.textOnBrand,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: theme.text,
    fontWeight: "700",
  },
  ghostButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ghostButtonText: {
    color: theme.text,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  helperText: {
    color: theme.textMuted,
    lineHeight: 20,
  },
  success: {
    color: theme.success,
    lineHeight: 20,
  },
  error: {
    color: theme.danger,
    lineHeight: 20,
  },
});
