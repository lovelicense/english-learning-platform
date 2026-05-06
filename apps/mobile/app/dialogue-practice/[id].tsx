import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  listDialoguePracticeSets,
  transcribeAiConversationAudio,
  updateDialoguePracticeSetTitle,
  type DialoguePracticeSetResponse,
} from "../../src/lib/api/ai-conversations";

type PracticeAnswerMode = "voice" | "text";
type RecordedClip = {
  uri: string;
  durationMs: number;
  fileName: string;
  contentType?: string | null;
};

export default function DialoguePracticeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const practiceSetId = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [practiceSet, setPracticeSet] = useState<DialoguePracticeSetResponse | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(true);
  const [answerMode, setAnswerMode] = useState<PracticeAnswerMode>("text");
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const turns = practiceSet?.turns ?? [];
  const currentTurn = turns[currentTurnIndex] ?? null;
  const visibleTurns = started ? turns.slice(0, currentTurnIndex + 1) : [];
  const currentAnswer = currentTurn ? answerDrafts[currentTurn.id] ?? "" : "";
  const clipDurationLabel = useMemo(
    () => formatDurationMs(isRecording ? recordingElapsedMs : recordedClip?.durationMs),
    [isRecording, recordingElapsedMs, recordedClip?.durationMs],
  );

  const loadPracticeSet = useCallback(async () => {
    if (!practiceSetId) {
      setError("다이얼로그 연습 세트 id가 없습니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const sets = await listDialoguePracticeSets();
      const found = sets.find((item) => item.id === practiceSetId) ?? null;
      if (!found) {
        throw new Error("다이얼로그 연습 세트를 찾을 수 없습니다.");
      }
      setPracticeSet(found);
      setTitleDraft(found.title);
      setCurrentTurnIndex(0);
      setStarted(false);
      setRevealAnswer(false);
      setAnswerMode("text");
      setAnswerDrafts({});
      setRecordedClip(null);
      setRecordingElapsedMs(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "다이얼로그 연습 세트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [practiceSetId]);

  useFocusEffect(
    useCallback(() => {
      void loadPracticeSet();
    }, [loadPracticeSet]),
  );

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      void Speech.stop();
      void stopPlayback();
      void releaseActiveRecording();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.helperText}>다이얼로그 연습 세트를 준비하는 중입니다.</Text>
      </View>
    );
  }

  if (!practiceSet || !currentTurn) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || "다이얼로그 연습 세트를 찾지 못했습니다."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Dialogue Practice</Text>
      <Text style={styles.title}>{practiceSet.title}</Text>
      <Text style={styles.description}>영어 AI 대화에서 저장한 세트를 turn 순서대로 다시 말해보는 모바일 연습 화면입니다.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세트 제목</Text>
        <TextInput
          style={styles.textInput}
          value={titleDraft}
          onChangeText={setTitleDraft}
          placeholder="다이얼로그 제목"
        />
        <View style={styles.inlineRow}>
          <Pressable
            style={[styles.secondaryButton, (!titleDraft.trim() || savingTitle || titleDraft.trim() === practiceSet.title.trim()) && styles.buttonDisabled]}
            onPress={() => void handleSaveTitle()}
            disabled={!titleDraft.trim() || savingTitle || titleDraft.trim() === practiceSet.title.trim()}
          >
            {savingTitle ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>제목 저장</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/dialogue-practice")}>
            <Text style={styles.secondaryButtonText}>전체 세트 보기</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>연습 세트 정보</Text>
        <Text style={styles.cardText}>총 turn: {turns.length}</Text>
        {practiceSet.conversationTopic ? <Text style={styles.cardText}>주제: {practiceSet.conversationTopic}</Text> : null}
        {practiceSet.situationDescription ? <Text style={styles.cardText}>상황: {practiceSet.situationDescription}</Text> : null}
        {practiceSet.userStartText ? <Text style={styles.cardText}>대화 시작문: {practiceSet.userStartText}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>연습 옵션</Text>
        <View style={styles.inlineRow}>
          <Pressable
            style={[styles.filterChip, !showAiPrompt && styles.filterChipActive]}
            onPress={() => setShowAiPrompt(false)}
          >
            <Text style={[styles.filterChipText, !showAiPrompt && styles.filterChipTextActive]}>AI 질문 숨기기</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, showAiPrompt && styles.filterChipActive]}
            onPress={() => setShowAiPrompt(true)}
          >
            <Text style={[styles.filterChipText, showAiPrompt && styles.filterChipTextActive]}>AI 질문 보기</Text>
          </Pressable>
        </View>
        <View style={styles.inlineRow}>
          <Pressable
            style={[styles.filterChip, answerMode === "text" && styles.filterChipActive]}
            onPress={() => setAnswerMode("text")}
          >
            <Text style={[styles.filterChipText, answerMode === "text" && styles.filterChipTextActive]}>텍스트 답변</Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, answerMode === "voice" && styles.filterChipActive]}
            onPress={() => setAnswerMode("voice")}
          >
            <Text style={[styles.filterChipText, answerMode === "voice" && styles.filterChipTextActive]}>음성 답변(STT)</Text>
          </Pressable>
        </View>
      </View>

      {!started ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>다이얼로그 시작</Text>
          <Text style={styles.cardText}>시작 버튼을 누르면 첫 번째 AI 질문을 기준으로 연습을 시작합니다.</Text>
          <Pressable style={styles.primaryButton} onPress={() => void handleBeginPractice()}>
            <Text style={styles.primaryButtonText}>시작</Text>
          </Pressable>
        </View>
      ) : null}

      {started ? (
        <View style={styles.card}>
          <View style={styles.progressHead}>
            <Text style={styles.cardTitle}>다이얼로그 플레이어</Text>
            <Text style={styles.progressBadge}>
              {currentTurn.sequence}/{turns.length}
            </Text>
          </View>

          {visibleTurns.map((turn, index) => {
            const isCurrentTurn = turn.id === currentTurn.id;
            const savedAnswer = answerDrafts[turn.id]?.trim() ?? "";

            return (
              <View key={turn.id} style={styles.timelineBlock}>
                <View style={[styles.turnCard, styles.aiTurnCard]}>
                  <Text style={styles.turnMeta}>AI 질문 · {turn.sequence} turn</Text>
                  {showAiPrompt ? (
                    <Text style={styles.turnText}>{turn.aiPrompt}</Text>
                  ) : (
                    <Text style={styles.turnHint}>AI 질문 영어 문장은 현재 숨김 상태입니다.</Text>
                  )}
                  {turn.aiPromptTtsUrl ? (
                    <Pressable
                      style={[styles.secondaryButton, playingKey === turn.id && styles.buttonDisabled]}
                      onPress={() => void playAudio(turn.id, turn.aiPromptTtsUrl ?? "")}
                    >
                      <Text style={styles.secondaryButtonText}>{playingKey === turn.id ? "재생 중..." : "질문 듣기"}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {isCurrentTurn ? (
                  <View style={[styles.turnCard, styles.userTurnCard]}>
                    <Text style={styles.turnMeta}>내 답변 연습</Text>
                    {answerMode === "text" ? (
                      <TextInput
                        style={styles.textarea}
                        multiline
                        placeholder="여기에 직접 답해보세요"
                        value={currentAnswer}
                        onChangeText={(value) => updateAnswerDraft(turn.id, value)}
                      />
                    ) : (
                      <>
                        <Text style={styles.cardText}>권한 상태: {formatPermissionLabel(recordingPermission)}</Text>
                        <Text style={styles.cardText}>
                          {recordedClip
                            ? `준비된 음성 답변 길이: ${clipDurationLabel}. STT 전사 후 수정해서 저장할 수 있습니다.`
                            : "음성으로 답한 뒤 STT 전사본을 확인하고 답변으로 저장합니다."}
                        </Text>
                        <View style={styles.inlineRow}>
                          <Pressable
                            style={[styles.primaryButton, (recordingBusy || isRecording) && styles.buttonDisabled]}
                            onPress={() => void handleStartRecording()}
                            disabled={recordingBusy || isRecording}
                          >
                            {recordingBusy && !isRecording ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>녹음 시작</Text>}
                          </Pressable>
                          <Pressable
                            style={[styles.secondaryButton, (!isRecording || recordingBusy) && styles.buttonDisabled]}
                            onPress={() => void handleStopRecording()}
                            disabled={!isRecording || recordingBusy}
                          >
                            {recordingBusy && isRecording ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>녹음 종료</Text>}
                          </Pressable>
                          <Pressable
                            style={[styles.secondaryButton, (!recordedClip || transcribing || isRecording) && styles.buttonDisabled]}
                            onPress={() => void handleTranscribeVoice(turn.id)}
                            disabled={!recordedClip || transcribing || isRecording}
                          >
                            {transcribing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>STT 전사</Text>}
                          </Pressable>
                        </View>
                        <TextInput
                          style={styles.textarea}
                          multiline
                          placeholder="STT 결과가 여기에 들어갑니다. 필요하면 수정할 수 있습니다."
                          value={currentAnswer}
                          onChangeText={(value) => updateAnswerDraft(turn.id, value)}
                        />
                      </>
                    )}

                    <View style={styles.inlineRow}>
                      <Pressable style={styles.secondaryButton} onPress={() => setRevealAnswer((current) => !current)}>
                        <Text style={styles.secondaryButtonText}>{revealAnswer ? "정답 숨기기" : "정답 보기"}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.primaryButton, currentTurnIndex >= turns.length - 1 && styles.buttonDisabled]}
                        onPress={() => void handleMoveTurn("next")}
                        disabled={currentTurnIndex >= turns.length - 1}
                      >
                        <Text style={styles.primaryButtonText}>다음 turn</Text>
                      </Pressable>
                    </View>

                    {revealAnswer ? (
                      <View style={styles.answerRevealCard}>
                        <Text style={styles.turnHint}>정답: {turn.expectedUserAnswer}</Text>
                        {turn.expectedUserAnswerAlt ? <Text style={styles.turnHint}>대안: {turn.expectedUserAnswerAlt}</Text> : null}
                        {turn.hint ? <Text style={styles.turnHint}>힌트: {turn.hint}</Text> : null}
                        {turn.explanation ? <Text style={styles.turnHint}>설명: {turn.explanation}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={[styles.turnCard, styles.userTurnCard]}>
                    <Text style={styles.turnMeta}>내 연습 답변</Text>
                    <Text style={styles.turnText}>{savedAnswer || "이 turn에서 저장된 연습 답변이 없습니다."}</Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.inlineRow}>
            <Pressable
              style={[styles.secondaryButton, currentTurnIndex <= 0 && styles.buttonDisabled]}
              onPress={() => void handleMoveTurn("prev")}
              disabled={currentTurnIndex <= 0}
            >
              <Text style={styles.secondaryButtonText}>이전 turn</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, currentTurnIndex >= turns.length - 1 && styles.buttonDisabled]}
              onPress={() => void handleMoveTurn("next")}
              disabled={currentTurnIndex >= turns.length - 1}
            >
              <Text style={styles.secondaryButtonText}>다음 turn</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );

  function updateAnswerDraft(turnId: string, value: string) {
    setAnswerDrafts((current) => ({
      ...current,
      [turnId]: value,
    }));
  }

  async function handleBeginPractice() {
    if (!currentTurn) return;
    setStarted(true);
    setRevealAnswer(false);
    setMessage("첫 번째 AI 질문을 기준으로 다이얼로그 연습을 시작합니다.");
    if (currentTurn.aiPromptTtsUrl) {
      await playAudio(currentTurn.id, currentTurn.aiPromptTtsUrl);
    }
  }

  async function handleMoveTurn(direction: "prev" | "next") {
    if (!practiceSet) return;
    const nextIndex =
      direction === "prev"
        ? Math.max(0, currentTurnIndex - 1)
        : Math.min(practiceSet.turns.length - 1, currentTurnIndex + 1);
    setCurrentTurnIndex(nextIndex);
    setRevealAnswer(false);
    setRecordedClip(null);
    setRecordingElapsedMs(0);
    const nextTurn = practiceSet.turns[nextIndex];
    if (direction === "next" && nextTurn?.aiPromptTtsUrl) {
      await playAudio(nextTurn.id, nextTurn.aiPromptTtsUrl);
    }
  }

  async function playAudio(key: string, uri: string) {
    try {
      if (playingKey === key) {
        await stopPlayback();
        return;
      }
      await stopPlayback();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
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
      setPlayingKey(key);
    } catch (err) {
      setPlayingKey(null);
      setError(err instanceof Error ? err.message : "오디오 재생에 실패했습니다.");
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

  async function handleStartRecording() {
    if (recordingBusy || isRecording) return;
    setRecordingBusy(true);
    setError("");
    setMessage("");
    try {
      const permission = await ensureRecordingPermission();
      if (!permission) {
        setRecordingPermission("denied");
        setError("마이크 권한이 필요합니다. 기기 설정에서 권한을 허용해 주세요.");
        return;
      }
      await releaseActiveRecording();
      setRecordedClip(null);
      setRecordingElapsedMs(0);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      activeRecordingRef.current = recording;
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      startRecordingTimer();
      setMessage("다이얼로그 답변 녹음을 시작했습니다.");
    } catch (err) {
      await releaseActiveRecording();
      setError(err instanceof Error ? err.message : "녹음 시작에 실패했습니다.");
    } finally {
      setRecordingBusy(false);
    }
  }

  async function handleStopRecording() {
    if (recordingBusy || !activeRecordingRef.current) return;
    setRecordingBusy(true);
    setError("");
    try {
      const recording = activeRecordingRef.current;
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      if (!uri) {
        throw new Error("녹음 파일 경로를 확인할 수 없습니다.");
      }
      const durationMs = getDurationFromStatus(status, recordingStartedAtRef.current);
      const fileName = getFileNameFromUri(uri);
      setRecordedClip({
        uri,
        durationMs,
        fileName,
        contentType: normalizeAudioContentType(
          "mediaType" in status && typeof status.mediaType === "string" ? status.mediaType : null,
          fileName,
        ),
      });
      setRecordingElapsedMs(durationMs);
      setMessage("다이얼로그 음성 답변을 저장했습니다. 이제 STT 전사로 텍스트를 확인할 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 종료에 실패했습니다.");
    } finally {
      stopRecordingTimer();
      setIsRecording(false);
      recordingStartedAtRef.current = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      await releaseActiveRecording();
      setRecordingBusy(false);
    }
  }

  async function handleTranscribeVoice(turnId: string) {
    if (!recordedClip || !currentTurn) {
      setError("먼저 음성 답변을 녹음해 주세요.");
      return;
    }
    setTranscribing(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      const contentType = recordedClip.contentType || guessAudioContentType(recordedClip.fileName);
      const safeFileName = ensureAudioFileName(recordedClip.fileName, contentType);
      if (Platform.OS === "web") {
        const response = await fetch(recordedClip.uri);
        if (!response.ok) {
          throw new Error("웹 녹음 파일을 읽는 데 실패했습니다.");
        }
        const blob = await response.blob();
        formData.append("file", blob, safeFileName);
      } else {
        formData.append("file", {
          uri: recordedClip.uri,
          name: safeFileName,
          type: contentType,
        } as unknown as Blob);
      }
      formData.append("language", "en");
      const result = await transcribeAiConversationAudio(formData);
      updateAnswerDraft(turnId, result.text);
      setMessage("다이얼로그 음성 답변을 STT로 전사했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "다이얼로그 음성 전사에 실패했습니다.");
    } finally {
      setTranscribing(false);
    }
  }

  async function handleSaveTitle() {
    if (!practiceSet || !titleDraft.trim()) {
      setError("저장할 제목을 입력해 주세요.");
      return;
    }

    setSavingTitle(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateDialoguePracticeSetTitle(practiceSet.id, titleDraft.trim());
      setPracticeSet(updated);
      setTitleDraft(updated.title);
      setMessage("다이얼로그 제목을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "다이얼로그 제목 저장에 실패했습니다.");
    } finally {
      setSavingTitle(false);
    }
  }

  async function ensureRecordingPermission() {
    const current = await Audio.getPermissionsAsync();
    if (current.granted) {
      setRecordingPermission("granted");
      return true;
    }
    const requested = await Audio.requestPermissionsAsync();
    setRecordingPermission(requested.granted ? "granted" : "denied");
    return requested.granted;
  }

  function startRecordingTimer() {
    stopRecordingTimer();
    recordingTimerRef.current = setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) return;
      setRecordingElapsedMs(Date.now() - startedAt);
    }, 250);
  }

  function stopRecordingTimer() {
    if (!recordingTimerRef.current) return;
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  async function releaseActiveRecording() {
    const recording = activeRecordingRef.current;
    activeRecordingRef.current = null;
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // ignore already stopped
    }
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
    gap: 16,
  },
  centered: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
  },
  eyebrow: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
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
  cardText: {
    color: "#334155",
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  helperText: {
    color: "#64748b",
    lineHeight: 20,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  progressHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  progressBadge: {
    backgroundColor: "#ede9fe",
    color: "#6d28d9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontWeight: "700",
  },
  timelineBlock: {
    gap: 10,
  },
  turnCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  aiTurnCard: {
    backgroundColor: "#f8fafc",
  },
  userTurnCard: {
    backgroundColor: "#f5f3ff",
  },
  turnMeta: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  turnText: {
    color: "#0f172a",
    lineHeight: 21,
    fontSize: 15,
  },
  turnHint: {
    color: "#475569",
    lineHeight: 20,
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    textAlignVertical: "top",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  answerRevealCard: {
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 6,
  },
  success: {
    color: "#6d28d9",
    lineHeight: 20,
  },
  error: {
    color: "#b91c1c",
    lineHeight: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

function getDurationFromStatus(status: Awaited<ReturnType<Audio.Recording["getStatusAsync"]>>, startedAt: number | null) {
  if ("durationMillis" in status && typeof status.durationMillis === "number" && status.durationMillis > 0) {
    return status.durationMillis;
  }

  if (startedAt) {
    return Math.max(0, Date.now() - startedAt);
  }

  return 0;
}

function getFileNameFromUri(uri: string) {
  const cleaned = uri.split("?")[0] ?? uri;
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || `audio-${Date.now()}.m4a`;
}

function guessAudioContentType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".webm")) return "audio/webm";
  return "audio/mp4";
}

function normalizeAudioContentType(contentType: string | null | undefined, fileName: string) {
  const normalized = contentType?.trim().toLowerCase() ?? "";
  if (normalized.includes("/")) {
    return normalized;
  }
  return guessAudioContentType(fileName);
}

function ensureAudioFileName(fileName: string, contentType?: string | null) {
  const trimmed = fileName.trim() || `dialogue-practice-${Date.now()}`;
  const extension = getExtensionFromContentType(contentType);
  if (/\.[a-z0-9]+$/i.test(trimmed)) {
    return trimmed.replace(/\.[a-z0-9]+$/i, extension);
  }

  return `${trimmed}${extension}`;
}

function getExtensionFromContentType(contentType?: string | null) {
  const normalized = contentType?.toLowerCase() ?? "";
  if (normalized.includes("webm")) return ".webm";
  if (normalized.includes("mpeg")) return ".mp3";
  if (normalized.includes("wav")) return ".wav";
  if (normalized.includes("x-caf")) return ".caf";
  if (normalized.includes("mp4") || normalized.includes("m4a") || normalized.includes("aac")) return ".m4a";
  return ".m4a";
}

function formatDurationMs(durationMs?: number | null) {
  if (!durationMs || durationMs <= 0) return "00:00";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatPermissionLabel(permission: "unknown" | "granted" | "denied") {
  if (permission === "granted") return "허용됨";
  if (permission === "denied") return "거부됨";
  return "확인 전";
}
