import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createAiConversationSession, type AiConversationIoMode, type AiConversationTrackMode } from "../../src/lib/api/ai-conversations";

type TrackKey = "english" | "korean";

function resolveTrackMode(track?: string): AiConversationTrackMode {
  return track === "korean" ? "KOREAN_AI" : "ENGLISH_AI";
}

export default function AiConversationSetupScreen() {
  const params = useLocalSearchParams<{ track?: string }>();
  const track = (params.track === "korean" ? "korean" : "english") as TrackKey;
  const mode = resolveTrackMode(params.track);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [userRole, setUserRole] = useState("");
  const [aiRole, setAiRole] = useState("");
  const [topic, setTopic] = useState("");
  const [situation, setSituation] = useState("");
  const [starter, setStarter] = useState("");
  const [aiOutputMode, setAiOutputMode] = useState<AiConversationIoMode>("text");
  const [userInputMode, setUserInputMode] = useState<AiConversationIoMode>("text");

  const trackCopy = useMemo(() => {
    if (track === "korean") {
      return {
        title: "한국어 수집 시작",
        description: "내가 실제로 쓰는 한국어 문장을 자연스럽게 끌어내기 위한 세션입니다. 대화 전체보다 턴 단위 저장과 영어 표현 생성 연결이 더 중요합니다.",
        helper: "예: AI는 친구 역할로 가볍게 질문하고, 나는 실제 생활에서 쓰는 한국어로 답하기",
      };
    }

    return {
      title: "영어 연습 시작",
      description: "AI와 실제로 영어로 말해보는 세션입니다. 좋은 답변은 표현 자산으로 저장하고, 나중에 다이얼로그 연습으로 이어갈 수 있게 준비합니다.",
      helper: "예: AI는 면접관 역할, 나는 지원자 역할로 영어로 답하기",
    };
  }, [track]);

  async function handleCreateSession() {
    setSaving(true);
    setError("");
    try {
      const session = await createAiConversationSession({
        mode,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(userRole.trim() ? { userRole: userRole.trim() } : {}),
        ...(aiRole.trim() ? { aiRole: aiRole.trim() } : {}),
        ...(topic.trim() ? { conversationTopic: topic.trim() } : {}),
        ...(situation.trim() ? { situationDescription: situation.trim() } : {}),
        ...(starter.trim() ? { userStartText: starter.trim() } : {}),
        aiOutputMode,
        userInputMode,
      });
      router.replace(`/ai-conversation/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "새 AI 대화 세션을 만들지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>{track === "english" ? "English Track" : "Korean Track"}</Text>
      <Text style={styles.title}>{trackCopy.title}</Text>
      <Text style={styles.description}>{trackCopy.description}</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>세션 준비 포인트</Text>
        <Text style={styles.heroText}>{trackCopy.helper}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>기본 설정</Text>
        <TextInput style={styles.input} placeholder="세션 제목" value={title} onChangeText={setTitle} />
        <TextInput style={styles.input} placeholder="나의 역할" value={userRole} onChangeText={setUserRole} />
        <TextInput style={styles.input} placeholder="AI 역할" value={aiRole} onChangeText={setAiRole} />
        <TextInput style={styles.input} placeholder="주제" value={topic} onChangeText={setTopic} />
        <TextInput
          style={styles.textarea}
          multiline
          placeholder="상황 설명"
          value={situation}
          onChangeText={setSituation}
        />
        <TextInput
          style={styles.textareaSmall}
          multiline
          placeholder={track === "english" ? "첫 영어 답변이나 시작 문장" : "첫 한국어 문장 또는 시작 문장"}
          value={starter}
          onChangeText={setStarter}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>응답 방식</Text>
        <Text style={styles.fieldLabel}>AI 응답 방식</Text>
        <View style={styles.row}>
          {(["text", "voice"] as AiConversationIoMode[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, aiOutputMode === value && styles.chipSelected]}
              onPress={() => setAiOutputMode(value)}
            >
              <Text style={[styles.chipText, aiOutputMode === value && styles.chipTextSelected]}>
                {value === "text" ? "텍스트" : "AI 음성"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>내 답변 방식</Text>
        <View style={styles.row}>
          {(["text", "voice"] as AiConversationIoMode[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, userInputMode === value && styles.chipSelected]}
              onPress={() => setUserInputMode(value)}
            >
              <Text style={[styles.chipText, userInputMode === value && styles.chipTextSelected]}>
                {value === "text" ? "텍스트" : "내 음성"}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.primaryButton, saving && styles.buttonDisabled]} onPress={() => void handleCreateSession()} disabled={saving}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>세션 만들기</Text>}
        </Pressable>
      </View>
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  fieldLabel: {
    color: "#334155",
    fontWeight: "700",
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
  textarea: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 100,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  textareaSmall: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 72,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  chipSelected: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  chipText: {
    color: "#334155",
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#ffffff",
  },
  primaryButton: {
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  error: {
    color: "#b91c1c",
    lineHeight: 20,
  },
});
