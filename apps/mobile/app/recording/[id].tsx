import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  generateExpressionForUtterance,
  generateRecordingExpressionsBulk,
  generateRecordingTtsBulk,
  generateExpressionTts,
  type BulkTtsResponse,
  listExpressions,
  type BulkExpressionResponse,
  type ExpressionResponse,
} from "../../src/lib/api/expressions";
import { listPersonProfiles } from "../../src/lib/api/person-profiles";
import {
  analyzeRecording,
  deleteRecordingUtterance,
  fetchRecording,
  updateRecordingAnalysisStatus,
  updateRecordingMineSpeaker,
  updateRecordingParticipants,
  updateRecordingSpeakerLabel,
  updateRecordingSpeakerProfile,
  updateRecordingUtterance,
  type PersonProfileResponse,
  type RecordingResponse,
} from "../../src/lib/api/recordings";
import {
  buildRecordingContextPayload,
  contextsEqual,
  EMPTY_RECORDING_CONTEXT,
  getRecentGenerationContext,
  getRecordingContext,
  hasRecordingContextValue,
  RELATIONSHIP_TEMPLATES,
  setRecentGenerationContext,
  setRecordingContext as persistRecordingContext,
  SITUATION_TEMPLATES,
  TONE_TEMPLATES,
  type RecordingGenerationContext,
} from "../../src/lib/recording-context";
import {
  DEFAULT_RECORDING_ANALYSIS_MODE,
  getRecordingAnalysisMode,
  setRecordingAnalysisMode,
  type RecordingAnalysisMode,
} from "../../src/lib/recording-analysis-preference";

type UtteranceFilter = "all" | "mine" | "others";

function formatTimeline(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatClipDuration(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildRecordingContextFromAnalysis(recording: RecordingResponse | null): RecordingGenerationContext {
  return {
    relationship: recording?.analysisRelationship ?? "",
    situation: recording?.analysisSituation ?? "",
    tone: recording?.analysisTone ?? "",
  };
}

function buildSpeakerLabelDrafts(recording: RecordingResponse | null) {
  const speakerLabels = Array.from(new Set((recording?.utterances ?? []).map((item) => item.speakerLabel)));
  return Object.fromEntries(speakerLabels.map((speakerLabel) => [speakerLabel, speakerLabel]));
}

function formatAnalysisStatusReason(reason?: string | null) {
  switch (reason) {
    case "CONTEXT_UPDATED":
      return "대화 맥락 힌트가 수정됨";
    case "UTTERANCE_UPDATED":
      return "문장 또는 문장별 맥락 메모가 수정됨";
    case "UTTERANCE_SPEAKER_CHANGED":
      return "발화 화자가 변경됨";
    case "UTTERANCE_DELETED":
      return "문장이 삭제됨";
    case "SPEAKER_CHANGED":
      return "내 화자 지정이 변경됨";
    case "SPEAKER_LABEL_CHANGED":
      return "화자 이름이 변경됨";
    default:
      return reason ?? "";
  }
}

function normalizeProfileKeyword(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function inferRelationshipFromProfiles(profiles: PersonProfileResponse[]) {
  if (profiles.length === 0) return "";

  const hasMe = profiles.some((profile) => profile.isMe);
  const keywordSet = new Set(
    profiles.flatMap((profile) => [
      normalizeProfileKeyword(profile.roleLabel),
      normalizeProfileKeyword(profile.relationshipToMe),
    ]),
  );

  const hasAnyKeyword = (keywords: string[]) =>
    Array.from(keywordSet).some((value) => value && keywords.some((keyword) => value.includes(keyword)));

  if (hasAnyKeyword(["선생님", "teacher"]) && hasAnyKeyword(["학생", "student"])) {
    return "선생님 - 학생";
  }
  if (hasAnyKeyword(["손님", "고객", "customer", "guest"]) && hasAnyKeyword(["직원", "staff", "employee", "점원"])) {
    return "손님 - 직원";
  }
  if (hasMe && hasAnyKeyword(["배우자", "남편", "아내", "wife", "husband", "spouse"])) {
    return "부부";
  }
  if (
    hasMe &&
    hasAnyKeyword(["딸", "아들", "자녀", "아이", "아기", "daughter", "son", "child", "kid", "baby"])
  ) {
    return "부모 - 자녀";
  }
  if (
    hasMe &&
    hasAnyKeyword(["엄마", "아빠", "부모", "어머니", "아버지", "mother", "father", "parent"])
  ) {
    return "부모 - 자녀";
  }
  if (hasAnyKeyword(["친구", "friend"])) {
    return "친구";
  }

  return "";
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const normalizedLeft = [...left].sort().join(",");
  const normalizedRight = [...right].sort().join(",");
  return normalizedLeft === normalizedRight;
}

export default function RecordingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const recordingId = params.id ?? "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState<RecordingResponse | null>(null);
  const [personProfiles, setPersonProfiles] = useState<PersonProfileResponse[]>([]);
  const [utteranceDrafts, setUtteranceDrafts] = useState<Record<string, string>>({});
  const [utteranceSpeakerDrafts, setUtteranceSpeakerDrafts] = useState<Record<string, string>>({});
  const [utteranceContextDrafts, setUtteranceContextDrafts] = useState<Record<string, string>>({});
  const [recordingContextDraft, setRecordingContextDraft] =
    useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [savedRecordingContext, setSavedRecordingContext] =
    useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [recentManualContext, setRecentManualContextState] =
    useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [recordingParticipantDraftIds, setRecordingParticipantDraftIds] = useState<string[]>([]);
  const [speakerLabelDrafts, setSpeakerLabelDrafts] = useState<Record<string, string>>({});
  const [speakerProfileDrafts, setSpeakerProfileDrafts] = useState<Record<string, string>>({});
  const [savingUtteranceId, setSavingUtteranceId] = useState("");
  const [deletingUtteranceId, setDeletingUtteranceId] = useState("");
  const [mineSpeakerLoading, setMineSpeakerLoading] = useState("");
  const [savingContext, setSavingContext] = useState(false);
  const [analyzingConversation, setAnalyzingConversation] = useState(false);
  const [analysisStatusLoading, setAnalysisStatusLoading] = useState(false);
  const [speakerProfileLoading, setSpeakerProfileLoading] = useState("");
  const [speakerLabelLoading, setSpeakerLabelLoading] = useState("");
  const [recordingAnalysisMode, setRecordingAnalysisModeState] =
    useState<RecordingAnalysisMode>(DEFAULT_RECORDING_ANALYSIS_MODE);
  const [expressions, setExpressions] = useState<ExpressionResponse[]>([]);
  const [expressionLoadingId, setExpressionLoadingId] = useState("");
  const [ttsLoadingId, setTtsLoadingId] = useState("");
  const [playingExpressionId, setPlayingExpressionId] = useState("");
  const [playingRawUtteranceId, setPlayingRawUtteranceId] = useState("");
  const [rawAudioLoadingId, setRawAudioLoadingId] = useState("");
  const [rawAudioProgressMs, setRawAudioProgressMs] = useState(0);
  const [rawAudioClipStartMs, setRawAudioClipStartMs] = useState(0);
  const [rawAudioClipEndMs, setRawAudioClipEndMs] = useState(0);
  const [bulkExpressionLoadingScope, setBulkExpressionLoadingScope] = useState<"" | "mine" | "others">("");
  const [bulkTtsLoading, setBulkTtsLoading] = useState(false);
  const [utteranceFilter, setUtteranceFilter] = useState<UtteranceFilter>("all");

  const expressionSoundRef = useRef<Audio.Sound | null>(null);
  const rawAudioSoundRef = useRef<Audio.Sound | null>(null);
  const rawAudioEndMsRef = useRef(0);

  const utteranceCount = recording?.utterances.length ?? 0;
  const speakers = useMemo(() => {
    const labels = new Set((recording?.utterances ?? []).map((item) => item.speakerLabel));
    return Array.from(labels);
  }, [recording?.utterances]);
  const recordingExpressions = useMemo(() => {
    const utteranceIds = new Set((recording?.utterances ?? []).map((item) => item.id));
    return expressions.filter((item) => item.utteranceId && utteranceIds.has(item.utteranceId));
  }, [expressions, recording?.utterances]);
  const filteredUtterances = useMemo(() => {
    const utterances = recording?.utterances ?? [];
    if (utteranceFilter === "mine") {
      return utterances.filter((item) => item.isMine);
    }
    if (utteranceFilter === "others") {
      return utterances.filter((item) => !item.isMine);
    }
    return utterances;
  }, [recording?.utterances, utteranceFilter]);
  const participantIdsFromRecording = useMemo(
    () => (recording?.participants ?? []).map((item) => item.personProfile.id),
    [recording?.participants],
  );
  const hasUnsavedContextChanges = useMemo(
    () => !contextsEqual(recordingContextDraft, savedRecordingContext),
    [recordingContextDraft, savedRecordingContext],
  );
  const hasUnsavedParticipantChanges = useMemo(
    () => !sameIds(recordingParticipantDraftIds, participantIdsFromRecording),
    [participantIdsFromRecording, recordingParticipantDraftIds],
  );
  const hasAnyAnalysis = Boolean(
    recording?.analysisSummary?.trim() || recording?.utterances.some((item) => item.analysisIntent?.trim()),
  );
  const pendingMineExpressionCount = useMemo(() => {
    return (recording?.utterances ?? []).filter((utterance) => {
      if (!utterance.isMine) return false;
      return !recordingExpressions.some((expression) => expression.utteranceId === utterance.id);
    }).length;
  }, [recording?.utterances, recordingExpressions]);
  const pendingOthersExpressionCount = useMemo(() => {
    return (recording?.utterances ?? []).filter((utterance) => {
      if (utterance.isMine) return false;
      return !recordingExpressions.some((expression) => expression.utteranceId === utterance.id);
    }).length;
  }, [recording?.utterances, recordingExpressions]);
  const pendingRecordingTtsCount = useMemo(() => {
    return recordingExpressions.filter((expression) => !expression.ttsUrl).length;
  }, [recordingExpressions]);

  const initializeFromRecording = useCallback(async (nextRecording: RecordingResponse) => {
    const storedContext = await getRecordingContext(nextRecording.id);
    const analysisContext = buildRecordingContextFromAnalysis(nextRecording);
    const nextContext = hasRecordingContextValue(storedContext) ? storedContext : analysisContext;

    setRecording(nextRecording);
    setUtteranceDrafts(Object.fromEntries(nextRecording.utterances.map((item) => [item.id, item.koreanText])));
    setUtteranceSpeakerDrafts(Object.fromEntries(nextRecording.utterances.map((item) => [item.id, item.speakerLabel])));
    setUtteranceContextDrafts(Object.fromEntries(nextRecording.utterances.map((item) => [item.id, item.contextNote ?? ""])));
    setRecordingParticipantDraftIds(nextRecording.participants.map((item) => item.personProfile.id));
    setSpeakerLabelDrafts(buildSpeakerLabelDrafts(nextRecording));
    setSpeakerProfileDrafts(
      Object.fromEntries(nextRecording.speakerProfiles.map((item) => [item.speakerLabel, item.personProfileId])),
    );
    setSavedRecordingContext(nextContext);
    setRecordingContextDraft(nextContext);
  }, []);

  const loadRecording = useCallback(
    async (showRefreshing = false) => {
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
        await initializeFromRecording(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "녹음 상세 조회에 실패했습니다.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [initializeFromRecording, recordingId],
  );

  const loadExpressions = useCallback(async () => {
    const list = await listExpressions();
    setExpressions(list);
  }, []);

  const loadPeople = useCallback(async () => {
    const profiles = await listPersonProfiles();
    setPersonProfiles(profiles);
  }, []);

  useEffect(() => {
    void Promise.all([loadRecording(), loadPeople(), loadExpressions(), getRecentGenerationContext()])
      .then(([, , , recentContext]) => {
        setRecentManualContextState(recentContext);
      })
      .catch(() => {
        // Each loader already manages local state or failures.
      });
  }, [loadExpressions, loadPeople, loadRecording]);

  useEffect(() => {
    void getRecordingAnalysisMode().then((mode) => {
      setRecordingAnalysisModeState(mode);
    });
  }, []);

  useEffect(() => {
    return () => {
      void stopExpressionPlayback();
      void stopRawAudioPlayback();
    };
  }, []);

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

  async function stopRawAudioPlayback() {
    const sound = rawAudioSoundRef.current;
    rawAudioSoundRef.current = null;
    rawAudioEndMsRef.current = 0;
    setPlayingRawUtteranceId("");
    setRawAudioLoadingId("");
    setRawAudioProgressMs(0);
    setRawAudioClipStartMs(0);
    setRawAudioClipEndMs(0);
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

  function getExpressionForUtterance(utteranceId: string) {
    return recordingExpressions.find((item) => item.utteranceId === utteranceId) ?? null;
  }

  function applySuggestedRelationship(nextParticipantIds: string[]) {
    setRecordingContextDraft((current) => {
      if (current.relationship.trim()) return current;
      const inferred = inferRelationshipFromProfiles(
        personProfiles.filter((profile) => nextParticipantIds.includes(profile.id)),
      );
      return inferred ? { ...current, relationship: inferred } : current;
    });
  }

  function toggleRecordingParticipant(profileId: string) {
    setRecordingParticipantDraftIds((current) => {
      const next = current.includes(profileId)
        ? current.filter((item) => item !== profileId)
        : [...current, profileId];
      applySuggestedRelationship(next);
      return next;
    });
  }

  async function persistContextDraft(markAnalysisReview: boolean) {
    if (!recording) return;

    let nextRecording = recording;
    if (hasUnsavedParticipantChanges) {
      nextRecording = await updateRecordingParticipants(recording.id, recordingParticipantDraftIds);
      setRecording(nextRecording);
    }

    await persistRecordingContext(recording.id, recordingContextDraft);
    await setRecentGenerationContext(recordingContextDraft);
    setSavedRecordingContext(recordingContextDraft);
    setRecentManualContextState(recordingContextDraft);

    if (markAnalysisReview) {
      nextRecording = await updateRecordingAnalysisStatus(recording.id, "NEEDS_REVIEW", "CONTEXT_UPDATED");
      setRecording(nextRecording);
    }
  }

  async function runRecordingAnalysis(successMessage: string) {
    if (!recording) return;
    await analyzeRecording(recording.id, buildRecordingContextPayload(recordingContextDraft));
    const refreshed = await fetchRecording(recording.id);
    await initializeFromRecording(refreshed);
    setMessage(successMessage);
  }

  async function maybeRunAutoRecordingAnalysis(successMessage: string) {
    if (recordingAnalysisMode !== "auto") return false;
    await runRecordingAnalysis(successMessage);
    return true;
  }

  async function handleSaveRecordingContext() {
    if (!recording) return;
    if (!hasUnsavedContextChanges && !hasUnsavedParticipantChanges) {
      setMessage("저장할 대화 맥락 변경사항이 없습니다.");
      return;
    }

    setSavingContext(true);
    setError("");
    setMessage("");
    try {
      await persistContextDraft(true);
      const autoRan = await maybeRunAutoRecordingAnalysis(
        "대화 맥락을 저장하고 대화 요약 / 의도 분석까지 자동으로 갱신했습니다.",
      );
      if (!autoRan) {
        setMessage("대화 맥락 힌트와 관련 인물 연결을 저장했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화 맥락 저장에 실패했습니다.");
    } finally {
      setSavingContext(false);
    }
  }

  async function handleAnalyzeConversation() {
    if (!recording) return;
    if (recording.utterances.length === 0) {
      setError("분석할 문장이 없습니다.");
      return;
    }

    setAnalyzingConversation(true);
    setError("");
    setMessage("");
    try {
      if (hasUnsavedContextChanges || hasUnsavedParticipantChanges) {
        await persistContextDraft(false);
      }

      await runRecordingAnalysis("대화 요약과 문장 의도 분석을 갱신했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화 분석에 실패했습니다.");
    } finally {
      setAnalyzingConversation(false);
    }
  }

  async function handleMarkAnalysisOk() {
    if (!recording) return;

    setAnalysisStatusLoading(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateRecordingAnalysisStatus(recording.id, "OK");
      setRecording(updated);
      setMessage("분석 상태를 이상없음으로 표시했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 상태 저장에 실패했습니다.");
    } finally {
      setAnalysisStatusLoading(false);
    }
  }

  async function handleSelectMineSpeaker(speakerLabel: string) {
    if (!recording?.id) return;

    setMineSpeakerLoading(speakerLabel);
    setError("");
    setMessage("");

    try {
      const updated = await updateRecordingMineSpeaker(recording.id, speakerLabel);
      await initializeFromRecording(updated);
      const autoRan = await maybeRunAutoRecordingAnalysis(
        "내 화자 설정을 반영해 대화 요약 / 의도 분석까지 자동으로 갱신했습니다.",
      );
      if (!autoRan) {
        setMessage(`${speakerLabel}를 내 화자로 지정했습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 화자 설정에 실패했습니다.");
    } finally {
      setMineSpeakerLoading("");
    }
  }

  async function handleUpdateSpeakerLabel(speakerLabel: string) {
    if (!recording) return;

    const nextSpeakerLabel = (speakerLabelDrafts[speakerLabel] ?? speakerLabel).trim();
    if (!nextSpeakerLabel || nextSpeakerLabel === speakerLabel) {
      setMessage("변경할 화자 이름이 없습니다.");
      return;
    }

    setSpeakerLabelLoading(speakerLabel);
    setError("");
    setMessage("");
    try {
      const updated = await updateRecordingSpeakerLabel(recording.id, speakerLabel, nextSpeakerLabel);
      await initializeFromRecording(updated);
      const autoRan = await maybeRunAutoRecordingAnalysis(
        "화자 이름 변경을 반영해 대화 요약 / 의도 분석까지 자동으로 갱신했습니다.",
      );
      if (!autoRan) {
        setMessage(`${speakerLabel}를 ${nextSpeakerLabel}로 변경했습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "화자 이름 저장에 실패했습니다.");
    } finally {
      setSpeakerLabelLoading("");
    }
  }

  async function handleUpdateSpeakerProfile(speakerLabel: string, personProfileId?: string) {
    if (!recording) return;

    setSpeakerProfileLoading(speakerLabel);
    setError("");
    setMessage("");
    try {
      const updated = await updateRecordingSpeakerProfile(recording.id, speakerLabel, personProfileId);
      await initializeFromRecording(updated);
      setMessage(
        personProfileId
          ? `${speakerLabel}에 인물 프로필을 연결했습니다.`
          : `${speakerLabel} 인물 연결을 해제했습니다.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "화자 인물 연결 저장에 실패했습니다.");
    } finally {
      setSpeakerProfileLoading("");
    }
  }

  async function handleChangeRecordingAnalysisMode(mode: RecordingAnalysisMode) {
    setRecordingAnalysisModeState(mode);
    await setRecordingAnalysisMode(mode);
  }

  async function handleSaveUtterance(utteranceId: string) {
    const current = recording?.utterances.find((item) => item.id === utteranceId);
    if (!current) return;

    const draft = (utteranceDrafts[utteranceId] ?? current.koreanText).trim();
    const speakerLabel = (utteranceSpeakerDrafts[utteranceId] ?? current.speakerLabel).trim();
    const contextNote = (utteranceContextDrafts[utteranceId] ?? current.contextNote ?? "").trim();
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
        speakerLabel,
        contextNote,
        markAnalysisReview: true,
      });
      const reason = speakerLabel !== current.speakerLabel ? "UTTERANCE_SPEAKER_CHANGED" : "UTTERANCE_UPDATED";

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
          analysisStatusReason: reason,
        };
      });
      setUtteranceDrafts((currentDrafts) => ({
        ...currentDrafts,
        [utteranceId]: updated.koreanText,
      }));
      setUtteranceSpeakerDrafts((currentDrafts) => ({
        ...currentDrafts,
        [utteranceId]: updated.speakerLabel,
      }));
      setUtteranceContextDrafts((currentDrafts) => ({
        ...currentDrafts,
        [utteranceId]: updated.contextNote ?? "",
      }));
      const autoRan = await maybeRunAutoRecordingAnalysis(
        "문장 저장 후 대화 요약 / 의도 분석까지 자동으로 갱신했습니다.",
      );
      if (!autoRan) {
        setMessage("문장, 화자, 맥락 메모를 저장했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 저장에 실패했습니다.");
    } finally {
      setSavingUtteranceId("");
    }
  }

  async function handlePlayUtteranceAudio(utteranceId: string, startMs: number, endMs: number) {
    if (!recording?.audioUrl) {
      setError("원본 오디오를 찾을 수 없습니다.");
      return;
    }

    setError("");
    setMessage("");
    setRawAudioLoadingId(utteranceId);

    try {
      if (playingRawUtteranceId === utteranceId) {
        await stopRawAudioPlayback();
        return;
      }

      await stopRawAudioPlayback();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      rawAudioEndMsRef.current = endMs;
      setRawAudioClipStartMs(startMs);
      setRawAudioClipEndMs(endMs);
      setRawAudioProgressMs(startMs);
      const { sound } = await Audio.Sound.createAsync(
        { uri: recording.audioUrl },
        {
          shouldPlay: true,
          positionMillis: Math.max(0, startMs),
        },
        (status) => {
          if (!status.isLoaded) return;
          setRawAudioProgressMs(status.positionMillis);
          if (status.didJustFinish || status.positionMillis >= rawAudioEndMsRef.current) {
            void stopRawAudioPlayback();
          }
        },
      );
      rawAudioSoundRef.current = sound;
      setPlayingRawUtteranceId(utteranceId);
    } catch (err) {
      setPlayingRawUtteranceId("");
      setError(err instanceof Error ? err.message : "원본 오디오 재생에 실패했습니다.");
    } finally {
      setRawAudioLoadingId("");
    }
  }

  async function handleGenerateExpressionsBulk(speakerScope: "mine" | "others") {
    if (!recording) return;

    setBulkExpressionLoadingScope(speakerScope);
    setError("");
    setMessage("");
    try {
      const response: BulkExpressionResponse = await generateRecordingExpressionsBulk({
        recordingId: recording.id,
        speakerScope,
        includeExisting: false,
        ...buildRecordingContextPayload(recordingContextDraft),
      });
      const refreshed = await fetchRecording(recording.id);
      await initializeFromRecording(refreshed);
      await loadExpressions();
      setMessage(
        response.createdCount > 0
          ? speakerScope === "mine"
            ? `내 문장 ${response.createdCount}개를 일괄 생성했습니다.`
            : `기타 화자 문장 ${response.createdCount}개를 일괄 생성했습니다.`
          : speakerScope === "mine"
            ? "이번 녹음에서 새로 생성할 내 문장이 없습니다."
            : "이번 녹음에서 새로 생성할 기타 화자 문장이 없습니다.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 표현 생성에 실패했습니다.");
    } finally {
      setBulkExpressionLoadingScope("");
    }
  }

  async function handleGenerateTtsBulk() {
    if (!recording) return;

    setBulkTtsLoading(true);
    setError("");
    setMessage("");
    try {
      const response: BulkTtsResponse = await generateRecordingTtsBulk({
        recordingId: recording.id,
        onlyMissing: true,
      });
      await loadExpressions();
      setMessage(
        response.updatedCount > 0
          ? `이 녹음의 표현 ${response.updatedCount}개에 대해 TTS를 일괄 생성했습니다.`
          : "이 녹음에서 새로 생성할 TTS가 없습니다.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 TTS 생성에 실패했습니다.");
    } finally {
      setBulkTtsLoading(false);
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
      setUtteranceSpeakerDrafts((currentDrafts) => {
        const next = { ...currentDrafts };
        delete next[utteranceId];
        return next;
      });
      setUtteranceContextDrafts((currentDrafts) => {
        const next = { ...currentDrafts };
        delete next[utteranceId];
        return next;
      });
      setExpressions((current) => current.filter((item) => item.utteranceId !== utteranceId));
      setMessage("문장을 삭제했습니다. 연결된 표현도 함께 정리되었을 수 있습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 삭제에 실패했습니다.");
    } finally {
      setDeletingUtteranceId("");
    }
  }

  async function handleGenerateExpression(utteranceId: string) {
    if (!recording) return;

    setExpressionLoadingId(utteranceId);
    setError("");
    setMessage("");

    try {
      const created = await generateExpressionForUtterance(utteranceId, {
        relationship: recordingContextDraft.relationship.trim() || (recording.analysisRelationship ?? undefined),
        situation: recordingContextDraft.situation.trim() || (recording.analysisSituation ?? undefined),
        tone: recordingContextDraft.tone.trim() || (recording.analysisTone ?? undefined),
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
      <Text style={styles.description}>
        웹의 음성데이터 수집 / 텍스트 정리 흐름을 모바일에서도 이어서 쓸 수 있게, 문장 수정과 함께 맥락 힌트,
        분석, 인물 연결까지 한 화면에서 다룹니다.
      </Text>

      <View style={styles.buttonRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>뒤로</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, refreshing && styles.buttonDisabled]}
          onPress={() => void loadRecording(true)}
          disabled={refreshing}
        >
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
        <Text style={styles.cardText}>생성된 표현 수: {recordingExpressions.length}</Text>
        {playingRawUtteranceId ? (
          <View style={styles.linkedExpressionCard}>
            <Text style={styles.linkedExpressionLabel}>원본 오디오 재생 중</Text>
            <Text style={styles.cardText}>
              {formatClipDuration(Math.max(0, rawAudioProgressMs - rawAudioClipStartMs))} /{" "}
              {formatClipDuration(Math.max(0, rawAudioClipEndMs - rawAudioClipStartMs))}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      rawAudioClipEndMs > rawAudioClipStartMs
                        ? Math.min(
                            100,
                            Math.max(
                              0,
                              ((rawAudioProgressMs - rawAudioClipStartMs) /
                                (rawAudioClipEndMs - rawAudioClipStartMs)) *
                                100,
                            ),
                          )
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>대화 맥락 힌트</Text>
        <Text style={styles.metaText}>
          관계, 상황, 원하는 톤과 관련 인물을 적어두면 이후 대화 요약과 표현 생성이 더 자연스럽게 맞춰집니다.
        </Text>

        <View style={styles.subsection}>
          <Text style={styles.inputLabel}>관련 인물 선택</Text>
          <View style={styles.actionRow}>
            {personProfiles.length > 0 ? (
              personProfiles.map((profile) => {
                const selected = recordingParticipantDraftIds.includes(profile.id);
                return (
                  <Pressable
                    key={profile.id}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                    onPress={() => toggleRecordingParticipant(profile.id)}
                  >
                    <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                      {profile.name}
                      {profile.roleLabel ? ` (${profile.roleLabel})` : ""}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.metaText}>아직 등록된 인물 프로필이 없습니다.</Text>
            )}
          </View>
          <Text style={styles.metaText}>등록된 인물을 연결해 두면 관계 추론과 상황 이해에 함께 반영됩니다.</Text>
        </View>

        <Pressable
          style={[
            styles.smallSecondaryButton,
            !hasRecordingContextValue(recentManualContext) && styles.buttonDisabled,
          ]}
          onPress={() => setRecordingContextDraft(recentManualContext)}
          disabled={!hasRecordingContextValue(recentManualContext)}
        >
          <Text style={styles.smallSecondaryButtonText}>최근 맥락 다시 사용</Text>
        </Pressable>

        <View style={styles.subsection}>
          <Text style={styles.inputLabel}>관계 템플릿</Text>
          <View style={styles.actionRow}>
            {RELATIONSHIP_TEMPLATES.map((item) => (
              <Pressable
                key={item}
                style={[styles.filterChip, recordingContextDraft.relationship === item && styles.filterChipActive]}
                onPress={() => setRecordingContextDraft((current) => ({ ...current, relationship: item }))}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    recordingContextDraft.relationship === item && styles.filterChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.inlineInput}
            value={recordingContextDraft.relationship}
            onChangeText={(text) => setRecordingContextDraft((current) => ({ ...current, relationship: text }))}
            placeholder="예: 엄마 - 아이"
          />
        </View>

        <View style={styles.subsection}>
          <Text style={styles.inputLabel}>상황 템플릿</Text>
          <View style={styles.actionRow}>
            {SITUATION_TEMPLATES.map((item) => (
              <Pressable
                key={item}
                style={[styles.filterChip, recordingContextDraft.situation === item && styles.filterChipActive]}
                onPress={() => setRecordingContextDraft((current) => ({ ...current, situation: item }))}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    recordingContextDraft.situation === item && styles.filterChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.multilineInput}
            multiline
            value={recordingContextDraft.situation}
            onChangeText={(text) => setRecordingContextDraft((current) => ({ ...current, situation: text }))}
            placeholder="예: 아이가 유치원 가기 싫다고 하고, 엄마가 출근 전에 설득하는 상황"
          />
        </View>

        <View style={styles.subsection}>
          <Text style={styles.inputLabel}>톤 템플릿</Text>
          <View style={styles.actionRow}>
            {TONE_TEMPLATES.map((item) => (
              <Pressable
                key={item}
                style={[styles.filterChip, recordingContextDraft.tone === item && styles.filterChipActive]}
                onPress={() => setRecordingContextDraft((current) => ({ ...current, tone: item }))}
              >
                <Text
                  style={[styles.filterChipText, recordingContextDraft.tone === item && styles.filterChipTextActive]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.inlineInput}
            value={recordingContextDraft.tone}
            onChangeText={(text) => setRecordingContextDraft((current) => ({ ...current, tone: text }))}
            placeholder="예: 부드럽지만 단호한 일상 회화"
          />
        </View>

        <View style={styles.linkedExpressionCard}>
          <Text style={styles.linkedExpressionLabel}>분석 상태</Text>
          <Text style={styles.cardText}>
            {hasUnsavedContextChanges || hasUnsavedParticipantChanges
              ? "맥락 힌트나 관련 인물 연결에 저장되지 않은 변경이 있습니다."
              : recording?.analysisStatus === "NEEDS_REVIEW"
              ? "사람 확인 기준으로 대화 분석을 다시 보는 것이 좋습니다."
              : hasAnyAnalysis
              ? "현재 요약과 문장 의도는 최신 분석 기준입니다."
              : "아직 대화 요약 / 문장 의도 분석을 실행하지 않았습니다."}
          </Text>
          {recording?.analysisStatusReason ? (
            <Text style={styles.metaText}>변경 사유: {formatAnalysisStatusReason(recording.analysisStatusReason)}</Text>
          ) : null}
        </View>

        <View style={styles.linkedExpressionCard}>
          <Text style={styles.linkedExpressionLabel}>분석 실행 방식</Text>
          <Text style={styles.metaText}>
            자동을 선택하면 맥락 저장이나 문장 저장 뒤에 대화 요약 / 문장 의도를 바로 다시 분석합니다.
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.filterChip, recordingAnalysisMode === "manual" && styles.filterChipActive]}
              onPress={() => void handleChangeRecordingAnalysisMode("manual")}
            >
              <Text style={[styles.filterChipText, recordingAnalysisMode === "manual" && styles.filterChipTextActive]}>
                수동
              </Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, recordingAnalysisMode === "auto" && styles.filterChipActive]}
              onPress={() => void handleChangeRecordingAnalysisMode("auto")}
            >
              <Text style={[styles.filterChipText, recordingAnalysisMode === "auto" && styles.filterChipTextActive]}>
                자동
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.smallSecondaryButton, savingContext && styles.buttonDisabled]}
            onPress={() => void handleSaveRecordingContext()}
            disabled={savingContext}
          >
            {savingContext ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.smallSecondaryButtonText}>맥락 저장</Text>}
          </Pressable>
          <Pressable
            style={[styles.smallPrimaryButton, analyzingConversation && styles.buttonDisabled]}
            onPress={() => void handleAnalyzeConversation()}
            disabled={analyzingConversation || utteranceCount === 0}
          >
            {analyzingConversation ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.smallPrimaryButtonText}>대화 요약 / 의도 분석</Text>}
          </Pressable>
          {recording?.analysisStatus === "NEEDS_REVIEW" ? (
            <Pressable
              style={[styles.smallSecondaryButton, analysisStatusLoading && styles.buttonDisabled]}
              onPress={() => void handleMarkAnalysisOk()}
              disabled={analysisStatusLoading}
            >
              {analysisStatusLoading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.smallSecondaryButtonText}>이상없음으로 표시</Text>}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.smallPrimaryButton, bulkExpressionLoadingScope === "mine" && styles.buttonDisabled]}
            onPress={() => void handleGenerateExpressionsBulk("mine")}
            disabled={bulkExpressionLoadingScope.length > 0 || pendingMineExpressionCount === 0}
          >
            {bulkExpressionLoadingScope === "mine" ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.smallPrimaryButtonText}>
                {`내 문장 일괄 표현 생성 (${pendingMineExpressionCount})`}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.smallSecondaryButton, bulkExpressionLoadingScope === "others" && styles.buttonDisabled]}
            onPress={() => void handleGenerateExpressionsBulk("others")}
            disabled={bulkExpressionLoadingScope.length > 0 || pendingOthersExpressionCount === 0}
          >
            {bulkExpressionLoadingScope === "others" ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.smallSecondaryButtonText}>
                {`기타 화자 일괄 표현 생성 (${pendingOthersExpressionCount})`}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>대화 요약 / 분석 결과</Text>
        <Text style={styles.cardText}>{recording?.analysisSummary?.trim() || "아직 분석된 대화 요약이 없습니다."}</Text>
        <Text style={styles.cardText}>관계: {recording?.analysisRelationship?.trim() || "-"}</Text>
        <Text style={styles.cardText}>상황: {recording?.analysisSituation?.trim() || "-"}</Text>
        <Text style={styles.cardText}>톤: {recording?.analysisTone?.trim() || "-"}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>화자 설정 / 인물 연결</Text>
        <Text style={styles.metaText}>
          diarization 결과가 완벽하지 않을 수 있으니, 내 화자 지정과 화자별 인물 연결을 한 번 더 확인해 주세요.
        </Text>
        {speakers.length > 0 ? (
          speakers.map((speakerLabel) => {
            const mine = recording?.utterances.some((item) => item.speakerLabel === speakerLabel && item.isMine);
            const linkedProfileId = speakerProfileDrafts[speakerLabel] ?? "";
            return (
              <View key={speakerLabel} style={styles.utteranceCard}>
                <View style={styles.actionRow}>
                  <Pressable
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
                </View>

                <Text style={styles.inputLabel}>화자 이름</Text>
                <View style={styles.actionRow}>
                  <TextInput
                    style={styles.inlineInputGrow}
                    value={speakerLabelDrafts[speakerLabel] ?? speakerLabel}
                    onChangeText={(text) =>
                      setSpeakerLabelDrafts((current) => ({
                        ...current,
                        [speakerLabel]: text,
                      }))
                    }
                    placeholder="예: 나, 엄마, 아이"
                  />
                  <Pressable
                    style={[styles.smallSecondaryButton, speakerLabelLoading === speakerLabel && styles.buttonDisabled]}
                    onPress={() => void handleUpdateSpeakerLabel(speakerLabel)}
                    disabled={
                      speakerLabelLoading === speakerLabel ||
                      !(speakerLabelDrafts[speakerLabel] ?? "").trim() ||
                      (speakerLabelDrafts[speakerLabel] ?? "").trim() === speakerLabel
                    }
                  >
                    {speakerLabelLoading === speakerLabel ? (
                      <ActivityIndicator color="#0f172a" />
                    ) : (
                      <Text style={styles.smallSecondaryButtonText}>이름 저장</Text>
                    )}
                  </Pressable>
                </View>

                <Text style={styles.inputLabel}>인물 연결</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.filterChip, !linkedProfileId && styles.filterChipActive]}
                    onPress={() => void handleUpdateSpeakerProfile(speakerLabel)}
                  >
                    <Text style={[styles.filterChipText, !linkedProfileId && styles.filterChipTextActive]}>직접 연결 안 함</Text>
                  </Pressable>
                  {personProfiles.map((profile) => {
                    const selected = linkedProfileId === profile.id;
                    return (
                      <Pressable
                        key={`${speakerLabel}-${profile.id}`}
                        style={[styles.filterChip, selected && styles.filterChipActive]}
                        onPress={() => void handleUpdateSpeakerProfile(speakerLabel, profile.id)}
                        disabled={speakerProfileLoading === speakerLabel}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                          {profile.name}
                          {profile.roleLabel ? ` (${profile.roleLabel})` : ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.metaText}>아직 식별된 화자가 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>STT 문장 목록</Text>
        <View style={styles.actionRow}>
          {([
            ["all", `전체 ${utteranceCount}`],
            ["mine", `내 화자 ${recording?.utterances.filter((item) => item.isMine).length ?? 0}`],
            ["others", `다른 화자 ${recording?.utterances.filter((item) => !item.isMine).length ?? 0}`],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.filterChip, utteranceFilter === value && styles.filterChipActive]}
              onPress={() => setUtteranceFilter(value)}
            >
              <Text style={[styles.filterChipText, utteranceFilter === value && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {utteranceCount > 0 ? (
          filteredUtterances.map((utterance) => {
            const originalText = utterance.koreanText;
            const draftText = utteranceDrafts[utterance.id] ?? originalText;
            const draftSpeakerLabel = utteranceSpeakerDrafts[utterance.id] ?? utterance.speakerLabel;
            const draftContextNote = utteranceContextDrafts[utterance.id] ?? utterance.contextNote ?? "";
            const hasDraftChange =
              draftText.trim() !== originalText.trim() ||
              draftSpeakerLabel.trim() !== utterance.speakerLabel.trim() ||
              draftContextNote.trim() !== (utterance.contextNote ?? "").trim();
            const linkedExpression = getExpressionForUtterance(utterance.id);
            const originalIndex = (recording?.utterances ?? []).findIndex((item) => item.id === utterance.id);
            return (
              <View key={utterance.id} style={styles.utteranceCard}>
                <Text style={styles.utteranceHeader}>
                  {originalIndex + 1}. {utterance.speakerLabel}
                  {utterance.isMine ? " · 내 화자" : ""}
                </Text>
                <Text style={styles.utteranceTiming}>
                  {formatTimeline(utterance.startMs)} - {formatTimeline(utterance.endMs)}
                </Text>
                <Pressable
                  style={[styles.smallSecondaryButton, rawAudioLoadingId === utterance.id && styles.buttonDisabled]}
                  onPress={() => void handlePlayUtteranceAudio(utterance.id, utterance.startMs, utterance.endMs)}
                  disabled={rawAudioLoadingId === utterance.id}
                >
                  {rawAudioLoadingId === utterance.id ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : (
                    <Text style={styles.smallSecondaryButtonText}>
                      {playingRawUtteranceId === utterance.id ? "원본 듣기 정지" : "원본 듣기"}
                    </Text>
                  )}
                </Pressable>
                {playingRawUtteranceId === utterance.id ? (
                  <Text style={styles.metaText}>
                    클립 재생 중 {formatClipDuration(Math.max(0, rawAudioProgressMs - utterance.startMs))} /{" "}
                    {formatClipDuration(Math.max(0, utterance.endMs - utterance.startMs))}
                  </Text>
                ) : null}

                <Text style={styles.inputLabel}>발화 화자</Text>
                <View style={styles.actionRow}>
                  {speakers.map((speakerLabel) => {
                    const selected = draftSpeakerLabel === speakerLabel;
                    return (
                      <Pressable
                        key={`${utterance.id}-${speakerLabel}`}
                        style={[styles.filterChip, selected && styles.filterChipActive]}
                        onPress={() =>
                          setUtteranceSpeakerDrafts((current) => ({
                            ...current,
                            [utterance.id]: speakerLabel,
                          }))
                        }
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{speakerLabel}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>문장</Text>
                <TextInput
                  style={styles.utteranceInput}
                  multiline
                  value={draftText}
                  onChangeText={(text) =>
                    setUtteranceDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [utterance.id]: text,
                    }))
                  }
                />

                <Text style={styles.inputLabel}>맥락 메모</Text>
                <TextInput
                  style={styles.multilineInput}
                  multiline
                  value={draftContextNote}
                  onChangeText={(text) =>
                    setUtteranceContextDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [utterance.id]: text,
                    }))
                  }
                  placeholder="이 문장의 상황, 의도, 말투 힌트를 적어두면 다음 분석과 표현 생성에 반영됩니다."
                />

                {hasDraftChange ? <Text style={styles.warningText}>저장되지 않은 문장 / 화자 / 메모 수정이 있습니다.</Text> : null}
                {utterance.analysisIntent ? <Text style={styles.metaText}>의도: {utterance.analysisIntent}</Text> : null}
                {linkedExpression ? (
                  <View style={styles.linkedExpressionCard}>
                    <Text style={styles.linkedExpressionLabel}>연결된 표현</Text>
                    <Text style={styles.linkedExpressionText}>{linkedExpression.englishBase}</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.smallPrimaryButton, savingUtteranceId === utterance.id && styles.buttonDisabled]}
                    onPress={() => void handleSaveUtterance(utterance.id)}
                    disabled={savingUtteranceId === utterance.id || deletingUtteranceId === utterance.id}
                  >
                    {savingUtteranceId === utterance.id ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.smallPrimaryButtonText}>문장 / 메모 저장</Text>
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
                      <Text style={styles.smallPrimaryButtonText}>표현 생성</Text>
                    )}
                  </Pressable>
                  {linkedExpression ? (
                    <Pressable style={styles.smallSecondaryButton} onPress={() => router.push(`/expression/${linkedExpression.id}`)}>
                      <Text style={styles.smallSecondaryButtonText}>표현 보기</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.metaText}>아직 표시할 문장이 없습니다.</Text>
        )}
        {utteranceCount > 0 && filteredUtterances.length === 0 ? (
          <Text style={styles.metaText}>현재 필터에 맞는 문장이 없습니다.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>생성된 영어 표현</Text>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.smallSecondaryButton, bulkTtsLoading && styles.buttonDisabled]}
            onPress={() => void handleGenerateTtsBulk()}
            disabled={bulkTtsLoading || pendingRecordingTtsCount === 0}
          >
            {bulkTtsLoading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.smallSecondaryButtonText}>
                {`남은 TTS 일괄 생성 (${pendingRecordingTtsCount})`}
              </Text>
            )}
          </Pressable>
        </View>
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
                <Pressable style={styles.smallSecondaryButton} onPress={() => router.push(`/expression/${expression.id}`)}>
                  <Text style={styles.smallSecondaryButtonText}>상세 보기</Text>
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
  cardText: {
    color: "#334155",
    lineHeight: 21,
  },
  metaText: {
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
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  subsection: {
    gap: 10,
  },
  inputLabel: {
    color: "#0f172a",
    fontWeight: "700",
  },
  speakerChip: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  speakerChipActive: {
    backgroundColor: "#2563eb",
  },
  speakerChipText: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
  speakerChipTextActive: {
    color: "#ffffff",
  },
  filterChip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  filterChipActive: {
    backgroundColor: "#dbeafe",
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#1d4ed8",
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  inlineInputGrow: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#0f172a",
    backgroundColor: "#ffffff",
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    color: "#0f172a",
    backgroundColor: "#ffffff",
    textAlignVertical: "top",
  },
  utteranceCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  utteranceHeader: {
    color: "#0f172a",
    fontWeight: "800",
  },
  utteranceTiming: {
    color: "#64748b",
    fontSize: 12,
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
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  warningText: {
    color: "#b45309",
    lineHeight: 20,
  },
  linkedExpressionCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  linkedExpressionLabel: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  linkedExpressionText: {
    color: "#0f172a",
    lineHeight: 20,
  },
  smallPrimaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  smallSecondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  smallDangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  smallPrimaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  smallSecondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800",
  },
  expressionCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f8fbff",
  },
  expressionKorean: {
    color: "#475569",
    lineHeight: 20,
  },
  expressionBase: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 24,
  },
  expressionSub: {
    color: "#334155",
    lineHeight: 20,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
});
