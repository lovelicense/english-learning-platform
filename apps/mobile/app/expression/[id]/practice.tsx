import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  listExpressions,
  savePracticeExpression,
  type ExpressionResponse,
} from "../../../src/lib/api/expressions";
import {
  createPracticeVoicePresign,
  generatePracticePrompt,
  scorePracticeAnswer,
  scorePracticeVoiceAnswer,
  type PracticePromptResponse,
  type PracticeScoreResponse,
} from "../../../src/lib/api/practice";
import {
  DEFAULT_LEARNING_PREFERENCES,
  getLearningPreferences,
  type LearningPreferences,
} from "../../../src/lib/learning-preferences";

type PracticeTestType = "translation" | "situation" | "pattern" | "think";
type PracticeAnswerMode = "voice" | "text";
type RecordedClip = {
  uri: string;
  durationMs: number;
  fileName: string;
  contentType?: string | null;
};
type SavedPatternExpressionState = {
  id: string;
  hasEnglishTts: boolean;
  hasKoreanTts: boolean;
};

export default function ExpressionPracticeScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const expressionId = params.id ?? "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expressions, setExpressions] = useState<ExpressionResponse[]>([]);
  const [expression, setExpression] = useState<ExpressionResponse | null>(null);
  const [prompt, setPrompt] = useState<PracticePromptResponse | null>(null);
  const [answerMode, setAnswerMode] = useState<PracticeAnswerMode>("voice");
  const [selectedTestType, setSelectedTestType] = useState<PracticeTestType>("translation");
  const [answerDraft, setAnswerDraft] = useState("");
  const [score, setScore] = useState<PracticeScoreResponse | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [scoringMode, setScoringMode] = useState<PracticeAnswerMode | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [voiceUploadPercent, setVoiceUploadPercent] = useState(0);
  const [learningPreferences, setLearningPreferences] = useState<LearningPreferences>(DEFAULT_LEARNING_PREFERENCES);
  const [savingPatternExpression, setSavingPatternExpression] = useState(false);
  const [savedPatternExpression, setSavedPatternExpression] = useState<SavedPatternExpressionState | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRecordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clipDurationLabel = useMemo(
    () => formatDurationMs(isRecording ? recordingElapsedMs : recordedClip?.durationMs),
    [isRecording, recordingElapsedMs, recordedClip?.durationMs],
  );
  const currentExpressionIndex = useMemo(
    () => expressions.findIndex((item) => item.id === expressionId),
    [expressions, expressionId],
  );
  const previousExpression = useMemo(
    () => (currentExpressionIndex > 0 ? expressions[currentExpressionIndex - 1] ?? null : null),
    [currentExpressionIndex, expressions],
  );
  const nextExpression = useMemo(
    () => (currentExpressionIndex >= 0 ? expressions[currentExpressionIndex + 1] ?? null : null),
    [currentExpressionIndex, expressions],
  );
  const isPatternPrompt = prompt?.testType === "pattern";

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
      setExpressions(list);
      const found = list.find((item) => item.id === expressionId) ?? null;
      if (!found) {
        throw new Error("표현을 찾을 수 없습니다.");
      }
      setExpression(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 연습 화면을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [expressionId]);

  useEffect(() => {
    void loadExpression();
  }, [loadExpression]);

  useFocusEffect(
    useCallback(() => {
      void loadLearningPreferences();
    }, []),
  );

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      clearAutoRecordTimeout();
      void Speech.stop();
      void stopPlayback();
      void releaseActiveRecording();
    };
  }, []);

  useEffect(() => {
    clearAutoRecordTimeout();
    void Speech.stop();
    setPrompt(null);
    setScore(null);
    setAnswerDraft("");
    setRecordedClip(null);
    setRecordingElapsedMs(0);
    setVoiceUploadPercent(0);
    setPlayingKey(null);
    setSelectedTestType("translation");
    setAnswerMode(learningPreferences.defaultAnswerMode);
    setSavedPatternExpression(null);
  }, [expressionId, learningPreferences.defaultAnswerMode]);

  async function loadLearningPreferences() {
    const next = await getLearningPreferences();
    setLearningPreferences(next);
    setAnswerMode(next.defaultAnswerMode);
  }

  async function handleGeneratePrompt(testType?: PracticeTestType) {
    if (!expression) return;

    const nextType = testType ?? "translation";
    setPromptLoading(true);
    setError("");
    setMessage("");
    setScore(null);
    setSavedPatternExpression(null);

    try {
      const created = await generatePracticePrompt(expression.id, nextType);
      setPrompt(created);
      setAnswerDraft("");
      setRecordedClip(null);
      setVoiceUploadPercent(0);
      if (answerMode === "voice") {
        if (learningPreferences.autoPlayPromptTts && learningPreferences.autoStartVoiceRecording) {
          setMessage("표현 연습 문제를 준비했고 질문을 읽어준 뒤 3초 후 자동으로 녹음을 시작합니다.");
        } else if (learningPreferences.autoPlayPromptTts) {
          setMessage("표현 연습 문제를 준비했고 질문을 먼저 읽어줍니다.");
        } else if (learningPreferences.autoStartVoiceRecording) {
          setMessage("표현 연습 문제를 준비했고 3초 후 자동으로 녹음을 시작합니다.");
        } else {
          setMessage("표현 연습 문제를 준비했습니다. 원하면 직접 녹음을 시작해 주세요.");
        }
      } else {
        setMessage("표현 연습 문제를 준비했습니다.");
      }
      await maybeSpeakPromptAndAutoRecord(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "연습 문제 생성에 실패했습니다.");
    } finally {
      setPromptLoading(false);
    }
  }

  async function handleScoreAnswer() {
    if (!expression || !prompt) return;

    const trimmed = answerDraft.trim();
    if (!trimmed) {
      setError("답변을 입력해 주세요.");
      return;
    }

    setScoringMode("text");
    setError("");
    setMessage("");

    try {
      const result = await scorePracticeAnswer({
        expressionId: expression.id,
        answer: trimmed,
        testType: prompt.testType,
        promptKorean: prompt.promptKorean,
        promptContext: prompt.promptContext,
        promptTarget: prompt.target,
        promptTargetAlt: prompt.targetAlt,
        promptReferenceTarget: prompt.referenceTarget,
        promptPatternLabel: prompt.patternLabel,
        promptPatternDescription: prompt.patternDescription,
      });
      const autoPlayed = await applyScoredResult(result);
      setMessage(autoPlayed ? "텍스트 채점이 완료되어 정답 TTS를 자동 재생합니다." : "텍스트 채점이 완료되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "채점에 실패했습니다.");
    } finally {
      setScoringMode(null);
    }
  }

  async function scoreVoiceAnswerFromClip(clip: RecordedClip, autoStarted = false) {
    if (!expression || !prompt) return;

    setScoringMode("voice");
    setVoiceUploadPercent(1);
    setError("");
    setMessage(autoStarted ? "녹음 종료 후 자동으로 음성 채점을 진행하고 있습니다." : "");

    try {
      const uploadPayload = await getRecordedClipUploadPayload(clip);
      const contentType = uploadPayload.contentType || guessAudioContentType(clip.fileName);
      const fileName = ensureAudioFileName(clip.fileName, contentType);
      const presign = await createPracticeVoicePresign({
        fileName,
        contentType,
      });

      await uploadRecordedClipToPresignedUrl(presign.uploadUrl, uploadPayload, contentType, setVoiceUploadPercent);

      const result = await scorePracticeVoiceAnswer({
        expressionId: expression.id,
        audioKey: presign.key,
        fileName,
        testType: prompt.testType,
        promptKorean: prompt.promptKorean,
        promptContext: prompt.promptContext,
        promptTarget: prompt.target,
        promptTargetAlt: prompt.targetAlt,
        promptReferenceTarget: prompt.referenceTarget,
        promptPatternLabel: prompt.patternLabel,
        promptPatternDescription: prompt.patternDescription,
      });
      const autoPlayed = await applyScoredResult(result);
      setMessage(autoPlayed ? "음성 답변 채점이 완료되어 정답 TTS를 자동 재생합니다." : "음성 답변 채점이 완료되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "음성 채점에 실패했습니다.");
    } finally {
      setScoringMode(null);
    }
  }

  async function handleScoreVoiceAnswer() {
    if (!recordedClip) {
      setError("먼저 영어 답변을 녹음해 주세요.");
      return;
    }

    await scoreVoiceAnswerFromClip(recordedClip);
  }

  async function handleSavePatternExpression() {
    if (!prompt || prompt.testType !== "pattern") {
      setError("패턴형 문제 결과만 표현 자산으로 저장할 수 있습니다.");
      return;
    }
    if (savedPatternExpression) {
      setMessage("이 패턴형 문제 결과는 이미 표현 자산으로 저장했습니다.");
      return;
    }

    const koreanText = prompt.promptKorean?.trim();
    const englishBase = score?.suggestedAnswer?.trim() || prompt.target?.trim();
    const englishNatural = score?.suggestedAnswerAlt?.trim() || prompt.targetAlt?.trim() || englishBase;

    if (!koreanText || !englishBase) {
      setError("저장할 문제 문장 또는 영어 표현이 없습니다.");
      return;
    }

    const noteParts = [
      prompt.patternLabel ? `패턴: ${prompt.patternLabel}` : null,
      prompt.patternDescription ?? null,
      prompt.referenceTarget ? `원래 대표 표현: ${prompt.referenceTarget}` : null,
    ].filter(Boolean);

    setSavingPatternExpression(true);
    setError("");
    setMessage("");
    try {
      const created = await savePracticeExpression({
        koreanText,
        englishBase,
        englishEasy: prompt.target,
        englishNatural,
        promptContext: prompt.promptContext,
        note: noteParts.join("\n"),
      });
      setSavedPatternExpression({
        id: created.id,
        hasEnglishTts: Boolean(created.ttsUrl),
        hasKoreanTts: Boolean(created.koreanTtsUrl),
      });
      setMessage(
        created.ttsUrl || created.koreanTtsUrl
          ? "패턴형 문제를 새 표현 자산으로 저장했고, TTS도 함께 준비했습니다."
          : "패턴형 문제를 새 표현 자산으로 저장했습니다.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "패턴형 표현 저장에 실패했습니다.");
    } finally {
      setSavingPatternExpression(false);
    }
  }

  function handleMoveToExpression(targetId: string) {
    clearAutoRecordTimeout();
    void Speech.stop();
    void stopPlayback();
    router.replace(`/expression/${targetId}/practice`);
  }

  async function applyScoredResult(result: PracticeScoreResponse) {
    setScore(result);
    if (answerMode === "text") {
      setAnswerDraft(result.answer);
    }
    await loadExpression(true);
    if (expression?.ttsUrl) {
      await playAudio("reference-tts", expression.ttsUrl, false);
      return true;
    }
    return false;
  }

  async function handlePlayAudio(key: string, uri: string) {
    await playAudio(key, uri, true);
  }

  async function playAudio(key: string, uri: string, clearFeedback: boolean) {
    if (clearFeedback) {
      setError("");
      setMessage("");
    }

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

    clearAutoRecordTimeout();
    await Speech.stop();
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
      setScore(null);
      setVoiceUploadPercent(0);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      activeRecordingRef.current = recording;
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      startRecordingTimer();
      setMessage("영어 답변 녹음을 시작했습니다.");
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
    let nextClip: RecordedClip | null = null;

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

      nextClip = {
        uri,
        durationMs,
        fileName,
        contentType: "mediaType" in status && typeof status.mediaType === "string" ? status.mediaType : null,
      };
      setRecordedClip(nextClip);
      setRecordingElapsedMs(durationMs);
      setMessage("영어 답변 녹음이 저장되었습니다. 자동으로 음성 채점을 시작합니다.");
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

    if (nextClip && answerMode === "voice" && prompt && expression) {
      await scoreVoiceAnswerFromClip(nextClip, true);
    }
  }

  async function maybeSpeakPromptAndAutoRecord(nextPrompt: PracticePromptResponse) {
    if (answerMode !== "voice") return;
    if (!learningPreferences.autoPlayPromptTts) {
      if (learningPreferences.autoStartVoiceRecording) {
        scheduleAutoRecordingStart();
      } else {
        setMessage("표현 연습 문제를 준비했습니다. 원하면 직접 녹음을 시작해 주세요.");
      }
      return;
    }

    const promptText = nextPrompt.promptKorean.trim();
    if (!promptText) {
      if (learningPreferences.autoStartVoiceRecording) {
        scheduleAutoRecordingStart();
      }
      return;
    }

    clearAutoRecordTimeout();
    await Speech.stop();

    Speech.speak(promptText, {
      language: "ko-KR",
      pitch: 1,
      rate: 0.95,
      onDone: () => {
        if (learningPreferences.autoStartVoiceRecording) {
          scheduleAutoRecordingStart();
        } else {
          setMessage("질문 읽기가 끝났습니다. 원하면 직접 녹음을 시작해 주세요.");
        }
      },
      onStopped: () => {
        clearAutoRecordTimeout();
      },
      onError: () => {
        if (learningPreferences.autoStartVoiceRecording) {
          scheduleAutoRecordingStart();
        } else {
          setMessage("질문 읽기 중 문제가 있었지만 직접 녹음을 시작할 수 있습니다.");
        }
      },
    });
  }

  function scheduleAutoRecordingStart() {
    clearAutoRecordTimeout();
    setMessage("질문 읽기가 끝났습니다. 3초 뒤 자동으로 녹음을 시작합니다.");
    autoRecordTimeoutRef.current = setTimeout(() => {
      autoRecordTimeoutRef.current = null;
      void handleStartRecording();
    }, 3000);
  }

  function clearAutoRecordTimeout() {
    if (!autoRecordTimeoutRef.current) return;
    clearTimeout(autoRecordTimeoutRef.current);
    autoRecordTimeoutRef.current = null;
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
      if (!startedAt) {
        setRecordingElapsedMs(0);
        return;
      }
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
      // Best effort cleanup.
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.description}>표현 연습 화면을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Expression Practice</Text>
      <Text style={styles.description}>표현 하나를 골라 문제를 만들고, 텍스트나 음성으로 집중 연습합니다.</Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>뒤로</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, !previousExpression && styles.buttonDisabled]}
          onPress={() => previousExpression ? handleMoveToExpression(previousExpression.id) : undefined}
          disabled={!previousExpression}
        >
          <Text style={styles.secondaryButtonText}>이전 표현</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, !nextExpression && styles.buttonDisabled]}
          onPress={() => nextExpression ? handleMoveToExpression(nextExpression.id) : undefined}
          disabled={!nextExpression}
        >
          <Text style={styles.secondaryButtonText}>다음 표현</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void loadExpression(true)} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>표현 새로고침</Text>}
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
        <Text style={styles.cardTitle}>현재 표현</Text>
        <Text style={styles.metaText}>
          {currentExpressionIndex >= 0 ? `${currentExpressionIndex + 1} / ${expressions.length}` : `총 ${expressions.length}개`}
        </Text>
        <Text style={styles.korean}>{expression?.koreanText ?? "-"}</Text>
        <Text style={styles.base}>{expression?.englishBase ?? "-"}</Text>
        <Text style={styles.sub}>쉬운형: {expression?.englishEasy ?? "-"}</Text>
        <Text style={styles.sub}>자연형: {expression?.englishNatural ?? "-"}</Text>
        <Text style={styles.metaText}>연습 {expression?.practiceCount ?? 0}회 · 최근 점수 {expression?.latestPracticeScore ?? "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>문제 생성</Text>
        <View style={styles.row}>
          {(["translation", "situation", "pattern", "think"] as const).map((type) => (
            <Pressable
              key={type}
              style={[styles.chip, selectedTestType === type && styles.chipSelected]}
              onPress={() => setSelectedTestType(type)}
            >
              <Text style={[styles.chipText, selectedTestType === type && styles.chipTextSelected]}>{formatTestType(type)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <Pressable
            style={[styles.primaryButton, (!expression || promptLoading) && styles.buttonDisabled]}
            onPress={() => void handleGeneratePrompt(selectedTestType)}
            disabled={!expression || promptLoading}
          >
            {promptLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>문제 생성(시작)</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, !expression?.ttsUrl && styles.buttonDisabled]}
            onPress={() => expression?.ttsUrl ? void handlePlayAudio("reference-tts", expression.ttsUrl) : undefined}
            disabled={!expression?.ttsUrl}
          >
            <Text style={styles.secondaryButtonText}>{playingKey === "reference-tts" ? "정답 TTS 정지" : "정답 TTS 재생"}</Text>
          </Pressable>
        </View>
        {prompt ? (
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>{prompt.promptKorean}</Text>
            {prompt.promptContext ? <Text style={styles.metaText}>{prompt.promptContext}</Text> : null}
            {isPatternPrompt ? (
              <View style={styles.patternInfoCard}>
                <Text style={styles.patternInfoTitle}>패턴형 문제</Text>
                {prompt.patternLabel ? <Text style={styles.metaText}>패턴 이름: {prompt.patternLabel}</Text> : null}
                {prompt.patternDescription ? <Text style={styles.metaText}>{prompt.patternDescription}</Text> : null}
                <Text style={styles.metaText}>패턴 설명을 보고 같은 골격으로 영어 답을 만들어 보세요.</Text>
              </View>
            ) : null}
            {prompt.tips ? <Text style={styles.metaText}>힌트: {prompt.tips}</Text> : null}
            {prompt.testType === "think" ? (
              <Text style={styles.metaText}>아래 설명을 바탕으로 어떤 영어 문장을 떠올려야 하는지 생각해 보세요.</Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.metaText}>먼저 연습 문제를 생성해 주세요.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>답변 모드</Text>
        <View style={styles.row}>
          <Pressable style={[styles.chip, answerMode === "voice" && styles.chipSelected]} onPress={() => setAnswerMode("voice")}>
            <Text style={[styles.chipText, answerMode === "voice" && styles.chipTextSelected]}>음성 답변(STT)</Text>
          </Pressable>
          <Pressable style={[styles.chip, answerMode === "text" && styles.chipSelected]} onPress={() => setAnswerMode("text")}>
            <Text style={[styles.chipText, answerMode === "text" && styles.chipTextSelected]}>텍스트 답변</Text>
          </Pressable>
        </View>

        {answerMode === "text" ? (
          <>
            <TextInput
              style={styles.answerInput}
              multiline
              placeholder="영어 답변을 입력해 보세요"
              value={answerDraft}
              onChangeText={setAnswerDraft}
            />
            <Pressable
              style={[styles.primaryButton, (!prompt || scoringMode !== null) && styles.buttonDisabled]}
              onPress={() => void handleScoreAnswer()}
              disabled={!prompt || scoringMode !== null}
            >
              {scoringMode === "text" ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>텍스트 채점하기</Text>}
            </Pressable>
          </>
        ) : (
          <View style={styles.voiceCard}>
            <Text style={styles.metaText}>권한 상태: {formatPermissionLabel(recordingPermission)}</Text>
            <Text style={styles.recordingValue}>{clipDurationLabel}</Text>
            <Text style={styles.metaText}>
              {isRecording ? "영어로 답한 뒤 녹음을 종료해 주세요." : "질문 읽기 후 자동 녹음, 자동 STT 채점을 바로 이어갈 수 있습니다."}
            </Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.primaryButton, (recordingBusy || isRecording || !prompt || scoringMode !== null) && styles.buttonDisabled]}
                onPress={() => void handleStartRecording()}
                disabled={recordingBusy || isRecording || !prompt || scoringMode !== null}
              >
                {recordingBusy && !isRecording ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>음성 녹음 시작</Text>}
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, (!isRecording || recordingBusy) && styles.buttonDisabled]}
                onPress={() => void handleStopRecording()}
                disabled={!isRecording || recordingBusy}
              >
                {recordingBusy && isRecording ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>녹음 종료</Text>}
              </Pressable>
            </View>
            <View style={styles.row}>
              <Pressable
                style={[styles.secondaryButton, (!recordedClip || scoringMode !== null) && styles.buttonDisabled]}
                onPress={() => recordedClip ? void handlePlayAudio("local-answer", recordedClip.uri) : undefined}
                disabled={!recordedClip || scoringMode !== null}
              >
                <Text style={styles.secondaryButtonText}>{playingKey === "local-answer" ? "방금 녹음 정지" : "방금 녹음 듣기"}</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, (!recordedClip || !prompt || scoringMode !== null || isRecording) && styles.buttonDisabled]}
                onPress={() => void handleScoreVoiceAnswer()}
                disabled={!recordedClip || !prompt || scoringMode !== null || isRecording}
              >
                {scoringMode === "voice" ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>음성 다시 채점</Text>}
              </Pressable>
            </View>
            {recordedClip ? (
              <View style={styles.clipCard}>
                <Text style={styles.partTitle}>저장된 음성</Text>
                <Text style={styles.partMeta}>파일명: {recordedClip.fileName}</Text>
                <Text style={styles.partMeta}>길이: {formatDurationMs(recordedClip.durationMs)}</Text>
              </View>
            ) : (
              <Text style={styles.metaText}>아직 저장된 음성 답변이 없습니다.</Text>
            )}
            {scoringMode === "voice" ? <Text style={styles.metaText}>업로드 진행률: {voiceUploadPercent}%</Text> : null}
          </View>
        )}
      </View>

      {score ? (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>총점 {score.score}</Text>
          <View style={styles.scoreMetricRow}>
            <View style={styles.scoreMetricChip}>
              <Text style={styles.scoreMetricLabel}>의미</Text>
              <Text style={styles.scoreMetricValue}>{score.meaningScore}</Text>
            </View>
            <View style={styles.scoreMetricChip}>
              <Text style={styles.scoreMetricLabel}>자연스러움</Text>
              <Text style={styles.scoreMetricValue}>{score.naturalnessScore}</Text>
            </View>
            <View style={styles.scoreMetricChip}>
              <Text style={styles.scoreMetricLabel}>문법</Text>
              <Text style={styles.scoreMetricValue}>{score.grammarScore}</Text>
            </View>
          </View>
          {score.recognizedAnswer ? (
            <View style={styles.feedbackBlock}>
              <Text style={styles.feedbackLabel}>STT 인식</Text>
              <Text style={styles.feedbackText}>{score.recognizedAnswer}</Text>
            </View>
          ) : null}
          <View style={styles.feedbackBlock}>
            <Text style={styles.feedbackLabel}>총평</Text>
            <Text style={styles.feedbackText}>{score.feedback}</Text>
          </View>
          <View style={styles.feedbackBlock}>
            <Text style={styles.feedbackLabel}>잘한 점</Text>
            <Text style={styles.feedbackText}>{score.strengthComment}</Text>
          </View>
          <View style={styles.feedbackBlock}>
            <Text style={styles.feedbackLabel}>교정 포인트</Text>
            <Text style={styles.feedbackText}>{score.correctionComment}</Text>
          </View>
          {score.meaningComment ? (
            <View style={styles.feedbackBlock}>
              <Text style={styles.feedbackLabel}>의미 코멘트</Text>
              <Text style={styles.feedbackText}>{score.meaningComment}</Text>
            </View>
          ) : null}
          <View style={styles.answerBlock}>
            <Text style={styles.feedbackLabel}>{isPatternPrompt ? "이번 문제 정답" : "정답 기준"}</Text>
            <Text style={styles.answerText}>{score.target}</Text>
          </View>
          {isPatternPrompt && prompt?.referenceTarget ? (
            <View style={styles.answerBlockAlt}>
              <Text style={styles.feedbackLabel}>원래 대표 표현</Text>
              <Text style={styles.answerText}>{prompt.referenceTarget}</Text>
            </View>
          ) : null}
          <View style={styles.answerBlock}>
            <Text style={styles.feedbackLabel}>추천 답변</Text>
            <Text style={styles.answerText}>{score.suggestedAnswer}</Text>
          </View>
          {score.suggestedAnswerAlt ? (
            <View style={styles.answerBlockAlt}>
              <Text style={styles.feedbackLabel}>대안 답변</Text>
              <Text style={styles.answerText}>{score.suggestedAnswerAlt}</Text>
            </View>
          ) : null}
          {score.audioUrl ? (
            <Pressable style={styles.secondaryButton} onPress={() => void handlePlayAudio("scored-answer", score.audioUrl!)}>
              <Text style={styles.secondaryButtonText}>{playingKey === "scored-answer" ? "채점 음성 정지" : "채점된 음성 다시 듣기"}</Text>
            </Pressable>
          ) : null}
          {isPatternPrompt ? (
            <View style={styles.patternSaveCard}>
              <Text style={styles.patternSaveTitle}>표현 자산 저장</Text>
              <Text style={styles.metaText}>이번 패턴형 문제의 한국어 문장과 답안을 새 표현으로 저장해 이후 표현 학습에 바로 합류시킵니다.</Text>
              {savedPatternExpression ? (
                <View style={styles.successBox}>
                  <Text style={styles.successBoxTitle}>표현 자산 저장 완료</Text>
                  <Text style={styles.successBoxText}>
                    {savedPatternExpression.hasEnglishTts || savedPatternExpression.hasKoreanTts
                      ? `TTS 준비됨${
                          savedPatternExpression.hasEnglishTts && savedPatternExpression.hasKoreanTts
                            ? " (영어/한국어)"
                            : savedPatternExpression.hasEnglishTts
                              ? " (영어)"
                              : " (한국어)"
                        }`
                      : "필요하면 나중에 TTS를 생성할 수 있습니다."}
                  </Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <Pressable
                  style={[styles.secondaryButton, (savingPatternExpression || !!savedPatternExpression) && styles.buttonDisabled]}
                  onPress={() => void handleSavePatternExpression()}
                  disabled={savingPatternExpression || !!savedPatternExpression}
                >
                  {savingPatternExpression ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>{savedPatternExpression ? "표현 자산 저장 완료" : "표현 자산으로 저장"}</Text>}
                </Pressable>
                {savedPatternExpression ? (
                  <Pressable style={styles.primaryButton} onPress={() => router.push(`/expression/${savedPatternExpression.id}`)}>
                    <Text style={styles.primaryButtonText}>새 표현 보기</Text>
                  </Pressable>
                ) : null}
                {savedPatternExpression ? (
                  <Pressable style={styles.secondaryButton} onPress={() => router.push("/expressions")}>
                    <Text style={styles.secondaryButtonText}>표현 목록 보기</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function formatTestType(value: PracticeTestType | "translation" | "situation" | "think") {
  if (value === "translation") return "번역형";
  if (value === "situation") return "상황형";
  if (value === "think") return "Think in English";
  return "패턴형";
}

function getDurationFromStatus(status: Awaited<ReturnType<Audio.Recording["getStatusAsync"]>>, startedAt: number | null) {
  if ("durationMillis" in status && typeof status.durationMillis === "number" && status.durationMillis > 0) {
    return status.durationMillis;
  }

  if (startedAt) {
    return Math.max(0, Date.now() - startedAt);
  }

  return 0;
}

async function getRecordedClipUploadPayload(recordedClip: RecordedClip): Promise<
  | { kind: "native"; uri: string; sizeBytes: number; contentType?: string | null }
  | { kind: "web"; blob: Blob; sizeBytes: number; contentType?: string | null }
> {
  if (Platform.OS === "web") {
    const response = await fetch(recordedClip.uri);
    if (!response.ok) {
      throw new Error("웹 녹음 파일을 읽는 데 실패했습니다.");
    }
    const blob = await response.blob();
    if (!blob.size) {
      throw new Error("업로드할 웹 녹음 파일이 비어 있습니다.");
    }
    return {
      kind: "web",
      blob,
      sizeBytes: blob.size,
      contentType: blob.type || recordedClip.contentType || null,
    };
  }

  const fileInfo = await FileSystem.getInfoAsync(recordedClip.uri);
  if (!fileInfo.exists || fileInfo.isDirectory) {
    throw new Error("업로드할 녹음 파일을 찾을 수 없습니다.");
  }

  return {
    kind: "native",
    uri: recordedClip.uri,
    sizeBytes: fileInfo.size,
    contentType: recordedClip.contentType || null,
  };
}

async function uploadRecordedClipToPresignedUrl(
  uploadUrl: string,
  payload:
    | { kind: "native"; uri: string; sizeBytes: number; contentType?: string | null }
    | { kind: "web"; blob: Blob; sizeBytes: number; contentType?: string | null },
  contentType: string,
  onProgress: (percent: number) => void,
) {
  if (payload.kind === "web") {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: payload.blob,
    });
    if (!response.ok) {
      throw new Error(`업로드에 실패했습니다. (${response.status})`);
    }
    onProgress(100);
    return;
  }

  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    payload.uri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        "Content-Type": contentType,
      },
    },
    (progress) => {
      if (progress.totalBytesExpectedToSend <= 0) return;
      const percent = Math.min(
        100,
        Math.max(1, Math.round((progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100)),
      );
      onProgress(percent);
    },
  );

  const uploadResult = await uploadTask.uploadAsync();
  if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`업로드에 실패했습니다. (${uploadResult?.status ?? "unknown"})`);
  }
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

function ensureAudioFileName(fileName: string, contentType?: string | null) {
  const trimmed = fileName.trim() || `practice-${Date.now()}`;
  if (/\.[a-z0-9]+$/i.test(trimmed)) {
    return trimmed;
  }

  const extension = getExtensionFromContentType(contentType);
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

function getFileNameFromUri(uri: string) {
  const segments = uri.split("/");
  const last = segments[segments.length - 1];
  return last || "practice-answer.m4a";
}

function formatPermissionLabel(permission: "unknown" | "granted" | "denied") {
  if (permission === "granted") return "허용됨";
  if (permission === "denied") return "거부됨";
  return "아직 확인 전";
}

function formatDurationMs(value?: number | null) {
  if (!value || value <= 0) return "00:00";
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipSelected: {
    backgroundColor: "#2563eb",
  },
  chipText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  chipTextSelected: {
    color: "#ffffff",
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
  korean: {
    color: "#475569",
    lineHeight: 22,
  },
  base: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 28,
  },
  sub: {
    color: "#334155",
    lineHeight: 21,
  },
  promptCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f8fbff",
  },
  promptTitle: {
    color: "#0f172a",
    fontWeight: "800",
    lineHeight: 22,
  },
  patternInfoCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: "#eff6ff",
  },
  patternInfoTitle: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
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
    color: "#0f172a",
  },
  voiceCard: {
    borderWidth: 1,
    borderColor: "#d1fae5",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    backgroundColor: "#f0fdf4",
  },
  recordingValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  clipCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    backgroundColor: "#ffffff",
  },
  scoreCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  scoreMetricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scoreMetricChip: {
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 88,
    gap: 2,
  },
  scoreMetricLabel: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },
  scoreMetricValue: {
    color: "#0f172a",
    fontWeight: "800",
  },
  feedbackBlock: {
    gap: 4,
  },
  feedbackLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
  },
  feedbackText: {
    color: "#334155",
    lineHeight: 21,
  },
  answerBlock: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    padding: 12,
  },
  answerBlockAlt: {
    gap: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 12,
  },
  patternSaveCard: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#f8faff",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  patternSaveTitle: {
    color: "#312e81",
    fontWeight: "800",
  },
  answerText: {
    color: "#0f172a",
    lineHeight: 22,
    fontWeight: "700",
  },
  metaText: {
    color: "#64748b",
    lineHeight: 20,
  },
  success: {
    color: "#15803d",
    lineHeight: 20,
  },
  error: {
    color: "#dc2626",
    lineHeight: 20,
  },
  successBox: {
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  successBoxTitle: {
    color: "#166534",
    fontWeight: "800",
  },
  successBoxText: {
    color: "#166534",
    lineHeight: 20,
  },
  partTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  partMeta: {
    color: "#475569",
    lineHeight: 20,
  },
});
