import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { generateExpressionFromText } from "../src/lib/api/expressions";
import { listPersonProfiles } from "../src/lib/api/person-profiles";
import type { PersonProfileResponse } from "../src/lib/api/recordings";
import {
  buildRecordingContextPayload,
  EMPTY_RECORDING_CONTEXT,
  getRecentGenerationContext,
  hasRecordingContextValue,
  RELATIONSHIP_TEMPLATES,
  setRecentGenerationContext,
  SITUATION_TEMPLATES,
  TONE_TEMPLATES,
  type RecordingGenerationContext,
} from "../src/lib/recording-context";

export default function QuickSentenceScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [text, setText] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [personProfiles, setPersonProfiles] = useState<PersonProfileResponse[]>([]);
  const [selectedPersonProfileIds, setSelectedPersonProfileIds] = useState<string[]>([]);
  const [recentContext, setRecentContextState] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [contextDraft, setContextDraft] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);

  const hasContext = useMemo(() => hasRecordingContextValue(contextDraft), [contextDraft]);

  const loadScreen = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profiles, storedRecentContext] = await Promise.all([listPersonProfiles(), getRecentGenerationContext()]);
      setPersonProfiles(profiles);
      setRecentContextState(storedRecentContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "빠른 문장 저장 화면을 준비하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadScreen();
    }, [loadScreen]),
  );

  function togglePersonProfile(profileId: string) {
    setSelectedPersonProfileIds((current) =>
      current.includes(profileId) ? current.filter((item) => item !== profileId) : [...current, profileId],
    );
  }

  async function handleGenerate() {
    const koreanText = text.trim();
    if (!koreanText) {
      setError("저장할 한국어 문장을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const created = await generateExpressionFromText({
        koreanText,
        personProfileIds: selectedPersonProfileIds,
        ...buildRecordingContextPayload(contextDraft),
      });
      await setRecentGenerationContext(contextDraft);
      setRecentContextState(contextDraft);
      setMessage("문장을 저장하고 영어 표현을 생성했습니다.");
      setText("");
      setSelectedPersonProfileIds([]);
      setShowContext(false);
      setContextDraft(EMPTY_RECORDING_CONTEXT);
      router.push(`/expression/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.description}>빠른 문장 저장 화면을 준비하는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Quick Save</Text>
      <Text style={styles.description}>
        녹음 없이 한국어 문장을 먼저 남기고, 필요하면 맥락을 더해 바로 영어 표현으로 바꿉니다.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>모바일용 빠른 입력</Text>
        <Text style={styles.heroText}>짧은 문장 메모를 가장 빠르게 자산화하는 전용 화면입니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>한국어 문장</Text>
        <TextInput
          style={styles.textarea}
          multiline
          value={text}
          onChangeText={setText}
          placeholder="예: 버스 10분 뒤에 와."
        />

        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={() => setShowContext((current) => !current)} disabled={saving}>
            <Text style={styles.secondaryButtonText}>{showContext ? "맥락 입력 접기" : "맥락 추가"}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, !hasRecordingContextValue(recentContext) && styles.buttonDisabled]}
            onPress={() => {
              setContextDraft(recentContext);
              setShowContext(true);
            }}
            disabled={!hasRecordingContextValue(recentContext) || saving}
          >
            <Text style={styles.secondaryButtonText}>최근 맥락 다시 사용</Text>
          </Pressable>
        </View>

        {showContext ? (
          <View style={styles.contextBlock}>
            <Text style={styles.fieldLabel}>관련 인물 선택</Text>
            <View style={styles.buttonRow}>
              {personProfiles.length > 0 ? (
                personProfiles.map((profile) => {
                  const selected = selectedPersonProfileIds.includes(profile.id);
                  return (
                    <Pressable
                      key={profile.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => togglePersonProfile(profile.id)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {profile.name}
                        {profile.roleLabel ? ` (${profile.roleLabel})` : ""}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>등록된 인물이 없으면 Settings의 개인 인물 사전에서 먼저 추가할 수 있습니다.</Text>
              )}
            </View>

            <Text style={styles.fieldLabel}>관계</Text>
            <View style={styles.buttonRow}>
              {RELATIONSHIP_TEMPLATES.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, contextDraft.relationship === item && styles.chipSelected]}
                  onPress={() => setContextDraft((current) => ({ ...current, relationship: item }))}
                >
                  <Text style={[styles.chipText, contextDraft.relationship === item && styles.chipTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={contextDraft.relationship}
              onChangeText={(value) => setContextDraft((current) => ({ ...current, relationship: value }))}
              placeholder="대화 관계 예: 엄마 - 아이"
            />

            <Text style={styles.fieldLabel}>상황</Text>
            <View style={styles.buttonRow}>
              {SITUATION_TEMPLATES.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, contextDraft.situation === item && styles.chipSelected]}
                  onPress={() => setContextDraft((current) => ({ ...current, situation: item }))}
                >
                  <Text style={[styles.chipText, contextDraft.situation === item && styles.chipTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.textareaSmall}
              multiline
              value={contextDraft.situation}
              onChangeText={(value) => setContextDraft((current) => ({ ...current, situation: value }))}
              placeholder="상황 예: 아이가 늦잠을 자서 엄마가 서둘러 준비하라고 말하는 상황"
            />

            <Text style={styles.fieldLabel}>톤</Text>
            <View style={styles.buttonRow}>
              {TONE_TEMPLATES.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.chip, contextDraft.tone === item && styles.chipSelected]}
                  onPress={() => setContextDraft((current) => ({ ...current, tone: item }))}
                >
                  <Text style={[styles.chipText, contextDraft.tone === item && styles.chipTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={contextDraft.tone}
              onChangeText={(value) => setContextDraft((current) => ({ ...current, tone: value }))}
              placeholder="톤 예: 자연스럽고 부드럽게"
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.primaryButton, (!text.trim() || saving) && styles.buttonDisabled]}
            onPress={() => void handleGenerate()}
            disabled={!text.trim() || saving}
          >
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>저장 후 표현 생성</Text>}
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setText("");
              setSelectedPersonProfileIds([]);
              setShowContext(false);
              setContextDraft(EMPTY_RECORDING_CONTEXT);
              setError("");
              setMessage("");
            }}
            disabled={saving}
          >
            <Text style={styles.secondaryButtonText}>입력 초기화</Text>
          </Pressable>
        </View>
        {hasContext ? <Text style={styles.helperText}>이번 맥락은 생성 후 최근 맥락으로 다시 저장됩니다.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    padding: 24,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
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
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroText: {
    color: "#cbd5e1",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  fieldLabel: {
    color: "#0f172a",
    fontWeight: "700",
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 16,
    minHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    textAlignVertical: "top",
  },
  textareaSmall: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
    textAlignVertical: "top",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  chip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  chipSelected: {
    backgroundColor: "#dbeafe",
  },
  chipText: {
    color: "#334155",
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#1d4ed8",
  },
  contextBlock: {
    gap: 12,
  },
  helperText: {
    color: "#64748b",
    lineHeight: 20,
  },
  error: {
    color: "#dc2626",
    lineHeight: 20,
  },
  success: {
    color: "#15803d",
    lineHeight: 20,
  },
});
