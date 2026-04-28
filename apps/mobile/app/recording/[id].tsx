import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  generateExpressionForUtterance,
  generateExpressionTts,
  listExpressions,
  type ExpressionResponse,
} from "../../src/lib/api/expressions";
import {
  deleteRecordingUtterance,
  fetchRecording,
  type RecordingResponse,
  updateRecordingMineSpeaker,
  updateRecordingUtterance,
} from "../../src/lib/api/recordings";

export default function RecordingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const recordingId = params.id ?? "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState<RecordingResponse | null>(null);
  const [utteranceDrafts, setUtteranceDrafts] = useState<Record<string, string>>({});
  const [savingUtteranceId, setSavingUtteranceId] = useState("");
  const [deletingUtteranceId, setDeletingUtteranceId] = useState("");
  const [mineSpeakerLoading, setMineSpeakerLoading] = useState("");
  const [expressions, setExpressions] = useState<ExpressionResponse[]>([]);
  const [expressionLoadingId, setExpressionLoadingId] = useState("");
  const [ttsLoadingId, setTtsLoadingId] = useState("");
  const [playingExpressionId, setPlayingExpressionId] = useState("");

  const expressionSoundRef = useRef<Audio.Sound | null>(null);

  const utteranceCount = recording?.utterances.length ?? 0;
  const speakers = useMemo(() => {
    const labels = new Set((recording?.utterances ?? []).map((item) => item.speakerLabel));
    return Array.from(labels);
  }, [recording?.utterances]);
  const recordingExpressions = useMemo(() => {
    const utteranceIds = new Set((recording?.utterances ?? []).map((item) => item.id));
    return expressions.filter((item) => item.utteranceId && utteranceIds.has(item.utteranceId));
  }, [expressions, recording?.utterances]);

  const loadRecording = useCallback(async (showRefreshing = false) => {
    if (!recordingId) {
      setError("녹음 id가 없습니다.");
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
      const next = await fetchRecording(recordingId);
      setRecording(next);
      setUtteranceDrafts(Object.fromEntries(next.utterances.map((item) => [item.id, item.koreanText])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 상세 조회에 실패했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [recordingId]);

  const loadExpressions = useCallback(async () => {
    const list = await listExpressions();
    setExpressions(list);
  }, []);

  useEffect(() => {
    void loadRecording();
  }, [loadRecording]);

  useEffect(() => {
    void loadExpressions().catch(() => {
      // Recording detail can still work without expression list on first render.
    });
  }, [loadExpressions]);

  useEffect(() => {
    return () => {
      void stopExpressionPlayback();
    };
  }, []);

  async function handleSaveUtterance(utteranceId: string) {
    const current = recording?.utterances.find((item) => item.id === utteranceId);
    if (!current) return;

    const draft = (utteranceDrafts[utteranceId] ?? current.koreanText).trim();
    if (!draft) {
      setError("수정할 문장을 입력해 주세요.");
      return;
    }

    setSavingUtteranceId(utteranceId);
    setError("");
    setMessage("");

    try {
      const updated = await updateRecordingUtterance(utteranceId, {
        koreanText: draft,
      });
      setRecording((currentRecording) => {
        if (!currentRecording) return currentRecording;
        return {
          ...currentRecording,
          utterances: currentRecording.utterances.map((item) =>
            item.id === utteranceId
              ? {
                  ...item,
                  koreanText: updated.koreanText,
                  speakerLabel: updated.speakerLabel,
                  isMine: updated.isMine,
                  contextNote: updated.contextNote,
                  analysisIntent: updated.analysisIntent,
                }
              : item,
          ),
          analysisStatus: "NEEDS_REVIEW",
          analysisStatusReason: "UTTERANCE_UPDATED",
        };
      });
      setUtteranceDrafts((currentDrafts) => ({
        ...currentDrafts,
        [utteranceId]: updated.koreanText,
      }));
      setMessage("문장을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 저장에 실패했습니다.");
    } finally {
      setSavingUtteranceId("");
    }
  }

  async function handleDeleteUtterance(utteranceId: string) {
    setDeletingUtteranceId(utteranceId);
    setError("");
    setMessage("");

    try {
      await deleteRecordingUtterance(utteranceId, true);
      setRecording((currentRecording) => {
        if (!currentRecording) return currentRecording;
        return {
          ...currentRecording,
          utterances: currentRecording.utterances.filter((item) => item.id !== utteranceId),
          analysisStatus: "NEEDS_REVIEW",
          analysisStatusReason: "UTTERANCE_DELETED",
        };
      });
      setUtteranceDrafts((currentDrafts) => {
        const next = { ...currentDrafts };
        delete next[utteranceId];
        return next;
      });
      setMessage("문장을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 삭제에 실패했습니다.");
    } finally {
      setDeletingUtteranceId("");
    }
  }

  async function handleSelectMineSpeaker(speakerLabel: string) {
    if (!recording?.id) return;

    setMineSpeakerLoading(speakerLabel);
    setError("");
    setMessage("");

    try {
      const updated = await updateRecordingMineSpeaker(recording.id, speakerLabel);
      setRecording(updated);
      setUtteranceDrafts(Object.fromEntries(updated.utterances.map((item) => [item.id, item.koreanText])));
      setMessage(`${speakerLabel}를 내 화자로 지정했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 화자 설정에 실패했습니다.");
    } finally {
      setMineSpeakerLoading("");
    }
  }

  async function handleGenerateExpression(utteranceId: string) {
    if (!recording) return;

    setExpressionLoadingId(utteranceId);
    setError("");
    setMessage("");

    try {
      const created = await generateExpressionForUtterance(utteranceId, {
        relationship: recording.analysisRelationship ?? undefined,
        situation: recording.analysisSituation ?? undefined,
        tone: recording.analysisTone ?? undefined,
      });
      setExpressions((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setMessage("영어 표현을 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "영어 표현 생성에 실패했습니다.");
    } finally {
      setExpressionLoadingId("");
    }
  }

  async function handleGenerateTts(expressionId: string) {
    setTtsLoadingId(expressionId);
    setError("");
    setMessage("");

    try {
      const tts = await generateExpressionTts(expressionId);
      setExpressions((current) =>
        current.map((item) =>
          item.id === expressionId
            ? {
                ...item,
                ttsKey: tts.ttsKey,
                ttsUrl: tts.ttsUrl,
                koreanTtsKey: tts.koreanTtsKey,
                koreanTtsUrl: tts.koreanTtsUrl,
              }
            : item,
        ),
      );
      setMessage("TTS를 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS 생성에 실패했습니다.");
    } finally {
      setTtsLoadingId("");
    }
  }

  async function handlePlayExpression(expression: ExpressionResponse) {
    if (!expression.ttsUrl) {
      setError("먼저 TTS를 생성해 주세요.");
      return;
    }

    setError("");
    setMessage("");

    try {
      if (playingExpressionId === expression.id) {
        await stopExpressionPlayback();
        return;
      }

      await stopExpressionPlayback();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: expression.ttsUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlayingExpressionId("");
            void sound.unloadAsync();
            expressionSoundRef.current = null;
          }
        },
      );
      expressionSoundRef.current = sound;
      setPlayingExpressionId(expression.id);
    } catch (err) {
      setPlayingExpressionId("");
      setError(err instanceof Error ? err.message : "TTS 재생에 실패했습니다.");
    }
  }

  async function stopExpressionPlayback() {
    const sound = expressionSoundRef.current;
    expressionSoundRef.current = null;
    setPlayingExpressionId("");
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
        <Text style={styles.description}>녹음 결과를 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Recording Detail</Text>
      <Text style={styles.description}>녹음 상세에서 STT와 diarization 결과를 먼저 확인합니다.</Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>뒤로</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void loadRecording(true)} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>새로고침</Text>}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void loadExpressions()}>
          <Text style={styles.secondaryButtonText}>표현 새로고침</Text>
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
        <Text style={styles.cardTitle}>기본 정보</Text>
        <Text style={styles.cardText}>recordingId: {recording?.id ?? "-"}</Text>
        <Text style={styles.cardText}>status: {recording?.status ?? "-"}</Text>
        <Text style={styles.cardText}>fileName: {recording?.fileName ?? "-"}</Text>
        <Text style={styles.cardText}>diarization: {recording?.diarization ? "on" : "off"}</Text>
        <Text style={styles.cardText}>문장 수: {utteranceCount}</Text>
        <Text style={styles.cardText}>화자 수: {speakers.length}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>처리 상태</Text>
        <Text style={styles.cardText}>analysisStatus: {recording?.analysisStatus ?? "NOT_ANALYZED"}</Text>
        {recording?.analysisStatusReason ? <Text style={styles.cardText}>reason: {recording.analysisStatusReason}</Text> : null}
        {recording?.status !== "PROCESSED" ? (
          <Text style={styles.metaText}>아직 worker 처리 중일 수 있습니다. 잠시 뒤 새로고침해 주세요.</Text>
        ) : null}
        {recording?.status === "PROCESSED" && utteranceCount === 0 ? (
          <Text style={styles.metaText}>처리는 끝났지만 아직 문장이 없습니다. 업로드 파일 상태를 다시 확인해 보세요.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>대화 요약 / 맥락</Text>
        <Text style={styles.cardText}>요약: {recording?.analysisSummary?.trim() || "아직 요약이 없습니다."}</Text>
        <Text style={styles.cardText}>관계: {recording?.analysisRelationship?.trim() || "-"}</Text>
        <Text style={styles.cardText}>상황: {recording?.analysisSituation?.trim() || "-"}</Text>
        <Text style={styles.cardText}>톤: {recording?.analysisTone?.trim() || "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>화자 목록</Text>
        {speakers.length > 0 ? (
          speakers.map((speakerLabel) => {
            const mine = recording?.utterances.some((item) => item.speakerLabel === speakerLabel && item.isMine);
            return (
              <Pressable
                key={speakerLabel}
                style={[styles.speakerChip, mine && styles.speakerChipActive]}
                onPress={() => void handleSelectMineSpeaker(speakerLabel)}
                disabled={mineSpeakerLoading.length > 0}
              >
                {mineSpeakerLoading === speakerLabel ? (
                  <ActivityIndicator color={mine ? "#ffffff" : "#1d4ed8"} />
                ) : (
                  <Text style={[styles.speakerChipText, mine && styles.speakerChipTextActive]}>
                    {speakerLabel}
                    {mine ? " · 내 화자" : ""}
                  </Text>
                )}
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.metaText}>아직 식별된 화자가 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>STT 문장 목록</Text>
        {utteranceCount > 0 ? (
          recording?.utterances.map((utterance, index) => (
            <View key={utterance.id} style={styles.utteranceCard}>
              <Text style={styles.utteranceHeader}>
                {index + 1}. {utterance.speakerLabel}
                {utterance.isMine ? " · 내 화자" : ""}
              </Text>
              <Text style={styles.utteranceTiming}>
                {formatTimeline(utterance.startMs)} - {formatTimeline(utterance.endMs)}
              </Text>
              <TextInput
                style={styles.utteranceInput}
                multiline
                value={utteranceDrafts[utterance.id] ?? utterance.koreanText}
                onChangeText={(text) =>
                  setUtteranceDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [utterance.id]: text,
                  }))
                }
              />
              {utterance.analysisIntent ? <Text style={styles.metaText}>의도: {utterance.analysisIntent}</Text> : null}
              {utterance.contextNote ? <Text style={styles.metaText}>메모: {utterance.contextNote}</Text> : null}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.smallPrimaryButton, savingUtteranceId === utterance.id && styles.buttonDisabled]}
                  onPress={() => void handleSaveUtterance(utterance.id)}
                  disabled={savingUtteranceId === utterance.id || deletingUtteranceId === utterance.id}
                >
                  {savingUtteranceId === utterance.id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.smallPrimaryButtonText}>문장 저장</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.smallDangerButton, deletingUtteranceId === utterance.id && styles.buttonDisabled]}
                  onPress={() => void handleDeleteUtterance(utterance.id)}
                  disabled={savingUtteranceId === utterance.id || deletingUtteranceId === utterance.id}
                >
                  {deletingUtteranceId === utterance.id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.smallPrimaryButtonText}>삭제</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.smallPrimaryButton, expressionLoadingId === utterance.id && styles.buttonDisabled]}
                  onPress={() => void handleGenerateExpression(utterance.id)}
                  disabled={expressionLoadingId === utterance.id}
                >
                  {expressionLoadingId === utterance.id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.smallPrimaryButtonText}>영어 표현 생성</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>아직 표시할 문장이 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>생성된 영어 표현</Text>
        {recordingExpressions.length > 0 ? (
          recordingExpressions.map((expression) => (
            <View key={expression.id} style={styles.expressionCard}>
              <Text style={styles.expressionKorean}>{expression.koreanText}</Text>
              <Text style={styles.expressionBase}>{expression.englishBase}</Text>
              <Text style={styles.expressionSub}>easy: {expression.englishEasy}</Text>
              <Text style={styles.expressionSub}>natural: {expression.englishNatural}</Text>
              {expression.note ? <Text style={styles.metaText}>note: {expression.note}</Text> : null}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.smallPrimaryButton, ttsLoadingId === expression.id && styles.buttonDisabled]}
                  onPress={() => void handleGenerateTts(expression.id)}
                  disabled={ttsLoadingId === expression.id}
                >
                  {ttsLoadingId === expression.id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.smallPrimaryButtonText}>{expression.ttsUrl ? "TTS 재생성" : "TTS 생성"}</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.smallPrimaryButton, !expression.ttsUrl && styles.buttonDisabled]}
                  onPress={() => void handlePlayExpression(expression)}
                  disabled={!expression.ttsUrl}
                >
                  <Text style={styles.smallPrimaryButtonText}>
                    {playingExpressionId === expression.id ? "정지" : "TTS 재생"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>아직 이 녹음에서 생성된 영어 표현이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function formatTimeline(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
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
    borderRadius: 24,
    padding: 20,
    gap: 10
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a"
  },
  cardText: {
    color: "#334155",
    lineHeight: 21
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
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
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
  speakerChip: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start"
  },
  speakerChipActive: {
    backgroundColor: "#2563eb"
  },
  speakerChipText: {
    color: "#1d4ed8",
    fontWeight: "700"
  },
  speakerChipTextActive: {
    color: "#ffffff"
  },
  utteranceCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
    gap: 6
  },
  utteranceHeader: {
    color: "#0f172a",
    fontWeight: "800"
  },
  utteranceTiming: {
    color: "#64748b",
    fontSize: 12
  },
  utteranceText: {
    color: "#0f172a",
    lineHeight: 22,
    fontSize: 15
  },
  utteranceInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 84,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    textAlignVertical: "top"
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap"
  },
  smallPrimaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  smallDangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center"
  },
  smallPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  expressionCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f8fbff"
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
  }
});
