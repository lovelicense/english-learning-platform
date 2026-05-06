import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  listAiConversationSessions,
  type AiConversationSessionResponse,
  type AiConversationTrackMode,
} from "../src/lib/api/ai-conversations";

type TrackKey = "english" | "korean";
type SessionSort = "recent" | "turns";

const TRACKS: Array<{
  key: TrackKey;
  mode: AiConversationTrackMode;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
}> = [
  {
    key: "english",
    mode: "ENGLISH_AI",
    title: "영어 연습 트랙",
    subtitle: "실제로 영어로 말해보고, 좋은 답변은 표현 자산으로 저장",
    description: "AI와 영어로 대화하면서 내 답변을 교정하고, 나중에 다이얼로그 연습으로 다시 쓸 수 있게 준비합니다.",
    cta: "영어 대화 시작",
  },
  {
    key: "korean",
    mode: "KOREAN_AI",
    title: "한국어 수집 트랙",
    subtitle: "내가 실제로 쓰는 한국어 문장을 모아 영어 학습으로 연결",
    description: "빠른 문장 저장, 대화 녹음과 나란한 수집 채널로 두고, 턴 단위 문장을 영어 표현 생성으로 연결합니다.",
    cta: "한국어 수집 시작",
  },
];

const TRACK_FLOW_STEPS: Record<TrackKey, string[]> = {
  english: [
    "AI와 영어로 실제로 이어서 답하기",
    "좋은 내 답변을 표현 자산으로 저장하기",
    "세션을 다이얼로그 연습으로 다시 쓰기",
  ],
  korean: [
    "AI와 한국어로 실제 문장 끌어내기",
    "내 턴을 저장하고 영어 표현 생성하기",
    "생성된 표현으로 연습/복습까지 짧게 잇기",
  ],
};

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

function summarizeSession(session: AiConversationSessionResponse) {
  if (session.turns.length > 0) {
    return session.turns[session.turns.length - 1]?.originalText ?? "최근 대화 내용이 없습니다.";
  }
  return session.userStartText ?? session.conversationTopic ?? session.goal ?? "아직 대화가 시작되지 않았습니다.";
}

export default function AiConversationHomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SessionSort>("recent");
  const [englishSessions, setEnglishSessions] = useState<AiConversationSessionResponse[]>([]);
  const [koreanSessions, setKoreanSessions] = useState<AiConversationSessionResponse[]>([]);

  const totalSessionCount = useMemo(() => englishSessions.length + koreanSessions.length, [englishSessions.length, koreanSessions.length]);

  const filteredEnglishSessions = useMemo(() => filterAndSortSessions(englishSessions, query, sort), [englishSessions, query, sort]);
  const filteredKoreanSessions = useMemo(() => filterAndSortSessions(koreanSessions, query, sort), [koreanSessions, query, sort]);

  const loadSessions = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const [english, korean] = await Promise.all([
        listAiConversationSessions("ENGLISH_AI"),
        listAiConversationSessions("KOREAN_AI"),
      ]);
      setEnglishSessions(english);
      setKoreanSessions(korean);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 대화 세션을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSessions();
    }, [loadSessions]),
  );

  function openTrackSetup(track: TrackKey) {
    router.push(`/ai-conversation/setup?track=${track}`);
  }

  function openSession(sessionId: string) {
    router.push(`/ai-conversation/${sessionId}`);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSessions(true)} tintColor="#2563eb" />}
    >
      <Text style={styles.eyebrow}>AI Conversation</Text>
      <Text style={styles.title}>연습 채널 + 수집 채널</Text>
      <Text style={styles.description}>
        웹의 AI 대시보드를 그대로 줄이지 않고, 모바일에서는 `영어 연습`과 `한국어 수집` 두 트랙으로 나눠 빠르게 들어가고 최근 세션을 바로 이어보는 구조로 정리합니다.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>지금 이 화면에서 하는 일</Text>
        <Text style={styles.heroText}>1. 영어 트랙은 실전 말하기 연습과 표현 자산화</Text>
        <Text style={styles.heroText}>2. 한국어 트랙은 실제 문장 수집과 영어 표현 생성 연결</Text>
        <Text style={styles.heroText}>3. 최근 세션을 다시 열어 다음 단계 구현 범위를 확인</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>현재 준비 상태</Text>
        <Text style={styles.summaryText}>등록된 AI 대화 세션: {totalSessionCount}개</Text>
        <Text style={styles.summaryText}>영어 세션 {englishSessions.length}개 · 한국어 세션 {koreanSessions.length}개</Text>
        <Text style={styles.summaryText}>지금 목표: 대화 자체보다 대화에서 저장, 연습까지 이어지는 연결을 더 짧게 만들기</Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/dialogue-practice")}>
            <Text style={styles.secondaryButtonText}>전체 다이얼로그 세트 보기</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>최근 세션 찾기</Text>
        <TextInput
          style={styles.input}
          placeholder="제목, 주제, 최근 대화 내용 검색"
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.filterRow}>
          <Pressable style={[styles.filterChip, sort === "recent" && styles.filterChipActive]} onPress={() => setSort("recent")}>
            <Text style={[styles.filterChipText, sort === "recent" && styles.filterChipTextActive]}>최근 수정순</Text>
          </Pressable>
          <Pressable style={[styles.filterChip, sort === "turns" && styles.filterChipActive]} onPress={() => setSort("turns")}>
            <Text style={[styles.filterChipText, sort === "turns" && styles.filterChipTextActive]}>turn 많은 순</Text>
          </Pressable>
        </View>
      </View>

      {TRACKS.map((track) => {
        const sessions = track.key === "english" ? filteredEnglishSessions : filteredKoreanSessions;
        const latestSession = sessions[0] ?? null;
        return (
          <View key={track.key} style={styles.card}>
            <View style={styles.trackHeader}>
              <View style={styles.trackHeading}>
                <Text style={styles.cardTitle}>{track.title}</Text>
                <Text style={styles.trackSubtitle}>{track.subtitle}</Text>
              </View>
              <Pressable style={styles.primaryButton} onPress={() => openTrackSetup(track.key)}>
                <Text style={styles.primaryButtonText}>{track.cta}</Text>
              </Pressable>
            </View>
            <Text style={styles.cardText}>{track.description}</Text>

            <View style={styles.flowCard}>
              <Text style={styles.flowTitle}>이 트랙에서 바로 이어지는 흐름</Text>
              {TRACK_FLOW_STEPS[track.key].map((step, index) => (
                <View key={`${track.key}-step-${index}`} style={styles.flowStepRow}>
                  <View style={styles.flowStepBadge}>
                    <Text style={styles.flowStepBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.flowStepText}>{step}</Text>
                </View>
              ))}
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>지금 이 트랙에서 먼저 할 일</Text>
              <Text style={styles.cardText}>
                {latestSession
                  ? track.key === "english"
                    ? "최근 영어 세션을 다시 열고, 내 답변이 있는 턴을 표현 저장 또는 다이얼로그 연습으로 이어보는 것이 가장 빠릅니다."
                    : "최근 한국어 세션을 다시 열고, 저장할 내 턴을 골라 영어 표현 생성으로 넘기는 것이 가장 빠릅니다."
                  : track.key === "english"
                    ? "첫 영어 세션을 만들어 AI와 몇 턴만 이어간 뒤, 좋은 답변 하나를 표현으로 저장하는 흐름부터 여는 게 좋습니다."
                    : "첫 한국어 세션을 만들어 실제로 쓰는 문장 하나를 저장하고 영어 표현 생성까지 이어보는 흐름부터 여는 게 좋습니다."}
              </Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.primaryButton} onPress={() => openTrackSetup(track.key)}>
                  <Text style={styles.primaryButtonText}>{track.cta}</Text>
                </Pressable>
                {latestSession ? (
                  <Pressable style={styles.secondaryButton} onPress={() => openSession(latestSession.id)}>
                    <Text style={styles.secondaryButtonText}>최근 세션 이어보기</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Text style={styles.sectionTitle}>최근 세션</Text>
            {loading ? (
              <ActivityIndicator color="#2563eb" />
            ) : sessions.length > 0 ? (
              sessions.slice(0, 5).map((session) => (
                <Pressable key={session.id} style={styles.sessionCard} onPress={() => openSession(session.id)}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTitle}>{session.title?.trim() || "제목 없는 세션"}</Text>
                    <Text style={styles.sessionMeta}>{formatRelativeDate(session.updatedAt)}</Text>
                  </View>
                  <Text style={styles.sessionMeta}>
                    {session.turns.length} turns · AI {session.aiOutputMode ?? "text"} · Me {session.userInputMode ?? "text"}
                  </Text>
                  <Text style={styles.sessionSnippet}>{summarizeSession(session)}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.helperText}>
                {track.key === "english"
                  ? "아직 영어 AI 세션이 없습니다. 첫 세션을 만들어 실전 영어 연습 흐름을 열 수 있습니다."
                  : "아직 한국어 AI 세션이 없습니다. 빠른 문장 저장과 나란한 수집 채널로 첫 세션을 시작해 보세요."}
              </Text>
            )}
          </View>
        );
      })}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>세션 조회 오류</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
    gap: 16,
  },
  eyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  description: {
    color: "#475569",
    lineHeight: 22,
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 22,
    gap: 8,
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
  },
  heroText: {
    color: "#cbd5e1",
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: "#ecfeff",
    borderRadius: 20,
    padding: 20,
    gap: 6,
  },
  summaryTitle: {
    color: "#134e4a",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryText: {
    color: "#134e4a",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  trackHeader: {
    gap: 12,
  },
  trackHeading: {
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  trackSubtitle: {
    color: "#0f766e",
    lineHeight: 20,
    fontWeight: "600",
  },
  flowCard: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 16,
    gap: 10,
  },
  flowTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  flowStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  flowStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ccfbf1",
  },
  flowStepBadgeText: {
    color: "#115e59",
    fontSize: 12,
    fontWeight: "800",
  },
  flowStepText: {
    flex: 1,
    color: "#334155",
    lineHeight: 20,
  },
  statusCard: {
    borderRadius: 16,
    backgroundColor: "#ecfeff",
    padding: 16,
    gap: 10,
  },
  statusTitle: {
    color: "#134e4a",
    fontSize: 16,
    fontWeight: "800",
  },
  cardText: {
    color: "#334155",
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionTitle: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sessionCard: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 16,
    gap: 6,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  sessionMeta: {
    color: "#64748b",
    lineHeight: 18,
  },
  sessionSnippet: {
    color: "#334155",
    lineHeight: 20,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  filterChipActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  helperText: {
    color: "#64748b",
    lineHeight: 20,
  },
  primaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  errorCard: {
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  errorTitle: {
    color: "#991b1b",
    fontWeight: "800",
  },
  errorText: {
    color: "#b91c1c",
    lineHeight: 20,
  },
});

function filterAndSortSessions(sessions: AiConversationSessionResponse[], query: string, sort: SessionSort) {
  const normalized = query.trim().toLowerCase();
  const filtered = !normalized
    ? sessions
    : sessions.filter((session) =>
        [session.title, session.conversationTopic, session.userStartText, summarizeSession(session)]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalized)),
      );

  return [...filtered].sort((a, b) => {
    if (sort === "turns") {
      if (b.turns.length !== a.turns.length) return b.turns.length - a.turns.length;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
