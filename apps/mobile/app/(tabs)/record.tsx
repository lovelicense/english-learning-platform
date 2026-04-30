import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useFocusEffect, Link, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  completeRecordingSessionPart,
  createRecordingSession,
  createRecordingSessionPartPresign,
  enqueueRecordingSessionProcessing,
  fetchRecordingSession,
  finalizeRecordingSession,
  type RecordingSessionCreateResponse,
  type RecordingSessionStatusResponse,
} from "../../src/lib/api/recording-sessions";
import {
  deleteRecording,
  listRecordings,
  reprocessRecording,
  type RecordingSummaryResponse,
} from "../../src/lib/api/recordings";
import {
  DEFAULT_RECORDING_PREFERENCES,
  getRecordingPreferences,
  type RecordingPreferences,
} from "../../src/lib/recording-preferences";

type RecordedClip = {
  uri: string;
  durationMs: number;
  fileName: string;
  contentType?: string | null;
};

type RecordingListFilter = "all" | "processed" | "processing" | "needs_review";

export default function RecordScreen() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [latestRecordingId, setLatestRecordingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionMeta, setSessionMeta] = useState<RecordingSessionCreateResponse | null>(null);
  const [session, setSession] = useState<RecordingSessionStatusResponse | null>(null);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingPreferences>(DEFAULT_RECORDING_PREFERENCES);
  const [pendingAutoUploadClip, setPendingAutoUploadClip] = useState<RecordedClip | null>(null);
  const [recordings, setRecordings] = useState<RecordingSummaryResponse[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);
  const [recordingActionLoadingId, setRecordingActionLoadingId] = useState("");
  const [recordingsQuery, setRecordingsQuery] = useState("");
  const [recordingsFilter, setRecordingsFilter] = useState<RecordingListFilter>("all");

  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const elapsedLabel = useMemo(() => formatDurationMs(isRecording ? recordingElapsedMs : session?.totalDurationMs), [isRecording, recordingElapsedMs, session?.totalDurationMs]);
  const clipDurationLabel = useMemo(() => formatDurationMs(recordedClip?.durationMs), [recordedClip?.durationMs]);
  const recommendedPartLabel = useMemo(
    () => formatDurationMs(sessionMeta?.recommendedPartDurationMs),
    [sessionMeta?.recommendedPartDurationMs],
  );
  const maxDurationLabel = useMemo(() => formatDurationMs(sessionMeta?.maxDurationMs), [sessionMeta?.maxDurationMs]);
  const canFinalize = Boolean(sessionMeta?.sessionId && (session?.parts.length ?? 0) > 0);
  const canProcess = Boolean(sessionMeta?.sessionId && session?.status === "UPLOADED" && (session?.parts.length ?? 0) > 0);
  const currentSessionStatus = session?.status ?? sessionMeta?.status ?? "NOT_STARTED";
  const nextActionHint = useMemo(() => {
    if (isRecording) {
      return "녹음을 끝내면 로컬 파일 저장 단계로 넘어갑니다.";
    }
    if (uploading) {
      return "업로드와 처리 요청이 진행 중입니다. 완료 후 결과 화면으로 이어집니다.";
    }
    if (!recordedClip) {
      return "먼저 실제 음성을 녹음해 파일을 만들어 주세요.";
    }
    if (!sessionMeta?.sessionId) {
      return "지금은 녹음 파일이 준비된 상태입니다. 바로 업로드하거나 세션을 먼저 만들어도 됩니다.";
    }
    if (canProcess) {
      return "업로드는 끝났고, 이제 처리 요청만 보내면 STT 파이프라인이 시작됩니다.";
    }
    if (canFinalize) {
      return "업로드된 파트가 있습니다. finalize 후 process로 이어갈 수 있습니다.";
    }
    return "녹음 파일 업로드와 처리 시작까지 한 번에 진행할 수 있습니다.";
  }, [isRecording, uploading, recordedClip, sessionMeta?.sessionId, canProcess, canFinalize]);
  const sessionStatusTone = useMemo(() => getSessionStatusTone(currentSessionStatus), [currentSessionStatus]);
  const filteredRecordings = useMemo(() => {
    const query = recordingsQuery.trim().toLowerCase();
    return recordings.filter((item) => {
      if (recordingsFilter === "processed" && item.status !== "PROCESSED") return false;
      if (recordingsFilter === "processing" && !["UPLOADED", "PROCESSING", "QUEUED"].includes(item.status)) return false;
      if (recordingsFilter === "needs_review" && item.analysisStatus !== "NEEDS_REVIEW") return false;
      if (!query) return true;
      return (
        item.fileName.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query) ||
        (item.analysisStatus ?? "").toLowerCase().includes(query)
      );
    });
  }, [recordings, recordingsFilter, recordingsQuery]);

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      void releaseActiveRecording();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecordingPreferences();
      void refreshRecordings();
    }, []),
  );

  useEffect(() => {
    if (!sessionMeta?.sessionId) return;
    if (!session) return;
    if (!["QUEUED", "PROCESSING", "UPLOADING", "UPLOADED"].includes(session.status)) return;

    const timeout = setTimeout(() => {
      void refreshSessionSilently(sessionMeta.sessionId);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [sessionMeta?.sessionId, session]);

  useEffect(() => {
    if (!pendingAutoUploadClip || uploading || recordingBusy || isRecording) return;

    const clip = pendingAutoUploadClip;
    setPendingAutoUploadClip(null);
    void handleUploadRecordedClip(clip);
  }, [pendingAutoUploadClip, uploading, recordingBusy, isRecording]);

  async function loadRecordingPreferences() {
    const next = await getRecordingPreferences();
    setRecordingPreferences(next);
    setTitle((current) => (current.trim() ? current : next.defaultSessionTitle));
  }

  async function refreshRecordings() {
    setRecordingsLoading(true);
    try {
      const next = await listRecordings();
      setRecordings(next);
    } finally {
      setRecordingsLoading(false);
    }
  }

  async function handleCreateSession() {
    setCreating(true);
    setError("");
    setMessage("");
    try {
      const created = await createRecordingSession(title);
      setSessionMeta(created);
      const status = await fetchRecordingSession(created.sessionId);
      setSession(status);
      setMessage("모바일 녹음 세션이 생성되었습니다. 이제 실제 녹음 파일을 이 세션에 업로드하는 단계만 남았습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 세션 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRefresh() {
    if (!sessionMeta?.sessionId) return;
    setRefreshing(true);
    setError("");
    try {
      await refreshSessionSilently(sessionMeta.sessionId);
      setMessage("세션 상태를 새로고침했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 조회에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleFinalize() {
    if (!sessionMeta?.sessionId) return;
    setFinalizing(true);
    setError("");
    setMessage("");
    try {
      const result = await finalizeRecordingSession(sessionMeta.sessionId, session?.parts.length ?? undefined, session?.totalDurationMs ?? undefined);
      const next = await fetchRecordingSession(sessionMeta.sessionId);
      setSession(next);
      setMessage(`세션을 finalize 했습니다. 현재 상태는 ${result.status} 입니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 finalize에 실패했습니다.");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleProcess() {
    if (!sessionMeta?.sessionId) return;
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const result = await enqueueRecordingSessionProcessing(sessionMeta.sessionId, true);
      const next = await fetchRecordingSession(sessionMeta.sessionId);
      setSession(next);
      setMessage(`처리를 큐에 등록했습니다. queuedJobCount=${result.queuedJobCount}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 처리 요청에 실패했습니다.");
    } finally {
      setProcessing(false);
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
      setMessage("녹음을 시작했습니다. 끝나면 `녹음 종료`를 눌러 주세요.");
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
      const nextClip = {
        uri,
        durationMs,
        fileName,
        contentType: "mediaType" in status && typeof status.mediaType === "string" ? status.mediaType : null,
      } satisfies RecordedClip;

      setRecordedClip(nextClip);
      setRecordingElapsedMs(durationMs);
      if (recordingPreferences.autoUploadAfterStop) {
        setMessage("녹음이 저장되었습니다. 설정에 따라 업로드와 처리 요청을 자동으로 시작합니다.");
        setPendingAutoUploadClip(nextClip);
      } else {
        setMessage("녹음이 저장되었습니다. 이제 `녹음 업로드 + 처리 시작`으로 STT 파이프라인까지 바로 연결할 수 있습니다.");
      }
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

  async function refreshSessionSilently(sessionId: string) {
    const next = await fetchRecordingSession(sessionId);
    setSession(next);
  }

  async function handleUploadRecordedClip(clipOverride?: RecordedClip) {
    const targetClip = clipOverride ?? recordedClip;
    if (!targetClip) {
      setError("먼저 음성을 녹음해 주세요.");
      return;
    }

    if (uploading || creating || finalizing || processing || isRecording) return;

    setUploading(true);
    setUploadPercent(1);
    setError("");
    setMessage("녹음 파일 업로드를 준비하고 있습니다.");

    try {
      const activeSession = await ensureUploadSession();
      const uploadPayload = await getRecordedClipUploadPayload(targetClip);

      const existingPartCount = session?.parts.length ?? 0;
      const partNumber = existingPartCount + 1;
      const contentType = uploadPayload.contentType || guessAudioContentType(targetClip.fileName);
      const uploadFileName = ensureAudioFileName(targetClip.fileName, contentType);

      const presign = await createRecordingSessionPartPresign(activeSession.sessionId, {
        partNumber,
        fileName: uploadFileName,
        contentType,
        sizeBytes: uploadPayload.sizeBytes,
      });

      setMessage(`녹음 파일을 업로드 중입니다. part ${partNumber}/1`);

      await uploadRecordedClipToPresignedUrl(presign.uploadUrl, uploadPayload, contentType, setUploadPercent);

      const completed = await completeRecordingSessionPart(activeSession.sessionId, presign.partId, {
        durationMs: targetClip.durationMs,
        sizeBytes: uploadPayload.sizeBytes,
      });
      setLatestRecordingId(completed.recordingId);

      await finalizeRecordingSession(activeSession.sessionId, partNumber, targetClip.durationMs);
      await enqueueRecordingSessionProcessing(activeSession.sessionId, true);
      const next = await fetchRecordingSession(activeSession.sessionId);
      setSession(next);
      setUploadPercent(100);
      setMessage("녹음 업로드와 STT 처리 요청까지 완료했습니다. 이제 worker 결과를 기다리면 됩니다.");
      await refreshRecordings();
      if (recordingPreferences.openResultAfterUpload) {
        router.push(`/recording/${completed.recordingId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function ensureUploadSession() {
    if (sessionMeta?.sessionId && !shouldCreateFreshSession(session?.status)) {
      return sessionMeta;
    }

    const created = await createRecordingSession(title);
    setSessionMeta(created);
    const status = await fetchRecordingSession(created.sessionId);
    setSession(status);
    return created;
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

  async function handleOpenRecording(recordingId: string) {
    router.push(`/recording/${recordingId}`);
  }

  async function handleReprocessRecording(recordingId: string) {
    setRecordingActionLoadingId(`reprocess-${recordingId}`);
    setError("");
    setMessage("");
    try {
      await reprocessRecording(recordingId, true);
      await refreshRecordings();
      setMessage("텍스트 변환을 다시 실행했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "텍스트 변환 다시 실행에 실패했습니다.");
    } finally {
      setRecordingActionLoadingId("");
    }
  }

  async function runDeleteRecording(recordingId: string) {
    setRecordingActionLoadingId(`delete-${recordingId}`);
    setError("");
    setMessage("");
    try {
      await deleteRecording(recordingId);
      setRecordings((current) => current.filter((item) => item.id !== recordingId));
      setMessage("녹음을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 삭제에 실패했습니다.");
    } finally {
      setRecordingActionLoadingId("");
    }
  }

  function handleDeleteRecording(recording: RecordingSummaryResponse) {
    const message = `"${recording.fileName}" 녹음을 삭제할까요? 이미 생성한 영어 표현은 유지됩니다.`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(message)) {
        void runDeleteRecording(recording.id);
      }
      return;
    }

    Alert.alert("녹음 삭제", message, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void runDeleteRecording(recording.id) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Recording MVP</Text>
      <Text style={styles.description}>
        모바일에서는 먼저 실제 녹음을 안정적으로 만들고, 그 다음 업로드 세션과 STT 파이프라인을 연결하는 순서가 가장 안전합니다.
      </Text>

      <View style={[styles.statusSummaryCard, sessionStatusTone === "success" && styles.statusSummarySuccess, sessionStatusTone === "warning" && styles.statusSummaryWarning]}>
        <Text style={styles.statusSummaryLabel}>현재 상태</Text>
        <Text style={styles.statusSummaryValue}>{formatSessionStatusLabel(currentSessionStatus)}</Text>
        <Text style={styles.statusSummaryHint}>{nextActionHint}</Text>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>{isRecording ? "현재 녹음 길이" : "최근 녹음 길이"}</Text>
        <Text style={styles.timerValue}>{elapsedLabel}</Text>
        <Text style={styles.timerHint}>
          {isRecording
            ? "녹음 중에는 언제든 종료할 수 있습니다."
            : "이제 실제 녹음 파일을 바로 업로드하고 STT 처리 큐까지 연결할 수 있습니다."}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>녹음 제어</Text>
        <Text style={styles.metaText}>권한 상태: {formatPermissionLabel(recordingPermission)}</Text>
        <Text style={styles.metaText}>
          기본 제목: {recordingPreferences.defaultSessionTitle || "없음"} / 자동 업로드: {recordingPreferences.autoUploadAfterStop ? "켜짐" : "꺼짐"} / 업로드 후 결과 열기: {recordingPreferences.openResultAfterUpload ? "켜짐" : "꺼짐"}
        </Text>
        <Text style={styles.metaText}>
          {recordedClip ? "녹음 파일이 준비되었습니다. 업로드를 시작하면 finalize/process까지 자동으로 이어집니다." : "아직 저장된 녹음 파일이 없습니다. 먼저 녹음을 시작해 주세요."}
        </Text>
        <View style={styles.buttonRow}>
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
        </View>
        <Pressable
          style={[styles.uploadButton, (!recordedClip || uploading || recordingBusy || isRecording) && styles.buttonDisabled]}
          onPress={() => void handleUploadRecordedClip()}
          disabled={!recordedClip || uploading || recordingBusy || isRecording}
        >
          {uploading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>업로드하고 처리 시작</Text>}
        </Pressable>
        {uploading ? <Text style={styles.metaText}>업로드 진행률: {uploadPercent}%</Text> : null}
        {latestRecordingId ? (
          <Link href={`/recording/${latestRecordingId}`} asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>최근 결과 보기</Text>
            </Pressable>
          </Link>
        ) : null}
        {recordedClip ? (
          <View style={styles.clipCard}>
            <Text style={styles.partTitle}>저장된 음성 파일</Text>
            <Text style={styles.partMeta}>file: {recordedClip.fileName}</Text>
            <Text style={styles.partMeta}>duration: {clipDurationLabel}</Text>
            <Text style={styles.clipUri}>{recordedClip.uri}</Text>
          </View>
        ) : (
          <Text style={styles.metaText}>아직 저장된 음성 파일이 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세션 제목</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 안드로이드 장시간 녹음"
          value={title}
          onChangeText={setTitle}
        />
        <Text style={styles.metaText}>source는 자동으로 `MOBILE`로 저장됩니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세션 제어</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Text style={styles.metaText}>세션을 수동으로 나눠 제어하고 싶을 때만 아래 버튼을 사용하면 됩니다.</Text>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.primaryButton, (creating || isRecording) && styles.buttonDisabled]}
            onPress={() => void handleCreateSession()}
            disabled={creating || isRecording}
          >
            {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>세션 먼저 만들기</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, (!sessionMeta?.sessionId || refreshing) && styles.buttonDisabled]}
            onPress={() => void handleRefresh()}
            disabled={!sessionMeta?.sessionId || refreshing}
          >
            {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>상태 새로고침</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, (!canFinalize || finalizing) && styles.buttonDisabled]}
            onPress={() => void handleFinalize()}
            disabled={!canFinalize || finalizing}
          >
            {finalizing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>업로드 마감</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, (!canProcess || processing) && styles.buttonDisabled]}
            onPress={() => void handleProcess()}
            disabled={!canProcess || processing}
          >
            {processing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>처리 요청</Text>}
          </Pressable>
        </View>
        {!canFinalize ? <Text style={styles.metaText}>업로드된 파트가 있어야 `업로드 마감`을 호출할 수 있습니다.</Text> : null}
        {!canProcess ? <Text style={styles.metaText}>세션이 `UPLOADED` 상태여야 `처리 요청`을 보낼 수 있습니다.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세션 가이드</Text>
        <Text style={styles.cardText}>권장 파트 길이: {recommendedPartLabel}</Text>
        <Text style={styles.cardText}>최대 길이: {maxDurationLabel}</Text>
        <Text style={styles.cardText}>현재 완료 범위: 실제 음성 녹음, 로컬 파일 저장, presign 업로드, finalize, process 요청</Text>
        <Text style={styles.cardText}>다음 구현 순서: STT 결과 상세 화면, 문장 수정, 내 화자 선택</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>현재 세션 상태</Text>
        <Text style={styles.cardText}>sessionId: {sessionMeta?.sessionId ?? "-"}</Text>
        <Text style={styles.cardText}>status: {formatSessionStatusLabel(currentSessionStatus)}</Text>
        <Text style={styles.cardText}>uploadedPartCount: {session?.uploadedPartCount ?? 0}</Text>
        <Text style={styles.cardText}>expectedPartCount: {session?.expectedPartCount ?? "-"}</Text>
        <Text style={styles.cardText}>totalDurationMs: {session?.totalDurationMs ?? "-"}</Text>
        <Text style={styles.cardText}>jobs: {session?.jobs.length ?? 0}</Text>
        {session?.errorMessage ? <Text style={styles.error}>error: {session.errorMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>업로드 파트</Text>
        {session?.parts?.length ? (
          session.parts.map((part) => (
            <View key={part.id} style={styles.partRow}>
              <Text style={styles.partTitle}>Part {part.partNumber}</Text>
              <Text style={styles.partMeta}>{part.status}</Text>
              <Text style={styles.partMeta}>{part.fileName}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>아직 업로드된 파트가 없습니다.</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.recordingSectionHead}>
          <View style={styles.recordingSectionTitleWrap}>
            <Text style={styles.cardTitle}>최근 녹음</Text>
            <Text style={styles.metaText}>이전에 처리한 녹음을 다시 열거나, 필요할 때 다시 처리 / 삭제할 수 있습니다.</Text>
          </View>
          <Pressable
            style={[styles.secondaryButton, recordingsLoading && styles.buttonDisabled]}
            onPress={() => void refreshRecordings()}
            disabled={recordingsLoading}
          >
            {recordingsLoading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>새로고침</Text>}
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="파일명이나 상태로 검색"
          value={recordingsQuery}
          onChangeText={setRecordingsQuery}
        />
        <View style={styles.buttonRow}>
          {([
            ["all", `전체 ${recordings.length}`],
            ["processed", `처리 완료 ${recordings.filter((item) => item.status === "PROCESSED").length}`],
            ["processing", `처리 중 ${recordings.filter((item) => ["UPLOADED", "PROCESSING", "QUEUED"].includes(item.status)).length}`],
            ["needs_review", `재검토 ${recordings.filter((item) => item.analysisStatus === "NEEDS_REVIEW").length}`],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              style={[styles.filterChip, recordingsFilter === value && styles.filterChipActive]}
              onPress={() => setRecordingsFilter(value)}
            >
              <Text style={[styles.filterChipText, recordingsFilter === value && styles.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {filteredRecordings.length > 0 ? (
          filteredRecordings.map((item, index) => (
            <View key={item.id} style={styles.recordingItemCard}>
              <View style={styles.recordingItemHead}>
                <Text style={styles.recordingItemTitle}>
                  {index + 1}. {item.fileName}
                </Text>
                <View
                  style={[
                    styles.recordingStatusBadge,
                    item.status === "PROCESSED" ? styles.recordingStatusProcessed : styles.recordingStatusPending,
                  ]}
                >
                  <Text
                    style={[
                      styles.recordingStatusBadgeText,
                      item.status === "PROCESSED"
                        ? styles.recordingStatusProcessedText
                        : styles.recordingStatusPendingText,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.metaText}>
                {formatDateTime(item.createdAt)} · 문장 수 {item._count.utterances}개
              </Text>
              <Text style={styles.metaText}>{item.diarization ? "화자 분리 사용" : "화자 분리 없음"}</Text>
              <Text style={styles.metaText}>
                분석 상태: {formatAnalysisStatusLabel(item.analysisStatus)}
                {item.analysisStatusReason ? ` · ${item.analysisStatusReason}` : ""}
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  style={styles.uploadButton}
                  onPress={() => void handleOpenRecording(item.id)}
                  disabled={recordingActionLoadingId.length > 0}
                >
                  <Text style={styles.primaryButtonText}>열기</Text>
                </Pressable>
                {(item.status === "UPLOADED" || item.status === "PROCESSING") && (
                  <Pressable
                    style={[styles.secondaryButton, recordingActionLoadingId === `reprocess-${item.id}` && styles.buttonDisabled]}
                    onPress={() => void handleReprocessRecording(item.id)}
                    disabled={recordingActionLoadingId.length > 0}
                  >
                    {recordingActionLoadingId === `reprocess-${item.id}` ? (
                      <ActivityIndicator color="#0f172a" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>다시 처리</Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={[styles.dangerButton, recordingActionLoadingId === `delete-${item.id}` && styles.buttonDisabled]}
                  onPress={() => handleDeleteRecording(item)}
                  disabled={recordingActionLoadingId.length > 0}
                >
                  {recordingActionLoadingId === `delete-${item.id}` ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>삭제</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>
            {recordings.length === 0 ? "아직 저장된 녹음이 없습니다." : "현재 검색 / 필터 조건에 맞는 녹음이 없습니다."}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>작업 큐</Text>
        {session?.jobs?.length ? (
          session.jobs.map((job) => (
            <View key={job.id} style={styles.partRow}>
              <Text style={styles.partTitle}>{job.type}</Text>
              <Text style={styles.partMeta}>{job.status}</Text>
              <Text style={styles.partMeta}>{formatDateTime(job.createdAt)}</Text>
              {job.errorMessage ? <Text style={styles.error}>{job.errorMessage}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>아직 큐에 등록된 작업이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
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
  const trimmed = fileName.trim() || `recording-${Date.now()}`;
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

function shouldCreateFreshSession(status?: string | null) {
  return status === "PROCESSED" || status === "CANCELLED";
}

function formatSessionStatusLabel(status?: string | null) {
  if (status === "CREATED") return "세션 생성됨";
  if (status === "UPLOADING") return "업로드 중";
  if (status === "UPLOADED") return "업로드 완료";
  if (status === "QUEUED") return "처리 대기";
  if (status === "PROCESSING") return "처리 중";
  if (status === "PROCESSED") return "처리 완료";
  if (status === "FAILED") return "실패";
  if (status === "CANCELLED") return "취소됨";
  return "시작 전";
}

function getSessionStatusTone(status?: string | null) {
  if (status === "PROCESSED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "warning";
  return "default";
}

function getFileNameFromUri(uri: string) {
  const segments = uri.split("/");
  const last = segments[segments.length - 1];
  return last || "recording.m4a";
}

function formatPermissionLabel(permission: "unknown" | "granted" | "denied") {
  if (permission === "granted") return "허용됨";
  if (permission === "denied") return "거부됨";
  return "아직 확인 전";
}

function formatAnalysisStatusLabel(status?: string | null) {
  if (status === "OK") return "이상 없음";
  if (status === "NEEDS_REVIEW") return "재검토 필요";
  if (status === "NOT_ANALYZED") return "아직 분석 전";
  return "분석 정보 없음";
}

function formatDurationMs(value?: number | null) {
  if (!value || value <= 0) return "00:00";
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8fafc",
    padding: 24,
    gap: 16
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
    lineHeight: 20
  },
  statusSummaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#dbeafe"
  },
  statusSummarySuccess: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4"
  },
  statusSummaryWarning: {
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed"
  },
  statusSummaryLabel: {
    color: "#475569",
    fontWeight: "700"
  },
  statusSummaryValue: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "800"
  },
  statusSummaryHint: {
    color: "#334155",
    lineHeight: 20
  },
  timerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 8
  },
  timerLabel: {
    color: "#64748b",
    fontWeight: "600"
  },
  timerValue: {
    fontSize: 40,
    fontWeight: "800",
    color: "#0f172a"
  },
  timerHint: {
    color: "#475569",
    textAlign: "center",
    lineHeight: 20
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  filterChip: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start"
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
  primaryButton: {
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingVertical: 16,
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
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  dangerButton: {
    backgroundColor: "#dc2626",
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center"
  },
  uploadButton: {
    backgroundColor: "#2563eb",
    borderRadius: 999,
    paddingVertical: 16,
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
  metaText: {
    color: "#64748b",
    lineHeight: 20
  },
  success: {
    color: "#15803d",
    lineHeight: 20
  },
  error: {
    color: "#dc2626",
    lineHeight: 20
  },
  clipCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 16,
    padding: 14,
    gap: 4,
    backgroundColor: "#eff6ff"
  },
  clipUri: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 18
  },
  recordingSectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  recordingSectionTitleWrap: {
    flex: 1,
    gap: 6
  },
  recordingItemCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    gap: 8
  },
  recordingItemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  recordingItemTitle: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "700"
  },
  recordingStatusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  recordingStatusProcessed: {
    backgroundColor: "#dbeafe"
  },
  recordingStatusPending: {
    backgroundColor: "#e2e8f0"
  },
  recordingStatusBadgeText: {
    fontSize: 12,
    fontWeight: "800"
  },
  recordingStatusProcessedText: {
    color: "#1d4ed8"
  },
  recordingStatusPendingText: {
    color: "#475569"
  },
  partRow: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 14,
    gap: 4
  },
  partTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  partMeta: {
    color: "#475569"
  }
});
