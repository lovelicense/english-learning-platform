import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, router } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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

type RecordedClip = {
  uri: string;
  durationMs: number;
  fileName: string;
  contentType?: string | null;
};

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

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      void releaseActiveRecording();
    };
  }, []);

  useEffect(() => {
    if (!sessionMeta?.sessionId) return;
    if (!session) return;
    if (!["QUEUED", "PROCESSING", "UPLOADING", "UPLOADED"].includes(session.status)) return;

    const timeout = setTimeout(() => {
      void refreshSessionSilently(sessionMeta.sessionId);
    }, 4000);

    return () => clearTimeout(timeout);
  }, [sessionMeta?.sessionId, session]);

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

      setRecordedClip({
        uri,
        durationMs,
        fileName,
        contentType: "mediaType" in status && typeof status.mediaType === "string" ? status.mediaType : null,
      });
      setRecordingElapsedMs(durationMs);
      setMessage("녹음이 저장되었습니다. 이제 `녹음 업로드 + 처리 시작`으로 STT 파이프라인까지 바로 연결할 수 있습니다.");
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

  async function handleUploadRecordedClip() {
    if (!recordedClip) {
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
      const uploadPayload = await getRecordedClipUploadPayload(recordedClip);

      const existingPartCount = session?.parts.length ?? 0;
      const partNumber = existingPartCount + 1;
      const contentType = uploadPayload.contentType || guessAudioContentType(recordedClip.fileName);
      const uploadFileName = ensureAudioFileName(recordedClip.fileName, contentType);

      const presign = await createRecordingSessionPartPresign(activeSession.sessionId, {
        partNumber,
        fileName: uploadFileName,
        contentType,
        sizeBytes: uploadPayload.sizeBytes,
      });

      setMessage(`녹음 파일을 업로드 중입니다. part ${partNumber}/1`);

      await uploadRecordedClipToPresignedUrl(presign.uploadUrl, uploadPayload, contentType, setUploadPercent);

      const completed = await completeRecordingSessionPart(activeSession.sessionId, presign.partId, {
        durationMs: recordedClip.durationMs,
        sizeBytes: uploadPayload.sizeBytes,
      });
      setLatestRecordingId(completed.recordingId);

      await finalizeRecordingSession(activeSession.sessionId, partNumber, recordedClip.durationMs);
      await enqueueRecordingSessionProcessing(activeSession.sessionId, true);
      const next = await fetchRecordingSession(activeSession.sessionId);
      setSession(next);
      setUploadPercent(100);
      setMessage("녹음 업로드와 STT 처리 요청까지 완료했습니다. 이제 worker 결과를 기다리면 됩니다.");
      router.push(`/recording/${completed.recordingId}`);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Recording MVP</Text>
      <Text style={styles.description}>
        모바일에서는 먼저 실제 녹음을 안정적으로 만들고, 그 다음 업로드 세션과 STT 파이프라인을 연결하는 순서가 가장 안전합니다.
      </Text>

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
          {uploading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>녹음 업로드 + 처리 시작</Text>}
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

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.primaryButton, (creating || isRecording) && styles.buttonDisabled]}
            onPress={() => void handleCreateSession()}
            disabled={creating || isRecording}
          >
            {creating ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>모바일 세션 생성</Text>}
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
            {finalizing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>Finalize</Text>}
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, (!canProcess || processing) && styles.buttonDisabled]}
            onPress={() => void handleProcess()}
            disabled={!canProcess || processing}
          >
            {processing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>Process</Text>}
          </Pressable>
        </View>
        {!canFinalize ? <Text style={styles.metaText}>업로드된 파트가 있어야 finalize를 호출할 수 있습니다.</Text> : null}
        {!canProcess ? <Text style={styles.metaText}>세션이 `UPLOADED` 상태이고 업로드 파트가 있어야 process를 호출할 수 있습니다.</Text> : null}
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
        <Text style={styles.cardText}>status: {session?.status ?? sessionMeta?.status ?? "-"}</Text>
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
