import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  createRecordingSession,
  enqueueRecordingSessionProcessing,
  fetchRecordingSession,
  finalizeRecordingSession,
  type RecordingSessionCreateResponse,
  type RecordingSessionStatusResponse,
} from "../../src/lib/api/recording-sessions";

export default function RecordScreen() {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionMeta, setSessionMeta] = useState<RecordingSessionCreateResponse | null>(null);
  const [session, setSession] = useState<RecordingSessionStatusResponse | null>(null);

  const elapsedLabel = useMemo(() => formatDurationMs(session?.totalDurationMs), [session?.totalDurationMs]);
  const recommendedPartLabel = useMemo(
    () => formatDurationMs(sessionMeta?.recommendedPartDurationMs),
    [sessionMeta?.recommendedPartDurationMs],
  );
  const maxDurationLabel = useMemo(() => formatDurationMs(sessionMeta?.maxDurationMs), [sessionMeta?.maxDurationMs]);
  const canFinalize = Boolean(sessionMeta?.sessionId && (session?.parts.length ?? 0) > 0);
  const canProcess = Boolean(sessionMeta?.sessionId && session?.status === "UPLOADED" && (session?.parts.length ?? 0) > 0);

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
      setMessage("모바일 녹음 세션이 생성되었습니다. 다음 단계로 실제 오디오 녹음과 파트 업로드를 연결하면 됩니다.");
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

  async function refreshSessionSilently(sessionId: string) {
    const next = await fetchRecordingSession(sessionId);
    setSession(next);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Recording MVP</Text>
      <Text style={styles.description}>
        모바일에서는 먼저 녹음 세션을 만들고, 이후 파트 업로드와 STT 처리를 이어서 붙이는 방식이 가장 안전합니다.
      </Text>

      <View style={styles.timerCard}>
        <Text style={styles.timerLabel}>현재 누적 길이</Text>
        <Text style={styles.timerValue}>{elapsedLabel}</Text>
        <Text style={styles.timerHint}>아직 실제 오디오 녹음은 연결 전입니다. 우선 세션 생성과 상태 조회를 모바일에서 확인합니다.</Text>
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
          <Pressable style={[styles.primaryButton, creating && styles.buttonDisabled]} onPress={() => void handleCreateSession()} disabled={creating}>
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
        <Text style={styles.cardText}>다음 구현 순서: Expo 오디오 녹음, presign 업로드, finalize, process polling</Text>
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
