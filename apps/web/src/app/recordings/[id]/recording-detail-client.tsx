"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api-client";
import { clearSession, getStoredUser, getToken } from "../../../lib/auth";
import {
  buildRecordingContextPayload,
  EMPTY_RECORDING_CONTEXT,
  loadRecordingContext,
  saveRecordingContext,
  type RecordingGenerationContext,
} from "../../../lib/recording-context";
import {
  DEFAULT_RECORDING_ANALYSIS_MODE,
  loadRecordingAnalysisMode,
  saveRecordingAnalysisMode,
  type RecordingAnalysisMode,
} from "../../../lib/recording-analysis-preference";

type RecordingUtterance = {
  id: string;
  speakerLabel: string;
  koreanText: string;
  startMs: number;
  endMs: number;
  isMine: boolean;
  analysisIntent?: string | null;
};

type RecordingResponse = {
  id: string;
  fileName: string;
  status: string;
  diarization: boolean;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string;
  analysisSummary?: string | null;
  analysisRelationship?: string | null;
  analysisSituation?: string | null;
  analysisTone?: string | null;
  analysisUpdatedAt?: string | null;
  utterances: RecordingUtterance[];
};

type Expression = {
  id: string;
  utteranceId?: string | null;
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  note?: string | null;
  userMemo?: string | null;
  ttsKey?: string | null;
  ttsUrl?: string | null;
};

type TtsResponse = { expressionId: string; ttsKey: string; ttsUrl: string; expression: string };
type MeResponse = { userId: string; email: string };
type BulkExpressionResponse = {
  recordingId: string;
  createdCount: number;
  skippedCount: number;
  totalRequested: number;
  expressions: Expression[];
};
type BulkTtsResponse = {
  recordingId: string;
  updatedCount: number;
  skippedCount: number;
  totalRequested: number;
  expressions: TtsResponse[];
};
type DeleteUtteranceResponse = {
  success: boolean;
  utteranceId: string;
  deletedExpressionCount: number;
};
type RecordingAnalysis = {
  summary: string;
  intents: Array<{
    utteranceId?: string;
    speakerLabel?: string;
    koreanText: string;
    intent: string;
  }>;
};

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatAudioTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remain = totalSeconds % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

function contextsEqual(left: RecordingGenerationContext, right: RecordingGenerationContext) {
  return left.relationship === right.relationship && left.situation === right.situation && left.tone === right.tone;
}

function buildRecordingContextFromAnalysis(recording: RecordingResponse | null): RecordingGenerationContext {
  return {
    relationship: recording?.analysisRelationship ?? "",
    situation: recording?.analysisSituation ?? "",
    tone: recording?.analysisTone ?? "",
  };
}

const DETAIL_PREVIEW_COUNTS = {
  utterances: 6,
  expressions: 6,
} as const;
const LIST_INCREMENT_SMALL = 5;
const LIST_INCREMENT_LARGE = 20;
const DETAIL_SECTION_TABS = [
  { id: "overview", label: "개요" },
  { id: "recording", label: "녹음" },
  { id: "expressions", label: "표현" },
] as const;

export function RecordingDetailClient({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rawAudioRef = useRef<HTMLAudioElement | null>(null);
  const expressionDetailRef = useRef<HTMLDivElement | null>(null);
  const overviewSectionRef = useRef<HTMLElement | null>(null);
  const recordingSectionRef = useRef<HTMLElement | null>(null);
  const expressionsSectionRef = useRef<HTMLElement | null>(null);
  const recordingContextRef = useRef<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [recording, setRecording] = useState<RecordingResponse | null>(null);
  const [allExpressions, setAllExpressions] = useState<Expression[]>([]);
  const [selectedExpressionId, setSelectedExpressionId] = useState("");
  const [expressionMemoDraft, setExpressionMemoDraft] = useState("");
  const [utteranceDrafts, setUtteranceDrafts] = useState<Record<string, string>>({});
  const [recordingContext, setRecordingContext] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [recordingContextDraft, setRecordingContextDraft] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [recordingAnalysisMode, setRecordingAnalysisMode] = useState<RecordingAnalysisMode>(DEFAULT_RECORDING_ANALYSIS_MODE);
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [analysisNeedsRefresh, setAnalysisNeedsRefresh] = useState(false);
  const [rawAudioCurrentTime, setRawAudioCurrentTime] = useState(0);
  const [rawAudioDuration, setRawAudioDuration] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [visibleCounts, setVisibleCounts] = useState<Record<keyof typeof DETAIL_PREVIEW_COUNTS, number>>(DETAIL_PREVIEW_COUNTS);
  const [expandedSections, setExpandedSections] = useState<Record<"overview" | "recording" | "expressions", boolean>>({
    overview: true,
    recording: true,
    expressions: true,
  });

  const utteranceIds = useMemo(() => new Set(recording?.utterances.map((item) => item.id) ?? []), [recording]);
  const expressions = useMemo(
    () => allExpressions.filter((item) => item.utteranceId && utteranceIds.has(item.utteranceId)),
    [allExpressions, utteranceIds],
  );
  const selectedExpression = useMemo(
    () => expressions.find((item) => item.id === selectedExpressionId) ?? expressions[0] ?? null,
    [expressions, selectedExpressionId],
  );
  const visibleUtterances = useMemo(
    () => (recording?.utterances ?? []).slice(0, visibleCounts.utterances),
    [recording, visibleCounts.utterances],
  );
  const visibleExpressions = useMemo(
    () => expressions.slice(0, visibleCounts.expressions),
    [expressions, visibleCounts.expressions],
  );
  const expressionIdsByUtterance = useMemo(
    () =>
      new Set(
        expressions
          .map((item) => item.utteranceId)
          .filter((value): value is string => Boolean(value)),
      ),
    [expressions],
  );
  const pendingMineExpressionCount = useMemo(
    () =>
      (recording?.utterances ?? []).filter(
        (utterance) => utterance.isMine && utterance.koreanText.trim() && !expressionIdsByUtterance.has(utterance.id),
      ).length,
    [expressionIdsByUtterance, recording],
  );
  const pendingOthersExpressionCount = useMemo(
    () =>
      (recording?.utterances ?? []).filter(
        (utterance) => !utterance.isMine && utterance.koreanText.trim() && !expressionIdsByUtterance.has(utterance.id),
      ).length,
    [expressionIdsByUtterance, recording],
  );
  const pendingRecordingTtsCount = useMemo(
    () => expressions.filter((expression) => !expression.ttsKey).length,
    [expressions],
  );
  const speakerOptions = useMemo(() => {
    const seen = new Set<string>();
    return (recording?.utterances ?? []).filter((utterance) => {
      if (seen.has(utterance.speakerLabel)) return false;
      seen.add(utterance.speakerLabel);
      return true;
    });
  }, [recording]);
  const intentByUtteranceId = useMemo(
    () =>
      new Map(
        ((analysis?.intents?.length
          ? analysis.intents
          : (recording?.utterances ?? []).map((utterance) => ({
              utteranceId: utterance.id,
              intent: utterance.analysisIntent ?? "",
            }))) as Array<{ utteranceId?: string; intent: string }>)
          .filter((item) => item.utteranceId)
          .map((item) => [item.utteranceId as string, item.intent]),
      ),
    [analysis, recording],
  );
  const selectedExpressionIntent = selectedExpression?.utteranceId
    ? intentByUtteranceId.get(selectedExpression.utteranceId) ?? ""
    : "";
  const visibleAnalysisSummary = analysis?.summary ?? recording?.analysisSummary ?? "";
  const hasUnsavedContextChanges = !contextsEqual(recordingContextDraft, recordingContext);
  const hasAnyAnalysis = Boolean(visibleAnalysisSummary) || (recording?.utterances ?? []).some((item) => Boolean(item.analysisIntent));

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    Promise.all([
      apiFetch<MeResponse>("/auth/me"),
      apiFetch<RecordingResponse>(`/recordings/${recordingId}`),
      apiFetch<Expression[]>("/expressions").catch(() => []),
    ])
      .then(([me, recordingDetail, expressionList]) => {
        setUser(me);
        setRecording(recordingDetail);
        setAllExpressions(expressionList);
        setUtteranceDrafts(
          Object.fromEntries(recordingDetail.utterances.map((utterance) => [utterance.id, utterance.koreanText])),
        );
      })
      .catch((err) => {
        clearSession();
        setError(err instanceof Error ? err.message : "녹음 정보를 불러오지 못했습니다.");
        router.replace("/");
      })
      .finally(() => setReady(true));
  }, [recordingId, router]);

  useEffect(() => {
    if (!recording?.id) return;
    const fallbackContext = buildRecordingContextFromAnalysis(recording);
    const storedContext = loadRecordingContext(recording.id);
    const nextContext = contextsEqual(storedContext, EMPTY_RECORDING_CONTEXT) ? fallbackContext : storedContext;
    setRecordingContext(nextContext);
    setRecordingContextDraft(nextContext);
    const analysisContext = buildRecordingContextFromAnalysis(recording);
    const hasAnalysisContent = Boolean(recording.analysisSummary) || recording.utterances.some((item) => Boolean(item.analysisIntent));
    setAnalysisNeedsRefresh(hasAnalysisContent && !contextsEqual(nextContext, analysisContext));
  }, [recording?.id]);

  useEffect(() => {
    recordingContextRef.current = recordingContext;
  }, [recordingContext]);

  useEffect(() => {
    if (!selectedExpressionId && expressions[0]) {
      setSelectedExpressionId(expressions[0].id);
    }
    if (selectedExpressionId && !expressions.some((item) => item.id === selectedExpressionId)) {
      setSelectedExpressionId(expressions[0]?.id ?? "");
    }
  }, [expressions, selectedExpressionId]);

  useEffect(() => {
    setExpressionMemoDraft(selectedExpression?.userMemo ?? "");
  }, [selectedExpression]);

  useEffect(() => {
    setRecordingAnalysisMode(loadRecordingAnalysisMode());
  }, []);

  function expandList(list: keyof typeof DETAIL_PREVIEW_COUNTS, amount: number | "all", total: number) {
    setVisibleCounts((current) => ({
      ...current,
      [list]: amount === "all" ? total : Math.min(total, current[list] + amount),
    }));
  }

  function collapseList(list: keyof typeof DETAIL_PREVIEW_COUNTS) {
    setVisibleCounts((current) => ({ ...current, [list]: DETAIL_PREVIEW_COUNTS[list] }));
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  async function runRecordingAnalysis(
    successMessage?: string,
    context: RecordingGenerationContext = recordingContextRef.current,
  ) {
    if (!recording) return null;
    const result = await apiFetch<RecordingAnalysis>(`/recordings/${recording.id}/analyze`, {
      method: "POST",
      body: JSON.stringify(buildRecordingContextPayload(context)),
    });
    const refreshedRecording = await apiFetch<RecordingResponse>(`/recordings/${recording.id}`);
    setRecording(refreshedRecording);
    setUtteranceDrafts(Object.fromEntries(refreshedRecording.utterances.map((utterance) => [utterance.id, utterance.koreanText])));
    setAnalysis(result);
    setAnalysisNeedsRefresh(false);
    if (successMessage) {
      setMessage(successMessage);
    }
    return result;
  }

  async function runAutoRecordingAnalysis(successMessage?: string) {
    if (recordingAnalysisMode !== "auto") return null;
    return runRecordingAnalysis(successMessage);
  }

  function handleRecordingAnalysisModeChange(mode: RecordingAnalysisMode) {
    setRecordingAnalysisMode(mode);
    saveRecordingAnalysisMode(mode);
  }

  function markAnalysisAsOutdated() {
    setAnalysisNeedsRefresh(true);
  }

  function updateRecordingContextField(field: keyof RecordingGenerationContext, value: string) {
    setRecordingContextDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveRecordingContext() {
    if (!recording) return;
    if (!hasUnsavedContextChanges) {
      setMessage("저장할 맥락 변경사항이 없습니다.");
      return;
    }

    const nextContext = recordingContextDraft;
    setLoading("save-recording-context");
    setError("");
    setMessage("");
    try {
      saveRecordingContext(recording.id, nextContext);
      setRecordingContext(nextContext);
      if (recordingAnalysisMode === "auto") {
        await runRecordingAnalysis("맥락 힌트를 저장하고 대화 분석을 자동으로 갱신했습니다.", nextContext);
      } else {
        markAnalysisAsOutdated();
        setMessage("대화 맥락 힌트를 저장했습니다. 분석을 다시 실행하면 최신 맥락이 반영됩니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화 맥락 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  function renderSectionIntro(
    section: keyof typeof expandedSections,
    title: string,
    description: string,
    summary: string,
  ) {
    const isOpen = expandedSections[section];
    return (
      <div className="section-intro">
        <div>
          <h2 className="h2">{title}</h2>
          <p className="muted">{description}</p>
          {!isOpen && <div className="section-summary">{summary}</div>}
        </div>
        <button
          type="button"
          className="section-toggle"
          onClick={() => toggleSection(section)}
          aria-expanded={isOpen}
        >
          {isOpen ? "접기" : "펼치기"}
        </button>
      </div>
    );
  }

  function scrollToDetailSection(section: (typeof DETAIL_SECTION_TABS)[number]["id"]) {
    const refs = {
      overview: overviewSectionRef,
      recording: recordingSectionRef,
      expressions: expressionsSectionRef,
    } as const;

    if (!expandedSections[section]) {
      setExpandedSections((current) => ({ ...current, [section]: true }));
    }

    window.setTimeout(() => {
      refs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function renderListControls(list: keyof typeof DETAIL_PREVIEW_COUNTS, total: number) {
    const visible = visibleCounts[list];
    if (total <= DETAIL_PREVIEW_COUNTS[list]) return null;
    const remaining = Math.max(0, total - visible);
    const isExpanded = visible >= total;

    return (
      <div className="row" style={{ marginTop: 12 }}>
        {!isExpanded && remaining > 0 && (
          <>
            <button className="button ghost" onClick={() => expandList(list, LIST_INCREMENT_SMALL, total)}>
              {`${Math.min(LIST_INCREMENT_SMALL, remaining)}개 더 보기`}
            </button>
            {remaining > LIST_INCREMENT_SMALL && (
              <button className="button ghost" onClick={() => expandList(list, LIST_INCREMENT_LARGE, total)}>
                {`${Math.min(LIST_INCREMENT_LARGE, remaining)}개 더 보기`}
              </button>
            )}
            {remaining > 0 && (
              <button className="button ghost" onClick={() => expandList(list, "all", total)}>
                {`전체 보기 (${remaining}개 남음)`}
              </button>
            )}
          </>
        )}
        {visible > DETAIL_PREVIEW_COUNTS[list] && (
          <button className="button ghost" onClick={() => collapseList(list)}>
            접기
          </button>
        )}
      </div>
    );
  }

  function focusSelectedExpressionDetail() {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    window.requestAnimationFrame(() => {
      expressionDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      expressionDetailRef.current?.focus({ preventScroll: true });
    });
  }

  async function refreshExpressions(preferredId?: string) {
    const nextExpressions = await apiFetch<Expression[]>("/expressions").catch(() => []);
    setAllExpressions(nextExpressions);
    setSelectedExpressionId(preferredId ?? nextExpressions.find((item) => item.utteranceId && utteranceIds.has(item.utteranceId))?.id ?? "");
  }

  async function refreshRecording() {
    const nextRecording = await apiFetch<RecordingResponse>(`/recordings/${recordingId}`);
    setRecording(nextRecording);
    setUtteranceDrafts(Object.fromEntries(nextRecording.utterances.map((utterance) => [utterance.id, utterance.koreanText])));
  }

  async function handleSaveUtterance(utteranceId: string) {
    const draft = utteranceDrafts[utteranceId]?.trim();
    if (!draft) {
      setError("저장할 문장을 입력해 주세요.");
      return;
    }

    setLoading(`save-${utteranceId}`);
    setError("");
    setMessage("");
    try {
      const updated = await apiFetch<RecordingUtterance>(`/recordings/utterances/${utteranceId}`, {
        method: "PATCH",
        body: JSON.stringify({ koreanText: draft }),
      });
      setRecording((current) =>
        current
          ? {
              ...current,
              utterances: current.utterances.map((item) =>
                item.id === utteranceId ? { ...item, koreanText: updated.koreanText } : item,
              ),
            }
          : current,
      );
      setUtteranceDrafts((current) => ({ ...current, [utteranceId]: updated.koreanText }));
      await runAutoRecordingAnalysis("문장을 저장하고 대화 분석을 자동으로 갱신했습니다.");
      if (recordingAnalysisMode !== "auto") {
        markAnalysisAsOutdated();
        setMessage("문장을 수정해 저장했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteUtterance(utteranceId: string) {
    const utterance = recording?.utterances.find((item) => item.id === utteranceId);
    if (!utterance) return;

    const confirmed = window.confirm(`"${utterance.koreanText}" 문장을 삭제할까요? 연결된 영어 표현도 함께 삭제됩니다.`);
    if (!confirmed) return;

    setLoading(`delete-utterance-${utteranceId}`);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<DeleteUtteranceResponse>(`/recordings/utterances/${utteranceId}`, {
        method: "DELETE",
      });
      await refreshRecording();
      await refreshExpressions();
      await runAutoRecordingAnalysis("문장을 삭제하고 대화 분석을 자동으로 갱신했습니다.");
      if (recordingAnalysisMode !== "auto") {
        markAnalysisAsOutdated();
        setMessage(
          response.deletedExpressionCount > 0
            ? `문장과 연결된 영어 표현 ${response.deletedExpressionCount}개를 함께 삭제했습니다.`
            : "문장을 삭제했습니다.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 삭제에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateExpression(utteranceId: string) {
    const draft = utteranceDrafts[utteranceId]?.trim();
    if (!draft) {
      setError("표현 생성 전에 문장을 입력해 주세요.");
      return;
    }

    const currentUtterance = recording?.utterances.find((item) => item.id === utteranceId);
    setLoading(`expr-${utteranceId}`);
    setError("");
    setMessage("");
    try {
      if (currentUtterance && currentUtterance.koreanText !== draft) {
        await apiFetch<RecordingUtterance>(`/recordings/utterances/${utteranceId}`, {
          method: "PATCH",
          body: JSON.stringify({ koreanText: draft }),
        });
      }
      const expression = await apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({ utteranceId, ...buildRecordingContextPayload(recordingContext) }),
      });
      await refreshRecording();
      await refreshExpressions(expression.id);
      setMessage("영어 표현을 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "영어 표현 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateTts() {
    if (!selectedExpression) {
      setError("먼저 표현을 선택해 주세요.");
      return;
    }

    setLoading("tts");
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<TtsResponse>(`/expressions/${selectedExpression.id}/tts`, {
        method: "POST",
      });
      await refreshExpressions(selectedExpression.id);
      setMessage("TTS를 생성했습니다. 바로 재생해 확인할 수 있습니다.");
      window.setTimeout(() => {
        audioRef.current?.load();
        audioRef.current?.play().catch(() => undefined);
      }, 50);
      void response;
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateExpressionsBulk(speakerScope: "mine" | "others") {
    if (!recording) return;

    setLoading(`expr-bulk-${speakerScope}`);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<BulkExpressionResponse>("/expressions/generate/bulk", {
        method: "POST",
        body: JSON.stringify({
          recordingId: recording.id,
          speakerScope,
          includeExisting: false,
          ...buildRecordingContextPayload(recordingContext),
        }),
      });
      await refreshRecording();
      const preferredId = response.expressions[0]?.id ?? selectedExpressionId ?? undefined;
      await refreshExpressions(preferredId);
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
      setLoading("");
    }
  }

  async function handleGenerateTtsBulk() {
    if (!recording) return;

    setLoading("tts-bulk");
    setError("");
    setMessage("");
    try {
      const response = await apiFetch<BulkTtsResponse>("/expressions/tts/bulk", {
        method: "POST",
        body: JSON.stringify({ recordingId: recording.id, onlyMissing: true }),
      });
      await refreshExpressions(selectedExpressionId || undefined);
      setMessage(
        response.updatedCount > 0
          ? `이 녹음의 표현 ${response.updatedCount}개에 대해 TTS를 일괄 생성했습니다.`
          : "이 녹음에서 새로 생성할 TTS가 없습니다.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "일괄 TTS 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteExpression() {
    if (!selectedExpression) {
      setError("삭제할 표현을 먼저 선택해 주세요.");
      return;
    }

    const confirmed = window.confirm(`"${selectedExpression.englishBase}" 표현을 삭제할까요?`);
    if (!confirmed) return;

    setLoading("delete-expression");
    setError("");
    setMessage("");
    try {
      await apiFetch<{ success: boolean; expressionId: string }>(`/expressions/${selectedExpression.id}`, {
        method: "DELETE",
      });
      await refreshExpressions();
      setMessage("선택한 표현을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 삭제에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSaveExpressionMemo() {
    if (!selectedExpression) {
      setError("먼저 표현을 선택해 주세요.");
      return;
    }

    setLoading("save-expression-memo");
    setError("");
    setMessage("");
    try {
      await apiFetch<Expression>(`/expressions/${selectedExpression.id}/memo`, {
        method: "PATCH",
        body: JSON.stringify({ userMemo: expressionMemoDraft }),
      });
      await refreshExpressions(selectedExpression.id);
      setMessage("표현 메모를 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 메모 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleAnalyzeConversation() {
    if (!recording) return;

    setLoading("analyze");
    setError("");
    setMessage("");
    try {
      await runRecordingAnalysis("대화 요약과 발화 의도 분석을 불러왔습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화 분석에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  function seekRawAudio(timeSeconds: number, autoPlay = false) {
    const player = rawAudioRef.current;
    if (!player) return;
    const bounded = Math.max(0, Math.min(timeSeconds, player.duration || timeSeconds));
    player.currentTime = bounded;
    setRawAudioCurrentTime(bounded);
    if (autoPlay) {
      player.play().catch(() => undefined);
    }
  }

  async function handleCopyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setError("");
      setMessage(`${label} 복사를 완료했습니다.`);
    } catch {
      setError("클립보드 복사에 실패했습니다.");
    }
  }

  async function handleReprocess() {
    setLoading("reprocess");
    setError("");
    setMessage("");
    try {
      await apiFetch<RecordingResponse>(`/recordings/${recordingId}/process`, {
        method: "POST",
        body: JSON.stringify({ diarization: true }),
      });
      await refreshRecording();
      await refreshExpressions(selectedExpressionId || undefined);
      setMessage("텍스트 변환을 다시 실행하고 최신 결과를 불러왔습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "텍스트 변환 다시 실행에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteRecording() {
    if (!recording) return;
    const confirmed = window.confirm(`"${recording.fileName}" 녹음을 삭제할까요? 이미 생성한 영어 표현은 유지됩니다.`);
    if (!confirmed) return;

    setLoading("delete-recording");
    setError("");
    setMessage("");
    try {
      await apiFetch<{ success: boolean; recordingId: string }>(`/recordings/${recording.id}`, {
        method: "DELETE",
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 삭제에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSelectMineSpeaker(speakerLabel: string) {
    setLoading(`mine-speaker-${speakerLabel}`);
    setError("");
    setMessage("");
    try {
      const updated = await apiFetch<RecordingResponse>(`/recordings/${recordingId}/mine-speaker`, {
        method: "PATCH",
        body: JSON.stringify({ speakerLabel }),
      });
      setRecording(updated);
      setUtteranceDrafts(Object.fromEntries(updated.utterances.map((utterance) => [utterance.id, utterance.koreanText])));
      await runAutoRecordingAnalysis("내 화자 설정을 반영해 대화 분석을 자동으로 갱신했습니다.");
      if (recordingAnalysisMode !== "auto") {
        markAnalysisAsOutdated();
        setMessage(`${speakerLabel}를 내 화자로 지정했습니다. 이후 내 문장 추출과 표현 생성에 반영됩니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 화자 설정에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleUpdateSpeakerLabel(speakerLabel: string) {
    const nextSpeakerLabel = window.prompt(`${speakerLabel}의 이름을 입력하세요. 예: 나, 엄마, 아이, 친구`, speakerLabel);
    if (!nextSpeakerLabel?.trim()) return;

    setLoading(`speaker-label-${speakerLabel}`);
    setError("");
    setMessage("");
    try {
      const updated = await apiFetch<RecordingResponse>(`/recordings/${recordingId}/speaker-label`, {
        method: "PATCH",
        body: JSON.stringify({ speakerLabel, nextSpeakerLabel: nextSpeakerLabel.trim() }),
      });
      setRecording(updated);
      setUtteranceDrafts(Object.fromEntries(updated.utterances.map((utterance) => [utterance.id, utterance.koreanText])));
      await runAutoRecordingAnalysis("화자 이름 변경을 반영해 대화 분석을 자동으로 갱신했습니다.");
      if (recordingAnalysisMode !== "auto") {
        markAnalysisAsOutdated();
        setMessage(`${speakerLabel} 이름을 "${nextSpeakerLabel.trim()}"로 저장했습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "화자 이름 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  if (!ready) {
    return <main className="container"><div className="card">녹음 상세 화면을 불러오는 중...</div></main>;
  }

  if (!recording) {
    return (
      <main className="container">
        <div className="card">
          <h1 className="h2">녹음을 찾을 수 없습니다.</h1>
          <p className="muted" style={{ marginTop: 8 }}>{error || "삭제되었거나 접근 권한이 없습니다."}</p>
          <Link className="button" href="/dashboard" style={{ display: "inline-block", marginTop: 16 }}>
            대시보드로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container grid dashboard-page">
      <section ref={overviewSectionRef} className="card hero compact">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <span className="badge">저장된 녹음</span>
              <span className="badge">문장 수정</span>
              <span className="badge">표현/TTS 재작업</span>
            </div>
            <h1 className="h1" style={{ marginBottom: 8 }}>녹음 상세</h1>
            <p className="muted">{recording.fileName}</p>
            <p className="muted" style={{ marginTop: 6 }}>로그인 사용자: <strong>{user?.email ?? getStoredUser()?.email ?? "-"}</strong></p>
          </div>
          <div className="row">
            <Link className="button ghost" href="/dashboard">대시보드</Link>
            <button className="button secondary" onClick={() => { clearSession(); router.replace("/"); }}>로그아웃</button>
          </div>
        </div>
        {message && <div className="success-box" style={{ marginTop: 12 }}>{message}</div>}
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
      </section>

      <div className="dashboard-grid recording-detail-grid">
        <section ref={recordingSectionRef} className="card panel-lg">
          {renderSectionIntro(
            "recording",
            "1. 녹음과 텍스트 확인",
            "원본 음성을 다시 들으면서 STT 결과를 다듬고 필요한 문장만 표현으로 변환합니다.",
            `상태 ${recording.status} · 문장 ${recording.utterances.length}개`,
          )}
          {expandedSections.recording && (
            <>
          <div className="row" style={{ justifyContent: "flex-end", alignItems: "flex-start", marginTop: 12 }}>
            <button className="button ghost" onClick={handleReprocess} disabled={!!loading}>
              {loading === "reprocess" ? "재실행 중..." : "텍스트 변환 다시 실행"}
            </button>
            <button className="button danger" onClick={handleDeleteRecording} disabled={!!loading}>
              {loading === "delete-recording" ? "삭제 중..." : "이 녹음 삭제"}
            </button>
          </div>

          <div className="grid recording-summary-grid" style={{ marginTop: 16 }}>
            <div className="mini-card">
              <strong>처리 상태</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                상태: {recording.status} · 화자 분리: {recording.diarization ? "사용" : "미사용"}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                문장 수: {recording.utterances.length}개
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                현재 내 화자: {speakerOptions.find((item) => item.isMine)?.speakerLabel ?? "선택되지 않음"}
              </div>
            </div>
            {recording.audioUrl && (
              <div className="mini-card">
                <strong>원본 음성 재생</strong>
                <audio
                  ref={rawAudioRef}
                  controls
                  className="audio-player"
                  style={{ marginTop: 12 }}
                  src={recording.audioUrl}
                  onLoadedMetadata={(event) => setRawAudioDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setRawAudioCurrentTime(event.currentTarget.currentTime)}
                />
                <div className="mini-card" style={{ marginTop: 12 }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>재생 위치 이동</strong>
                    <span className="muted">
                      {formatAudioTime(rawAudioCurrentTime)} / {formatAudioTime(rawAudioDuration)}
                    </span>
                  </div>
                  <input
                    className="timeline-slider"
                    type="range"
                    min={0}
                    max={rawAudioDuration || 0}
                    step={0.1}
                    value={Math.min(rawAudioCurrentTime, rawAudioDuration || 0)}
                    onChange={(event) => seekRawAudio(Number(event.target.value), false)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mini-card" style={{ marginTop: 16 }}>
            <strong>대화 맥락 힌트</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              표현 생성 전에 관계, 상황, 원하는 톤을 적어두면 직역보다 맥락에 맞는 영어가 나오기 쉽습니다.
            </div>
            <div className="grid" style={{ marginTop: 12 }}>
              <input
                className="input"
                value={recordingContextDraft.relationship}
                onChange={(event) => updateRecordingContextField("relationship", event.target.value)}
                placeholder="예: 엄마 - 아이"
              />
              <textarea
                className="input"
                style={{ minHeight: 96, resize: "vertical" }}
                value={recordingContextDraft.situation}
                onChange={(event) => updateRecordingContextField("situation", event.target.value)}
                placeholder="예: 아이가 유치원 가기 싫다고 하고, 엄마가 출근 전에 설득하는 상황"
              />
              <input
                className="input"
                value={recordingContextDraft.tone}
                onChange={(event) => updateRecordingContextField("tone", event.target.value)}
                placeholder="예: 부드럽지만 단호한 일상 회화"
              />
            </div>
            <div className="mini-card" style={{ marginTop: 12 }}>
              <strong>분석 상태</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {hasUnsavedContextChanges
                  ? "맥락 힌트에 저장되지 않은 변경사항이 있습니다."
                  : analysisNeedsRefresh
                  ? "대화 또는 맥락이 바뀌어 분석을 다시 실행해야 합니다."
                  : hasAnyAnalysis
                  ? "현재 보이는 대화 요약과 문장의도는 최신 분석입니다."
                  : "아직 대화 요약/의도 분석을 실행하지 않았습니다."}
              </div>
            </div>
            <div className="mini-card" style={{ marginTop: 12 }}>
              <strong>분석 실행 방식</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                기본값은 수동입니다. 자동을 선택하면 맥락/문장/화자 수정 후 대화 요약과 의도를 다시 분석합니다.
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className={`chip ${recordingAnalysisMode === "manual" ? "selected" : ""}`}
                  onClick={() => handleRecordingAnalysisModeChange("manual")}
                  disabled={!!loading}
                >
                  수동
                </button>
                <button
                  type="button"
                  className={`chip ${recordingAnalysisMode === "auto" ? "selected" : ""}`}
                  onClick={() => handleRecordingAnalysisModeChange("auto")}
                  disabled={!!loading}
                >
                  자동
                </button>
              </div>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="button ghost"
                onClick={handleSaveRecordingContext}
                disabled={!!loading || !hasUnsavedContextChanges}
              >
                {loading === "save-recording-context" ? "맥락 저장 중..." : "맥락 저장"}
              </button>
              <button className="button secondary" onClick={handleAnalyzeConversation} disabled={!!loading || recording.utterances.length === 0}>
                {loading === "analyze" ? "분석 중..." : "대화 요약/의도 분석"}
              </button>
              <button
                className="button"
                onClick={() => handleGenerateExpressionsBulk("mine")}
                disabled={!!loading || pendingMineExpressionCount === 0}
              >
                {loading === "expr-bulk-mine" ? "일괄 생성 중..." : `내 문장 일괄 표현 생성 (${pendingMineExpressionCount})`}
              </button>
              <button
                className="button ghost"
                onClick={() => handleGenerateExpressionsBulk("others")}
                disabled={!!loading || pendingOthersExpressionCount === 0}
              >
                {loading === "expr-bulk-others"
                  ? "일괄 생성 중..."
                  : `기타 화자 일괄 표현 생성 (${pendingOthersExpressionCount})`}
              </button>
            </div>
          </div>

          <div className="mini-card" style={{ marginTop: 16 }}>
            <strong>대화 요약</strong>
            <div style={{ marginTop: 10, lineHeight: 1.6 }}>{visibleAnalysisSummary || "아직 분석된 대화 요약이 없습니다."}</div>
            <div className="muted" style={{ marginTop: 10 }}>
              아래 각 발화 카드에서도 intent를 함께 볼 수 있습니다.
            </div>
          </div>

          {recording.diarization && speakerOptions.length > 0 && (
            <div className="mini-card" style={{ marginTop: 16 }}>
              <strong>내 화자 선택</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                diarization 결과가 틀릴 수 있으니, 실제 내 목소리 화자를 직접 선택해 주세요.
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                {speakerOptions.map((speaker) => (
                  <button
                    key={speaker.speakerLabel}
                    className={`chip ${speaker.isMine ? "selected" : ""}`}
                    onClick={() => handleSelectMineSpeaker(speaker.speakerLabel)}
                    disabled={!!loading}
                  >
                    {loading === `mine-speaker-${speaker.speakerLabel}`
                      ? `${speaker.speakerLabel} 저장 중...`
                      : speaker.isMine
                      ? `${speaker.speakerLabel} (내 화자)`
                      : speaker.speakerLabel}
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                {speakerOptions.map((speaker) => (
                  <button
                    key={`${speaker.speakerLabel}-label`}
                    className="button ghost"
                    onClick={() => handleUpdateSpeakerLabel(speaker.speakerLabel)}
                    disabled={!!loading}
                  >
                    {loading === `speaker-label-${speaker.speakerLabel}`
                      ? `${speaker.speakerLabel} 저장 중...`
                      : `${speaker.speakerLabel} 이름 변경`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid" style={{ marginTop: 16 }}>
            {recording.utterances.length === 0 && (
              <div className="mini-card muted">아직 변환된 문장이 없습니다. 텍스트 변환을 다시 실행해 보세요.</div>
            )}
            {visibleUtterances.map((utterance, index) => (
              <div key={utterance.id} className="utterance-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{index + 1}. {utterance.speakerLabel}</strong>
                    <span className="muted" style={{ marginLeft: 8 }}>
                      {formatTime(utterance.startMs)} - {formatTime(utterance.endMs)}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`tag ${utterance.isMine ? "tag-primary" : "tag-muted"}`}>{utterance.isMine ? "내 화자" : "기타 화자"}</span>
                    <span className={`tag ${expressionIdsByUtterance.has(utterance.id) ? "tag-done" : "tag-muted"}`}>
                      {expressionIdsByUtterance.has(utterance.id) ? "표현 있음" : "표현 없음"}
                    </span>
                  </div>
                </div>
                <textarea
                  className="input"
                  style={{ marginTop: 10, minHeight: 96, resize: "vertical" }}
                  value={utteranceDrafts[utterance.id] ?? ""}
                  onChange={(event) =>
                    setUtteranceDrafts((current) => ({ ...current, [utterance.id]: event.target.value }))
                  }
                  placeholder="STT 결과를 확인하고 자연스럽게 수정해 주세요."
                  disabled={!!loading}
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    className="button"
                    onClick={() => seekRawAudio(utterance.startMs / 1000, true)}
                    disabled={!recording.audioUrl}
                  >
                    원본 듣기
                  </button>
                  <button
                    className="button ghost"
                    onClick={() => handleSaveUtterance(utterance.id)}
                    disabled={!!loading || !(utteranceDrafts[utterance.id]?.trim())}
                  >
                    {loading === `save-${utterance.id}` ? "저장 중..." : "문장 저장"}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => handleGenerateExpression(utterance.id)}
                    disabled={!!loading || !(utteranceDrafts[utterance.id]?.trim())}
                  >
                    {loading === `expr-${utterance.id}` ? "생성 중..." : "저장 후 표현 생성"}
                  </button>
                  <button
                    className="button danger"
                    onClick={() => handleDeleteUtterance(utterance.id)}
                    disabled={!!loading}
                  >
                    {loading === `delete-utterance-${utterance.id}` ? "삭제 중..." : "문장 삭제"}
                  </button>
                </div>
                <div className="mini-card" style={{ marginTop: 12 }}>
                  <strong>이 발화의 의도</strong>
                  <div style={{ marginTop: 8 }}>{intentByUtteranceId.get(utterance.id) || "아직 분석된 발화 의도가 없습니다."}</div>
                </div>
              </div>
            ))}
            {renderListControls("utterances", recording.utterances.length)}
          </div>
            </>
          )}
        </section>

        <section ref={expressionsSectionRef} className="card panel-lg">
          {renderSectionIntro(
            "expressions",
            "2. 영어 표현과 복사",
            "이 녹음에서 만든 표현만 모아 보고, 한국어/영어를 바로 복사하거나 TTS를 생성합니다.",
            `표현 ${expressions.length}개 · TTS 대기 ${pendingRecordingTtsCount}개`,
          )}
          {expandedSections.expressions && (
            <>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="button secondary" onClick={handleGenerateTtsBulk} disabled={!!loading || pendingRecordingTtsCount === 0}>
              {loading === "tts-bulk" ? "일괄 생성 중..." : `남은 TTS 일괄 생성 (${pendingRecordingTtsCount})`}
            </button>
          </div>

          <div className="expression-layout" style={{ marginTop: 16 }}>
            <div className="expression-browser">
              <div className="expression-section-head">
                <div>
                  <div className="expression-section-eyebrow">Expression List</div>
                  <strong>표현 목록</strong>
                </div>
                <span className="tag tag-muted">{expressions.length}개</span>
              </div>
              <div className="grid" style={{ marginTop: 12 }}>
                {expressions.length === 0 && <div className="mini-card muted">이 녹음에서 아직 생성된 표현이 없습니다.</div>}
                {visibleExpressions.map((expression, index) => (
                  <button
                    key={expression.id}
                    className={`expression-item ${selectedExpressionId === expression.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedExpressionId(expression.id);
                      focusSelectedExpressionDetail();
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div className="muted" style={{ fontSize: 12 }}>{expression.koreanText}</div>
                      <span className={`tag ${expression.ttsKey ? "tag-done" : "tag-muted"}`}>
                        {expression.ttsKey ? "TTS 완료" : "TTS 미생성"}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 700 }}>{index + 1}. {expression.englishBase}</div>
                  </button>
                ))}
              </div>
              {renderListControls("expressions", expressions.length)}
            </div>

          {selectedExpression && (
            <div ref={expressionDetailRef} className="expression-detail-panel" tabIndex={-1}>
              <div className="expression-section-head">
                <div>
                  <div className="expression-section-eyebrow">Selected Detail</div>
                  <strong>선택한 표현 상세</strong>
                </div>
                <span className="tag tag-primary">선택됨</span>
              </div>
              <div className="grid" style={{ marginTop: 16 }}>
                <div className="mini-card">
                  <strong>한국어 원문</strong>
                  <div style={{ marginTop: 8 }}>{selectedExpression.koreanText}</div>
                </div>
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
                <div className="mini-card">
                  <strong>메모</strong>
                  <textarea
                    className="textarea"
                    style={{ marginTop: 8, minHeight: 96 }}
                    value={expressionMemoDraft}
                    onChange={(event) => setExpressionMemoDraft(event.target.value)}
                    placeholder="예: 비슷한 상황에서도 그대로 써도 되는 표현"
                  />
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="button secondary" onClick={handleSaveExpressionMemo} disabled={!!loading || !selectedExpression}>
                      {loading === "save-expression-memo" ? "메모 저장 중..." : "메모 저장"}
                    </button>
                  </div>
                </div>
                <div className="mini-card">
                  <strong>대화 요약</strong>
                  <div style={{ marginTop: 8 }}>{visibleAnalysisSummary || "아직 분석된 대화 요약이 없습니다."}</div>
                </div>
                <div className="mini-card">
                  <strong>발화 의도</strong>
                  <div style={{ marginTop: 8 }}>{selectedExpressionIntent || "아직 분석된 발화 의도가 없습니다."}</div>
                </div>

                <div className="row">
                  <button className="button ghost" onClick={() => handleCopyText(selectedExpression.koreanText, "한국어 문장")} disabled={!!loading}>
                    한국어 복사
                  </button>
                  <button className="button ghost" onClick={() => handleCopyText(selectedExpression.englishBase, "영어 표현")} disabled={!!loading}>
                    영어 복사
                  </button>
                  <button className="button" onClick={handleGenerateTts} disabled={!!loading}>
                    {loading === "tts"
                      ? (selectedExpression?.ttsKey ? "TTS 재생성 중..." : "TTS 생성 중...")
                      : (selectedExpression?.ttsKey ? "TTS 재생성" : "TTS 생성")}
                  </button>
                  <button className="button secondary" onClick={() => audioRef.current?.play()} disabled={!selectedExpression.ttsUrl}>
                    TTS 재생
                  </button>
                  <button className="button danger" onClick={handleDeleteExpression} disabled={!!loading}>
                    {loading === "delete-expression" ? "삭제 중..." : "표현 삭제"}
                  </button>
                </div>

                <audio
                  ref={audioRef}
                  controls
                  className="audio-player"
                  src={selectedExpression.ttsUrl || undefined}
                />
              </div>
            </div>
          )}
          </div>
            </>
          )}
        </section>
      </div>
      <nav className="mobile-section-nav" aria-label="상세 페이지 섹션 이동">
        {DETAIL_SECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="mobile-section-nav-button"
            onClick={() => scrollToDetailSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
