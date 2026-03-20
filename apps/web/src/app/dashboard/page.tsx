"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiFetch, createPresignedUploadTask } from "../../lib/api-client";
import { clearSession, getStoredUser, getToken } from "../../lib/auth";
import { startRecordedAudioSession, type RecordingSession } from "../../lib/recorder";

type MeResponse = { userId: string; email: string };
type PresignResponse = { key: string; uploadUrl: string; recordingId: string };
type RecordingUtterance = {
  id: string;
  speakerLabel: string;
  koreanText: string;
  startMs: number;
  endMs: number;
  isMine: boolean;
};
type RecordingResponse = {
  id: string;
  fileName: string;
  status: string;
  utterances: RecordingUtterance[];
};
type Expression = {
  id: string;
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  note?: string | null;
  ttsKey?: string | null;
};
type TtsResponse = { expressionId: string; ttsKey: string; ttsUrl: string; expression: string };
type PracticeScore = { id: string; score: number; feedback: string; target: string };
type ReviewItem = { id: string; korean: string; english: string; mastery: number; ttsKey?: string | null };

type FlowStep = {
  id: string;
  label: string;
  description: string;
  progress: number;
};

const RECORDING_OPTIONS = [
  { label: "5초", value: 5000 },
  { label: "10초", value: 10000 },
  { label: "15초", value: 15000 },
  { label: "20초", value: 20000 },
];

const AUTO_FLOW_STEPS: FlowStep[] = [
  { id: "record-start", label: "녹음 준비", description: "브라우저 마이크 권한과 녹음을 시작합니다.", progress: 5 },
  { id: "recording", label: "녹음 중", description: "선택한 시간 동안 샘플 발화를 녹음합니다.", progress: 12 },
  { id: "presign", label: "업로드 준비", description: "S3 업로드용 presigned URL을 요청합니다.", progress: 20 },
  { id: "upload", label: "S3 업로드", description: "오디오 파일을 스토리지에 업로드합니다.", progress: 34 },
  { id: "transcribe", label: "STT 전사", description: "한국어 음성을 문장 단위로 전사합니다.", progress: 50 },
  { id: "mine", label: "내 문장 추출", description: "내 화자 문장을 우선 추출합니다.", progress: 62 },
  { id: "expressions", label: "영어 표현 생성", description: "선택된 문장을 영어 표현으로 변환합니다.", progress: 78 },
  { id: "tts", label: "TTS 생성", description: "첫 번째 표현의 영어 음성을 생성합니다.", progress: 90 },
  { id: "reviews", label: "복습 목록 갱신", description: "표현장과 오늘 복습 목록을 새로고침합니다.", progress: 96 },
  { id: "complete", label: "완료", description: "테스트 영역으로 이동해 바로 연습합니다.", progress: 100 },
];

const STEP_TIMEOUTS: Record<string, number> = {
  "record-start": 10000,
  recording: 30000,
  presign: 15000,
  upload: 60000,
  transcribe: 90000,
  mine: 10000,
  expressions: 45000,
  tts: 30000,
  reviews: 15000,
  complete: 10000,
  score: 15000,
};

const stepMap = Object.fromEntries(AUTO_FLOW_STEPS.map((step) => [step.id, step]));
const WAVE_BAR_COUNT = 28;

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authError, setAuthError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(5000);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [recording, setRecording] = useState<RecordingResponse | null>(null);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [selectedExpressionId, setSelectedExpressionId] = useState("");
  const [ttsUrl, setTtsUrl] = useState("");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<PracticeScore | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [flowStepId, setFlowStepId] = useState<string>("");
  const [flowLog, setFlowLog] = useState<string[]>([]);
  const [flowDetails, setFlowDetails] = useState<string[]>([]);
  const [failedStepId, setFailedStepId] = useState<string>("");
  const [retryMode, setRetryMode] = useState<"" | "manual" | "auto">("");
  const [waveBars, setWaveBars] = useState<number[]>(() => Array.from({ length: WAVE_BAR_COUNT }, () => 8));
  const [recordingRemainingMs, setRecordingRemainingMs] = useState(0);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [isMicRecording, setIsMicRecording] = useState(false);
  const [activeTimeoutMessage, setActiveTimeoutMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const testSectionRef = useRef<HTMLElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingSessionRef = useRef<RecordingSession | null>(null);
  const uploadTaskRef = useRef<ReturnType<typeof createPresignedUploadTask> | null>(null);
  const abortControllersRef = useRef<AbortController[]>([]);
  const userCancelledRef = useRef(false);

  const selectedExpression = useMemo(
    () => expressions.find((item) => item.id === selectedExpressionId) ?? expressions[0] ?? null,
    [expressions, selectedExpressionId],
  );

  const currentFlowStep = flowStepId ? stepMap[flowStepId] : null;
  const flowProgress = useMemo(() => {
    const base = currentFlowStep?.progress ?? 0;
    if (flowStepId === "upload" && uploadPercent > 0) {
      const start = 20;
      const maxSegment = 14;
      return Math.min(34, start + Math.round((uploadPercent / 100) * maxSegment));
    }
    return base;
  }, [currentFlowStep, flowStepId, uploadPercent]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    Promise.all([
      apiFetch<MeResponse>("/auth/me"),
      apiFetch<Expression[]>("/expressions").catch(() => []),
      apiFetch<ReviewItem[]>("/reviews/today").catch(() => []),
    ])
      .then(([me, expressionList, reviewList]) => {
        setUser(me);
        setExpressions(expressionList);
        if (expressionList[0]) setSelectedExpressionId(expressionList[0].id);
        setReviews(reviewList);
      })
      .catch((err) => {
        setAuthError(err instanceof Error ? err.message : "세션 확인에 실패했습니다.");
        clearSession();
        router.replace("/");
      })
      .finally(() => setReady(true));

    return () => {
      cancelActiveOperations(false);
    };
  }, [router]);

  function resetWaveform() {
    setWaveBars(Array.from({ length: WAVE_BAR_COUNT }, () => 8));
    setRecordingElapsedMs(0);
    setRecordingRemainingMs(0);
  }

  function pushWaveLevel(level: number) {
    const nextHeight = Math.max(8, Math.min(100, Math.round(12 + level * 88)));
    setWaveBars((prev) => [...prev.slice(1), nextHeight]);
  }

  function registerAbortController() {
    const controller = new AbortController();
    abortControllersRef.current.push(controller);
    return controller;
  }

  function clearAbortController(controller: AbortController) {
    abortControllersRef.current = abortControllersRef.current.filter((item) => item !== controller);
  }

  function cancelActiveOperations(showMessage = true) {
    userCancelledRef.current = true;
    recordingSessionRef.current?.cancel();
    recordingSessionRef.current = null;
    uploadTaskRef.current?.cancel();
    uploadTaskRef.current = null;
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current = [];
    setIsMicRecording(false);
    setActiveTimeoutMessage("");
    if (showMessage) {
      setMessage("현재 진행 중인 녹음/업로드/처리를 취소했습니다.");
      setError("");
    }
  }

  function isAbortError(err: unknown) {
    return err instanceof Error && (err.name === "AbortError" || /취소/.test(err.message));
  }

  async function runWithTimeout<T>(stepId: string, taskFactory: (signal?: AbortSignal) => Promise<T>, timeoutMs?: number) {
    const controller = registerAbortController();
    const ms = timeoutMs ?? STEP_TIMEOUTS[stepId] ?? 20000;
    setActiveTimeoutMessage(`${stepMap[stepId]?.label ?? stepId} 제한시간 ${Math.round(ms / 1000)}초`);

    try {
      return await Promise.race<T>([
        taskFactory(controller.signal),
        new Promise<T>((_, reject) => {
          const timer = window.setTimeout(() => {
            controller.abort();
            reject(new Error(`${stepMap[stepId]?.label ?? stepId} 단계가 제한시간 ${Math.round(ms / 1000)}초를 초과했습니다.`));
          }, ms);
          controller.signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
        }),
      ]);
    } finally {
      clearAbortController(controller);
      setActiveTimeoutMessage("");
    }
  }

  function markFlow(stepId: string, detail?: string) {
    setFlowStepId(stepId);
    setFlowLog((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
    if (detail) {
      setFlowDetails((prev) => [...prev, `${stepMap[stepId]?.label ?? stepId}: ${detail}`]);
    }
    if (stepId === "upload") {
      setUploadPercent((prev) => (prev > 0 ? prev : 1));
    }
  }

  function resetFlowUi() {
    setFlowStepId("");
    setFlowLog([]);
    setFlowDetails([]);
    setFailedStepId("");
    setRetryMode("");
    setUploadPercent(0);
    setActiveTimeoutMessage("");
  }

  function setStepFailure(stepId: string, detail: string, mode: "manual" | "auto") {
    setFailedStepId(stepId);
    setRetryMode(mode);
    setFlowStepId(stepId);
    setFlowLog((prev) => (prev.includes(stepId) ? prev : [...prev, stepId]));
    setFlowDetails((prev) => [...prev, `${stepMap[stepId]?.label ?? stepId}: 실패 - ${detail}`]);
  }

  async function refreshLists(preferredExpressionId?: string) {
    const [expressionList, reviewList] = await Promise.all([
      apiFetch<Expression[]>("/expressions"),
      apiFetch<ReviewItem[]>("/reviews/today").catch(() => []),
    ]);
    setExpressions(expressionList);
    setReviews(reviewList);
    const nextId = preferredExpressionId ?? expressionList[0]?.id ?? "";
    setSelectedExpressionId(nextId);
  }

  async function startMicRecording(durationMs: number) {
    userCancelledRef.current = false;
    resetWaveform();
    setIsMicRecording(true);
    const session = startRecordedAudioSession({
      durationMs,
      onLevel: pushWaveLevel,
      onTick: (remaining, elapsed) => {
        setRecordingRemainingMs(remaining);
        setRecordingElapsedMs(elapsed);
      },
    });
    recordingSessionRef.current = session;

    try {
      const file = await Promise.race<File>([
        session.promise,
        new Promise<File>((_, reject) => {
          window.setTimeout(() => reject(new Error("녹음 단계가 제한시간을 초과했습니다.")), durationMs + 7000);
        }),
      ]);
      return file;
    } finally {
      recordingSessionRef.current = null;
      setIsMicRecording(false);
      setRecordingRemainingMs(0);
    }
  }

  async function uploadAndProcessFile(file: File) {
    markFlow("presign", `${file.name} 업로드 준비`);
    const presign = await runWithTimeout("presign", (signal) => apiFetch<PresignResponse>("/recordings/presign", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "audio/webm" }),
      signal,
    }));

    markFlow("upload", `${Math.max(1, Math.round(file.size / 1024))}KB 파일 업로드`);
    setUploadPercent(1);
    const uploadTask = createPresignedUploadTask(presign.uploadUrl, file, (percent) => setUploadPercent(percent));
    uploadTaskRef.current = uploadTask;
    try {
      await Promise.race<void>([
        uploadTask.promise,
        new Promise<void>((_, reject) => {
          window.setTimeout(() => {
            uploadTask.cancel();
            reject(new Error("S3 업로드 단계가 제한시간을 초과했습니다."));
          }, STEP_TIMEOUTS.upload);
        }),
      ]);
    } finally {
      uploadTaskRef.current = null;
    }

    markFlow("transcribe", "전사 및 화자 분리 요청");
    const processed = await runWithTimeout("transcribe", (signal) => apiFetch<RecordingResponse>(`/recordings/${presign.recordingId}/process`, {
      method: "POST",
      body: JSON.stringify({ diarization: true }),
      signal,
    }));
    setUploadPercent(100);
    setRecording(processed);
    return processed;
  }

  async function completeAutoFlowFromProcessed(processed: RecordingResponse) {
    markFlow("mine", `전사된 ${processed.utterances.length}개 문장에서 우선순위 선별`);
    const mineUtterances = processed.utterances.filter((item) => item.isMine && item.koreanText?.trim());
    const targetUtterances = (mineUtterances.length > 0 ? mineUtterances : processed.utterances)
      .filter((item) => item.koreanText?.trim())
      .slice(0, 3);

    if (targetUtterances.length === 0) {
      throw new Error("전사된 문장이 없어 영어 표현을 생성할 수 없습니다.");
    }

    markFlow("expressions", `${targetUtterances.length}개 문장을 영어 표현으로 생성`);
    const createdExpressions: Expression[] = [];
    for (const utterance of targetUtterances) {
      const expression = await runWithTimeout("expressions", (signal) => apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({ utteranceId: utterance.id }),
        signal,
      }));
      createdExpressions.push(expression);
    }

    const firstExpression = createdExpressions[0];
    if (!firstExpression) {
      throw new Error("표현 생성 결과가 없습니다.");
    }

    markFlow("tts", `${firstExpression.englishBase.slice(0, 28)}${firstExpression.englishBase.length > 28 ? "..." : ""}`);
    const tts = await runWithTimeout("tts", (signal) => apiFetch<TtsResponse>(`/expressions/${firstExpression.id}/tts`, {
      method: "POST",
      signal,
    }));
    setTtsUrl(tts.ttsUrl);
    window.setTimeout(() => audioRef.current?.load(), 50);

    markFlow("reviews", "표현장과 오늘의 복습 목록 갱신");
    await runWithTimeout("reviews", async () => {
      await refreshLists(firstExpression.id);
      return true;
    });
    setAnswer("");
    setScore(null);

    markFlow("complete", "테스트 영역으로 자동 이동");
    setMessage(`원클릭 학습이 완료되었습니다. 내 문장 ${targetUtterances.length}개를 표현으로 만들고, 첫 문장의 TTS까지 생성했습니다. 이제 바로 아래 테스트에서 말해보세요.`);

    window.setTimeout(() => {
      testSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      answerRef.current?.focus();
    }, 150);
  }

  async function continueAutoFlowWithFile(file: File) {
    const processed = await uploadAndProcessFile(file);
    await completeAutoFlowFromProcessed(processed);
  }

  async function handleUploadAndProcess() {
    if (!selectedFile) {
      setError("오디오 파일을 먼저 선택해 주세요.");
      return;
    }
    userCancelledRef.current = false;
    setError("");
    setMessage("");
    setLoading("upload");
    setRecording(null);
    setTtsUrl("");
    setScore(null);
    setFailedStepId("");
    setRetryMode("");

    try {
      const processed = await uploadAndProcessFile(selectedFile);
      setMessage(`녹음 업로드와 전사가 완료되었습니다. (${processed.utterances.length}개 문장)`);
    } catch (err) {
      if (isAbortError(err) || userCancelledRef.current) {
        setMessage("수동 업로드/전사를 취소했습니다.");
        setError("");
      } else {
        const text = err instanceof Error ? err.message : "업로드 처리에 실패했습니다.";
        setStepFailure(flowStepId || "upload", text, "manual");
        setError(text);
      }
    } finally {
      setLoading("");
    }
  }

  async function handleRecordDemo() {
    userCancelledRef.current = false;
    setError("");
    setMessage(`${Math.round(recordingDuration / 1000)}초 동안 브라우저 녹음을 진행합니다.`);
    setLoading("record");
    setFailedStepId("");
    setRetryMode("");
    try {
      const file = await startMicRecording(recordingDuration);
      setSelectedFile(file);
      setMessage(`녹음이 완료되었습니다: ${file.name}`);
    } catch (err) {
      if (isAbortError(err) || userCancelledRef.current) {
        setMessage("브라우저 녹음을 취소했습니다.");
        setError("");
      } else {
        const text = err instanceof Error ? err.message : "녹음을 시작할 수 없습니다.";
        setError(text);
        setStepFailure("recording", text, "manual");
      }
    } finally {
      setLoading("");
    }
  }

  async function handleAutoRecordFlow() {
    userCancelledRef.current = false;
    setError("");
    setMessage("");
    setScore(null);
    setRecording(null);
    setTtsUrl("");
    setLoading("auto-flow");
    resetFlowUi();

    try {
      markFlow("record-start", "마이크 권한 요청");
      markFlow("recording", `${Math.round(recordingDuration / 1000)}초 샘플 발화 녹음 시작`);
      const file = await startMicRecording(recordingDuration);
      setSelectedFile(file);
      await continueAutoFlowWithFile(file);
    } catch (err) {
      if (isAbortError(err) || userCancelledRef.current) {
        setMessage("원클릭 학습 흐름을 취소했습니다.");
        setError("");
      } else {
        const text = err instanceof Error ? err.message : "자동 학습 흐름 실행에 실패했습니다.";
        setStepFailure(flowStepId || "recording", text, "auto");
        setError(text);
      }
    } finally {
      setLoading("");
    }
  }

  async function handleRetryFailedStep() {
    if (!failedStepId) return;
    userCancelledRef.current = false;
    setError("");
    setMessage("");
    setLoading(retryMode === "auto" ? "auto-flow" : "retry");

    try {
      if (retryMode === "manual") {
        if (failedStepId === "recording") {
          await handleRecordDemo();
          return;
        }
        if (!selectedFile) throw new Error("재시도할 오디오 파일이 없습니다.");
        const processed = await uploadAndProcessFile(selectedFile);
        setMessage(`재시도 후 전사가 완료되었습니다. (${processed.utterances.length}개 문장)`);
        setFailedStepId("");
        setRetryMode("");
        return;
      }

      if (retryMode === "auto") {
        if (failedStepId === "record-start" || failedStepId === "recording") {
          await handleAutoRecordFlow();
          return;
        }
        if ((failedStepId === "presign" || failedStepId === "upload" || failedStepId === "transcribe") && selectedFile) {
          await continueAutoFlowWithFile(selectedFile);
          setFailedStepId("");
          setRetryMode("");
          return;
        }
        if (["mine", "expressions", "tts", "reviews", "complete"].includes(failedStepId) && recording) {
          await completeAutoFlowFromProcessed(recording);
          setFailedStepId("");
          setRetryMode("");
          return;
        }
      }

      throw new Error("재시도 가능한 직전 단계 정보를 찾지 못했습니다.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "재시도에 실패했습니다.";
      setError(text);
      setStepFailure(failedStepId, text, retryMode || "manual");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateFromUtterance(utteranceId: string) {
    setError("");
    setMessage("");
    setLoading(`expr-${utteranceId}`);
    try {
      const expression = await runWithTimeout("expressions", (signal) => apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({ utteranceId }),
        signal,
      }));
      await refreshLists(expression.id);
      setMessage("영어 표현을 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateFromText() {
    const text = window.prompt("직접 한국어 문장을 입력하세요.");
    if (!text?.trim()) return;
    setError("");
    setMessage("");
    setLoading("manual-generate");
    try {
      const expression = await runWithTimeout("expressions", (signal) => apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({ koreanText: text.trim() }),
        signal,
      }));
      await refreshLists(expression.id);
      setMessage("직접 입력한 문장으로 표현을 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateTts() {
    if (!selectedExpression) {
      setError("먼저 표현을 선택해 주세요.");
      return;
    }
    setError("");
    setMessage("");
    setLoading("tts");
    try {
      const response = await runWithTimeout("tts", (signal) => apiFetch<TtsResponse>(`/expressions/${selectedExpression.id}/tts`, {
        method: "POST",
        signal,
      }));
      setTtsUrl(response.ttsUrl);
      setMessage("TTS가 생성되었습니다. 재생 버튼을 눌러 확인하세요.");
      window.setTimeout(() => audioRef.current?.load(), 50);
      await refreshLists(selectedExpression.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleScore() {
    if (!selectedExpression) {
      setError("채점할 표현을 먼저 선택해 주세요.");
      return;
    }
    if (!answer.trim()) {
      setError("영어 답변을 입력해 주세요.");
      return;
    }
    setError("");
    setMessage("");
    setLoading("score");
    try {
      const result = await runWithTimeout("score", (signal) => apiFetch<PracticeScore>("/practice/score", {
        method: "POST",
        body: JSON.stringify({ expressionId: selectedExpression.id, answer }),
        signal,
      }));
      setScore(result);
      await refreshLists(selectedExpression.id);
      setMessage("말하기 테스트를 채점했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "채점에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  if (!ready) {
    return <main className="container"><div className="card">대시보드 준비 중...</div></main>;
  }

  return (
    <main className="container grid dashboard-page">
      <section className="card hero compact">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <span className="badge">JWT 인증</span>
              <span className="badge">S3 업로드</span>
              <span className="badge">OpenAI 연동</span>
            </div>
            <h1 className="h1" style={{ marginBottom: 8 }}>서비스 대시보드</h1>
            <p className="muted">로그인 사용자: <strong>{user?.email ?? getStoredUser()?.email ?? "-"}</strong></p>
          </div>
          <div className="row">
            <button className="button ghost" onClick={handleGenerateFromText} disabled={!!loading}>직접 문장 생성</button>
            <button className="button secondary" onClick={() => { clearSession(); router.replace("/"); }}>로그아웃</button>
          </div>
        </div>
        {authError && <div className="error-box" style={{ marginTop: 12 }}>{authError}</div>}
        {message && <div className="success-box" style={{ marginTop: 12 }}>{message}</div>}
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
        {activeTimeoutMessage && <div className="timeout-box" style={{ marginTop: 12 }}>{activeTimeoutMessage}</div>}
      </section>

      <section className="card panel-lg">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="h2">원클릭 학습 시작</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              녹음 버튼 한 번으로 <strong>녹음 → 업로드 → 전사 → 내 문장 추출 → 영어 표현 생성 → TTS 생성 → 테스트 이동</strong>까지 자동으로 진행합니다.
            </p>
          </div>
          <div className="row">
            <button className="button" onClick={handleAutoRecordFlow} disabled={!!loading}>
              {loading === "auto-flow" ? (currentFlowStep ? `${currentFlowStep.label}...` : "처리 중...") : "원클릭으로 시작"}
            </button>
            {!!loading && (
              <button className="button danger" onClick={() => cancelActiveOperations(true)}>
                현재 작업 취소
              </button>
            )}
          </div>
        </div>

        <div className="control-row" style={{ marginTop: 16 }}>
          <div>
            <div className="control-label">녹음 시간 선택</div>
            <div className="row chip-row" style={{ marginTop: 8 }}>
              {RECORDING_OPTIONS.map((item) => (
                <button
                  key={item.value}
                  className={`chip ${recordingDuration === item.value ? "selected" : ""}`}
                  onClick={() => setRecordingDuration(item.value)}
                  disabled={!!loading}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {failedStepId && (
            <div className="retry-panel">
              <div className="control-label">실패 단계</div>
              <div className="muted" style={{ marginTop: 6 }}>{stepMap[failedStepId]?.label ?? failedStepId}</div>
              <button className="button secondary" style={{ marginTop: 10 }} onClick={handleRetryFailedStep} disabled={!!loading}>
                {loading === "retry" ? "재시도 중..." : "실패 단계 재시도"}
              </button>
            </div>
          )}
        </div>

        <div className="recording-visual-card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <strong>실시간 마이크 파형</strong>
            <span className={`tag ${isMicRecording ? "tag-primary" : "tag-muted"}`}>{isMicRecording ? "녹음 중" : "대기"}</span>
          </div>
          <div className="waveform-wrap" style={{ marginTop: 12 }}>
            {waveBars.map((height, index) => (
              <span key={`${index}-${height}`} className={`wave-bar ${isMicRecording ? "live" : "idle"}`} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <div className="muted">경과 {Math.max(0, (recordingElapsedMs / 1000)).toFixed(1)}초</div>
            <div className="muted">남은 시간 {Math.max(0, (recordingRemainingMs / 1000)).toFixed(1)}초</div>
          </div>
        </div>

        <div className="mini-card" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <strong>실시간 진행률</strong>
            <span className="muted">{flowProgress}%</span>
          </div>
          <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${flowProgress}%` }} /></div>
          <div className="muted" style={{ marginTop: 10 }}>
            {currentFlowStep ? `${currentFlowStep.label} · ${currentFlowStep.description}` : "원클릭 학습을 시작하면 여기에서 단계별 진행 상황이 표시됩니다."}
          </div>
          {flowStepId === "upload" && uploadPercent > 0 && (
            <div className="upload-inline-status">업로드 진행률 {uploadPercent}%</div>
          )}
        </div>

        <div className="grid auto-flow-grid" style={{ marginTop: 16 }}>
          {AUTO_FLOW_STEPS.map((step) => {
            const done = flowLog.includes(step.id);
            const active = flowStepId === step.id && loading === "auto-flow";
            const failed = failedStepId === step.id;
            return (
              <div
                key={step.id}
                className={`mini-card step-card ${done ? "done" : ""} ${active ? "active" : ""} ${failed ? "failed" : ""}`}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{step.label}</strong>
                  <span className={`tag ${failed ? "tag-failed" : done ? "tag-done" : "tag-muted"}`}>{step.progress}%</span>
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{step.description}</div>
                <div className="muted" style={{ marginTop: 8 }}>
                  {failed ? "실패" : active ? "진행 중" : done ? "완료" : "대기"}
                </div>
                {failed && (
                  <button className="link-button" style={{ marginTop: 8 }} onClick={handleRetryFailedStep} disabled={!!loading}>
                    이 단계 다시 시도
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {flowDetails.length > 0 && (
          <div className="mini-card" style={{ marginTop: 16 }}>
            <strong>자동 실행 로그</strong>
            <div className="flow-log-list" style={{ marginTop: 10 }}>
              {flowDetails.map((item, index) => (
                <div key={`${item}-${index}`} className="flow-log-item">{item}</div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <section className="card panel-lg">
          <h2 className="h2">1. 수동 녹음 업로드 / 전사</h2>
          <p className="muted">파일 업로드 또는 선택한 시간만큼 브라우저 녹음 후 STT를 실행합니다.</p>
          <div className="row" style={{ marginTop: 14 }}>
            <input
              className="input file-input"
              type="file"
              accept="audio/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            <button className="button ghost" onClick={handleRecordDemo} disabled={!!loading}>
              {loading === "record" ? "녹음 중..." : `브라우저 녹음 (${Math.round(recordingDuration / 1000)}초)`}
            </button>
            <button className="button" onClick={handleUploadAndProcess} disabled={!selectedFile || !!loading}>
              {loading === "upload" ? "처리 중..." : "업로드 & 전사"}
            </button>
            {(loading === "record" || loading === "upload") && (
              <button className="button danger" onClick={() => cancelActiveOperations(true)}>취소</button>
            )}
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            선택 파일: {selectedFile ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : "없음"}
          </div>
          {(loading === "upload" || flowStepId === "upload") && uploadPercent > 0 && (
            <div className="upload-status-box">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>업로드 진행률</strong>
                <span>{uploadPercent}%</span>
              </div>
              <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${uploadPercent}%` }} /></div>
              <div className="muted" style={{ marginTop: 8 }}>업로드 중 문제가 있으면 바로 취소하거나 재시도할 수 있습니다.</div>
            </div>
          )}
          {retryMode === "manual" && failedStepId && (
            <div className="retry-inline-box">
              <div className="muted">마지막 실패 단계: {stepMap[failedStepId]?.label ?? failedStepId}</div>
              <button className="button secondary" style={{ marginTop: 10 }} onClick={handleRetryFailedStep} disabled={!!loading}>
                수동 흐름 재시도
              </button>
            </div>
          )}

          {recording && (
            <div className="grid" style={{ marginTop: 18 }}>
              <div className="mini-card">
                <strong>처리 결과</strong>
                <div className="muted" style={{ marginTop: 8 }}>
                  상태: {recording.status} · 문장 수: {recording.utterances.length}
                </div>
              </div>
              {recording.utterances.map((utterance) => (
                <div key={utterance.id} className="utterance-card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{utterance.speakerLabel}</strong>
                      <span className="muted" style={{ marginLeft: 8 }}>{utterance.startMs}ms ~ {utterance.endMs}ms</span>
                    </div>
                    <span className={`tag ${utterance.isMine ? "tag-primary" : "tag-muted"}`}>{utterance.isMine ? "내 화자" : "기타 화자"}</span>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 16 }}>{utterance.koreanText}</div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      className="button secondary"
                      disabled={!!loading}
                      onClick={() => handleGenerateFromUtterance(utterance.id)}
                    >
                      {loading === `expr-${utterance.id}` ? "생성 중..." : "이 문장으로 표현 생성"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card panel-lg">
          <h2 className="h2">2. 영어 표현 & TTS</h2>
          <p className="muted">생성된 표현을 선택하고 TTS를 만들어 재생합니다.</p>
          <div className="grid" style={{ marginTop: 14 }}>
            {expressions.length === 0 && <div className="mini-card muted">아직 생성된 표현이 없습니다.</div>}
            {expressions.map((expression) => (
              <button
                key={expression.id}
                className={`expression-item ${selectedExpressionId === expression.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedExpressionId(expression.id);
                  setTtsUrl(expression.ttsKey ? `${API_URL.replace(/\/$/, "")}/${expression.ttsKey}` : "");
                  setScore(null);
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>{expression.koreanText}</div>
                <div style={{ fontWeight: 700, marginTop: 6 }}>{expression.englishBase}</div>
              </button>
            ))}
          </div>

          {selectedExpression && (
            <div className="grid" style={{ marginTop: 16 }}>
              <div className="mini-card">
                <strong>기본형</strong>
                <div style={{ marginTop: 8 }}>{selectedExpression.englishBase}</div>
              </div>
              <div className="mini-card">
                <strong>쉬운형</strong>
                <div style={{ marginTop: 8 }}>{selectedExpression.englishEasy}</div>
              </div>
              <div className="mini-card">
                <strong>자연형</strong>
                <div style={{ marginTop: 8 }}>{selectedExpression.englishNatural}</div>
              </div>
              <div className="mini-card">
                <strong>설명</strong>
                <div style={{ marginTop: 8 }}>{selectedExpression.note || "설명 없음"}</div>
              </div>
              <div className="row">
                <button className="button" onClick={handleGenerateTts} disabled={!!loading}>
                  {loading === "tts" ? "TTS 생성 중..." : "TTS 생성"}
                </button>
                <button
                  className="button ghost"
                  onClick={() => audioRef.current?.play()}
                  disabled={!ttsUrl}
                >
                  TTS 재생
                </button>
              </div>
              <audio ref={audioRef} controls className="audio-player" src={ttsUrl || undefined} />
              {ttsUrl && (
                <div className="muted">TTS URL: <span className="code">{ttsUrl}</span></div>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-grid">
        <section ref={testSectionRef} className={`card panel-lg ${flowStepId === "complete" ? "section-highlight" : ""}`}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="h2">3. 말하기 테스트</h2>
              <p className="muted">선택한 기본형을 기준으로 간단 채점합니다.</p>
            </div>
            {flowStepId === "complete" && <span className="badge" style={{ background: "#dbeafe" }}>자동 이동 완료</span>}
          </div>
          <div className="grid" style={{ marginTop: 14 }}>
            <div className="mini-card">
              <div className="muted">문제</div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>{selectedExpression?.koreanText ?? "표현을 먼저 선택하세요."}</div>
            </div>
            <textarea
              ref={answerRef}
              className="textarea"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="영어로 답변을 입력하세요"
            />
            <div className="row">
              <button className="button secondary" onClick={handleScore} disabled={!!loading || !selectedExpression}>
                {loading === "score" ? "채점 중..." : "채점하기"}
              </button>
            </div>
            {score && (
              <div className="grid score-grid">
                <div className="mini-card"><strong>점수</strong><div className="kpi" style={{ marginTop: 8 }}>{score.score}</div></div>
                <div className="mini-card"><strong>피드백</strong><div style={{ marginTop: 8 }}>{score.feedback}</div></div>
                <div className="mini-card"><strong>정답 기준</strong><div style={{ marginTop: 8 }}>{score.target}</div></div>
              </div>
            )}
          </div>
        </section>

        <section className="card panel-lg">
          <h2 className="h2">4. 오늘의 복습</h2>
          <p className="muted">사용자 표현과 최근 점수를 바탕으로 복습 목록을 표시합니다.</p>
          <div className="grid" style={{ marginTop: 14 }}>
            {reviews.length === 0 && <div className="mini-card muted">복습 항목이 없습니다.</div>}
            {reviews.map((item) => (
              <div key={item.id} className="mini-card">
                <strong>{item.korean}</strong>
                <div className="muted" style={{ marginTop: 8 }}>{item.english}</div>
                <div className="progress" style={{ marginTop: 12 }}><span style={{ width: `${item.mastery}%` }} /></div>
                <div className="muted" style={{ marginTop: 8 }}>최근 숙련도 {item.mastery}%</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
