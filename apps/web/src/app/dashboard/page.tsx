"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, createPresignedUploadTask, downloadApiFile } from "../../lib/api-client";
import { normalizeAudioFileForUpload, prepareAudioChunksForUpload } from "../../lib/audio-split";
import { clearSession, getStoredUser, getToken } from "../../lib/auth";
import {
  buildRecordingContextPayload,
  EMPTY_RECORDING_CONTEXT,
  loadRecordingContext,
  loadRecentGenerationContext,
  saveRecordingContext,
  saveRecentGenerationContext,
  type RecordingGenerationContext,
} from "../../lib/recording-context";
import {
  DEFAULT_RECORDING_ANALYSIS_MODE,
  loadRecordingAnalysisMode,
  saveRecordingAnalysisMode,
  type RecordingAnalysisMode,
} from "../../lib/recording-analysis-preference";
import { startRecordedAudioSession, type RecordingSession } from "../../lib/recorder";

type MeResponse = { userId: string; email: string };
type PresignResponse = { key: string; uploadUrl: string; recordingId: string };
type RecordingUtterance = {
  id: string;
  speakerLabel: string;
  koreanText: string;
  contextNote?: string | null;
  startMs: number;
  endMs: number;
  isMine: boolean;
  analysisIntent?: string | null;
};
type PersonProfile = {
  id: string;
  name: string;
  roleLabel?: string | null;
  relationshipToMe?: string | null;
  aliases?: string | null;
  notes?: string | null;
  isMe?: boolean;
};
type RecordingResponse = {
  id: string;
  fileName: string;
  status: string;
  audioUrl?: string;
  diarization?: boolean;
  analysisSummary?: string | null;
  analysisRelationship?: string | null;
  analysisSituation?: string | null;
  analysisTone?: string | null;
  analysisStatus?: "NOT_ANALYZED" | "OK" | "NEEDS_REVIEW" | null;
  analysisStatusReason?: string | null;
  analysisUpdatedAt?: string | null;
  participants: Array<{ personProfile: PersonProfile }>;
  speakerProfiles: Array<{ speakerLabel: string; personProfileId: string; personProfile: PersonProfile }>;
  utterances: RecordingUtterance[];
};
type RecordingSummary = {
  id: string;
  fileName: string;
  status: string;
  diarization: boolean;
  createdAt: string;
  updatedAt: string;
  analysisStatus?: "NOT_ANALYZED" | "OK" | "NEEDS_REVIEW" | null;
  analysisStatusReason?: string | null;
  _count: { utterances: number };
};
type Expression = {
  id: string;
  utteranceId?: string | null;
  savedSentenceId?: string | null;
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  note?: string | null;
  userMemo?: string | null;
  ttsKey?: string | null;
  ttsUrl?: string | null;
  koreanTtsKey?: string | null;
  koreanTtsUrl?: string | null;
  sourceAnalysisIntent?: string | null;
  sourceAnalysisSummary?: string | null;
  sourceRelationship?: string | null;
  sourceSituation?: string | null;
  sourceTone?: string | null;
  sourceContextNote?: string | null;
  practiceCount?: number;
  latestPracticeScore?: number | null;
  createdAt?: string;
  utterance?: {
    recording?: {
      id: string;
      fileName?: string | null;
      createdAt?: string;
    } | null;
  } | null;
};
type TtsResponse = {
  expressionId: string;
  ttsKey: string;
  ttsUrl: string;
  koreanTtsKey: string;
  koreanTtsUrl: string;
  expression: string;
};
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
type PracticeScore = {
  id: string;
  score: number;
  meaningScore?: number;
  naturalnessScore?: number;
  grammarScore?: number;
  feedback: string;
  strengthComment?: string;
  correctionComment?: string;
  meaningComment?: string;
  suggestedAnswer?: string;
  suggestedAnswerAlt?: string;
  target: string;
  answer: string;
  audioUrl?: string;
  responseLatencyMs?: number | null;
  responseTimedOut?: boolean;
  responseLimitMs?: number;
};
type ReviewItem = {
  id: string;
  korean: string;
  english: string;
  mastery: number;
  ttsKey?: string | null;
  recommendedTestType?: "translation" | "situation";
  reviewReason?: string | null;
  lastReviewedAt?: string | null;
  practiceAnswer?: string | null;
  practiceAudioUrl?: string | null;
};
type ReviewStrategy = "system" | "low_score" | "stale" | "voice_gap" | "random";
type ExpressionBrowserScope = "recording" | "all";
type PracticeFlowMode = "single" | "review_once" | "review_series";
type PracticeHistoryItem = {
  id: string;
  expressionId: string;
  koreanText: string;
  englishBase: string;
  answer: string;
  recognizedAnswer?: string | null;
  target: string;
  mode?: "text" | "voice" | null;
  testType?: "translation" | "situation" | "pattern" | null;
  promptKorean?: string | null;
  promptContext?: string | null;
  score: number;
  meaningScore?: number | null;
  naturalnessScore?: number | null;
  grammarScore?: number | null;
  feedback: string;
  strengthComment?: string | null;
  correctionComment?: string | null;
  meaningComment?: string | null;
  suggestedAnswer?: string | null;
  suggestedAnswerAlt?: string | null;
  createdAt: string;
  audioUrl?: string | null;
};
type LearningAssetsProgress = {
  overall: {
    patternTemplateCount: number;
    vocabularyItemCount: number;
    collectedPatternCount: number;
    automatedPatternCount: number;
    collectedVocabularyCount: number;
    usableVocabularyCount: number;
    patternCollectionRate: number;
    patternAutomationRate: number;
    vocabularyCollectionRate: number;
    vocabularyUsableRate: number;
    responseWithin1sRate: number;
    overallProgress: number;
  };
  levels: Array<{
    level: "A1" | "A2";
    patternTargetCount: number;
    patternCollectedCount: number;
    patternAutomatedCount: number;
    vocabularyTargetCount: number;
    vocabularyCollectedCount: number;
    vocabularyUsableCount: number;
    progress: number;
  }>;
  weakestCategories: Array<{
    kind: "pattern" | "vocabulary";
    level?: "A1" | "A2";
    code: string;
    nameKo: string;
    targetCount: number;
    collectedCount: number;
    automatedCount: number;
    gap: number;
  }>;
};
type LearningAssetExpression = {
  id: string;
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  utteranceId?: string | null;
  savedSentenceId?: string | null;
  createdAt: string;
};
type LearningPatternTemplate = {
  id: string;
  templateText: string;
  meaningKo: string;
  usageNote?: string | null;
  difficulty?: number | null;
  exampleEn?: string | null;
  exampleKo?: string | null;
  isCoreExpression: boolean;
  progress: {
    status: "COLLECTED" | "RECOGNIZED" | "PRACTICING" | "USABLE_IN_SPEAKING" | "AUTOMATED";
    successCount: number;
    failCount: number;
    responseWithin1sCount: number;
    lastPracticedAt?: string | null;
  } | null;
  expressions: LearningAssetExpression[];
  collected: boolean;
  automated: boolean;
};
type LearningPatternCategory = {
  id: string;
  level: "A1" | "A2";
  code: string;
  nameKo: string;
  nameEn: string;
  description?: string | null;
  targetCount: number;
  sortOrder: number;
  templates: LearningPatternTemplate[];
};
type LearningVocabularyItem = {
  id: string;
  level: "A1" | "A2";
  lemma: string;
  partOfSpeech: string;
  meaningKo: string;
  exampleEn?: string | null;
  exampleKo?: string | null;
  frequencyRank?: number | null;
  isCore: boolean;
  progress: {
    status: "COLLECTED" | "RECOGNIZED" | "PRACTICING" | "USABLE_IN_SPEAKING" | "AUTOMATED";
    successCount: number;
    failCount: number;
    responseWithin1sCount: number;
    lastPracticedAt?: string | null;
  } | null;
  expressions: LearningAssetExpression[];
  collected: boolean;
  automated: boolean;
};
type LearningVocabularyCategory = {
  id: string;
  code: string;
  nameKo: string;
  nameEn: string;
  description?: string | null;
  sortOrder: number;
  items: LearningVocabularyItem[];
};
type LearningAssetsCatalog = {
  patternCategories: LearningPatternCategory[];
  vocabularyCategories: LearningVocabularyCategory[];
  unmatchedPatternExpressions: LearningAssetExpression[];
  unmatchedVocabularyExpressions: LearningAssetExpression[];
};

function MetricHelpButton({ label, description }: { label: string; description: string }) {
  return (
    <span className="help-tooltip">
      <button
        type="button"
        className="help-icon-button"
        aria-label={`${label} 도움말`}
      >
        ?
      </button>
      <span role="tooltip" className="help-tooltip-bubble">
        {description}
      </span>
    </span>
  );
}

function FieldHelpLabel({ label, description }: { label: string; description: string }) {
  return (
    <div className="row" style={{ alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
      <strong>{label}</strong>
      <MetricHelpButton label={label} description={description} />
    </div>
  );
}
type PracticeVoicePresignResponse = { key: string; uploadUrl: string };
type RecordingSessionCreateResponse = {
  sessionId: string;
  status: string;
  recommendedPartDurationMs: number;
  maxDurationMs: number;
};
type RecordingSessionPartPresignResponse = {
  sessionId: string;
  partId: string;
  partNumber: number;
  audioKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
};
type RecordingSessionStatusResponse = {
  id: string;
  status: string;
  uploadedPartCount: number;
  expectedPartCount?: number | null;
  totalDurationMs?: number | null;
  errorMessage?: string | null;
  parts: Array<{
    id: string;
    partNumber: number;
    status: string;
    errorMessage?: string | null;
    recording?: {
      id: string;
      fileName: string;
      status: string;
      createdAt: string;
    } | null;
  }>;
  jobs: Array<{
    id: string;
    status: string;
    errorMessage?: string | null;
    targetId: string;
  }>;
};
type PracticePrompt = {
  testType: "translation" | "situation" | "pattern";
  promptKorean: string;
  promptContext?: string;
  target: string;
  referenceTarget?: string;
  targetAlt?: string;
  tips?: string;
  patternLabel?: string;
  patternDescription?: string;
};

function buildTranslationPracticePrompt(expression: Expression): PracticePrompt {
  return {
    testType: "translation",
    promptKorean: expression.koreanText,
    target: expression.englishBase,
    tips: "핵심 의미를 살려 자연스럽게 영어로 말해보세요.",
  };
}
type RecordingAnalysis = {
  summary: string;
  intents: Array<{
    utteranceId?: string;
    speakerLabel?: string;
    koreanText: string;
    intent: string;
  }>;
};

type FlowStep = {
  id: string;
  label: string;
  description: string;
  progress: number;
};

function normalizeProfileKeyword(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function inferRelationshipFromProfiles(profiles: PersonProfile[]) {
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

const RECORDING_OPTIONS = [
  { label: "5초", value: 5000 },
  { label: "10초", value: 10000 },
  { label: "20초", value: 20000 },
  { label: "40초", value: 40000 },
  { label: "90초", value: 90000 },
];

const AUTO_FLOW_STEPS: FlowStep[] = [
  { id: "record-start", label: "녹음 준비", description: "브라우저 마이크 권한과 녹음을 시작합니다.", progress: 5 },
  { id: "recording", label: "녹음 중", description: "선택한 시간 동안 샘플 발화를 녹음합니다.", progress: 12 },
  { id: "presign", label: "업로드 준비", description: "S3 업로드용 presigned URL을 요청합니다.", progress: 20 },
  { id: "upload", label: "S3 업로드", description: "오디오 파일을 스토리지에 업로드합니다.", progress: 34 },
  { id: "transcribe", label: "텍스트 변환", description: "한국어 음성을 문장 단위 텍스트로 변환합니다.", progress: 50 },
  { id: "mine", label: "내 문장 추출", description: "내 화자 문장을 우선 추출합니다.", progress: 62 },
  { id: "expressions", label: "영어 표현 생성", description: "선택된 문장을 영어 표현으로 변환합니다.", progress: 78 },
  { id: "tts", label: "TTS 생성", description: "첫 번째 표현의 영어 음성을 생성합니다.", progress: 90 },
  { id: "reviews", label: "복습 목록 갱신", description: "표현장과 오늘 복습 목록을 새로고침합니다.", progress: 96 },
  { id: "complete", label: "완료", description: "테스트 영역으로 이동해 바로 연습합니다.", progress: 100 },
];

const DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG = false;

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
  "score-voice": 45000,
};

const stepMap = Object.fromEntries(AUTO_FLOW_STEPS.map((step) => [step.id, step]));
const WAVE_BAR_COUNT = 28;
const BROWSER_RECORDING_MAX_MS = 5 * 60 * 1000;
const MOBILE_BROWSER_RECORDING_MAX_MS = 3 * 60 * 1000;
const MANUAL_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
const MANUAL_UPLOAD_ALLOWED_EXTENSIONS = [".wav", ".m4a", ".mp3", ".mp4", ".aac"];
const DEFAULT_PREVIEW_COUNTS = {
  recordings: 4,
  utterances: 6,
  expressions: 6,
  reviews: 4,
  practiceHistory: 6,
  ttsLibrary: 4,
} as const;
const LIST_INCREMENT_SMALL = 5;
const LIST_INCREMENT_LARGE = 20;
const MANUAL_RECORDING_CHUNK_MS = BROWSER_RECORDING_MAX_MS;
const MANUAL_RECORDING_MAX_MS = BROWSER_RECORDING_MAX_MS;
const MANUAL_RECORDING_IOS_SAFARI_MAX_MS = BROWSER_RECORDING_MAX_MS;
const MANUAL_RECORDING_RETRY_DELAYS = [2000, 5000, 10000];
const MANUAL_UPLOAD_STT_CHUNK_MS = 10 * 60 * 1000;
const DASHBOARD_SECTION_TABS = [
  { id: "personDictionary", label: "인물 사전" },
  { id: "autoFlow", label: "원클릭" },
  { id: "learningProgress", label: "진도" },
  { id: "learningAssets", label: "DB 보기" },
  { id: "patternAssets", label: "패턴 자산" },
  { id: "vocabularyAssets", label: "단어 자산" },
  { id: "recordings", label: "녹음 목록" },
  { id: "recordingDetail", label: "녹음 상세" },
  { id: "expressions", label: "표현" },
  { id: "practice", label: "연습" },
  { id: "practiceHistory", label: "기록" },
  { id: "ttsLibrary", label: "TTS" },
] as const;

const MOBILE_DASHBOARD_SECTION_TABS = [
  { id: "autoFlow", label: "원클릭" },
  { id: "recordings", label: "녹음" },
  { id: "expressions", label: "표현" },
  { id: "practice", label: "연습" },
  { id: "practiceHistory", label: "기록" },
  { id: "ttsLibrary", label: "TTS" },
] as const;

const REVIEW_STRATEGY_OPTIONS: Array<{ value: ReviewStrategy; label: string; description: string }> = [
  { value: "system", label: "시스템 추천", description: "기본 추천 기준으로 복습 문제를 구성합니다." },
  { value: "low_score", label: "낮은 점수 우선", description: "최근 점수가 낮은 표현을 먼저 복습합니다." },
  { value: "stale", label: "오래 안 본 표현", description: "최근 복습하지 않은 표현을 먼저 보여줍니다." },
  { value: "voice_gap", label: "음성 부족 우선", description: "음성 연습 기록이 부족한 표현을 먼저 복습합니다." },
  { value: "random", label: "랜덤", description: "표현을 무작위로 섞어서 복습합니다." },
];

type ManualRecordingStats = {
  effectiveMaxMs: number;
  chunkCount: number;
  successCount: number;
  failedCount: number;
  currentChunkIndex: number;
  isActive: boolean;
};

type FailedManualChunk = {
  id: string;
  file: File;
  chunkIndex: number;
  reason: string;
};

type TtsLibraryPlaybackTrack = {
  expressionId: string;
  language: "english" | "korean";
};

type TtsLibraryPlaybackPlan = {
  tracks: TtsLibraryPlaybackTrack[];
  gapMs: number;
  trackIndex: number;
  sessionId: number;
};

const RELATIONSHIP_TEMPLATES = [
  "엄마 - 아이",
  "아빠 - 아이",
  "남편 - 아내",
  "가족",
  "회사 상사 - 동료",
  "부부",
  "친구",
  "손님 - 직원",
  "부모 - 자녀",
  "선생님 - 학생",
];
const SITUATION_TEMPLATES = ["집", "이동 중", "식사 중", "가족 식사", "병원", "학교", "가게", "통화 중"];
const TONE_TEMPLATES = ["자연스럽게", "부드럽게", "단호하게", "친근하게", "공손하게"];

function isBrowserRecordedFile(file: File) {
  const normalizedType = (file.type || "").toLowerCase();
  const normalizedName = file.name.toLowerCase();
  return (
    normalizedName.startsWith("recording-") &&
    (normalizedType.includes("webm") || normalizedType.includes("mp4") || normalizedType.includes("m4a"))
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authError, setAuthError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(20000);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [recording, setRecording] = useState<RecordingResponse | null>(null);
  const [recordingContext, setRecordingContext] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [recordingContextDraft, setRecordingContextDraft] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [recordingAnalysis, setRecordingAnalysis] = useState<RecordingAnalysis | null>(null);
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [personProfiles, setPersonProfiles] = useState<PersonProfile[]>([]);
  const [personProfileDraft, setPersonProfileDraft] = useState({
    id: "",
    name: "",
    roleLabel: "",
    relationshipToMe: "",
    aliases: "",
    notes: "",
    isMe: false,
  });
  const [utteranceDrafts, setUtteranceDrafts] = useState<Record<string, string>>({});
  const [utteranceSpeakerDrafts, setUtteranceSpeakerDrafts] = useState<Record<string, string>>({});
  const [utteranceContextDrafts, setUtteranceContextDrafts] = useState<Record<string, string>>({});
  const [utteranceAnalysisReviewFlags, setUtteranceAnalysisReviewFlags] = useState<Record<string, boolean>>({});
  const [recordingParticipantDraftIds, setRecordingParticipantDraftIds] = useState<string[]>([]);
  const [speakerLabelDrafts, setSpeakerLabelDrafts] = useState<Record<string, string>>({});
  const [activeSpeakerRenameLabel, setActiveSpeakerRenameLabel] = useState("");
  const [speakerProfileDrafts, setSpeakerProfileDrafts] = useState<Record<string, string>>({});
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [selectedExpressionId, setSelectedExpressionId] = useState("");
  const [expressionMemoDraft, setExpressionMemoDraft] = useState("");
  const [expressionBrowserScope, setExpressionBrowserScope] = useState<ExpressionBrowserScope>("recording");
  const [expressionQuery, setExpressionQuery] = useState("");
  const [ttsUrl, setTtsUrl] = useState("");
  const [testMode, setTestMode] = useState<"text" | "voice">("voice");
  const [practiceTestType, setPracticeTestType] = useState<"translation" | "situation" | "pattern">("translation");
  const [practicePrompt, setPracticePrompt] = useState<PracticePrompt | null>(null);
  const [practicePromptReadyAtMs, setPracticePromptReadyAtMs] = useState<number | null>(null);
  const [practiceResponseStartedAtMs, setPracticeResponseStartedAtMs] = useState<number | null>(null);
  const [activeReviewExpressionId, setActiveReviewExpressionId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [voiceAnswerFile, setVoiceAnswerFile] = useState<File | null>(null);
  const [score, setScore] = useState<PracticeScore | null>(null);
  const [savedPatternExpression, setSavedPatternExpression] = useState<{
    id: string;
    hasEnglishTts: boolean;
    hasKoreanTts: boolean;
  } | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryItem[]>([]);
  const [reviewStrategy, setReviewStrategy] = useState<ReviewStrategy>("system");
  const [practiceFlowMode, setPracticeFlowMode] = useState<PracticeFlowMode>("single");
  const [reviewAutoAdvance, setReviewAutoAdvance] = useState(false);
  const [reviewReadQuestion, setReviewReadQuestion] = useState(false);
  const [pendingAutoReview, setPendingAutoReview] = useState<ReviewItem | null>(null);
  const [learningAssetsProgress, setLearningAssetsProgress] = useState<LearningAssetsProgress | null>(null);
  const [learningAssetsCatalog, setLearningAssetsCatalog] = useState<LearningAssetsCatalog | null>(null);
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
  const [rawAudioCurrentTime, setRawAudioCurrentTime] = useState(0);
  const [rawAudioDuration, setRawAudioDuration] = useState(0);
  const [isMicRecording, setIsMicRecording] = useState(false);
  const [isPracticeRecording, setIsPracticeRecording] = useState(false);
  const [practiceAutoStartCountdown, setPracticeAutoStartCountdown] = useState<number | null>(null);
  const [activeTimeoutMessage, setActiveTimeoutMessage] = useState("");
  const [showAutoFlowHelp, setShowAutoFlowHelp] = useState(false);
  const [showManualGenerateComposer, setShowManualGenerateComposer] = useState(false);
  const [showManualGenerateContext, setShowManualGenerateContext] = useState(false);
  const [manualGenerateText, setManualGenerateText] = useState("");
  const [recentManualContext, setRecentManualContext] = useState<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const [manualGenerateParticipantIds, setManualGenerateParticipantIds] = useState<string[]>([]);
  const [recordingAnalysisMode, setRecordingAnalysisMode] = useState<RecordingAnalysisMode>(DEFAULT_RECORDING_ANALYSIS_MODE);
  const [manualRecordingLimitMs, setManualRecordingLimitMs] = useState(MANUAL_RECORDING_MAX_MS);
  const [ttsLibraryRepeatCount, setTtsLibraryRepeatCount] = useState<1 | 2 | 3>(1);
  const [ttsLibraryGapMs, setTtsLibraryGapMs] = useState(0);
  const [ttsLibraryIncludeKorean, setTtsLibraryIncludeKorean] = useState(false);
  const [ttsLibraryQuery, setTtsLibraryQuery] = useState("");
  const [isTtsLibraryPlaying, setIsTtsLibraryPlaying] = useState(false);
  const [isTtsLibraryPreparing, setIsTtsLibraryPreparing] = useState(false);
  const [ttsLibraryCurrentExpressionId, setTtsLibraryCurrentExpressionId] = useState("");
  const [activeRecordingSessionId, setActiveRecordingSessionId] = useState("");
  const [activeRecordingSessionStatus, setActiveRecordingSessionStatus] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<(typeof DASHBOARD_SECTION_TABS)[number]["id"]>("autoFlow");
  const [manualRecordingStats, setManualRecordingStats] = useState<ManualRecordingStats>({
    effectiveMaxMs: MANUAL_RECORDING_MAX_MS,
    chunkCount: 0,
    successCount: 0,
    failedCount: 0,
    currentChunkIndex: 0,
    isActive: false,
  });
  const [failedManualChunks, setFailedManualChunks] = useState<FailedManualChunk[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<"recordings" | "expressions" | "practice" | "practiceHistory" | "ttsLibrary", boolean>>({
    recordings: true,
    expressions: true,
    practice: true,
    practiceHistory: false,
    ttsLibrary: false,
  });
  const [learningProgressOpen, setLearningProgressOpen] = useState(false);
  const [personDictionaryOpen, setPersonDictionaryOpen] = useState(false);
  const [assetSectionOpen, setAssetSectionOpen] = useState(false);
  const [exportSectionOpen, setExportSectionOpen] = useState(false);
  const [patternAssetOpen, setPatternAssetOpen] = useState(false);
  const [vocabularyAssetOpen, setVocabularyAssetOpen] = useState(false);
  const [patternAssetQuery, setPatternAssetQuery] = useState("");
  const [patternAssetCoreOnly, setPatternAssetCoreOnly] = useState(false);
  const [vocabularyAssetQuery, setVocabularyAssetQuery] = useState("");
  const [visibleCounts, setVisibleCounts] = useState<Record<keyof typeof DEFAULT_PREVIEW_COUNTS, number>>(DEFAULT_PREVIEW_COUNTS);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsLibraryAudioRef = useRef<HTMLAudioElement | null>(null);
  const practiceReferenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const expressionDetailRef = useRef<HTMLDivElement | null>(null);
  const practiceMainCardRef = useRef<HTMLDivElement | null>(null);
  const recordingDetailRef = useRef<HTMLDivElement | null>(null);
  const rawAudioRef = useRef<HTMLAudioElement | null>(null);
  const personDictionarySectionRef = useRef<HTMLElement | null>(null);
  const testSectionRef = useRef<HTMLElement | null>(null);
  const autoFlowSectionRef = useRef<HTMLElement | null>(null);
  const learningProgressSectionRef = useRef<HTMLElement | null>(null);
  const learningAssetsSectionRef = useRef<HTMLElement | null>(null);
  const patternAssetsSectionRef = useRef<HTMLElement | null>(null);
  const vocabularyAssetsSectionRef = useRef<HTMLElement | null>(null);
  const recordingsSectionRef = useRef<HTMLElement | null>(null);
  const expressionsSectionRef = useRef<HTMLElement | null>(null);
  const practiceHistorySectionRef = useRef<HTMLElement | null>(null);
  const ttsLibrarySectionRef = useRef<HTMLElement | null>(null);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingSessionRef = useRef<{ stop: () => void; cancel: () => void } | null>(null);
  const practiceRecordingSessionRef = useRef<RecordingSession | null>(null);
  const practiceAutoStartTimeoutRef = useRef<number | null>(null);
  const practiceAutoStartIntervalRef = useRef<number | null>(null);
  const reviewAutoAdvanceTimeoutRef = useRef<number | null>(null);
  const reviewAutoAdvanceScrollTimeoutRef = useRef<number | null>(null);
  const reviewQuestionSpeechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const uploadTaskRef = useRef<ReturnType<typeof createPresignedUploadTask> | null>(null);
  const abortControllersRef = useRef<AbortController[]>([]);
  const userCancelledRef = useRef(false);
  const sessionPollTimeoutRef = useRef<number | null>(null);
  const recordingContextRef = useRef<RecordingGenerationContext>(EMPTY_RECORDING_CONTEXT);
  const ttsLibraryPlaybackPlanRef = useRef<TtsLibraryPlaybackPlan | null>(null);
  const ttsLibraryPlaybackTimeoutRef = useRef<number | null>(null);
  const ttsLibraryPlaybackSessionIdRef = useRef(0);
  const ttsLibraryAudioCacheRef = useRef<Map<string, string>>(new Map());

  const selectedExpression = useMemo(
    () => expressions.find((item) => item.id === selectedExpressionId) ?? expressions[0] ?? null,
    [expressions, selectedExpressionId],
  );
  const recordingUtteranceIds = useMemo(
    () => new Set(recording?.utterances.map((utterance) => utterance.id) ?? []),
    [recording],
  );
  const recordingExpressions = useMemo(
    () =>
      expressions.filter(
        (expression) => expression.utteranceId && recordingUtteranceIds.has(expression.utteranceId),
      ),
    [expressions, recordingUtteranceIds],
  );
  const savedSentenceExpressions = useMemo(
    () => expressions.filter((expression) => expression.savedSentenceId && !expression.utteranceId),
    [expressions],
  );
  const sectionExpressions = useMemo(
    () => (recording ? recordingExpressions : savedSentenceExpressions),
    [recording, recordingExpressions, savedSentenceExpressions],
  );
  const browsedExpressions = useMemo(
    () => (expressionBrowserScope === "all" ? expressions : sectionExpressions),
    [expressionBrowserScope, expressions, sectionExpressions],
  );
  const filteredExpressions = useMemo(() => {
    const query = expressionQuery.trim().toLowerCase();
    if (!query) return browsedExpressions;
    return browsedExpressions.filter((expression) =>
      [
        expression.koreanText,
        expression.englishBase,
        expression.englishEasy,
        expression.englishNatural,
        expression.note ?? "",
        expression.userMemo ?? "",
        expression.sourceAnalysisSummary ?? "",
        expression.sourceAnalysisIntent ?? "",
        expression.sourceRelationship ?? "",
        expression.sourceSituation ?? "",
        expression.sourceTone ?? "",
        expression.sourceContextNote ?? "",
        expression.utterance?.recording?.fileName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [browsedExpressions, expressionQuery]);
  const selectedSectionExpression = useMemo(
    () => sectionExpressions.find((item) => item.id === selectedExpressionId) ?? null,
    [sectionExpressions, selectedExpressionId],
  );
  const selectedBrowserExpression = useMemo(
    () => filteredExpressions.find((item) => item.id === selectedExpressionId) ?? filteredExpressions[0] ?? null,
    [filteredExpressions, selectedExpressionId],
  );
  const utteranceExpressionIds = useMemo(
    () => new Set(recordingExpressions.map((item) => item.utteranceId).filter((value): value is string => Boolean(value))),
    [recordingExpressions],
  );
  const pendingMineExpressionCount = useMemo(
    () =>
      (recording?.utterances ?? []).filter(
        (utterance) => utterance.isMine && utterance.koreanText.trim() && !utteranceExpressionIds.has(utterance.id),
      ).length,
    [recording, utteranceExpressionIds],
  );
  const pendingOthersExpressionCount = useMemo(
    () =>
      (recording?.utterances ?? []).filter(
        (utterance) => !utterance.isMine && utterance.koreanText.trim() && !utteranceExpressionIds.has(utterance.id),
      ).length,
    [recording, utteranceExpressionIds],
  );
  const pendingSectionTtsCount = useMemo(
    () => sectionExpressions.filter((expression) => !expression.ttsKey || !expression.koreanTtsKey).length,
    [sectionExpressions],
  );
  const completedSectionTtsExpressions = useMemo(
    () => sectionExpressions.filter((expression) => Boolean(expression.ttsKey && expression.ttsUrl)),
    [sectionExpressions],
  );
  const completedTtsExpressions = useMemo(
    () => expressions.filter((expression) => Boolean(expression.ttsKey && expression.ttsUrl)),
    [expressions],
  );
  const filteredCompletedTtsExpressions = useMemo(() => {
    const query = ttsLibraryQuery.trim().toLowerCase();
    if (!query) return completedTtsExpressions;
    return completedTtsExpressions.filter((expression) =>
      `${expression.englishBase} ${expression.koreanText}`.toLowerCase().includes(query),
    );
  }, [completedTtsExpressions, ttsLibraryQuery]);
  const filteredPatternCategories = useMemo(() => {
    const categories = learningAssetsCatalog?.patternCategories ?? [];
    const query = patternAssetQuery.trim().toLowerCase();
    return categories
      .map((category) => ({
        ...category,
        templates: category.templates.filter((template) => {
          if (patternAssetCoreOnly && !template.isCoreExpression) {
            return false;
          }
          if (!query) {
            return true;
          }
          return [
            template.templateText,
            template.meaningKo,
            template.usageNote ?? "",
            template.exampleEn ?? "",
            template.exampleKo ?? "",
            ...template.expressions.flatMap((expression) => [expression.englishBase, expression.koreanText, expression.englishNatural]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        }),
      }))
      .filter((category) => category.templates.length > 0);
  }, [learningAssetsCatalog, patternAssetCoreOnly, patternAssetQuery]);
  const filteredVocabularyCategories = useMemo(() => {
    const categories = learningAssetsCatalog?.vocabularyCategories ?? [];
    const query = vocabularyAssetQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          [
            item.lemma,
            item.meaningKo,
            item.exampleEn ?? "",
            item.exampleKo ?? "",
            item.partOfSpeech,
            ...item.expressions.flatMap((expression) => [expression.englishBase, expression.koreanText, expression.englishNatural]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [learningAssetsCatalog, vocabularyAssetQuery]);
  const visibleRecordings = useMemo(
    () => recordings.slice(0, visibleCounts.recordings),
    [recordings, visibleCounts.recordings],
  );
  const visibleUtterances = useMemo(
    () => (recording?.utterances ?? []).slice(0, visibleCounts.utterances),
    [recording, visibleCounts.utterances],
  );
  const visibleExpressions = useMemo(
    () => filteredExpressions.slice(0, visibleCounts.expressions),
    [filteredExpressions, visibleCounts.expressions],
  );
  const visibleReviews = useMemo(
    () => reviews.slice(0, visibleCounts.reviews),
    [reviews, visibleCounts.reviews],
  );
  const visiblePracticeHistory = useMemo(
    () => practiceHistory.slice(0, visibleCounts.practiceHistory),
    [practiceHistory, visibleCounts.practiceHistory],
  );
  const visibleCompletedTtsExpressions = useMemo(
    () => filteredCompletedTtsExpressions.slice(0, visibleCounts.ttsLibrary),
    [filteredCompletedTtsExpressions, visibleCounts.ttsLibrary],
  );
  const activeReviewIndex = useMemo(
    () => (activeReviewExpressionId ? reviews.findIndex((item) => item.id === activeReviewExpressionId) : -1),
    [activeReviewExpressionId, reviews],
  );
  const activeReviewItem = activeReviewIndex >= 0 ? reviews[activeReviewIndex] ?? null : null;
  const nextReviewItem = activeReviewIndex >= 0 ? reviews[activeReviewIndex + 1] ?? null : null;
  const practiceFocusLabel =
    practiceFlowMode === "review_series"
      ? "연속 복습"
      : practiceFlowMode === "review_once"
      ? "복습 1건"
      : "단일 연습";

  const speakerOptions = useMemo(() => {
    const seen = new Set<string>();
    return (recording?.utterances ?? []).filter((utterance) => {
      if (seen.has(utterance.speakerLabel)) return false;
      seen.add(utterance.speakerLabel);
      return true;
    });
  }, [recording]);
  const intentByUtteranceId = useMemo(
    () => buildIntentByUtteranceId(recording, recordingAnalysis),
    [recordingAnalysis, recording],
  );
  const selectedExpressionIntent = selectedExpression?.utteranceId
    ? intentByUtteranceId.get(selectedExpression.utteranceId) ?? ""
    : "";
  const selectedBrowserExpressionIntent =
    selectedBrowserExpression?.utteranceId
      ? intentByUtteranceId.get(selectedBrowserExpression.utteranceId) ?? ""
      : selectedBrowserExpression?.sourceAnalysisIntent ?? "";
  const isPracticeQuestionPending = activeReviewExpressionId !== null && reviewReadQuestion && practicePromptReadyAtMs === null;
  const visibleRecordingSummary = recordingAnalysis?.summary ?? recording?.analysisSummary ?? "";
  const hasUnsavedContextChanges = !contextsEqual(recordingContextDraft, recordingContext);
  const hasUnsavedParticipantChanges =
    recordingParticipantDraftIds.slice().sort().join(",") !==
    (recording?.participants.map((item) => item.personProfile.id) ?? []).slice().sort().join(",");
  const hasAnyAnalysis = Boolean(visibleRecordingSummary) || (recording?.utterances ?? []).some((item) => Boolean(item.analysisIntent));
  const analysisStatus = recording?.analysisStatus ?? (hasAnyAnalysis ? "OK" : "NOT_ANALYZED");
  const isReviewAnswerHidden =
    Boolean(activeReviewExpressionId) && selectedExpression?.id === activeReviewExpressionId && !score;

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

  const recordingDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [],
  );
  const manualSessionStatusLabel = useMemo(() => {
    switch (activeRecordingSessionStatus) {
      case "CREATED":
        return "세션 생성";
      case "UPLOADING":
        return "업로드 중";
      case "UPLOADED":
        return "업로드 완료";
      case "QUEUED":
        return "worker 대기";
      case "PROCESSING":
        return "텍스트 변환 중";
      case "PROCESSED":
        return "처리 완료";
      case "FAILED":
        return "실패";
      case "CANCELLED":
        return "취소됨";
      default:
        return "대기";
    }
  }, [activeRecordingSessionStatus]);

  useEffect(() => {
    setTtsUrl(selectedExpression?.ttsUrl ?? "");
  }, [selectedExpression]);

  useEffect(() => {
    setExpressionMemoDraft(selectedExpression?.userMemo ?? "");
  }, [selectedExpression]);

  useEffect(() => {
    if (!expressions.length) {
      if (selectedExpressionId) {
        setSelectedExpressionId("");
      }
      return;
    }
    if (!selectedExpressionId) {
      setSelectedExpressionId(filteredExpressions[0]?.id ?? expressions[0]?.id ?? "");
      return;
    }
    if (!expressions.some((expression) => expression.id === selectedExpressionId)) {
      setSelectedExpressionId(filteredExpressions[0]?.id ?? expressions[0]?.id ?? "");
    }
  }, [expressions, filteredExpressions, selectedExpressionId]);

  useEffect(() => {
    if (!selectedExpression) {
      setPracticePrompt(null);
      return;
    }
    setPracticeTestType("translation");
    setPracticePrompt(buildTranslationPracticePrompt(selectedExpression));
  }, [selectedExpression?.id]);

  useEffect(() => {
    setSavedPatternExpression(null);
  }, [practicePrompt?.testType, practicePrompt?.promptKorean, practicePrompt?.target, score?.id]);

  useEffect(() => {
    if (!recording?.id) {
      setRecordingContext(EMPTY_RECORDING_CONTEXT);
      setRecordingContextDraft(EMPTY_RECORDING_CONTEXT);
      setRecordingParticipantDraftIds([]);
      setSpeakerLabelDrafts({});
      setSpeakerProfileDrafts({});
      return;
    }
    const fallbackContext = buildRecordingContextFromAnalysis(recording);
    const storedContext = loadRecordingContext(recording.id);
    const nextContext = contextsEqual(storedContext, EMPTY_RECORDING_CONTEXT) ? fallbackContext : storedContext;
    setRecordingContext(nextContext);
    setRecordingContextDraft(nextContext);
    setRecordingParticipantDraftIds(recording.participants.map((item) => item.personProfile.id));
    setSpeakerLabelDrafts(buildSpeakerLabelDrafts(recording));
    setSpeakerProfileDrafts(
      Object.fromEntries(recording.speakerProfiles.map((item) => [item.speakerLabel, item.personProfileId])),
    );
  }, [recording?.id]);

  useEffect(() => {
    recordingContextRef.current = recordingContext;
  }, [recordingContext]);

  useEffect(() => {
    setRecentManualContext(loadRecentGenerationContext());
    setRecordingAnalysisMode(loadRecordingAnalysisMode());
  }, []);

  function getReviewsEndpoint(strategy: ReviewStrategy) {
    const params = new URLSearchParams();
    if (strategy !== "system") {
      params.set("strategy", strategy);
    }
    const query = params.toString();
    return query ? `/reviews/today?${query}` : "/reviews/today";
  }

  async function fetchReviewList(strategy: ReviewStrategy) {
    return apiFetch<ReviewItem[]>(getReviewsEndpoint(strategy)).catch(() => []);
  }

  useEffect(() => {
    return () => {
      if (ttsLibraryPlaybackTimeoutRef.current) {
        window.clearTimeout(ttsLibraryPlaybackTimeoutRef.current);
      }
      stopReviewQuestionSpeech();
      for (const objectUrl of ttsLibraryAudioCacheRef.current.values()) {
        URL.revokeObjectURL(objectUrl);
      }
      ttsLibraryAudioCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }

    Promise.all([
      apiFetch<MeResponse>("/auth/me"),
      apiFetch<Expression[]>("/expressions").catch(() => []),
      fetchReviewList(reviewStrategy),
      apiFetch<PracticeHistoryItem[]>("/practice/logs?limit=50").catch(() => []),
      apiFetch<RecordingSummary[]>("/recordings").catch(() => []),
      apiFetch<PersonProfile[]>("/person-profiles").catch(() => []),
      apiFetch<LearningAssetsProgress>("/learning-assets/progress").catch(() => null),
      apiFetch<LearningAssetsCatalog>("/learning-assets/catalog").catch(() => null),
    ])
      .then(([me, expressionList, reviewList, historyList, recordingList, personProfileList, learningAssets, learningCatalog]) => {
        setUser(me);
        setExpressions(expressionList);
        if (expressionList[0]) {
          setSelectedExpressionId(pickExpressionIdForRecording(expressionList, null));
        }
        setReviews(reviewList);
        setPracticeHistory(historyList);
        setRecordings(recordingList);
        setPersonProfiles(personProfileList);
        setLearningAssetsProgress(learningAssets);
        setLearningAssetsCatalog(learningCatalog);
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

  useEffect(() => {
    if (!ready || !getToken()) return;
    fetchReviewList(reviewStrategy).then((reviewList) => {
      setReviews(reviewList);
    });
  }, [ready, reviewStrategy]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const userAgent = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isMobileBrowser = isIOS || isAndroid;
    const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
    if (isIOS && isSafari) {
      setManualRecordingLimitMs(MANUAL_RECORDING_IOS_SAFARI_MAX_MS);
      return;
    }
    setManualRecordingLimitMs(isMobileBrowser ? MOBILE_BROWSER_RECORDING_MAX_MS : MANUAL_RECORDING_MAX_MS);
  }, []);

  function resetWaveform() {
    setWaveBars(Array.from({ length: WAVE_BAR_COUNT }, () => 8));
    setRecordingElapsedMs(0);
    setRecordingRemainingMs(0);
  }

function formatAudioTime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remain = totalSeconds % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

function formatUtteranceTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatRecordingSeconds(ms: number) {
  return `${Math.max(0, ms / 1000).toFixed(1)}초`;
}

function formatGapLabel(ms: number) {
  return ms === 0 ? "없음" : `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}초`;
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

function formatAnalysisStatusReason(reason?: string | null) {
  switch (reason) {
    case "CONTEXT_UPDATED":
      return "대화 맥락 힌트가 수정됨";
    case "UTTERANCE_UPDATED":
      return "문장 또는 문장별 맥락 메모가 수정됨";
    case "UTTERANCE_SPEAKER_CHANGED":
      return "발화의 화자가 변경됨";
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

function buildIntentByUtteranceId(
  recording: RecordingResponse | null,
  analysis: RecordingAnalysis | null,
) {
  const intentMap = new Map<string, string>();

  for (const utterance of recording?.utterances ?? []) {
    if (!utterance.id) continue;
    intentMap.set(utterance.id, utterance.analysisIntent ?? "");
  }

  for (const item of analysis?.intents ?? []) {
    if (!item.utteranceId) continue;
    intentMap.set(item.utteranceId, item.intent);
  }

  return intentMap;
}

function buildSpeakerLabelDrafts(recording: RecordingResponse | null) {
  const uniqueLabels = Array.from(new Set((recording?.utterances ?? []).map((utterance) => utterance.speakerLabel)));
  return Object.fromEntries(uniqueLabels.map((speakerLabel) => [speakerLabel, speakerLabel]));
}

function pickExpressionIdForRecording(
  expressions: Expression[],
  recording: RecordingResponse | null,
  preferredExpressionId?: string,
) {
  if (preferredExpressionId && expressions.some((expression) => expression.id === preferredExpressionId)) {
    return preferredExpressionId;
  }

  if (recording) {
    const recordingUtteranceIds = new Set(recording.utterances.map((utterance) => utterance.id));
    const firstRecordingExpression = expressions.find(
      (expression) => expression.utteranceId && recordingUtteranceIds.has(expression.utteranceId),
    );
    if (firstRecordingExpression) {
      return firstRecordingExpression.id;
    }
  }

  return expressions[0]?.id ?? "";
}

function stopReviewQuestionSpeech() {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

function speakReviewQuestion(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !text.trim()) return;

  stopReviewQuestionSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const finalize = () => {
    if (reviewQuestionSpeechRef.current === utterance) {
      reviewQuestionSpeechRef.current = null;
      onEnd?.();
    }
  };
  utterance.onend = finalize;
  utterance.onerror = finalize;
  reviewQuestionSpeechRef.current = utterance;
  window.speechSynthesis.speak(utterance);
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

  function pushWaveLevel(level: number) {
    const nextHeight = Math.max(8, Math.min(100, Math.round(12 + level * 88)));
    setWaveBars((prev) => [...prev.slice(1), nextHeight]);
  }

  function registerAbortController() {
    const controller = new AbortController();
    abortControllersRef.current.push(controller);
    return controller;
  }

  function clearPracticeAutoStartCountdown() {
    if (practiceAutoStartTimeoutRef.current) {
      window.clearTimeout(practiceAutoStartTimeoutRef.current);
      practiceAutoStartTimeoutRef.current = null;
    }
    if (practiceAutoStartIntervalRef.current) {
      window.clearInterval(practiceAutoStartIntervalRef.current);
      practiceAutoStartIntervalRef.current = null;
    }
    setPracticeAutoStartCountdown(null);
  }

  function startVoicePracticeRecording() {
    userCancelledRef.current = false;
    stopReviewQuestionSpeech();
    clearPracticeAutoStartCountdown();
    setError("");
    setMessage("영어 말하기 테스트 녹음을 시작했습니다. 말이 끝나면 종료 버튼을 누르면 자동으로 채점합니다.");
    setVoiceAnswerFile(null);
    setScore(null);
    setPracticeResponseStartedAtMs(Date.now());

    const session = startRecordedAudioSession({ durationMs: 15000 });
    practiceRecordingSessionRef.current = session;
    setIsPracticeRecording(true);

    session.promise
      .then(async (file) => {
        setVoiceAnswerFile(file);
        setMessage(`음성 답변 녹음이 완료되었습니다: ${file.name}. 자동으로 채점을 시작합니다.`);
        await handleScoreVoice(file);
      })
      .catch((err) => {
        if (!userCancelledRef.current) {
          setError(err instanceof Error ? err.message : "음성 답변 녹음에 실패했습니다.");
        }
      })
      .finally(() => {
        practiceRecordingSessionRef.current = null;
        setIsPracticeRecording(false);
      });
  }

  function scheduleVoicePracticeAutoStart() {
    clearPracticeAutoStartCountdown();
    setPracticeAutoStartCountdown(3);
    setMessage("3초 뒤에 음성 녹음이 자동으로 시작됩니다.");
    practiceAutoStartIntervalRef.current = window.setInterval(() => {
      setPracticeAutoStartCountdown((current) => {
        if (current === null || current <= 1) return current;
        return current - 1;
      });
    }, 1000);
    practiceAutoStartTimeoutRef.current = window.setTimeout(() => {
      clearPracticeAutoStartCountdown();
      startVoicePracticeRecording();
    }, 3000);
  }

  function clearAbortController(controller: AbortController) {
    abortControllersRef.current = abortControllersRef.current.filter((item) => item !== controller);
  }

  function cancelActiveOperations(showMessage = true) {
    userCancelledRef.current = true;
    if (sessionPollTimeoutRef.current) {
      window.clearTimeout(sessionPollTimeoutRef.current);
      sessionPollTimeoutRef.current = null;
    }
    recordingSessionRef.current?.cancel();
    recordingSessionRef.current = null;
    practiceRecordingSessionRef.current?.cancel();
    practiceRecordingSessionRef.current = null;
    uploadTaskRef.current?.cancel();
    uploadTaskRef.current = null;
    stopReviewQuestionSpeech();
    clearPracticeAutoStartCountdown();
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current = [];
    setIsMicRecording(false);
    setManualRecordingStats((current) => ({ ...current, isActive: false }));
    setActiveRecordingSessionStatus("");
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
    const [expressionList, reviewList, historyList, learningAssets, learningCatalog] = await Promise.all([
      apiFetch<Expression[]>("/expressions"),
      fetchReviewList(reviewStrategy),
      apiFetch<PracticeHistoryItem[]>("/practice/logs?limit=50").catch(() => []),
      apiFetch<LearningAssetsProgress>("/learning-assets/progress").catch(() => null),
      apiFetch<LearningAssetsCatalog>("/learning-assets/catalog").catch(() => null),
    ]);
    setExpressions(expressionList);
    setReviews(reviewList);
    setPracticeHistory(historyList);
    setLearningAssetsProgress(learningAssets);
    setLearningAssetsCatalog(learningCatalog);
    const nextId = pickExpressionIdForRecording(expressionList, recording, preferredExpressionId);
    setSelectedExpressionId(nextId);
  }

  async function refreshRecordings() {
    const recordingList = await apiFetch<RecordingSummary[]>("/recordings").catch(() => []);
    setRecordings(recordingList);
  }

  async function refreshPersonProfiles() {
    const profileList = await apiFetch<PersonProfile[]>("/person-profiles").catch(() => []);
    setPersonProfiles(profileList);
  }

  function syncUtteranceDrafts(nextRecording: RecordingResponse | null) {
    if (!nextRecording) {
      setUtteranceDrafts({});
      setUtteranceSpeakerDrafts({});
      setUtteranceContextDrafts({});
      setUtteranceAnalysisReviewFlags({});
      setSpeakerLabelDrafts({});
      return;
    }
    setUtteranceDrafts(
      Object.fromEntries(nextRecording.utterances.map((utterance) => [utterance.id, utterance.koreanText])),
    );
    setUtteranceSpeakerDrafts(
      Object.fromEntries(nextRecording.utterances.map((utterance) => [utterance.id, utterance.speakerLabel])),
    );
    setUtteranceContextDrafts(
      Object.fromEntries(nextRecording.utterances.map((utterance) => [utterance.id, utterance.contextNote ?? ""])),
    );
    setUtteranceAnalysisReviewFlags(
      Object.fromEntries(
        nextRecording.utterances.map((utterance) => [utterance.id, DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG]),
      ),
    );
    setSpeakerLabelDrafts(buildSpeakerLabelDrafts(nextRecording));
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  }

  function scrollToDashboardSection(section: (typeof DASHBOARD_SECTION_TABS)[number]["id"]) {
    const refs = {
      personDictionary: personDictionarySectionRef,
      autoFlow: autoFlowSectionRef,
      learningProgress: learningProgressSectionRef,
      learningAssets: learningAssetsSectionRef,
      patternAssets: patternAssetsSectionRef,
      vocabularyAssets: vocabularyAssetsSectionRef,
      recordings: recordingsSectionRef,
      recordingDetail: recordingDetailRef,
      expressions: expressionsSectionRef,
      practice: testSectionRef,
      practiceHistory: practiceHistorySectionRef,
      ttsLibrary: ttsLibrarySectionRef,
    } as const;

    if (section in expandedSections && !expandedSections[section as keyof typeof expandedSections]) {
      setExpandedSections((current) => ({ ...current, [section]: true }));
    }
    if (section === "personDictionary") {
      setPersonDictionaryOpen(true);
    }
    if (section === "learningProgress") {
      setLearningProgressOpen(true);
    }
    if (section === "learningAssets") {
      setAssetSectionOpen(true);
    }
    if (section === "patternAssets") {
      setAssetSectionOpen(true);
      setPatternAssetOpen(true);
    }
    if (section === "vocabularyAssets") {
      setAssetSectionOpen(true);
      setVocabularyAssetOpen(true);
    }

    window.setTimeout(() => {
      refs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sections = [
      { id: "personDictionary", ref: personDictionarySectionRef },
      { id: "autoFlow", ref: autoFlowSectionRef },
      { id: "learningProgress", ref: learningProgressSectionRef },
      { id: "learningAssets", ref: learningAssetsSectionRef },
      { id: "patternAssets", ref: patternAssetsSectionRef },
      { id: "vocabularyAssets", ref: vocabularyAssetsSectionRef },
      { id: "recordings", ref: recordingsSectionRef },
      { id: "recordingDetail", ref: recordingDetailRef },
      { id: "expressions", ref: expressionsSectionRef },
      { id: "practice", ref: testSectionRef },
      { id: "practiceHistory", ref: practiceHistorySectionRef },
      { id: "ttsLibrary", ref: ttsLibrarySectionRef },
    ] as const;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
        const nextId = visibleEntries[0]?.target.getAttribute("data-section-id") as
          | (typeof DASHBOARD_SECTION_TABS)[number]["id"]
          | null;
        if (nextId) {
          setActiveSectionId(nextId);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.4, 0.6],
      },
    );

    for (const section of sections) {
      const node = section.ref.current;
      if (!node) continue;
      node.setAttribute("data-section-id", section.id);
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, []);

  function selectExpressionForPractice(expression: Expression) {
    clearPracticeAutoStartCountdown();
    setPracticeFlowMode("single");
    setReviewAutoAdvance(false);
    setPendingAutoReview(null);
    setActiveReviewExpressionId(null);
    setSelectedExpressionId(expression.id);
    setPracticePromptReadyAtMs(Date.now());
    setPracticeResponseStartedAtMs(null);
    setScore(null);
    setTtsUrl(expression.ttsUrl ?? "");
    scrollToDashboardSection("practice");
  }

  async function handlePlayPracticeReferenceTts() {
    if (!selectedExpression?.ttsUrl) {
      setError("정답 기준 영어 음성이 아직 준비되지 않았습니다.");
      return;
    }

    try {
      const player = practiceReferenceAudioRef.current;
      if (!player) return;
      player.src = selectedExpression.ttsUrl;
      player.load();
      await player.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "정답 기준 음성을 재생하지 못했습니다.");
    }
  }

  function expandList(list: keyof typeof DEFAULT_PREVIEW_COUNTS, amount: number | "all", total: number) {
    setVisibleCounts((current) => ({
      ...current,
      [list]: amount === "all" ? total : Math.min(total, current[list] + amount),
    }));
  }

  function collapseList(list: keyof typeof DEFAULT_PREVIEW_COUNTS) {
    setVisibleCounts((current) => ({ ...current, [list]: DEFAULT_PREVIEW_COUNTS[list] }));
  }

  async function handleDownloadAssetExport(assetType: "korean" | "english", format: "json" | "csv") {
    setError("");
    setMessage("");
    setLoading(`export-${assetType}-${format}`);
    try {
      const fileName = `english-learning-${assetType}-assets.${format}`;
      await downloadApiFile(`/exports/assets/${assetType}?format=${format}`, fileName);
      setMessage(
        assetType === "korean"
          ? `한글표현 자산을 ${format.toUpperCase()}로 내보냈습니다.`
          : `영어표현 자산을 ${format.toUpperCase()}로 내보냈습니다.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 export에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  function renderListControls(list: keyof typeof DEFAULT_PREVIEW_COUNTS, total: number) {
    const visible = visibleCounts[list];
    if (total <= DEFAULT_PREVIEW_COUNTS[list]) return null;
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
        {visible > DEFAULT_PREVIEW_COUNTS[list] && (
          <button className="button ghost" onClick={() => collapseList(list)}>
            접기
          </button>
        )}
      </div>
    );
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

  function focusSelectedExpressionDetail() {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    window.requestAnimationFrame(() => {
      expressionDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      expressionDetailRef.current?.focus({ preventScroll: true });
    });
  }

  function focusSelectedRecordingDetail() {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    window.requestAnimationFrame(() => {
      recordingDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      recordingDetailRef.current?.focus({ preventScroll: true });
    });
  }

  function focusPracticeMainCard() {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      practiceMainCardRef.current?.focus({ preventScroll: true });
      answerRef.current?.focus();
    });
  }

  function setRecordingWithDrafts(nextRecording: RecordingResponse | null) {
    setRecording(nextRecording);
    syncUtteranceDrafts(nextRecording);
    setRecordingAnalysis(null);
  }

  function updateRecordingAnalysisStatusLocal(
    status: "NOT_ANALYZED" | "OK" | "NEEDS_REVIEW",
    reason?: string | null,
  ) {
    setRecording((current) =>
      current
        ? {
            ...current,
            analysisStatus: status,
            analysisStatusReason: status === "OK" || status === "NOT_ANALYZED" ? null : reason ?? null,
          }
        : current,
    );
  }

  async function persistRecordingAnalysisStatus(
    status: "OK" | "NEEDS_REVIEW",
    reason?: string,
  ) {
    if (!recording?.id) return;
    await apiFetch(`/recordings/${recording.id}/analysis-status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
    updateRecordingAnalysisStatusLocal(status, status === "OK" ? null : reason ?? null);
  }

  async function runRecordingAnalysis(
    recordingId: string,
    successMessage?: string,
    context: RecordingGenerationContext = recordingContextRef.current,
  ) {
    const result = await apiFetch<RecordingAnalysis>(`/recordings/${recordingId}/analyze`, {
      method: "POST",
      body: JSON.stringify(buildRecordingContextPayload(context)),
    });
    const refreshedRecording = await apiFetch<RecordingResponse>(`/recordings/${recordingId}`);
    setRecording((current) => (current?.id === recordingId ? refreshedRecording : current));
    syncUtteranceDrafts(refreshedRecording);
    setRecordingAnalysis(result);
    if (successMessage) {
      setMessage(successMessage);
    }
    return result;
  }

  async function runAutoRecordingAnalysis(recordingId: string, successMessage?: string) {
    if (recordingAnalysisMode !== "auto") return null;
    return runRecordingAnalysis(recordingId, successMessage);
  }

  function handleRecordingAnalysisModeChange(mode: RecordingAnalysisMode) {
    setRecordingAnalysisMode(mode);
    saveRecordingAnalysisMode(mode);
  }

  function stopTtsLibraryPlayback() {
    ttsLibraryPlaybackPlanRef.current = null;
    ttsLibraryPlaybackSessionIdRef.current += 1;
    if (ttsLibraryPlaybackTimeoutRef.current) {
      window.clearTimeout(ttsLibraryPlaybackTimeoutRef.current);
      ttsLibraryPlaybackTimeoutRef.current = null;
    }
    const player = ttsLibraryAudioRef.current;
    if (player) {
      player.pause();
      player.currentTime = 0;
      player.removeAttribute("src");
      player.load();
    }
    setIsTtsLibraryPlaying(false);
    setIsTtsLibraryPreparing(false);
    setTtsLibraryCurrentExpressionId("");
  }

  async function getCachedTtsLibrarySrc(expression: Expression, language: "english" | "korean" = "english") {
    const cacheKey = `${expression.id}:${language}`;
    const cached = ttsLibraryAudioCacheRef.current.get(cacheKey);
    if (cached) return cached;
    const targetUrl = language === "korean" ? expression.koreanTtsUrl : expression.ttsUrl;
    if (!targetUrl) {
      throw new Error("TTS 재생 URL이 없습니다.");
    }

    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error("TTS 음성 파일을 불러오지 못했습니다.");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    ttsLibraryAudioCacheRef.current.set(cacheKey, objectUrl);
    return objectUrl;
  }

  async function playTtsLibraryPlanStep(plan: TtsLibraryPlaybackPlan) {
    const track = plan.tracks[plan.trackIndex];
    const expression = completedTtsExpressions.find((item) => item.id === track?.expressionId);
    if (!expression) {
      stopTtsLibraryPlayback();
      return;
    }

    const activeSessionId = plan.sessionId;
    setIsTtsLibraryPreparing(true);
    setTtsLibraryCurrentExpressionId(expression.id);
    try {
      const src = await getCachedTtsLibrarySrc(expression, track.language);
      if (ttsLibraryPlaybackSessionIdRef.current !== activeSessionId) return;
      const player = ttsLibraryAudioRef.current;
      if (!player) return;
      player.src = src;
      player.load();
      setIsTtsLibraryPreparing(false);
      setIsTtsLibraryPlaying(true);
      await player.play();
    } catch (err) {
      if (ttsLibraryPlaybackSessionIdRef.current !== activeSessionId) return;
      setIsTtsLibraryPreparing(false);
      setIsTtsLibraryPlaying(false);
      setError(err instanceof Error ? err.message : "TTS 라이브러리 재생에 실패했습니다.");
    }
  }

  function handleTtsLibraryAudioEnded() {
    const plan = ttsLibraryPlaybackPlanRef.current;
    if (!plan) return;

    const isLastTrack = plan.trackIndex + 1 >= plan.tracks.length;

    if (isLastTrack) {
      stopTtsLibraryPlayback();
      setMessage("TTS 전체 재생이 끝났습니다.");
      return;
    }

    const nextPlan: TtsLibraryPlaybackPlan = {
      ...plan,
      trackIndex: plan.trackIndex + 1,
    };
    ttsLibraryPlaybackPlanRef.current = nextPlan;
    const delayMs = nextPlan.gapMs;
    if (delayMs > 0) {
      ttsLibraryPlaybackTimeoutRef.current = window.setTimeout(() => {
        playTtsLibraryPlanStep(nextPlan).catch(() => undefined);
      }, delayMs);
    } else {
      void playTtsLibraryPlanStep(nextPlan);
    }
  }

  async function startTtsLibraryPlayback() {
    if (filteredCompletedTtsExpressions.length === 0) {
      setError("재생할 TTS 완료 표현이 없습니다.");
      return;
    }

    stopTtsLibraryPlayback();
    setError("");
    setMessage("");
    const playbackExpressions = ttsLibraryIncludeKorean
      ? filteredCompletedTtsExpressions.filter((item) => item.koreanTtsUrl)
      : filteredCompletedTtsExpressions;
    if (playbackExpressions.length === 0) {
      setError("한국어 포함 재생에 필요한 한국어 TTS가 아직 없습니다. TTS를 다시 생성해 주세요.");
      return;
    }
    const nextSessionId = ttsLibraryPlaybackSessionIdRef.current + 1;
    ttsLibraryPlaybackSessionIdRef.current = nextSessionId;
    const tracks = playbackExpressions.flatMap((expression) => {
      const englishTracks: TtsLibraryPlaybackTrack[] = Array.from(
        { length: ttsLibraryRepeatCount },
        () => ({ expressionId: expression.id, language: "english" as const }),
      );
      return ttsLibraryIncludeKorean
        ? [{ expressionId: expression.id, language: "korean" as const }, ...englishTracks]
        : englishTracks;
    });
    const plan: TtsLibraryPlaybackPlan = {
      tracks,
      gapMs: ttsLibraryGapMs,
      trackIndex: 0,
      sessionId: nextSessionId,
    };
    ttsLibraryPlaybackPlanRef.current = plan;
    if (ttsLibraryIncludeKorean && playbackExpressions.length < filteredCompletedTtsExpressions.length) {
      setMessage(`한국어 TTS가 없는 표현 ${filteredCompletedTtsExpressions.length - playbackExpressions.length}개는 제외하고 재생합니다.`);
    }
    await playTtsLibraryPlanStep(plan);
  }

  function updateRecordingContextField(field: keyof RecordingGenerationContext, value: string) {
    setRecordingContextDraft((current) => ({ ...current, [field]: value }));
  }

  function applySuggestedRelationshipToManualContext(nextParticipantIds: string[]) {
    setRecordingContext((current) => {
      if (current.relationship.trim()) return current;
      const suggested = inferRelationshipFromProfiles(
        personProfiles.filter((profile) => nextParticipantIds.includes(profile.id)),
      );
      return suggested ? { ...current, relationship: suggested } : current;
    });
  }

  function applySuggestedRelationshipToRecordingContext(nextParticipantIds: string[]) {
    setRecordingContextDraft((current) => {
      if (current.relationship.trim()) return current;
      const suggested = inferRelationshipFromProfiles(
        personProfiles.filter((profile) => nextParticipantIds.includes(profile.id)),
      );
      return suggested ? { ...current, relationship: suggested } : current;
    });
  }

  function toggleManualGenerateParticipant(profileId: string) {
    setManualGenerateParticipantIds((current) => {
      const next = current.includes(profileId)
        ? current.filter((item) => item !== profileId)
        : [...current, profileId];
      applySuggestedRelationshipToManualContext(next);
      return next;
    });
  }

  function toggleRecordingParticipant(profileId: string) {
    setRecordingParticipantDraftIds((current) => {
      const next = current.includes(profileId)
        ? current.filter((item) => item !== profileId)
        : [...current, profileId];
      applySuggestedRelationshipToRecordingContext(next);
      return next;
    });
  }

  async function handleSaveRecordingContext() {
    if (!recording?.id) return;
    if (!hasUnsavedContextChanges && !hasUnsavedParticipantChanges) {
      setMessage("저장할 맥락 변경사항이 없습니다.");
      return;
    }

    const nextContext = recordingContextDraft;
    setError("");
    setMessage("");
    setLoading("save-recording-context");
    try {
      if (hasUnsavedParticipantChanges) {
        const updated = await apiFetch<RecordingResponse>(`/recordings/${recording.id}/participants`, {
          method: "PATCH",
          body: JSON.stringify({ personProfileIds: recordingParticipantDraftIds }),
        });
        setRecordingWithDrafts(updated);
      }
      saveRecordingContext(recording.id, nextContext);
      saveRecentGenerationContext(nextContext);
      setRecentManualContext(nextContext);
      setRecordingContext(nextContext);
      if (recordingAnalysisMode === "auto") {
        await runRecordingAnalysis(recording.id, "맥락 힌트를 저장하고 대화 분석을 자동으로 갱신했습니다.", nextContext);
      } else {
        await persistRecordingAnalysisStatus("NEEDS_REVIEW", "CONTEXT_UPDATED");
        setMessage("대화 맥락 힌트를 저장했습니다. 분석을 다시 실행하면 최신 맥락이 반영됩니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화 맥락 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  function updateLocalUtterance(
    utteranceId: string,
    patch: { koreanText?: string; speakerLabel?: string; isMine?: boolean; contextNote?: string | null },
  ) {
    setRecording((current) => {
      if (!current) return current;
      return {
        ...current,
        utterances: current.utterances.map((utterance) =>
          utterance.id === utteranceId
            ? {
                ...utterance,
                ...(typeof patch.koreanText === "string" ? { koreanText: patch.koreanText } : {}),
                ...(typeof patch.speakerLabel === "string" ? { speakerLabel: patch.speakerLabel } : {}),
                ...(typeof patch.isMine === "boolean" ? { isMine: patch.isMine } : {}),
                ...(typeof patch.contextNote === "string" || patch.contextNote === null
                  ? { contextNote: patch.contextNote }
                  : {}),
              }
            : utterance,
        ),
      };
    });
    if (typeof patch.koreanText === "string") {
      setUtteranceDrafts((current) => ({ ...current, [utteranceId]: patch.koreanText as string }));
    }
    if (typeof patch.speakerLabel === "string") {
      setUtteranceSpeakerDrafts((current) => ({ ...current, [utteranceId]: patch.speakerLabel as string }));
    }
    if (typeof patch.contextNote === "string" || patch.contextNote === null) {
      setUtteranceContextDrafts((current) => ({ ...current, [utteranceId]: patch.contextNote ?? "" }));
    }
  }

  async function saveUtteranceDraft(
    utteranceId: string,
    options: { requireText?: boolean; markAnalysisReview?: boolean } = {},
  ) {
    const requireText = options.requireText ?? true;
    const markAnalysisReview = options.markAnalysisReview ?? false;
    const currentUtterance = recording?.utterances.find((utterance) => utterance.id === utteranceId);
    const textDraft = utteranceDrafts[utteranceId] ?? currentUtterance?.koreanText ?? "";
    const speakerLabel = utteranceSpeakerDrafts[utteranceId] ?? currentUtterance?.speakerLabel ?? "";
    const trimmedText = textDraft.trim();
    if (requireText && !trimmedText) {
      throw new Error("수정할 문장을 입력해 주세요.");
    }
    const contextNote = (utteranceContextDrafts[utteranceId] ?? currentUtterance?.contextNote ?? "").trim();
    const updated = await apiFetch<RecordingUtterance>(`/recordings/utterances/${utteranceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(trimmedText ? { koreanText: trimmedText } : {}),
        ...(speakerLabel ? { speakerLabel } : {}),
        contextNote,
      }),
    });
    updateLocalUtterance(utteranceId, {
      koreanText: updated.koreanText,
      speakerLabel: updated.speakerLabel,
      isMine: updated.isMine,
      contextNote: updated.contextNote ?? "",
    });
    if (markAnalysisReview) {
      updateRecordingAnalysisStatusLocal(
        "NEEDS_REVIEW",
        speakerLabel !== currentUtterance?.speakerLabel ? "UTTERANCE_SPEAKER_CHANGED" : "UTTERANCE_UPDATED",
      );
    }
    return updated;
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
    return uploadAndProcessFileInternal(file, {
      trackFlow: true,
      selectProcessedRecording: true,
      normalizeAudio: !isBrowserRecordedFile(file),
    });
  }

  async function uploadAndProcessFileInternal(
    file: File,
    options: { trackFlow?: boolean; selectProcessedRecording?: boolean; normalizeAudio?: boolean } = {},
  ) {
    const uploadFile = options.normalizeAudio ? await normalizeAudioFileForUpload(file) : file;
    if (options.trackFlow) {
      markFlow("presign", `${uploadFile.name} 업로드 준비`);
    }
    const presign = await runWithTimeout("presign", (signal) => apiFetch<PresignResponse>("/recordings/presign", {
      method: "POST",
      body: JSON.stringify({ fileName: uploadFile.name, contentType: uploadFile.type || "audio/webm" }),
      signal,
    }));

    if (options.trackFlow) {
      markFlow("upload", `${Math.max(1, Math.round(uploadFile.size / 1024))}KB 파일 업로드`);
    }
    setUploadPercent(1);
    const uploadTask = createPresignedUploadTask(presign.uploadUrl, uploadFile, (percent) => setUploadPercent(percent));
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

    if (options.trackFlow) {
      markFlow("transcribe", "텍스트 변환 및 화자 분리 요청");
    }
    const processed = await runWithTimeout("transcribe", (signal) => apiFetch<RecordingResponse>(`/recordings/${presign.recordingId}/process`, {
      method: "POST",
      body: JSON.stringify({ diarization: true }),
      signal,
    }));
    setUploadPercent(100);
    if (options.selectProcessedRecording !== false) {
      setRecordingWithDrafts(processed);
    }
    await refreshRecordings();
    return processed;
  }

  async function waitForRetry(delayMs: number) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  function updateManualRecordingStats(patch: Partial<ManualRecordingStats>) {
    setManualRecordingStats((current) => ({ ...current, ...patch }));
  }

  function validateManualUploadFile(file: File) {
    const normalizedName = file.name.toLowerCase();
    const matchedExtension = MANUAL_UPLOAD_ALLOWED_EXTENSIONS.find((ext) => normalizedName.endsWith(ext));
    if (!matchedExtension) {
      throw new Error(
        `수동 업로드는 ${MANUAL_UPLOAD_ALLOWED_EXTENSIONS.join(", ")} 형식만 지원합니다. webm 파일은 업로드 전에 변환해 주세요.`,
      );
    }

    if (file.size > MANUAL_UPLOAD_MAX_BYTES) {
      throw new Error(
        `수동 업로드 파일은 최대 ${Math.round(MANUAL_UPLOAD_MAX_BYTES / 1024 / 1024)}MB까지 지원합니다. 더 큰 파일은 나눠서 업로드해 주세요.`,
      );
    }
  }

  async function createRecordingSession(source: "WEB" | "MOBILE" | "MANUAL_UPLOAD", title?: string) {
    const created = await apiFetch<RecordingSessionCreateResponse>("/recording-sessions", {
      method: "POST",
      body: JSON.stringify({ source, title }),
    });
    setActiveRecordingSessionId(created.sessionId);
    setActiveRecordingSessionStatus(created.status);
    return created;
  }

  async function uploadSessionPart(
    sessionId: string,
    partNumber: number,
    file: File,
    options: { normalizeAudio?: boolean } = {},
  ) {
    const uploadFile = options.normalizeAudio === false ? file : await normalizeAudioFileForUpload(file);
    const presign = await apiFetch<RecordingSessionPartPresignResponse>(`/recording-sessions/${sessionId}/parts/presign`, {
      method: "POST",
      body: JSON.stringify({
        partNumber,
        fileName: uploadFile.name,
        contentType: uploadFile.type || "audio/webm",
        sizeBytes: uploadFile.size,
      }),
    });

    const uploadTask = createPresignedUploadTask(presign.uploadUrl, uploadFile, (percent) => setUploadPercent(percent));
    uploadTaskRef.current = uploadTask;
    try {
      await uploadTask.promise;
    } finally {
      uploadTaskRef.current = null;
    }

    await apiFetch(`/recording-sessions/${sessionId}/parts/${presign.partId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        durationMs: undefined,
        sizeBytes: uploadFile.size,
      }),
    });

    setSelectedFile(uploadFile);
    await refreshRecordings();
    return presign;
  }

  async function uploadPreparedSessionParts(
    sessionId: string,
    preparedChunks: Array<{ file: File; durationMs: number; partNumber: number }>,
    options: { normalizeAudio?: boolean } = {},
  ) {
    let uploadedCount = 0;
    for (const chunk of preparedChunks) {
      setMessage(
        `분할 파일 ${chunk.partNumber}/${preparedChunks.length} 업로드 중입니다. ${Math.round(chunk.durationMs / 1000)}초 길이의 파일을 처리합니다.`,
      );
      await uploadSessionPart(sessionId, chunk.partNumber, chunk.file, options);
      uploadedCount += 1;
      updateManualRecordingStats({
        chunkCount: preparedChunks.length,
        currentChunkIndex: chunk.partNumber,
        successCount: uploadedCount,
      });
    }
  }

  async function finalizeRecordingSession(sessionId: string, expectedPartCount?: number, totalDurationMs?: number) {
    const result = await apiFetch<{ sessionId: string; status: string }>(`/recording-sessions/${sessionId}/finalize`, {
      method: "POST",
      body: JSON.stringify({ expectedPartCount, totalDurationMs }),
    });
    setActiveRecordingSessionStatus(result.status);
    return result;
  }

  async function enqueueRecordingSessionProcessing(sessionId: string) {
    const result = await apiFetch<{ sessionId: string; status: string; queuedJobCount: number }>(
      `/recording-sessions/${sessionId}/process`,
      {
        method: "POST",
        body: JSON.stringify({ diarization: true }),
      },
    );
    setActiveRecordingSessionStatus(result.status);
    return result;
  }

  async function fetchRecordingSession(sessionId: string) {
    return apiFetch<RecordingSessionStatusResponse>(`/recording-sessions/${sessionId}`);
  }

  function beginRecordingSessionPolling(sessionId: string) {
    if (sessionPollTimeoutRef.current) {
      window.clearTimeout(sessionPollTimeoutRef.current);
      sessionPollTimeoutRef.current = null;
    }

    const poll = async () => {
      try {
        const session = await fetchRecordingSession(sessionId);
        setActiveRecordingSessionStatus(session.status);
        const processedParts = session.parts.filter((part) => part.status === "PROCESSED");
        updateManualRecordingStats({
          chunkCount: session.parts.length,
          successCount: processedParts.length,
          failedCount: session.parts.filter((part) => part.status === "FAILED").length,
          currentChunkIndex: session.parts[session.parts.length - 1]?.partNumber ?? 0,
        });

        if (session.status === "PROCESSED") {
          await refreshRecordings();
          setMessage(`녹음 세션 처리가 완료되었습니다. ${processedParts.length}개 분할 파일이 텍스트 변환되었습니다.`);
          sessionPollTimeoutRef.current = null;
          return;
        }

        if (session.status === "FAILED") {
          await refreshRecordings();
          setError(session.errorMessage || "녹음 세션 처리 중 실패한 파트가 있습니다.");
          sessionPollTimeoutRef.current = null;
          return;
        }

        await refreshRecordings();
        sessionPollTimeoutRef.current = window.setTimeout(() => void poll(), 4000);
      } catch (err) {
        if (!userCancelledRef.current) {
          setError(err instanceof Error ? err.message : "녹음 세션 상태를 불러오지 못했습니다.");
        }
      }
    };

    void poll();
  }

  async function uploadManualChunkWithRetry(
    sessionId: string,
    file: File,
    chunkIndex: number,
    options: { normalizeAudio?: boolean } = {},
  ) {
    for (let attempt = 0; attempt < MANUAL_RECORDING_RETRY_DELAYS.length; attempt += 1) {
      try {
        setMessage(
          `분할 파일 ${chunkIndex} 업로드와 텍스트 변환을 진행 중입니다. 녹음은 계속 이어집니다.`,
        );
        await uploadSessionPart(sessionId, chunkIndex, file, options);
        await enqueueRecordingSessionProcessing(sessionId);
        setFailedManualChunks((current) => current.filter((item) => item.chunkIndex !== chunkIndex));
        return true;
      } catch (err) {
        if (isAbortError(err) || userCancelledRef.current) {
          throw err;
        }

        const isLastAttempt = attempt === MANUAL_RECORDING_RETRY_DELAYS.length - 1;
        if (!isLastAttempt) {
          await waitForRetry(MANUAL_RECORDING_RETRY_DELAYS[attempt]);
          continue;
        }

        const reason = err instanceof Error ? err.message : "분할 파일 업로드에 실패했습니다.";
        setFailedManualChunks((current) => {
          const next = current.filter((item) => item.chunkIndex !== chunkIndex);
          next.push({ id: `${chunkIndex}-${Date.now()}`, file, chunkIndex, reason });
          return next;
        });
        setError(`분할 파일 ${chunkIndex} 처리에 실패했습니다. 아래에서 다시 업로드할 수 있습니다.`);
        return false;
      }
    }

    return false;
  }

  async function completeAutoFlowFromProcessed(processed: RecordingResponse) {
    markFlow("mine", `변환된 ${processed.utterances.length}개 문장에서 우선순위 선별`);
    const mineUtterances = processed.utterances.filter((item) => item.isMine && item.koreanText?.trim());
    const targetUtterances = (mineUtterances.length > 0 ? mineUtterances : processed.utterances)
      .filter((item) => item.koreanText?.trim())
      .slice(0, 3);

    if (targetUtterances.length === 0) {
      throw new Error("변환된 문장이 없어 영어 표현을 생성할 수 없습니다.");
    }

    markFlow("expressions", `${targetUtterances.length}개 문장을 영어 표현으로 생성`);
    const createdExpressions: Expression[] = [];
    for (const utterance of targetUtterances) {
      const expression = await runWithTimeout("expressions", (signal) => apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({ utteranceId: utterance.id, ...buildRecordingContextPayload(recordingContext) }),
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
    setRecordingWithDrafts(null);
    setTtsUrl("");
    setScore(null);
    setFailedStepId("");
    setRetryMode("");
    setActiveRecordingSessionId("");
    setActiveRecordingSessionStatus("");

    try {
      validateManualUploadFile(selectedFile);
      const session = await createRecordingSession("MANUAL_UPLOAD", selectedFile.name);
      const prepared = await prepareAudioChunksForUpload(selectedFile, MANUAL_UPLOAD_STT_CHUNK_MS);
      setManualRecordingStats({
        effectiveMaxMs: prepared.durationMs,
        chunkCount: prepared.chunks.length,
        successCount: 0,
        failedCount: 0,
        currentChunkIndex: 0,
        isActive: false,
      });
      if (prepared.chunks.length > 1) {
        setMessage(
          `긴 음성 파일을 ${prepared.chunks.length}개로 자동 분할했습니다. 각 파일을 순차 업로드한 뒤 worker가 비동기 처리합니다.`,
        );
      }
      await uploadPreparedSessionParts(session.sessionId, prepared.chunks, { normalizeAudio: true });
      await finalizeRecordingSession(session.sessionId, prepared.chunks.length, prepared.durationMs);
      await enqueueRecordingSessionProcessing(session.sessionId);
      beginRecordingSessionPolling(session.sessionId);
      setMessage("녹음 업로드가 완료되었습니다. worker가 텍스트 변환을 처리하는 동안 상태를 계속 확인합니다.");
    } catch (err) {
      if (isAbortError(err) || userCancelledRef.current) {
        setMessage("수동 업로드/텍스트 변환을 취소했습니다.");
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
    resetWaveform();
    setMessage(`최대 ${Math.round(manualRecordingLimitMs / 60000)}분 동안 브라우저 녹음을 진행합니다. 녹음이 끝나면 1개 파일로 업로드되며, 언제든 직접 종료할 수 있습니다.`);
    setLoading("record");
    setFailedStepId("");
    setRetryMode("");
    setUploadPercent(0);
    setFailedManualChunks([]);
    setActiveRecordingSessionId("");
    setActiveRecordingSessionStatus("");
    setManualRecordingStats({
      effectiveMaxMs: manualRecordingLimitMs,
      chunkCount: 0,
      successCount: 0,
      failedCount: 0,
      currentChunkIndex: 0,
      isActive: true,
    });
    try {
      const file = await startMicRecording(manualRecordingLimitMs);
      setSelectedFile(file);
      updateManualRecordingStats({
        chunkCount: 1,
        successCount: 0,
        failedCount: 0,
        currentChunkIndex: 1,
      });
      await uploadAndProcessFileInternal(file, {
        trackFlow: false,
        selectProcessedRecording: true,
        normalizeAudio: false,
      });
      updateManualRecordingStats({
        chunkCount: 1,
        successCount: 1,
        failedCount: 0,
        currentChunkIndex: 1,
      });
      setMessage("브라우저 녹음이 종료되었습니다. 1개 파일 업로드와 텍스트 변환이 완료되었습니다.");
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
      recordingSessionRef.current = null;
      setIsMicRecording(false);
      setRecordingRemainingMs(0);
      setLoading("");
      setManualRecordingStats((current) => ({ ...current, isActive: false }));
    }
  }

  async function handleAutoRecordFlow() {
    userCancelledRef.current = false;
    setError("");
    setMessage("");
    setScore(null);
    setRecordingWithDrafts(null);
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
        setMessage(`재시도 후 텍스트 변환이 완료되었습니다. (${processed.utterances.length}개 문장)`);
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

  function handleStopRecording() {
    if (!isMicRecording) return;
    recordingSessionRef.current?.stop();
    setMessage("녹음을 종료했습니다. 마지막 분할 파일 업로드와 텍스트 변환을 이어서 진행합니다.");
  }

  async function handleRetryManualChunk(chunk: FailedManualChunk) {
    if (!activeRecordingSessionId) {
      setError("재업로드할 녹음 세션을 찾을 수 없습니다.");
      return;
    }
    setError("");
    setLoading(`retry-manual-chunk-${chunk.id}`);
    try {
      const uploaded = await uploadManualChunkWithRetry(activeRecordingSessionId, chunk.file, chunk.chunkIndex, {
        normalizeAudio: false,
      });
      if (uploaded) {
        setManualRecordingStats((current) => ({
          ...current,
          failedCount: Math.max(0, current.failedCount - 1),
        }));
        setMessage(`분할 파일 ${chunk.chunkIndex} 재업로드가 완료되었습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "분할 파일 재업로드에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateFromUtterance(utteranceId: string) {
    setError("");
    setMessage("");
    setLoading(`expr-${utteranceId}`);
    try {
      const shouldReviewAnalysis = utteranceAnalysisReviewFlags[utteranceId] ?? DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG;
      const currentUtterance = recording?.utterances.find((item) => item.id === utteranceId);
      const draft = utteranceDrafts[utteranceId]?.trim() ?? "";
      if (!draft) {
        throw new Error("표현 생성 전에 문장을 입력해 주세요.");
      }
      const draftContextNote = (utteranceContextDrafts[utteranceId] ?? currentUtterance?.contextNote ?? "").trim();
      if (
        currentUtterance &&
        (currentUtterance.koreanText !== draft || (currentUtterance.contextNote ?? "") !== draftContextNote)
      ) {
        await saveUtteranceDraft(utteranceId, { markAnalysisReview: shouldReviewAnalysis });
      }
      if (shouldReviewAnalysis && recording?.id) {
        if (recordingAnalysisMode === "auto") {
          await runAutoRecordingAnalysis(recording.id, "문장 수정 내용을 반영해 대화 분석을 자동으로 갱신했습니다.");
        } else {
          await persistRecordingAnalysisStatus("NEEDS_REVIEW", "UTTERANCE_UPDATED");
        }
      }
      const expression = await runWithTimeout("expressions", (signal) => apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({ utteranceId, ...buildRecordingContextPayload(recordingContext) }),
        signal,
      }));
      if (recording?.id) {
        const loaded = await apiFetch<RecordingResponse>(`/recordings/${recording.id}`);
        setRecordingWithDrafts(loaded);
      }
      await refreshLists(expression.id);
      setUtteranceAnalysisReviewFlags((current) => ({
        ...current,
        [utteranceId]: DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG,
      }));
      setMessage("영어 표현을 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGenerateExpressionsBulk(speakerScope: "mine" | "others") {
    if (!recording) {
      setError("먼저 녹음을 불러와 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(`expr-bulk-${speakerScope}`);
    try {
      const response = await runWithTimeout("expressions", (signal) =>
        apiFetch<BulkExpressionResponse>("/expressions/generate/bulk", {
          method: "POST",
          body: JSON.stringify({
            recordingId: recording.id,
            speakerScope,
            includeExisting: false,
            ...buildRecordingContextPayload(recordingContext),
          }),
          signal,
        }),
      );
      await refreshRecordings();
      const loaded = await apiFetch<RecordingResponse>(`/recordings/${recording.id}`);
      setRecordingWithDrafts(loaded);
      await refreshLists(response.expressions[0]?.id ?? selectedExpressionId ?? undefined);
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

  async function handleSaveUtterance(utteranceId: string) {
    setError("");
    setMessage("");
    setLoading(`save-${utteranceId}`);
    try {
      const currentUtterance = recording?.utterances.find((utterance) => utterance.id === utteranceId);
      const speakerChanged =
        (utteranceSpeakerDrafts[utteranceId] ?? currentUtterance?.speakerLabel ?? "") !==
        (currentUtterance?.speakerLabel ?? "");
      const shouldReviewAnalysis =
        speakerChanged || (utteranceAnalysisReviewFlags[utteranceId] ?? DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG);
      await saveUtteranceDraft(utteranceId, {
        requireText: !speakerChanged,
        markAnalysisReview: shouldReviewAnalysis,
      });
      if (shouldReviewAnalysis && recording?.id) {
        await runAutoRecordingAnalysis(recording.id, "문장을 저장하고 대화 분석을 자동으로 갱신했습니다.");
      } else {
        setMessage("변환된 문장을 수정해 저장했습니다.");
      }
      if (shouldReviewAnalysis && recordingAnalysisMode !== "auto") {
        await persistRecordingAnalysisStatus(
          "NEEDS_REVIEW",
          speakerChanged ? "UTTERANCE_SPEAKER_CHANGED" : "UTTERANCE_UPDATED",
        );
        setMessage("변환된 문장을 수정해 저장했습니다.");
      }
      setUtteranceAnalysisReviewFlags((current) => ({
        ...current,
        [utteranceId]: DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSaveUtteranceContextNote(utteranceId: string) {
    setError("");
    setMessage("");
    setLoading(`save-context-${utteranceId}`);
    try {
      const shouldReviewAnalysis = utteranceAnalysisReviewFlags[utteranceId] ?? DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG;
      await saveUtteranceDraft(utteranceId, { requireText: false, markAnalysisReview: shouldReviewAnalysis });
      if (shouldReviewAnalysis && recording?.id) {
        await runAutoRecordingAnalysis(recording.id, "문장별 맥락 메모를 저장하고 대화 분석을 자동으로 갱신했습니다.");
      } else {
        setMessage("문장별 맥락 메모를 저장했습니다.");
      }
      if (shouldReviewAnalysis && recordingAnalysisMode !== "auto") {
        setMessage("문장별 맥락 메모를 저장했습니다.");
      }
      setUtteranceAnalysisReviewFlags((current) => ({
        ...current,
        [utteranceId]: DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "문장별 맥락 메모 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteUtterance(utteranceId: string) {
    const utterance = recording?.utterances.find((item) => item.id === utteranceId);
    if (!utterance) {
      setError("삭제할 문장을 먼저 선택해 주세요.");
      return;
    }

    const confirmed = window.confirm(`"${utterance.koreanText}" 문장을 삭제할까요? 연결된 영어 표현도 함께 삭제됩니다.`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    setLoading(`delete-utterance-${utteranceId}`);
    try {
      const shouldReviewAnalysis = utteranceAnalysisReviewFlags[utteranceId] ?? DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG;
      const response = await apiFetch<DeleteUtteranceResponse>(`/recordings/utterances/${utteranceId}`, {
        method: "DELETE",
        body: JSON.stringify({ markAnalysisReview: shouldReviewAnalysis }),
      });
      if (recording) {
        const loaded = await apiFetch<RecordingResponse>(`/recordings/${recording.id}`);
        setRecordingWithDrafts(loaded);
        if (shouldReviewAnalysis) {
          await runAutoRecordingAnalysis(loaded.id, "문장을 삭제하고 대화 분석을 자동으로 갱신했습니다.");
        }
      }
      await refreshLists();
      await refreshRecordings();
      if (shouldReviewAnalysis && recordingAnalysisMode !== "auto") {
        await persistRecordingAnalysisStatus("NEEDS_REVIEW", "UTTERANCE_DELETED");
        setMessage(
          response.deletedExpressionCount > 0
            ? `문장과 연결된 영어 표현 ${response.deletedExpressionCount}개를 함께 삭제했습니다.`
            : "문장을 삭제했습니다.",
        );
      } else {
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

  async function handleGenerateFromText() {
    const text = manualGenerateText.trim();
    if (!text) {
      setError("직접 생성할 한국어 문장을 입력해 주세요.");
      return;
    }
    setError("");
    setMessage("");
    setLoading("manual-generate");
    try {
      const expression = await runWithTimeout("expressions", (signal) => apiFetch<Expression>("/expressions/generate", {
        method: "POST",
        body: JSON.stringify({
          koreanText: text.trim(),
          personProfileIds: manualGenerateParticipantIds,
          ...buildRecordingContextPayload(recordingContext),
        }),
        signal,
      }));
      saveRecentGenerationContext(recordingContext);
      setRecentManualContext(recordingContext);
      setRecordingWithDrafts(null);
      await refreshLists(expression.id);
      scrollToDashboardSection("expressions");
      setManualGenerateText("");
      setManualGenerateParticipantIds([]);
      setShowManualGenerateComposer(false);
      setShowManualGenerateContext(false);
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
      await playSelectedExpressionTtsSequence({
        koreanTtsUrl: response.koreanTtsUrl,
        ttsUrl: response.ttsUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "TTS 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function playSelectedExpressionTtsSequence(expression?: {
    koreanTtsUrl?: string | null;
    ttsUrl?: string | null;
  }) {
    const target = expression ?? selectedBrowserExpression ?? selectedExpression;
    if (!target?.ttsUrl) {
      setError("영어 TTS 재생 URL이 없습니다.");
      return;
    }

    const player = audioRef.current;
    if (!player) return;

    const playUrl = async (url: string, errorMessage: string) => {
      player.src = url;
      player.load();
      await new Promise<void>((resolve, reject) => {
        const handleEnded = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error(errorMessage));
        };
        const cleanup = () => {
          player.onended = null;
          player.onerror = null;
        };

        player.onended = handleEnded;
        player.onerror = handleError;
        player.play().catch((err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error(errorMessage));
        });
      });
    };

    if (!target.koreanTtsUrl) {
      await playUrl(target.ttsUrl, "영어 TTS 재생에 실패했습니다.");
      return;
    }

    await playUrl(target.koreanTtsUrl, "한국어 TTS 재생에 실패했습니다.");
    await playUrl(target.ttsUrl, "영어 TTS 재생에 실패했습니다.");
  }

  async function handleGenerateTtsBulk() {
    if (!recording) {
      setError("먼저 녹음을 불러와 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setLoading("tts-bulk");
    try {
      const response = await runWithTimeout("tts", (signal) =>
        apiFetch<BulkTtsResponse>("/expressions/tts/bulk", {
          method: "POST",
          body: JSON.stringify({ recordingId: recording.id, onlyMissing: true }),
          signal,
        }),
      );
      await refreshLists(selectedExpressionId || undefined);
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

  async function handleCopyExpression() {
    if (!selectedExpression) {
      setError("복사할 표현을 먼저 선택해 주세요.");
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedExpression.englishBase);
      setError("");
      setMessage("영어 표현을 복사했습니다.");
    } catch {
      setError("클립보드 복사에 실패했습니다.");
    }
  }

  async function handleDeleteExpression() {
    if (!selectedExpression) {
      setError("삭제할 표현을 먼저 선택해 주세요.");
      return;
    }

    const confirmed = window.confirm(`"${selectedExpression.englishBase}" 표현을 삭제할까요? 오늘의 복습 기록에서도 제외됩니다.`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    setLoading("delete-expression");
    try {
      await apiFetch<{ success: boolean; expressionId: string }>(`/expressions/${selectedExpression.id}`, {
        method: "DELETE",
      });
      setTtsUrl("");
      setScore(null);
      await refreshLists();
      setMessage("선택한 표현을 삭제했습니다. 오늘의 복습 목록도 함께 갱신했습니다.");
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

    setError("");
    setMessage("");
    setLoading("save-expression-memo");
    try {
      await apiFetch<Expression>(`/expressions/${selectedExpression.id}/memo`, {
        method: "PATCH",
        body: JSON.stringify({ userMemo: expressionMemoDraft }),
      });
      await refreshLists(selectedExpression.id);
      setMessage("표현 메모를 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 메모 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSavePatternPracticeExpression() {
    if (!practicePrompt || practicePrompt.testType !== "pattern") {
      setError("패턴형 문제 결과만 표현 자산으로 저장할 수 있습니다.");
      return;
    }
    if (savedPatternExpression) {
      setMessage("이 패턴형 문제 결과는 이미 표현 자산으로 저장했습니다.");
      return;
    }

    const koreanText = practicePrompt.promptKorean?.trim();
    const englishBase = score?.suggestedAnswer?.trim() || practicePrompt.target?.trim();
    const englishNatural = score?.suggestedAnswerAlt?.trim() || practicePrompt.targetAlt?.trim() || englishBase;

    if (!koreanText || !englishBase) {
      setError("저장할 문제 문장 또는 영어 표현이 없습니다.");
      return;
    }

    const noteParts = [
      practicePrompt.patternLabel ? `패턴: ${practicePrompt.patternLabel}` : null,
      practicePrompt.patternDescription ?? null,
      practicePrompt.referenceTarget ? `원래 대표 표현: ${practicePrompt.referenceTarget}` : null,
    ].filter(Boolean);

    setError("");
    setMessage("");
    setLoading("save-pattern-expression");
    try {
      const created = await apiFetch<Expression>("/expressions/save-practice", {
        method: "POST",
        body: JSON.stringify({
          koreanText,
          englishBase,
          englishEasy: practicePrompt.target,
          englishNatural,
          promptContext: practicePrompt.promptContext,
          note: noteParts.join("\n"),
        }),
      });
      await refreshLists(created.id);
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
      setLoading("");
    }
  }

  function resetPracticeResponseTiming() {
    setPracticePromptReadyAtMs(null);
    setPracticeResponseStartedAtMs(null);
  }

  function clearReviewAutoAdvanceTimers() {
    if (reviewAutoAdvanceTimeoutRef.current !== null) {
      window.clearTimeout(reviewAutoAdvanceTimeoutRef.current);
      reviewAutoAdvanceTimeoutRef.current = null;
    }
    if (reviewAutoAdvanceScrollTimeoutRef.current !== null) {
      window.clearTimeout(reviewAutoAdvanceScrollTimeoutRef.current);
      reviewAutoAdvanceScrollTimeoutRef.current = null;
    }
  }

  function setReviewAutoAdvanceEnabled(enabled: boolean) {
    setReviewAutoAdvance(enabled);
    if (!enabled) {
      clearReviewAutoAdvanceTimers();
      setPendingAutoReview(null);
    }
    setPracticeFlowMode(enabled ? "review_series" : (activeReviewExpressionId ? "review_once" : "single"));
  }

  function switchToSinglePracticeMode() {
    clearPracticeAutoStartCountdown();
    clearReviewAutoAdvanceTimers();
    setPracticeFlowMode("single");
    setReviewAutoAdvance(false);
    setPendingAutoReview(null);
    setActiveReviewExpressionId(null);
  }

  function triggerAutoAdvanceToReview(nextReview: ReviewItem) {
    clearReviewAutoAdvanceTimers();
    setPendingAutoReview(nextReview);
    reviewAutoAdvanceTimeoutRef.current = window.setTimeout(() => {
      reviewAutoAdvanceTimeoutRef.current = null;
      setPendingAutoReview(null);
      void handleStartReviewPractice(nextReview, "translation", { autoAdvance: true });
      reviewAutoAdvanceScrollTimeoutRef.current = window.setTimeout(() => {
        reviewAutoAdvanceScrollTimeoutRef.current = null;
        testSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        focusPracticeMainCard();
      }, 100);
    }, 180);
  }

  async function handleStartReviewFlow(mode: "review_once" | "review_series") {
    if (reviews.length === 0) {
      setError("오늘의 복습 항목이 없습니다.");
      return;
    }

    const targetReview = activeReviewItem ?? reviews[0];
    setPracticeFlowMode(mode);
    setReviewAutoAdvance(mode === "review_series");
    setPendingAutoReview(null);
    await handleStartReviewPractice(
      targetReview,
      mode === "review_series" ? "translation" : (targetReview.recommendedTestType ?? "translation"),
      { autoAdvance: mode === "review_series" },
    );
  }

  async function handleMoveToNextReview() {
    if (!activeReviewExpressionId) {
      setError("현재 진행 중인 복습 문제가 없습니다.");
      return;
    }
    if (!nextReviewItem) {
      setActiveReviewExpressionId(null);
      setMessage("현재 문제가 마지막 복습 카드입니다.");
      return;
    }

    setError("");
    setMessage("다음 복습 카드로 이동합니다.");
    setPracticeFlowMode(reviewAutoAdvance ? "review_series" : "review_once");
    await handleStartReviewPractice(
      nextReviewItem,
      practiceTestType === "situation" ? "situation" : "translation",
      { autoAdvance: false },
    );
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
      const promptReadyAtMs = practicePromptReadyAtMs ?? Date.now();
      const responseStartedAtMs = practiceResponseStartedAtMs ?? promptReadyAtMs;
      const result = await runWithTimeout("score", (signal) => apiFetch<PracticeScore>("/practice/score", {
        method: "POST",
        body: JSON.stringify({
          expressionId: selectedExpression.id,
          answer,
          testType: practiceTestType,
          promptKorean: practicePrompt?.promptKorean,
          promptContext: practicePrompt?.promptContext,
          promptTarget: practicePrompt?.target,
          promptReadyAtMs,
          responseStartedAtMs,
        }),
        signal,
      }));
      const currentReviewId = activeReviewExpressionId;
      const currentReviewIndex = currentReviewId ? reviews.findIndex((item) => item.id === currentReviewId) : -1;
      const nextReview = reviewAutoAdvance && currentReviewIndex >= 0 ? reviews[currentReviewIndex + 1] ?? null : null;

      setScore(result);
      if (selectedExpression?.id === activeReviewExpressionId) {
        setActiveReviewExpressionId(selectedExpression.id);
      }
      await refreshLists(selectedExpression.id);
      if (currentReviewId && reviewAutoAdvance) {
        if (nextReview) {
          setMessage("말하기 테스트를 채점했습니다. 다음 복습 카드로 자동 이동합니다.");
          triggerAutoAdvanceToReview(nextReview);
        } else {
          setPendingAutoReview(null);
          setActiveReviewExpressionId(null);
          setMessage("말하기 테스트를 채점했습니다. 오늘의 복습이 모두 끝났습니다.");
        }
      } else {
        setMessage("말하기 테스트를 채점했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "채점에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  function handleStartVoicePractice() {
    if (isPracticeRecording || loading) return;
    if (activeReviewExpressionId && reviewReadQuestion && practicePromptReadyAtMs === null) {
      setError("문제를 모두 읽은 뒤에 녹음을 시작해 주세요.");
      return;
    }
    startVoicePracticeRecording();
  }

  function handleStopVoicePractice() {
    if (practiceAutoStartCountdown !== null) {
      clearPracticeAutoStartCountdown();
      setMessage("자동 녹음 시작을 취소했습니다.");
      return;
    }
    practiceRecordingSessionRef.current?.stop();
  }

  async function handleScoreVoice(preparedFile?: File) {
    if (!selectedExpression) {
      setError("채점할 표현을 먼저 선택해 주세요.");
      return;
    }
    const file = preparedFile instanceof File ? preparedFile : voiceAnswerFile;
    if (!file) {
      setError("먼저 영어 답변을 녹음해 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setLoading("score-voice");
    try {
      const promptReadyAtMs = practicePromptReadyAtMs ?? Date.now();
      const responseStartedAtMs = practiceResponseStartedAtMs ?? promptReadyAtMs;
      const presign = await runWithTimeout("score-voice", (signal) =>
        apiFetch<PracticeVoicePresignResponse>("/practice/voice/presign", {
          method: "POST",
          body: JSON.stringify({ fileName: file.name, contentType: file.type || "audio/webm" }),
          signal,
        }),
      );

      const uploadTask = createPresignedUploadTask(presign.uploadUrl, file);
      uploadTaskRef.current = uploadTask;
      try {
        await Promise.race<void>([
          uploadTask.promise,
          new Promise<void>((_, reject) => {
            window.setTimeout(() => {
              uploadTask.cancel();
              reject(new Error("음성 답변 업로드가 제한시간을 초과했습니다."));
            }, 30000);
          }),
        ]);
      } finally {
        uploadTaskRef.current = null;
      }

      const result = await runWithTimeout("score-voice", (signal) =>
        apiFetch<PracticeScore>("/practice/score-voice", {
          method: "POST",
          body: JSON.stringify({
            expressionId: selectedExpression.id,
            audioKey: presign.key,
            fileName: file.name,
            testType: practiceTestType,
            promptKorean: practicePrompt?.promptKorean,
            promptContext: practicePrompt?.promptContext,
            promptTarget: practicePrompt?.target,
            promptReadyAtMs,
            responseStartedAtMs,
          }),
          signal,
        }),
      );

      const currentReviewId = activeReviewExpressionId;
      const currentReviewIndex = currentReviewId ? reviews.findIndex((item) => item.id === currentReviewId) : -1;
      const nextReview = reviewAutoAdvance && currentReviewIndex >= 0 ? reviews[currentReviewIndex + 1] ?? null : null;

      setScore(result);
      setAnswer(result.answer);
      await refreshLists(selectedExpression.id);
      if (currentReviewId && reviewAutoAdvance) {
        if (nextReview) {
          setMessage("음성 답변을 채점했습니다. 다음 복습 카드로 자동 이동합니다.");
          triggerAutoAdvanceToReview(nextReview);
        } else {
          setPendingAutoReview(null);
          setActiveReviewExpressionId(null);
          setMessage("음성 답변을 채점했습니다. 오늘의 복습이 모두 끝났습니다.");
        }
      } else {
        setMessage("음성 답변을 영어로 인식해 채점했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "음성 채점에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleGeneratePracticePrompt(nextType: "translation" | "situation" | "pattern") {
    if (!selectedExpression) {
      setError("먼저 표현을 선택해 주세요.");
      return;
    }

    clearPracticeAutoStartCountdown();
    if (!activeReviewExpressionId) {
      setPracticeFlowMode("single");
    }
    setPracticeTestType(nextType);
    setAnswer("");
    setVoiceAnswerFile(null);
    setScore(null);
    setActiveReviewExpressionId(null);
    resetPracticeResponseTiming();
    setError("");
    setMessage("");

    if (nextType === "translation") {
      const readyAtMs = Date.now();
      setPracticePrompt(buildTranslationPracticePrompt(selectedExpression));
      setPracticePromptReadyAtMs(readyAtMs);
      return;
    }

    setLoading("practice-prompt");
    try {
      const prompt = await apiFetch<PracticePrompt>("/practice/prompts", {
        method: "POST",
        body: JSON.stringify({ expressionId: selectedExpression.id, testType: nextType }),
      });
      setPracticePrompt(prompt);
      setPracticePromptReadyAtMs(Date.now());
      setMessage(nextType === "pattern" ? "패턴형 문제를 불러왔습니다." : "상황형 문제를 불러왔습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "상황형 문제 생성에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function startPracticeForExpression(
    expression: Expression,
    targetType: "translation" | "situation" | "pattern",
    options?: { activeReviewExpressionId?: string | null; forceVoiceMode?: boolean },
  ) {
    stopReviewQuestionSpeech();
    clearPracticeAutoStartCountdown();
    setSelectedExpressionId(expression.id);
    setActiveReviewExpressionId(options?.activeReviewExpressionId ?? null);
    if (options?.forceVoiceMode) {
      setTestMode("voice");
    }
    setAnswer("");
    setVoiceAnswerFile(null);
    setScore(null);
    resetPracticeResponseTiming();
    setError("");
    setMessage("");

    if (targetType === "translation") {
      setPracticeTestType("translation");
      setPracticePrompt(buildTranslationPracticePrompt(expression));
      if (reviewReadQuestion) {
        setMessage("문제를 읽어주는 중입니다.");
        speakReviewQuestion(expression.koreanText, () => {
          setPracticePromptReadyAtMs(Date.now());
          setMessage("이제 답변을 준비해 주세요. 3초 뒤에 녹음이 자동으로 시작됩니다.");
          if (testMode === "voice") {
            scheduleVoicePracticeAutoStart();
          }
          window.setTimeout(() => answerRef.current?.focus(), 0);
        });
      } else {
        setPracticePromptReadyAtMs(Date.now());
        if (testMode === "voice") {
          scheduleVoicePracticeAutoStart();
        }
      }
    } else {
      setLoading("practice-prompt");
      try {
        const prompt = await apiFetch<PracticePrompt>("/practice/prompts", {
          method: "POST",
          body: JSON.stringify({ expressionId: expression.id, testType: targetType }),
        });
        setPracticeTestType(targetType);
        setPracticePrompt(prompt);
        if (reviewReadQuestion) {
          setMessage("문제를 읽어주는 중입니다.");
          speakReviewQuestion(prompt.promptKorean, () => {
            setPracticePromptReadyAtMs(Date.now());
            setMessage("이제 답변을 준비해 주세요. 3초 뒤에 녹음이 자동으로 시작됩니다.");
            if (testMode === "voice") {
              scheduleVoicePracticeAutoStart();
            }
            window.setTimeout(() => answerRef.current?.focus(), 0);
          });
        } else {
          setPracticePromptReadyAtMs(Date.now());
          if (testMode === "voice") {
            scheduleVoicePracticeAutoStart();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "상황형 문제 생성에 실패했습니다.");
        setLoading("");
        return;
      } finally {
        setLoading("");
      }
    }

    window.setTimeout(() => {
      testSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      focusPracticeMainCard();
    }, 120);
  }

  async function handleStartReviewPractice(
    review: ReviewItem,
    nextType?: "translation" | "situation",
    options?: { autoAdvance?: boolean },
  ) {
    const expression = expressions.find((item) => item.id === review.id);
    const targetType = options?.autoAdvance ? "translation" : (nextType ?? review.recommendedTestType ?? "translation");

    if (!expression) {
      setError("복습을 시작할 표현을 찾지 못했습니다.");
      return;
    }

    setPracticeFlowMode(options?.autoAdvance ? "review_series" : "review_once");
    await startPracticeForExpression(expression, targetType, {
      activeReviewExpressionId: expression.id,
      forceVoiceMode: true,
    });
  }

  async function handleStartPracticeFromHistory(item: PracticeHistoryItem) {
    const expression = expressions.find((entry) => entry.id === item.expressionId);
    const targetType = item.testType ?? "translation";

    if (!expression) {
      setError("최근 복습 기록과 연결된 표현을 찾지 못했습니다.");
      return;
    }

    setPracticeFlowMode("single");
    await startPracticeForExpression(expression, targetType, {
      activeReviewExpressionId: null,
      forceVoiceMode: false,
    });
  }

  async function handleLoadRecording(recordingId: string) {
    setError("");
    setMessage("");
    setLoading(`load-recording-${recordingId}`);
    try {
      const loaded = await apiFetch<RecordingResponse>(`/recordings/${recordingId}`);
      setRecordingWithDrafts(loaded);
      setSelectedFile(null);
      setScore(null);
      setTtsUrl("");
      focusSelectedRecordingDetail();
      setMessage(`이전 녹음 "${loaded.fileName}"을 불러왔습니다. 이어서 문장 수정, 표현 생성, TTS 생성을 진행할 수 있습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이전 녹음을 불러오지 못했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSavePersonProfile() {
    if (!personProfileDraft.name.trim()) {
      setError("인물 이름을 입력해 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setLoading("save-person-profile");
    try {
      const payload = {
        name: personProfileDraft.name.trim(),
        roleLabel: personProfileDraft.roleLabel.trim(),
        relationshipToMe: personProfileDraft.relationshipToMe.trim(),
        aliases: personProfileDraft.aliases.trim(),
        notes: personProfileDraft.notes.trim(),
        isMe: personProfileDraft.isMe,
      };
      if (personProfileDraft.id) {
        await apiFetch(`/person-profiles/${personProfileDraft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("인물 프로필을 수정했습니다.");
      } else {
        await apiFetch("/person-profiles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("인물 프로필을 추가했습니다.");
      }
      await refreshPersonProfiles();
      setPersonProfileDraft({ id: "", name: "", roleLabel: "", relationshipToMe: "", aliases: "", notes: "", isMe: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "인물 프로필 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleDeletePersonProfile(id: string) {
    const confirmed = window.confirm("이 인물 프로필을 삭제할까요?");
    if (!confirmed) return;

    setError("");
    setMessage("");
    setLoading(`delete-person-profile-${id}`);
    try {
      await apiFetch(`/person-profiles/${id}`, { method: "DELETE" });
      await refreshPersonProfiles();
      setPersonProfileDraft((current) => (current.id === id ? { id: "", name: "", roleLabel: "", relationshipToMe: "", aliases: "", notes: "", isMe: false } : current));
      setMessage("인물 프로필을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인물 프로필 삭제에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSaveRecordingParticipants() {
    if (!recording?.id) return;
    setError("");
    setMessage("");
    setLoading("save-recording-participants");
    try {
      const updated = await apiFetch<RecordingResponse>(`/recordings/${recording.id}/participants`, {
        method: "PATCH",
        body: JSON.stringify({ personProfileIds: recordingParticipantDraftIds }),
      });
      setRecordingWithDrafts(updated);
      setMessage("관련 인물을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "관련 인물 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleUpdateSpeakerProfile(recordingId: string, speakerLabel: string, personProfileId: string) {
    setError("");
    setMessage("");
    setLoading(`speaker-profile-${recordingId}-${speakerLabel}`);
    try {
      const updated = await apiFetch<RecordingResponse>(`/recordings/${recordingId}/speaker-profile`, {
        method: "PATCH",
        body: JSON.stringify({ speakerLabel, personProfileId: personProfileId || undefined }),
      });
      setRecordingWithDrafts(updated);
      setMessage(personProfileId ? `${speakerLabel}에 인물 프로필을 연결했습니다.` : `${speakerLabel} 인물 연결을 해제했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "화자 인물 연결 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleSelectMineSpeaker(recordingId: string, speakerLabel: string) {
    setError("");
    setMessage("");
    setLoading(`mine-speaker-${recordingId}-${speakerLabel}`);
    try {
      const updated = await apiFetch<RecordingResponse>(`/recordings/${recordingId}/mine-speaker`, {
        method: "PATCH",
        body: JSON.stringify({ speakerLabel }),
      });
      setRecordingWithDrafts(updated);
      await runAutoRecordingAnalysis(updated.id, "내 화자 설정을 반영해 대화 분석을 자동으로 갱신했습니다.");
      if (recordingAnalysisMode !== "auto") {
        await persistRecordingAnalysisStatus("NEEDS_REVIEW", "SPEAKER_CHANGED");
        setMessage(`${speakerLabel}를 내 화자로 지정했습니다. 이후 문장 추출과 표현 생성이 이 선택을 기준으로 동작합니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 화자 설정에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleUpdateSpeakerLabel(recordingId: string, speakerLabel: string) {
    const nextSpeakerLabel = speakerLabelDrafts[speakerLabel]?.trim();
    if (!nextSpeakerLabel) {
      setError("화자 이름을 입력해 주세요.");
      return;
    }
    if (nextSpeakerLabel === speakerLabel) {
      setMessage("변경된 화자 이름이 없어 저장하지 않았습니다.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(`speaker-label-${recordingId}-${speakerLabel}`);
    try {
      const updated = await apiFetch<RecordingResponse>(`/recordings/${recordingId}/speaker-label`, {
        method: "PATCH",
        body: JSON.stringify({ speakerLabel, nextSpeakerLabel }),
      });
      setRecordingWithDrafts(updated);
      setActiveSpeakerRenameLabel("");
      await runAutoRecordingAnalysis(updated.id, "화자 이름 변경을 반영해 대화 분석을 자동으로 갱신했습니다.");
      if (recordingAnalysisMode !== "auto") {
        await persistRecordingAnalysisStatus("NEEDS_REVIEW", "SPEAKER_LABEL_CHANGED");
        setMessage(`${speakerLabel} 이름을 "${nextSpeakerLabel}"로 저장했습니다.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "화자 이름 저장에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  function openSpeakerRenameDialog(speakerLabel: string) {
    setSpeakerLabelDrafts((current) => ({
      ...current,
      [speakerLabel]: current[speakerLabel] ?? speakerLabel,
    }));
    setActiveSpeakerRenameLabel(speakerLabel);
  }

  function closeSpeakerRenameDialog() {
    setActiveSpeakerRenameLabel("");
  }

  async function handleDeleteRecording(recordingId: string) {
    const target = recordings.find((item) => item.id === recordingId);
    const confirmed = window.confirm(`"${target?.fileName ?? "이 녹음"}"을 삭제할까요? 이미 생성한 영어 표현은 남기고, 녹음과 텍스트 변환 결과만 삭제합니다.`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    setLoading(`delete-recording-${recordingId}`);
    try {
      await apiFetch<{ success: boolean; recordingId: string }>(`/recordings/${recordingId}`, {
        method: "DELETE",
      });
      setRecordings((current) => current.filter((item) => item.id !== recordingId));
      if (recording?.id === recordingId) {
        setRecordingWithDrafts(null);
      }
      await refreshRecordings();
      await refreshLists(selectedExpressionId || undefined);
      setMessage("녹음을 삭제했습니다. 이미 생성한 영어 표현과 복습 기록은 유지했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "녹음 삭제에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleReprocessRecording(recordingId: string) {
    setError("");
    setMessage("");
    setLoading(`reprocess-recording-${recordingId}`);
    try {
      const processed = await apiFetch<RecordingResponse>(`/recordings/${recordingId}/process`, {
        method: "POST",
        body: JSON.stringify({ diarization: true }),
      });
      setRecordingWithDrafts(processed);
      await refreshRecordings();
      setMessage(`"${processed.fileName}" 텍스트 변환을 다시 실행했고, 결과를 불러왔습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "텍스트 변환 다시 실행에 실패했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function handleAnalyzeConversation() {
    if (!recording) {
      setError("먼저 녹음을 불러와 주세요.");
      return;
    }

    setError("");
    setMessage("");
    setLoading("analyze-recording");
    try {
      await runRecordingAnalysis(recording.id, "대화 요약과 발화 의도 분석을 불러왔습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대화 분석에 실패했습니다.");
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
            <h1 className="h1" style={{ marginBottom: 8 }}>내 언어 데이터 대시보드</h1>
            <p className="muted">로그인 사용자: <strong>{user?.email ?? getStoredUser()?.email ?? "-"}</strong></p>
            <p className="muted" style={{ marginTop: 8 }}>
              녹음, 문장, 표현, 테스트 기록을 한곳에 모아 정리하고 학습과 재활용으로 이어갑니다.
            </p>
          </div>
          <div className="row">
            <button
              className="button ghost"
              onClick={() => setShowManualGenerateComposer((current) => !current)}
              disabled={!!loading}
            >
              {showManualGenerateComposer ? "빠른 문장 저장 닫기" : "빠른 문장 저장"}
            </button>
            <button className="button secondary" onClick={() => { clearSession(); router.replace("/"); }}>로그아웃</button>
          </div>
        </div>
        {authError && <div className="error-box" style={{ marginTop: 12 }}>{authError}</div>}
        {message && <div className="success-box" style={{ marginTop: 12 }}>{message}</div>}
        {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
        {activeTimeoutMessage && <div className="timeout-box" style={{ marginTop: 12 }}>{activeTimeoutMessage}</div>}
        {showManualGenerateComposer && (
          <div className="mini-card" style={{ marginTop: 14 }}>
            <strong>빠른 문장 저장</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              한국어 문장을 먼저 빠르게 남기고, 필요하면 관계·상황·톤을 덧붙여 영어 표현 생성에 활용합니다.
            </div>
            <div className="grid" style={{ marginTop: 12 }}>
              <textarea
                className="textarea"
                style={{ minHeight: 104 }}
                value={manualGenerateText}
                onChange={(event) => setManualGenerateText(event.target.value)}
                placeholder="예: 버스 10분 뒤에 와."
              />
              <div className="row" style={{ gap: 10 }}>
                <button
                  className="button ghost"
                  onClick={() => setShowManualGenerateContext((current) => !current)}
                  disabled={!!loading}
                >
                  {showManualGenerateContext ? "맥락 입력 접기" : "맥락 추가"}
                </button>
                <button
                  className="button ghost"
                  onClick={() => {
                    setRecordingContext(recentManualContext);
                    setShowManualGenerateContext(true);
                  }}
                  disabled={
                    !!loading ||
                    (!recentManualContext.relationship && !recentManualContext.situation && !recentManualContext.tone)
                  }
                >
                  최근 맥락 다시 사용
                </button>
              </div>
              {showManualGenerateContext && (
                <div className="grid" style={{ gap: 12 }}>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>관련 인물 선택</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {personProfiles.map((profile) => (
                        <button
                          key={`manual-${profile.id}`}
                          type="button"
                          className={`chip ${manualGenerateParticipantIds.includes(profile.id) ? "selected" : ""}`}
                          onClick={() => toggleManualGenerateParticipant(profile.id)}
                          disabled={!!loading}
                        >
                          {profile.name}{profile.roleLabel ? ` (${profile.roleLabel})` : ""}
                        </button>
                      ))}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      이번 문장 해석에 필요한 인물만 골라두면 이름과 관계 정보를 함께 참고합니다.
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>관계 템플릿</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {RELATIONSHIP_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${recordingContext.relationship === item ? "selected" : ""}`}
                          onClick={() => setRecordingContext((current) => ({ ...current, relationship: item }))}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      style={{ marginTop: 10 }}
                      value={recordingContext.relationship}
                      onChange={(event) => setRecordingContext((current) => ({ ...current, relationship: event.target.value }))}
                      placeholder="대화 관계 예: 엄마 - 아이, 손님 - 직원"
                    />
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>상황 템플릿</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {SITUATION_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${recordingContext.situation === item ? "selected" : ""}`}
                          onClick={() => setRecordingContext((current) => ({ ...current, situation: item }))}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="input"
                      style={{ marginTop: 10, minHeight: 88, resize: "vertical" }}
                      value={recordingContext.situation}
                      onChange={(event) => setRecordingContext((current) => ({ ...current, situation: event.target.value }))}
                      placeholder="대화 상황 예: 아이가 혼자 집에 있겠다고 해서 엄마가 위험하다고 설명하는 상황"
                    />
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>톤 템플릿</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {TONE_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${recordingContext.tone === item ? "selected" : ""}`}
                          onClick={() => setRecordingContext((current) => ({ ...current, tone: item }))}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      style={{ marginTop: 10 }}
                      value={recordingContext.tone}
                      onChange={(event) => setRecordingContext((current) => ({ ...current, tone: event.target.value }))}
                      placeholder="원하는 영어 톤 예: 자연스럽고 부드럽지만 단호한 일상 회화"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="button" onClick={handleGenerateFromText} disabled={!!loading || !manualGenerateText.trim()}>
                {loading === "manual-generate" ? "생성 중..." : "저장 후 영어 표현 생성"}
              </button>
              <button
                className="button ghost"
                  onClick={() => {
                    setShowManualGenerateComposer(false);
                    setManualGenerateText("");
                    setManualGenerateParticipantIds([]);
                    setShowManualGenerateContext(false);
                  }}
                disabled={!!loading}
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </section>

      <section ref={personDictionarySectionRef} className="card panel-lg">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="h2" style={{ marginBottom: 8 }}>개인 인물 사전</h2>
            <div className="muted">
              나와 가족, 자주 등장하는 사람을 등록해두면 녹음 맥락 입력과 화자 선택을 훨씬 빠르게 할 수 있습니다.
            </div>
          </div>
          <button type="button" className="chip selected" onClick={() => setPersonDictionaryOpen((current) => !current)}>
            {personDictionaryOpen ? "접기" : "펼치기"}
          </button>
        </div>
        {personDictionaryOpen && (
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <div className="mini-card">
              <strong>{personProfileDraft.id ? "인물 프로필 수정" : "인물 프로필 추가"}</strong>
              <div className="grid" style={{ marginTop: 12 }}>
                <input className="input" value={personProfileDraft.name} onChange={(event) => setPersonProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder="이름 예: 박소연" />
                <input className="input" value={personProfileDraft.roleLabel} onChange={(event) => setPersonProfileDraft((current) => ({ ...current, roleLabel: event.target.value }))} placeholder="역할 예: 첫째딸, 배우자" />
                <input className="input" value={personProfileDraft.relationshipToMe} onChange={(event) => setPersonProfileDraft((current) => ({ ...current, relationshipToMe: event.target.value }))} placeholder="나와의 관계 예: 딸, 배우자, 본인" />
                <input className="input" value={personProfileDraft.aliases} onChange={(event) => setPersonProfileDraft((current) => ({ ...current, aliases: event.target.value }))} placeholder="별칭 예: 소연이, 언니" />
                <textarea className="textarea" style={{ minHeight: 92 }} value={personProfileDraft.notes} onChange={(event) => setPersonProfileDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="메모 예: 초등학생, 투정 부릴 때가 있음" />
                <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={personProfileDraft.isMe} onChange={(event) => setPersonProfileDraft((current) => ({ ...current, isMe: event.target.checked }))} />
                  이 인물은 나
                </label>
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="button" onClick={handleSavePersonProfile} disabled={!!loading || !personProfileDraft.name.trim()}>
                  {loading === "save-person-profile" ? "저장 중..." : personProfileDraft.id ? "수정 저장" : "인물 추가"}
                </button>
                {personProfileDraft.id && (
                  <button className="button ghost" onClick={() => setPersonProfileDraft({ id: "", name: "", roleLabel: "", relationshipToMe: "", aliases: "", notes: "", isMe: false })} disabled={!!loading}>
                    입력 초기화
                  </button>
                )}
              </div>
            </div>
            <div className="mini-card">
              <strong>등록된 인물</strong>
              <div className="grid" style={{ marginTop: 12 }}>
                {personProfiles.length === 0 && <div className="muted">아직 등록된 인물이 없습니다.</div>}
                {personProfiles.map((profile) => (
                  <div key={profile.id} className="mini-card">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{profile.name}</strong>
                      {profile.isMe && <span className="tag tag-primary">나</span>}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {[profile.roleLabel, profile.relationshipToMe].filter(Boolean).join(" · ") || "역할 정보 없음"}
                    </div>
                    {profile.aliases && <div className="muted" style={{ marginTop: 6 }}>별칭: {profile.aliases}</div>}
                    {profile.notes && <div className="muted" style={{ marginTop: 6 }}>{profile.notes}</div>}
                    <div className="row" style={{ marginTop: 10 }}>
                      <button className="button ghost" onClick={() => setPersonProfileDraft({ id: profile.id, name: profile.name, roleLabel: profile.roleLabel ?? "", relationshipToMe: profile.relationshipToMe ?? "", aliases: profile.aliases ?? "", notes: profile.notes ?? "", isMe: Boolean(profile.isMe) })} disabled={!!loading}>
                        수정
                      </button>
                      <button className="button danger" onClick={() => handleDeletePersonProfile(profile.id)} disabled={!!loading}>
                        {loading === `delete-person-profile-${profile.id}` ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section ref={autoFlowSectionRef} className="card panel-lg">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="row" style={{ alignItems: "center", gap: 10 }}>
              <h2 className="h2" style={{ marginBottom: 0 }}>원클릭 학습 시작</h2>
              <button
                type="button"
                className="help-icon-button"
                aria-label="원클릭 학습 시작 도움말"
                aria-expanded={showAutoFlowHelp}
                onClick={() => setShowAutoFlowHelp((current) => !current)}
              >
                ?
              </button>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              녹음 버튼 한 번으로 <strong>녹음 → 업로드 → 텍스트 변환 → 내 문장 추출 → 영어 표현 생성 → TTS 생성 → 테스트 이동</strong>까지 자동으로 진행합니다.
            </p>
          </div>
          <div className="row">
            <button className="button" onClick={handleAutoRecordFlow} disabled={!!loading}>
              {loading === "auto-flow"
                ? flowStepId === "recording" && isMicRecording
                  ? `녹음 중... ${formatRecordingSeconds(recordingElapsedMs)}`
                  : currentFlowStep
                  ? `${currentFlowStep.label}...`
                  : "처리 중..."
                : "원클릭으로 시작"}
            </button>
            {loading === "auto-flow" && flowStepId === "recording" && isMicRecording && (
              <button className="button secondary" onClick={handleStopRecording}>
                녹음 종료
              </button>
            )}
            {!!loading && (
              <button className="button danger" onClick={() => cancelActiveOperations(true)}>
                현재 작업 취소
              </button>
            )}
          </div>
          {loading === "auto-flow" && flowStepId === "recording" && isMicRecording && (
            <div className="muted" style={{ marginTop: 8 }}>
              원클릭 녹음 시간: 경과 {formatRecordingSeconds(recordingElapsedMs)} · 남은 시간 {formatRecordingSeconds(recordingRemainingMs)}
            </div>
          )}
        </div>
        {showAutoFlowHelp && (
          <div className="help-panel" style={{ marginTop: 14 }}>
            <strong>원클릭 학습 시작은 실제로 이렇게 동작합니다.</strong>
            <div className="help-list">
              <div>1. 브라우저에서 녹음한 뒤 S3 업로드, STT, diarization까지 자동 실행합니다.</div>
              <div>2. 시간은 5초, 10초, 20초, 40초, 90초 중에서 고를 수 있고, 녹음 중에는 언제든 `녹음 종료` 버튼으로 바로 멈출 수 있습니다.</div>
              <div>3. 먼저 `내 화자(isMine=true)` 문장을 우선 찾고, 있으면 그 문장들로 영어 표현을 만듭니다.</div>
              <div>4. `내 화자`가 아직 선택되지 않았거나 `isMine` 문장이 없으면, 전체 문장 중 비어 있지 않은 앞쪽 문장으로 fallback 합니다.</div>
              <div>5. fallback 시에도 무한정 생성하지 않고, 현재는 최대 3개 문장까지만 자동으로 영어 표현을 생성합니다.</div>
              <div>6. TTS는 생성된 표현 전체가 아니라 첫 번째 표현만 자동 생성합니다. 나머지는 아래 `남은 TTS 일괄 생성`으로 이어서 만들 수 있습니다.</div>
              <div>7. 따라서 여러 화자가 섞인 대화라면, 원클릭 후 `내 화자 선택`을 확인해서 필요하면 직접 바꿔주는 것이 가장 정확합니다.</div>
              <div>8. 원클릭 완료 후에는 말하기 테스트 영역으로 자동 이동하고, 바로 연습을 이어갈 수 있습니다.</div>
            </div>
          </div>
        )}

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
            <div className="muted" style={{ marginTop: 8 }}>
              현재 {Math.round(recordingDuration / 1000)}초 뒤 자동 종료되며, 녹음 중에는 언제든 직접 종료할 수 있습니다.
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
            <strong>원클릭 학습 진행률</strong>
            <span className="muted">{flowProgress}%</span>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            이 카드는 원클릭 학습 시작을 눌렀을 때만 바뀌는 학습 자동화 단계입니다.
          </div>
          <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${flowProgress}%` }} /></div>
          <div className="muted" style={{ marginTop: 10 }}>
            {currentFlowStep ? `${currentFlowStep.label} · ${currentFlowStep.description}` : "원클릭 학습을 시작하면 여기에서 단계별 진행 상황이 표시됩니다."}
          </div>
          {flowStepId === "upload" && uploadPercent > 0 && (
            <div className="upload-inline-status">업로드 진행률 {uploadPercent}%</div>
          )}
        </div>

        <div className="grid auto-flow-grid compact" style={{ marginTop: 12 }}>
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
                <div className="muted" style={{ marginTop: 6 }}>
                  {failed ? "실패" : active ? "진행 중" : done ? "완료" : "대기"}
                </div>
                {failed && (
                  <button className="link-button" style={{ marginTop: 6 }} onClick={handleRetryFailedStep} disabled={!!loading}>
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

      <section ref={learningProgressSectionRef} className="card panel-lg">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="h2" style={{ marginBottom: 0 }}>패턴 / 단어 진도</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              저장한 표현이 패턴과 단어 자산에 얼마나 쌓였는지, 그리고 실제로 얼마나 말할 수 있게 되었는지 보여줍니다.
            </p>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="tag tag-primary">
              {learningAssetsProgress ? `전체 ${learningAssetsProgress.overall.overallProgress}%` : "불러오는 중"}
            </span>
            <button type="button" className="chip selected" onClick={() => setLearningProgressOpen((current) => !current)}>
              {learningProgressOpen ? "접기" : "펼치기"}
            </button>
          </div>
        </div>
        {learningProgressOpen && learningAssetsProgress ? (
          <>
            <div className="grid" style={{ marginTop: 14, gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div className="mini-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>패턴 자동화율</strong>
                  <MetricHelpButton
                    label="패턴 자동화율"
                    description="현재 활성 표현과 연결된 패턴 중, 학습 상태가 AUTOMATED인 패턴의 비율입니다."
                  />
                </div>
                <div className="kpi" style={{ marginTop: 8 }}>{learningAssetsProgress.overall.patternAutomationRate}%</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  자동화된 패턴 {learningAssetsProgress.overall.automatedPatternCount} / 활성 패턴 {learningAssetsProgress.overall.patternTemplateCount}
                </div>
              </div>
              <div className="mini-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>패턴 수집률</strong>
                  <MetricHelpButton
                    label="패턴 수집률"
                    description="현재 활성 표현이 패턴 템플릿과 얼마나 연결되어 있는지를 보여주는 비율입니다. 삭제된 표현은 수집율에 포함되지 않습니다."
                  />
                </div>
                <div className="kpi" style={{ marginTop: 8 }}>{learningAssetsProgress.overall.patternCollectionRate}%</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  활성 표현 기준 {learningAssetsProgress.overall.collectedPatternCount} / {learningAssetsProgress.overall.patternTemplateCount}
                </div>
              </div>
              <div className="mini-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>단어 사용 가능률</strong>
                  <MetricHelpButton
                    label="단어 사용 가능률"
                    description="현재 활성 표현이 단어 자산과 얼마나 연결되어 있고, 그중 말하기에 사용할 수 있는 상태인지 보여줍니다."
                  />
                </div>
                <div className="kpi" style={{ marginTop: 8 }}>{learningAssetsProgress.overall.vocabularyUsableRate}%</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  {learningAssetsProgress.overall.usableVocabularyCount} / {learningAssetsProgress.overall.vocabularyItemCount}
                </div>
              </div>
              <div className="mini-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>1초 응답 통과율</strong>
                  <MetricHelpButton
                    label="1초 응답 통과율"
                    description="최근 성공 기록 중, 1초 안에 반응한 성공 비율입니다. 말하기 자동화 속도를 보는 보조 지표입니다."
                  />
                </div>
                <div className="kpi" style={{ marginTop: 8 }}>{learningAssetsProgress.overall.responseWithin1sRate}%</div>
                <div className="muted" style={{ marginTop: 6 }}>
                  최근 성공 기록 기준
                </div>
              </div>
            </div>
            <div className="grid" style={{ marginTop: 14, gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {learningAssetsProgress.levels.map((level) => (
                <div key={level.level} className="mini-card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div className="row" style={{ alignItems: "center", gap: 8 }}>
                      <strong>{level.level}</strong>
                      <MetricHelpButton
                        label={`${level.level} 진행률`}
                        description={`${level.level} 레벨의 패턴 자동화와 단어 사용 가능률을 합쳐 계산한 진행률입니다.`}
                      />
                    </div>
                    <span className="tag tag-muted">{level.progress}%</span>
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    패턴 자동화 {level.patternAutomatedCount}/{level.patternTargetCount} · 단어 사용 가능 {level.vocabularyUsableCount}/{level.vocabularyTargetCount}
                  </div>
                  <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${level.progress}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mini-card" style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong>가장 약한 유형</strong>
                <MetricHelpButton
                  label="가장 약한 유형"
                  description="활성 표현 기준으로 아직 덜 모였거나 덜 연결된 패턴/단어 카테고리를 보여줍니다."
                />
              </div>
              <div className="grid" style={{ marginTop: 12, gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                {learningAssetsProgress.weakestCategories.length === 0 && (
                  <div className="muted">아직 약점 데이터가 충분하지 않습니다.</div>
                )}
                {learningAssetsProgress.weakestCategories.map((item) => (
                  <div key={`${item.kind}-${item.code}`} className="mini-card">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{item.nameKo}</strong>
                      <span className="tag tag-muted">{item.kind === "pattern" ? "패턴" : "단어"}</span>
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      목표 {item.targetCount} · 확보 {item.collectedCount} · 자동화 {item.automatedCount}
                    </div>
                    <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${Math.max(0, 100 - Math.min(100, (item.gap / Math.max(1, item.targetCount)) * 100))}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : !learningProgressOpen ? null : (
          <div className="mini-card muted" style={{ marginTop: 14 }}>
            패턴 / 단어 진도를 불러오는 중입니다.
          </div>
        )}
      </section>

      <section ref={learningAssetsSectionRef} className="card panel-lg">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 className="h2" style={{ marginBottom: 0 }}>패턴 / 단어 DB 보기</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              DB에 저장된 패턴과 단어를 직접 보고, 어떤 내 표현이 연결됐는지 확인할 수 있습니다.
            </p>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="tag tag-muted">
              {learningAssetsCatalog
                ? `${learningAssetsCatalog.patternCategories.length}개 패턴 카테고리 · ${learningAssetsCatalog.vocabularyCategories.length}개 단어 카테고리`
                : "불러오는 중"}
            </span>
            <button
              type="button"
              className="chip selected"
              onClick={() => setAssetSectionOpen((current) => !current)}
            >
              {assetSectionOpen ? "접기" : "펼치기"}
            </button>
          </div>
        </div>
        {assetSectionOpen && learningAssetsCatalog ? (
          <>
            <section className="mini-card" style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>데이터 Export</strong>
                  <div className="muted" style={{ marginTop: 4 }}>
                    다른 앱이나 AI 워크플로우에서 다시 쓸 수 있도록 자산을 JSON 또는 CSV로 내려받습니다.
                  </div>
                </div>
                <button
                  type="button"
                  className="chip selected"
                  onClick={() => setExportSectionOpen((current) => !current)}
                >
                  {exportSectionOpen ? "접기" : "펼치기"}
                </button>
              </div>
              {exportSectionOpen && (
                <div className="grid" style={{ marginTop: 12, gap: 12 }}>
                  <div className="mini-card">
                    <strong>1. 한글표현 자산</strong>
                    <div className="muted" style={{ marginTop: 8 }}>
                      원문 문장, 맥락 메모, 화자, 시간축, 관계/상황/톤, 연결된 영어 표현 정보를 함께 내보냅니다.
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void handleDownloadAssetExport("korean", "json")}
                        disabled={!!loading}
                      >
                        {loading === "export-korean-json" ? "내보내는 중..." : "JSON 다운로드"}
                      </button>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => void handleDownloadAssetExport("korean", "csv")}
                        disabled={!!loading}
                      >
                        {loading === "export-korean-csv" ? "내보내는 중..." : "CSV 다운로드"}
                      </button>
                    </div>
                  </div>
                  <div className="mini-card">
                    <strong>2. 영어표현 자산</strong>
                    <div className="muted" style={{ marginTop: 8 }}>
                      기본형/쉬운형/자연형, 설명/메모, 원문 연결, TTS 키, 연습 이력 요약, 패턴/단어 매칭 정보를 함께 내보냅니다.
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => void handleDownloadAssetExport("english", "json")}
                        disabled={!!loading}
                      >
                        {loading === "export-english-json" ? "내보내는 중..." : "JSON 다운로드"}
                      </button>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={() => void handleDownloadAssetExport("english", "csv")}
                        disabled={!!loading}
                      >
                        {loading === "export-english-csv" ? "내보내는 중..." : "CSV 다운로드"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
            <section ref={patternAssetsSectionRef} className="mini-card" style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>
                  패턴 자산
                  <span className="muted" style={{ marginLeft: 8 }}>
                    {learningAssetsCatalog.patternCategories.reduce((sum, category) => sum + category.templates.length, 0)}개
                  </span>
                </strong>
                <button
                  type="button"
                  className="chip selected"
                  onClick={() => setPatternAssetOpen((current) => !current)}
                >
                  {patternAssetOpen ? "접기" : "펼치기"}
                </button>
              </div>
              {patternAssetOpen && (
                <div className="grid" style={{ marginTop: 12, gap: 12 }}>
                  <div className="mini-card">
                    <div className="muted" style={{ marginBottom: 8 }}>패턴 검색</div>
                    <input
                      className="input"
                      type="search"
                      value={patternAssetQuery}
                      onChange={(event) => setPatternAssetQuery(event.target.value)}
                      placeholder="패턴, 뜻, 예시, 매핑 표현으로 검색"
                    />
                    <div className="row" style={{ marginTop: 10, gap: 8 }}>
                      <button
                        type="button"
                        className={`chip ${patternAssetCoreOnly ? "selected" : ""}`}
                        onClick={() => setPatternAssetCoreOnly((current) => !current)}
                      >
                        {patternAssetCoreOnly ? "핵심표현만 보는 중" : "핵심표현만 보기"}
                      </button>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {patternAssetQuery.trim() || patternAssetCoreOnly
                        ? `${patternAssetCoreOnly ? "핵심표현 " : ""}검색 결과 ${filteredPatternCategories.reduce((sum, category) => sum + category.templates.length, 0)}개`
                        : "패턴 템플릿, 한국어 뜻, 예시 문장, 연결된 내 표현까지 함께 검색합니다."}
                    </div>
                  </div>
                  {filteredPatternCategories.length === 0 && (
                    <div className="mini-card muted">검색 결과가 없습니다.</div>
                  )}
                  {filteredPatternCategories.map((category) => (
                    <details key={category.id} className="mini-card" open={category.level === "A1"}>
                      <summary className="row" style={{ cursor: "pointer", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{category.level} {category.nameKo}</strong>
                          <div className="muted" style={{ marginTop: 4 }}>
                            {category.nameEn} · 목표 {category.targetCount}개 · {category.templates.length}개 템플릿 · 수집 {category.templates.filter((template) => template.collected).length}개 · 자동화 {category.templates.filter((template) => template.automated).length}개
                          </div>
                        </div>
                        <span className="tag tag-primary">{category.code}</span>
                      </summary>
                      <div className="grid" style={{ marginTop: 12 }}>
                        {category.templates.map((template) => (
                          <div key={template.id} className="mini-card">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                              <div className="row" style={{ alignItems: "center", gap: 8 }}>
                                <strong>{template.templateText}</strong>
                                {template.isCoreExpression && <span className="tag tag-core">핵심표현</span>}
                              </div>
                              <span className={`tag ${template.automated ? "tag-done" : template.collected ? "tag-primary" : "tag-muted"}`}>
                                {template.automated ? "자동화" : template.collected ? "수집됨" : "미수집"}
                              </span>
                            </div>
                            <div className="muted" style={{ marginTop: 8 }}>{template.meaningKo}</div>
                            {template.usageNote && <div className="muted" style={{ marginTop: 6 }}>{template.usageNote}</div>}
                            {template.exampleEn && (
                              <div style={{ marginTop: 8 }}>
                                <strong>예시</strong> {template.exampleEn}
                                {template.exampleKo ? <span className="muted"> / {template.exampleKo}</span> : null}
                              </div>
                            )}
                            <div className="muted" style={{ marginTop: 8 }}>
                              내 표현 {template.expressions.length}개 · 성공 {template.progress?.successCount ?? 0} · 1초 통과 {template.progress?.responseWithin1sCount ?? 0}
                            </div>
                            <div className="grid" style={{ marginTop: 10 }}>
                              {template.expressions.length === 0 ? (
                                <div className="muted">아직 매핑된 내 표현이 없습니다.</div>
                              ) : (
                                template.expressions.map((expression) => (
                                  <div key={expression.id} className="mini-card">
                                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                      <strong>{expression.englishBase}</strong>
                                      <span className="tag tag-muted">{expression.koreanText}</span>
                                    </div>
                                    {expression.englishNatural !== expression.englishBase && (
                                      <div className="muted" style={{ marginTop: 6 }}>
                                        자연형: {expression.englishNatural}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>

            <section ref={vocabularyAssetsSectionRef} className="mini-card" style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>
                  단어 자산
                  <span className="muted" style={{ marginLeft: 8 }}>
                    {learningAssetsCatalog.vocabularyCategories.reduce((sum, category) => sum + category.items.length, 0)}개
                  </span>
                </strong>
                <button
                  type="button"
                  className="chip selected"
                  onClick={() => setVocabularyAssetOpen((current) => !current)}
                >
                  {vocabularyAssetOpen ? "접기" : "펼치기"}
                </button>
              </div>
              {vocabularyAssetOpen && (
                <div className="grid" style={{ marginTop: 12, gap: 12 }}>
                  <div className="mini-card">
                    <div className="muted" style={{ marginBottom: 8 }}>단어 검색</div>
                    <input
                      className="input"
                      type="search"
                      value={vocabularyAssetQuery}
                      onChange={(event) => setVocabularyAssetQuery(event.target.value)}
                      placeholder="단어, 뜻, 예시, 매핑 표현으로 검색"
                    />
                    <div className="muted" style={{ marginTop: 8 }}>
                      {vocabularyAssetQuery.trim()
                        ? `검색 결과 ${filteredVocabularyCategories.reduce((sum, category) => sum + category.items.length, 0)}개`
                        : "lemma, 한국어 뜻, 예시 문장, 연결된 내 표현까지 함께 검색합니다."}
                    </div>
                  </div>
                  {filteredVocabularyCategories.length === 0 && (
                    <div className="mini-card muted">검색 결과가 없습니다.</div>
                  )}
                  {filteredVocabularyCategories.map((category) => (
                    <details key={category.id} className="mini-card" open={category.code === "daily_life"}>
                      <summary className="row" style={{ cursor: "pointer", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{category.nameKo}</strong>
                          <div className="muted" style={{ marginTop: 4 }}>
                            {category.nameEn} · {category.items.length}개 단어 · 수집 {category.items.filter((item) => item.collected).length}개 · 자동화 {category.items.filter((item) => item.automated).length}개
                          </div>
                        </div>
                        <span className="tag tag-muted">{category.code}</span>
                      </summary>
                      <div className="grid" style={{ marginTop: 12 }}>
                        {category.items.map((item) => (
                          <div key={item.id} className="mini-card">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                              <strong>{item.lemma}</strong>
                              <span className={`tag ${item.automated ? "tag-done" : item.collected ? "tag-primary" : "tag-muted"}`}>
                                {item.automated ? "자동화" : item.collected ? "수집됨" : "미수집"}
                              </span>
                            </div>
                            <div className="muted" style={{ marginTop: 8 }}>
                              {item.meaningKo} · {item.partOfSpeech}{item.frequencyRank ? ` · 순위 ${item.frequencyRank}` : ""}
                            </div>
                            {item.exampleEn && (
                              <div style={{ marginTop: 8 }}>
                                <strong>예시</strong> {item.exampleEn}
                                {item.exampleKo ? <span className="muted"> / {item.exampleKo}</span> : null}
                              </div>
                            )}
                            <div className="muted" style={{ marginTop: 8 }}>
                              내 표현 {item.expressions.length}개 · 성공 {item.progress?.successCount ?? 0} · 1초 통과 {item.progress?.responseWithin1sCount ?? 0}
                            </div>
                            <div className="grid" style={{ marginTop: 10 }}>
                              {item.expressions.length === 0 ? (
                                <div className="muted">아직 매핑된 내 표현이 없습니다.</div>
                              ) : (
                                item.expressions.map((expression) => (
                                  <div key={expression.id} className="mini-card">
                                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                      <strong>{expression.englishBase}</strong>
                                      <span className="tag tag-muted">{expression.koreanText}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>

            <div className="mini-card" style={{ marginTop: 14 }}>
              <strong>패턴 미매핑 내 표현</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                패턴 템플릿과 아직 연결되지 않은 내 표현입니다.
              </div>
              <div className="grid" style={{ marginTop: 12 }}>
                {learningAssetsCatalog.unmatchedPatternExpressions.length === 0 ? (
                  <div className="muted">패턴 미매핑 표현이 없습니다.</div>
                ) : (
                  learningAssetsCatalog.unmatchedPatternExpressions.map((expression) => (
                    <div key={expression.id} className="mini-card">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{expression.englishBase}</strong>
                        <span className="tag tag-failed">미매핑</span>
                      </div>
                      <div className="muted" style={{ marginTop: 8 }}>{expression.koreanText}</div>
                      {expression.englishNatural !== expression.englishBase && (
                        <div className="muted" style={{ marginTop: 6 }}>
                          자연형: {expression.englishNatural}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mini-card" style={{ marginTop: 14 }}>
              <strong>패턴 미매핑 내 표현이지만 단어는 잡힌 표현</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                패턴은 아직 못 찾았지만, 단어는 일부 연결된 표현입니다.
              </div>
              <div className="grid" style={{ marginTop: 12 }}>
                {learningAssetsCatalog.unmatchedPatternExpressions.filter(
                  (expression) => !learningAssetsCatalog.unmatchedVocabularyExpressions.some((item) => item.id === expression.id),
                ).length === 0 ? (
                  <div className="muted">해당 표현이 없습니다.</div>
                ) : (
                  learningAssetsCatalog.unmatchedPatternExpressions
                    .filter((expression) => !learningAssetsCatalog.unmatchedVocabularyExpressions.some((item) => item.id === expression.id))
                    .map((expression) => (
                      <div key={`partial-${expression.id}`} className="mini-card">
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <strong>{expression.englishBase}</strong>
                          <span className="tag tag-primary">단어만 매핑</span>
                        </div>
                        <div className="muted" style={{ marginTop: 8 }}>{expression.koreanText}</div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="mini-card muted" style={{ marginTop: 14 }}>
            DB 자산 목록을 불러오는 중입니다.
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <section ref={recordingsSectionRef} className="card panel-lg">
          {renderSectionIntro(
            "recordings",
            "1. 음성 데이터 수집 / 텍스트 정리",
            "파일 업로드 또는 브라우저 녹음으로 음성을 수집하고 텍스트로 정리합니다.",
            `저장된 녹음 ${recordings.length}개 · 현재 문장 ${recording?.utterances.length ?? 0}개`,
          )}
          {expandedSections.recordings && (
            <>
          <div className="row" style={{ marginTop: 14 }}>
            <input
              className="input file-input"
              type="file"
              accept=".wav,.m4a,.mp3,.mp4,.aac,audio/wav,audio/mp4,audio/mpeg,audio/aac"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (!file) {
                  setSelectedFile(null);
                  return;
                }

                try {
                  validateManualUploadFile(file);
                  setError("");
                  setSelectedFile(file);
                } catch (err) {
                  setSelectedFile(null);
                  setError(err instanceof Error ? err.message : "지원하지 않는 파일입니다.");
                  e.currentTarget.value = "";
                }
              }}
            />
            <button className="button ghost" onClick={handleRecordDemo} disabled={!!loading}>
              {loading === "record" && isMicRecording
                ? `녹음 중... ${formatRecordingSeconds(recordingElapsedMs)}`
                : `브라우저 녹음 (최대 ${Math.round(manualRecordingLimitMs / 60000)}분)`}
            </button>
            {loading === "record" && isMicRecording && (
              <button className="button secondary" onClick={handleStopRecording}>
                녹음 종료
              </button>
            )}
            <button className="button" onClick={handleUploadAndProcess} disabled={!selectedFile || !!loading}>
              {loading === "upload" ? "처리 중..." : "업로드 & 텍스트 변환"}
            </button>
            {(loading === "record" || loading === "upload") && (
              <button className="button danger" onClick={() => cancelActiveOperations(true)}>취소</button>
            )}
          </div>
          {loading === "record" && isMicRecording && (
            <div className="muted" style={{ marginTop: 10 }}>
              브라우저 녹음 시간: 경과 {formatRecordingSeconds(recordingElapsedMs)} · 남은 시간 {formatRecordingSeconds(recordingRemainingMs)}
            </div>
          )}
          <div className="muted" style={{ marginTop: 10 }}>
            선택 파일: {selectedFile ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : "없음"}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            브라우저 녹음은 현재 기기에서 최대 {Math.round(manualRecordingLimitMs / 60000)}분까지 지원합니다. 녹음 종료 시 1개 파일로 저장한 뒤 업로드와 텍스트 변환을 진행합니다.
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            수동 업로드는 WAV, M4A, MP3, MP4, AAC 형식을 지원하며 최대 {Math.round(MANUAL_UPLOAD_MAX_BYTES / 1024 / 1024)}MB까지 업로드할 수 있습니다.
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            현재 기기에서는 최대 약 {Math.round(manualRecordingLimitMs / 60000)}분까지 자동 종료됩니다. 사용자가 먼저 종료하면 지금까지 녹음한 내용을 1개 파일로 저장합니다.
          </div>
          {activeRecordingSessionId && (
            <div className="muted" style={{ marginTop: 8 }}>
              현재 세션: {activeRecordingSessionId} · 상태: {activeRecordingSessionStatus || "준비 중"}
            </div>
          )}
          {(manualRecordingStats.isActive || manualRecordingStats.chunkCount > 0 || failedManualChunks.length > 0) && (
            <div className="mini-card" style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>파일 처리 상태</strong>
                <span className={`tag ${activeRecordingSessionStatus === "FAILED" ? "tag-failed" : activeRecordingSessionStatus === "PROCESSED" ? "tag-done" : activeRecordingSessionStatus ? "tag-primary" : "tag-muted"}`}>
                  {manualSessionStatusLabel}
                </span>
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                이 카드는 수동 파일 업로드와 브라우저 녹음의 업로드/worker 처리 상태를 보여줍니다. 원클릭 학습 단계와는 별도입니다.
              </div>
              <div className="grid" style={{ marginTop: 12, gap: 10 }}>
                <div className="mini-card">
                  <strong>업로드된 파일</strong>
                  <div className="muted" style={{ marginTop: 6 }}>{manualRecordingStats.chunkCount}개</div>
                </div>
                <div className="mini-card">
                  <strong>처리 완료</strong>
                  <div className="muted" style={{ marginTop: 6 }}>{manualRecordingStats.successCount}개</div>
                </div>
                <div className="mini-card">
                  <strong>재업로드 필요</strong>
                  <div className="muted" style={{ marginTop: 6 }}>{manualRecordingStats.failedCount}개</div>
                </div>
              </div>
              <div className="muted" style={{ marginTop: 10 }}>
                세션 상태: {manualSessionStatusLabel} · 최근 처리 파일 번호는 #{manualRecordingStats.currentChunkIndex || "-"} 입니다.
              </div>
              {failedManualChunks.length > 0 && (
                <div className="grid" style={{ marginTop: 12 }}>
                  {failedManualChunks.map((chunk) => (
                    <div key={chunk.id} className="retry-inline-box">
                      <strong>분할 파일 {chunk.chunkIndex}</strong>
                      <div className="muted" style={{ marginTop: 6 }}>{chunk.reason}</div>
                      <button
                        className="button secondary"
                        style={{ marginTop: 10 }}
                        onClick={() => handleRetryManualChunk(chunk)}
                        disabled={!!loading}
                      >
                        {loading === `retry-manual-chunk-${chunk.id}` ? "재업로드 중..." : "다시 업로드"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="recording-layout" style={{ marginTop: 16 }}>
            <div className="recording-browser">
              <div className="recording-section-head">
                <div>
                  <div className="recording-section-eyebrow">Recording List</div>
                  <strong>이전 녹음 불러오기</strong>
                  <div className="muted" style={{ marginTop: 6 }}>
                    브라우저를 다시 열어도 저장된 텍스트 변환 결과를 이어서 작업할 수 있습니다.
                  </div>
                </div>
                <button className="button ghost" onClick={refreshRecordings} disabled={!!loading}>
                  새로고침
                </button>
              </div>
              <div className="grid" style={{ marginTop: 12 }}>
                {recordings.length === 0 && <div className="mini-card muted">아직 저장된 녹음이 없습니다.</div>}
                {visibleRecordings.map((item, index) => (
                  <div key={item.id} className="mini-card">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{index + 1}. {item.fileName}</strong>
                      <span className={`tag ${item.status === "PROCESSED" ? "tag-primary" : "tag-muted"}`}>{item.status}</span>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {recordingDateFormatter.format(new Date(item.createdAt))} · 문장 수 {item._count.utterances}개
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {item.diarization ? "화자 분리 사용" : "화자 분리 없음"}
                    </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button
                        className="button secondary"
                        onClick={() => handleLoadRecording(item.id)}
                        disabled={!!loading}
                      >
                        {loading === `load-recording-${item.id}` ? "불러오는 중..." : "불러오기"}
                      </button>
                      <Link className="button ghost" href={`/recordings/${item.id}`}>
                        상세 페이지
                      </Link>
                      {(item.status === "UPLOADED" || item.status === "PROCESSING") && (
                        <button
                          className="button ghost"
                          onClick={() => handleReprocessRecording(item.id)}
                          disabled={!!loading}
                        >
                          {loading === `reprocess-recording-${item.id}` ? "변환 실행 중..." : "텍스트 변환 다시 실행"}
                        </button>
                      )}
                      <button
                        className="button danger"
                        onClick={() => handleDeleteRecording(item.id)}
                        disabled={!!loading}
                      >
                        {loading === `delete-recording-${item.id}` ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {renderListControls("recordings", recordings.length)}
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
            <div ref={recordingDetailRef} className="recording-detail-panel" tabIndex={-1} data-section-id="recordingDetail">
              <div className="recording-section-head">
                <div>
                  <div className="recording-section-eyebrow">Selected Recording</div>
                  <strong>선택한 녹음 상세</strong>
                </div>
                <span className="tag tag-primary">불러옴</span>
              </div>
              <div className="grid" style={{ marginTop: 18 }}>
              <div className="mini-card">
                <strong>처리 결과</strong>
                <div className="muted" style={{ marginTop: 8 }}>
                  상태: {recording.status} · 문장 수: {recording.utterances.length}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  원본 파일: {recording.fileName}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  현재 내 화자: {speakerOptions.find((item) => item.isMine)?.speakerLabel ?? "선택되지 않음"}
                </div>
                {(recording.status === "PROCESSING" || recording.status === "UPLOADED") && (
                  <div className="muted" style={{ marginTop: 8 }}>
                    아직 활용 가능한 텍스트 변환 결과가 없습니다. 아래 버튼으로 다시 실행할 수 있습니다.
                  </div>
                )}
                <div className="row" style={{ marginTop: 12 }}>
                  {(recording.status === "PROCESSING" || recording.status === "UPLOADED") && (
                    <button
                      className="button ghost"
                      onClick={() => handleReprocessRecording(recording.id)}
                      disabled={!!loading}
                    >
                      {loading === `reprocess-recording-${recording.id}` ? "변환 실행 중..." : "텍스트 변환 다시 실행"}
                    </button>
                  )}
                  <button
                    className="button danger"
                    onClick={() => handleDeleteRecording(recording.id)}
                    disabled={!!loading}
                  >
                    {loading === `delete-recording-${recording.id}` ? "삭제 중..." : "현재 녹음 삭제"}
                  </button>
                </div>
              </div>
              <div className="mini-card">
                <strong>대화 맥락 힌트</strong>
                <div className="muted" style={{ marginTop: 8 }}>
                  관계, 상황, 원하는 톤을 적어두면 표현 생성이 대화 맥락을 더 잘 반영합니다.
                </div>
                <div className="grid" style={{ marginTop: 12 }}>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>관련 인물 선택</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {personProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className={`chip ${recordingParticipantDraftIds.includes(profile.id) ? "selected" : ""}`}
                          onClick={() => toggleRecordingParticipant(profile.id)}
                          disabled={!!loading}
                        >
                          {profile.name}{profile.roleLabel ? ` (${profile.roleLabel})` : ""}
                        </button>
                      ))}
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      관련 인물을 선택해 두면 이름만 상황 설명에 적어도 관계 정보를 함께 참고합니다.
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <button
                      className="button ghost"
                      onClick={() => setRecordingContextDraft(recentManualContext)}
                      disabled={
                        !!loading ||
                        (!recentManualContext.relationship && !recentManualContext.situation && !recentManualContext.tone)
                      }
                    >
                      최근 맥락 다시 사용
                    </button>
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>관계 템플릿</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {RELATIONSHIP_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${recordingContextDraft.relationship === item ? "selected" : ""}`}
                          onClick={() => updateRecordingContextField("relationship", item)}
                          disabled={!!loading}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      style={{ marginTop: 10 }}
                      value={recordingContextDraft.relationship}
                      onChange={(event) => updateRecordingContextField("relationship", event.target.value)}
                      placeholder="예: 엄마 - 아이"
                    />
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>상황 템플릿</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {SITUATION_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${recordingContextDraft.situation === item ? "selected" : ""}`}
                          onClick={() => updateRecordingContextField("situation", item)}
                          disabled={!!loading}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="input"
                      style={{ marginTop: 10, minHeight: 96, resize: "vertical" }}
                      value={recordingContextDraft.situation}
                      onChange={(event) => updateRecordingContextField("situation", event.target.value)}
                      placeholder="예: 아이가 혼자 집에 있겠다고 하고, 엄마가 위험해서 안 된다고 설명하는 상황"
                    />
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>톤 템플릿</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      {TONE_TEMPLATES.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`chip ${recordingContextDraft.tone === item ? "selected" : ""}`}
                          onClick={() => updateRecordingContextField("tone", item)}
                          disabled={!!loading}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      style={{ marginTop: 10 }}
                      value={recordingContextDraft.tone}
                      onChange={(event) => updateRecordingContextField("tone", event.target.value)}
                      placeholder="예: 자연스럽고 부드럽지만 단호한 미국식 일상 회화"
                    />
                  </div>
                </div>
                <div className="mini-card" style={{ marginTop: 12 }}>
                  <strong>분석 상태</strong>
                  <div className="muted" style={{ marginTop: 8 }}>
                    {hasUnsavedContextChanges
                      ? "맥락 힌트에 저장되지 않은 변경사항이 있습니다."
                      : analysisStatus === "NEEDS_REVIEW"
                      ? "사람 확인 기준으로 대화 분석 재검토가 필요한 상태입니다."
                      : hasAnyAnalysis
                      ? "현재 보이는 대화 요약과 문장의도는 최신 분석입니다."
                      : "아직 대화 요약/의도 분석을 실행하지 않았습니다."}
                  </div>
                  {recording?.analysisStatusReason && analysisStatus === "NEEDS_REVIEW" && (
                    <div className="muted" style={{ marginTop: 8 }}>
                      변경 사유: {formatAnalysisStatusReason(recording.analysisStatusReason)}
                    </div>
                  )}
                  {analysisStatus === "NEEDS_REVIEW" && (
                    <div className="row" style={{ marginTop: 10 }}>
                      <button
                        className="button ghost"
                        onClick={() => {
                          void persistRecordingAnalysisStatus("OK")
                            .then(() => setMessage("분석 상태를 이상없음으로 표시했습니다."))
                            .catch((err) =>
                              setError(err instanceof Error ? err.message : "분석 상태 저장에 실패했습니다."),
                            );
                        }}
                        disabled={!!loading}
                      >
                        이상없음으로 표시
                      </button>
                    </div>
                  )}
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
                    {loading === "analyze-recording" ? "분석 중..." : "대화 요약/의도 분석"}
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
              <div className="mini-card">
                <strong>대화 요약</strong>
                <div style={{ marginTop: 10, lineHeight: 1.6 }}>{visibleRecordingSummary || "아직 분석된 대화 요약이 없습니다."}</div>
                <div className="muted" style={{ marginTop: 10 }}>
                  아래 각 발화 카드에서 문장별 intent도 함께 확인할 수 있습니다.
                </div>
              </div>
              {recording.diarization && speakerOptions.length > 0 && (
                <div className="mini-card">
                  <strong>내 화자 선택</strong>
                  <div className="muted" style={{ marginTop: 8 }}>
                    화자 분리가 완벽하지 않을 수 있으니, 아래에서 내 목소리 화자를 직접 선택해 주세요.
                  </div>
                  <div className="row" style={{ marginTop: 12 }}>
                    {speakerOptions.map((speaker) => (
                      <button
                        key={speaker.speakerLabel}
                        className={`chip ${speaker.isMine ? "selected" : ""}`}
                        onClick={() => handleSelectMineSpeaker(recording.id, speaker.speakerLabel)}
                        disabled={!!loading}
                      >
                        {loading === `mine-speaker-${recording.id}-${speaker.speakerLabel}`
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
                        onClick={() => openSpeakerRenameDialog(speaker.speakerLabel)}
                        disabled={!!loading}
                      >
                        {speaker.speakerLabel} 이름 변경
                      </button>
                    ))}
                  </div>
                  <div className="grid" style={{ marginTop: 12 }}>
                    {speakerOptions.map((speaker) => (
                      <div key={`${speaker.speakerLabel}-profile`} className="mini-card">
                        <strong>{speaker.speakerLabel} 인물 연결</strong>
                        <select
                          className="input"
                          style={{ marginTop: 10 }}
                          value={speakerProfileDrafts[speaker.speakerLabel] ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setSpeakerProfileDrafts((current) => ({ ...current, [speaker.speakerLabel]: nextValue }));
                            void handleUpdateSpeakerProfile(recording.id, speaker.speakerLabel, nextValue);
                          }}
                          disabled={!!loading}
                        >
                          <option value="">직접 연결 안 함</option>
                          {personProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name}{profile.roleLabel ? ` (${profile.roleLabel})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {activeSpeakerRenameLabel && (
                    <div className="modal-backdrop" onClick={closeSpeakerRenameDialog}>
                      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                        <strong>{activeSpeakerRenameLabel} 이름 변경</strong>
                        <div className="muted" style={{ marginTop: 8 }}>
                          예: 나, 엄마, 아이, 남편
                        </div>
                        <input
                          className="input"
                          style={{ marginTop: 12 }}
                          value={speakerLabelDrafts[activeSpeakerRenameLabel] ?? activeSpeakerRenameLabel}
                          onChange={(event) =>
                            setSpeakerLabelDrafts((current) => ({
                              ...current,
                              [activeSpeakerRenameLabel]: event.target.value,
                            }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleUpdateSpeakerLabel(recording.id, activeSpeakerRenameLabel);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              closeSpeakerRenameDialog();
                            }
                          }}
                          placeholder="예: 나, 엄마, 아이, 남편"
                          disabled={!!loading}
                          autoFocus
                        />
                        <div className="modal-actions">
                          <button className="button ghost" onClick={closeSpeakerRenameDialog} disabled={!!loading}>
                            취소
                          </button>
                          <button
                            className="button"
                            onClick={() => handleUpdateSpeakerLabel(recording.id, activeSpeakerRenameLabel)}
                            disabled={
                              !!loading ||
                              !(speakerLabelDrafts[activeSpeakerRenameLabel] ?? "").trim() ||
                              speakerLabelDrafts[activeSpeakerRenameLabel]?.trim() === activeSpeakerRenameLabel
                            }
                          >
                            {loading === `speaker-label-${recording.id}-${activeSpeakerRenameLabel}` ? "저장 중..." : "이름 저장"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {recording.audioUrl && (
                <div className="mini-card">
                  <strong>업로드한 원본 음성 듣기</strong>
                  <div className="muted" style={{ marginTop: 8 }}>
                    텍스트 변환에 사용한 원본 파일을 바로 재생해서 결과와 비교할 수 있습니다.
                  </div>
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
              {visibleUtterances.map((utterance, index) => (
                <div key={utterance.id} className="utterance-card">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{index + 1}. {utterance.speakerLabel}</strong>
                      <span className="muted" style={{ marginLeft: 8 }}>
                        {formatUtteranceTime(utterance.startMs)} - {formatUtteranceTime(utterance.endMs)}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`tag ${utteranceExpressionIds.has(utterance.id) ? "tag-done" : "tag-muted"}`}>
                        {utteranceExpressionIds.has(utterance.id) ? "표현 생성 완료" : "표현 미생성"}
                      </span>
                      <span className={`tag ${utterance.isMine ? "tag-primary" : "tag-muted"}`}>{utterance.isMine ? "내 화자" : "기타 화자"}</span>
                    </div>
                  </div>
                  <textarea
                    className="input"
                    style={{ marginTop: 10, minHeight: 96, resize: "vertical" }}
                    value={utteranceDrafts[utterance.id] ?? ""}
                    onChange={(event) =>
                      setUtteranceDrafts((current) => ({ ...current, [utterance.id]: event.target.value }))
                    }
                    placeholder="STT 결과를 확인하고 필요하면 수정해 주세요."
                    disabled={!!loading}
                  />
                  <div style={{ marginTop: 10 }}>
                    <label className="muted" style={{ display: "block", marginBottom: 6 }}>이 발화의 화자</label>
                    <select
                      className="input"
                      value={utteranceSpeakerDrafts[utterance.id] ?? utterance.speakerLabel}
                      onChange={(event) =>
                        setUtteranceSpeakerDrafts((current) => ({ ...current, [utterance.id]: event.target.value }))
                      }
                      disabled={!!loading}
                    >
                      {speakerOptions.map((speaker) => (
                        <option key={`${utterance.id}-${speaker.speakerLabel}`} value={speaker.speakerLabel}>
                          {speaker.speakerLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="textarea"
                    style={{ marginTop: 10, minHeight: 88, resize: "vertical" }}
                    value={utteranceContextDrafts[utterance.id] ?? ""}
                    onChange={(event) =>
                      setUtteranceContextDrafts((current) => ({ ...current, [utterance.id]: event.target.value }))
                    }
                    placeholder="예: '일원독서실'의 일원은 지역명이 아니라 독서실 이름. '뭐가 그렇게 맛있어?'는 맛있게 먹는 모습을 보고 감탄하는 말."
                    disabled={!!loading}
                  />
                  <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 10 }}>
                    <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={utteranceAnalysisReviewFlags[utterance.id] ?? DEFAULT_UTTERANCE_ANALYSIS_REVIEW_FLAG}
                        onChange={(event) =>
                          setUtteranceAnalysisReviewFlags((current) => ({
                            ...current,
                            [utterance.id]: event.target.checked,
                          }))
                        }
                        disabled={!!loading}
                      />
                      이 수정은 의미에 영향 있음
                    </label>
                    <button
                      type="button"
                      className="help-icon-button"
                      title="오타, 띄어쓰기 같은 가벼운 수정이면 체크를 해제하세요."
                      aria-label="체크박스 도움말"
                      disabled={!!loading}
                    >
                      ?
                    </button>
                  </div>
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
                      disabled={
                        !!loading ||
                        (
                          !(utteranceDrafts[utterance.id]?.trim()) &&
                          (utteranceSpeakerDrafts[utterance.id] ?? utterance.speakerLabel) === utterance.speakerLabel
                        )
                      }
                      onClick={() => handleSaveUtterance(utterance.id)}
                    >
                      {loading === `save-${utterance.id}` ? "저장 중..." : "문장 저장"}
                    </button>
                    <button
                      className="button ghost"
                      disabled={!!loading}
                      onClick={() => handleSaveUtteranceContextNote(utterance.id)}
                    >
                      {loading === `save-context-${utterance.id}` ? "메모 저장 중..." : "맥락 메모 저장"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={!!loading || !(utteranceDrafts[utterance.id]?.trim())}
                      onClick={() => handleGenerateFromUtterance(utterance.id)}
                    >
                      {loading === `expr-${utterance.id}` ? "생성 중..." : "저장 후 표현 생성"}
                    </button>
                    <button
                      className="button danger"
                      disabled={!!loading}
                      onClick={() => handleDeleteUtterance(utterance.id)}
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
            </div>
          )}
          </div>
            </>
          )}
        </section>

        <section ref={expressionsSectionRef} className="card panel-lg">
          {renderSectionIntro(
            "expressions",
            "2. 영어 표현 생성 / 영어 음성 생성",
            "생성된 표현을 선택하고 영어 음성을 만들어 듣고 활용합니다.",
            expressionBrowserScope === "all"
              ? `전체 표현 ${filteredExpressions.length}개 · TTS 완료 ${completedTtsExpressions.length}개`
              : `표현 ${filteredExpressions.length}개 · TTS 완료 ${completedSectionTtsExpressions.length}개`,
          )}
          {expandedSections.expressions && (
            <>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className={`button ${expressionBrowserScope === "recording" ? "" : "secondary"}`}
              onClick={() => setExpressionBrowserScope("recording")}
              disabled={!!loading || !recording}
            >
              현재 녹음 표현
            </button>
            <button
              className={`button ${expressionBrowserScope === "all" ? "" : "secondary"}`}
              onClick={() => setExpressionBrowserScope("all")}
              disabled={!!loading}
            >
              전체 표현 라이브러리
            </button>
            <button className="button secondary" onClick={handleGenerateTtsBulk} disabled={!!loading || !recording || pendingSectionTtsCount === 0}>
              {loading === "tts-bulk" ? "일괄 생성 중..." : `남은 TTS 일괄 생성 (${pendingSectionTtsCount})`}
            </button>
          </div>
          <div className="mini-card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{expressionBrowserScope === "all" ? "전체 표현 탐색" : "현재 녹음 표현 탐색"}</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  {expressionBrowserScope === "all"
                    ? `모든 표현 ${expressions.length}개 중 ${filteredExpressions.length}개가 검색 결과에 표시됩니다.`
                    : `현재 녹음 표현 ${sectionExpressions.length}개 중 ${filteredExpressions.length}개가 검색 결과에 표시됩니다.`}
                </div>
              </div>
              <input
                className="input"
                type="search"
                value={expressionQuery}
                onChange={(event) => setExpressionQuery(event.target.value)}
                placeholder="한국어, 영어, 메모, 상황, 녹음 파일명으로 검색"
                style={{ minWidth: 280, flex: "1 1 320px" }}
              />
            </div>
          </div>
          {!isReviewAnswerHidden && (
            <div className="expression-layout" style={{ marginTop: 14 }}>
              <div className="expression-browser">
                <div className="expression-section-head">
                  <div>
                    <div className="expression-section-eyebrow">Expression List</div>
                    <strong>{expressionBrowserScope === "all" ? "전체 표현 목록" : "생성된 표현"}</strong>
                  </div>
                  <span className="tag tag-muted">{filteredExpressions.length}개</span>
                </div>
                <div className="grid" style={{ marginTop: 12 }}>
                  {filteredExpressions.length === 0 && (
                    <div className="mini-card muted">
                      {expressionBrowserScope === "all"
                        ? "검색 조건에 맞는 표현이 없습니다."
                        : recording
                        ? "이 녹음에서 아직 생성된 표현이 없습니다."
                        : "빠른 저장 문장에서 아직 생성된 표현이 없습니다."}
                    </div>
                  )}
                  {visibleExpressions.map((expression, index) => (
                    <button
                      key={expression.id}
                      className={`expression-item ${selectedExpressionId === expression.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedExpressionId(expression.id);
                        setPracticePromptReadyAtMs(Date.now());
                        setPracticeResponseStartedAtMs(null);
                        setScore(null);
                        focusSelectedExpressionDetail();
                      }}
                    >
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div className="muted" style={{ fontSize: 12 }}>{expression.koreanText}</div>
                        <span className={`tag ${expression.ttsKey ? "tag-done" : "tag-muted"}`}>
                          {expression.ttsKey ? "TTS 완료" : "TTS 미생성"}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, marginTop: 6 }}>{index + 1}. {expression.englishBase}</div>
                      <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                        <span className={`tag ${expression.utteranceId ? "tag-primary" : "tag-muted"}`}>
                          {expression.utteranceId ? "녹음 문장" : "빠른 저장"}
                        </span>
                        {expression.utterance?.recording?.fileName && (
                          <span className="tag tag-muted">{expression.utterance.recording.fileName}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {renderListControls("expressions", filteredExpressions.length)}
              </div>

              {selectedBrowserExpression && (
                <div ref={expressionDetailRef} className="expression-detail-panel" tabIndex={-1}>
                  <div className="expression-section-head">
                    <div>
                      <div className="expression-section-eyebrow">Selected Detail</div>
                      <strong>선택한 표현 상세</strong>
                    </div>
                    <span className="tag tag-primary">선택됨</span>
                  </div>
                  <div className="grid" style={{ marginTop: 12 }}>
                    <div className="mini-card">
                      <strong>기본형</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpression.englishBase}</div>
                    </div>
                    <div className="mini-card">
                      <strong>쉬운형</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpression.englishEasy}</div>
                    </div>
                    <div className="mini-card">
                      <strong>자연형</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpression.englishNatural}</div>
                    </div>
                    <div className="mini-card">
                      <strong>설명</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpression.note || "설명 없음"}</div>
                    </div>
                    <div className="mini-card">
                      <strong>메모</strong>
                      <textarea
                        className="textarea"
                        style={{ marginTop: 8, minHeight: 96 }}
                        value={expressionMemoDraft}
                        onChange={(event) => setExpressionMemoDraft(event.target.value)}
                        placeholder="예: 이 표현은 아이를 타이르듯 말할 때 자주 씀"
                      />
                      <div className="row" style={{ marginTop: 10 }}>
                        <button className="button secondary" onClick={handleSaveExpressionMemo} disabled={!!loading || !selectedBrowserExpression}>
                          {loading === "save-expression-memo" ? "메모 저장 중..." : "메모 저장"}
                        </button>
                      </div>
                    </div>
                    <div className="mini-card">
                      <strong>대화 요약</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpression.sourceAnalysisSummary || "아직 분석된 대화 요약이 없습니다."}</div>
                    </div>
                    <div className="mini-card">
                      <strong>발화 의도</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpressionIntent || "아직 분석된 발화 의도가 없습니다."}</div>
                    </div>
                    <div className="mini-card">
                      <strong>문장별 맥락 메모</strong>
                      <div style={{ marginTop: 8 }}>{selectedBrowserExpression.sourceContextNote || "저장된 문장별 맥락 메모가 없습니다."}</div>
                    </div>
                    <div className="mini-card">
                      <strong>출처</strong>
                      <div style={{ marginTop: 8 }}>
                        {selectedBrowserExpression.utterance?.recording?.fileName
                          ? selectedBrowserExpression.utterance.recording.fileName
                          : selectedBrowserExpression.utteranceId
                          ? "연결된 녹음 문장"
                          : "빠른 저장 문장"}
                      </div>
                    </div>
                    <div className="row">
                      <button className="button" onClick={handleGenerateTts} disabled={!!loading}>
                        {loading === "tts"
                          ? (selectedBrowserExpression?.ttsKey ? "TTS 재생성 중..." : "TTS 생성 중...")
                          : (selectedBrowserExpression?.ttsKey ? "TTS 재생성" : "TTS 생성")}
                      </button>
                      <button
                        className="button ghost"
                        onClick={handleCopyExpression}
                        disabled={!!loading || !selectedBrowserExpression}
                      >
                        영어 표현 복사
                      </button>
                      <button
                        className="button ghost"
                        onClick={() => void playSelectedExpressionTtsSequence()}
                        disabled={!ttsUrl}
                      >
                        TTS 재생
                      </button>
                      {selectedBrowserExpression.utterance?.recording?.id && (
                        <Link className="button ghost" href={`/recordings/${selectedBrowserExpression.utterance.recording.id}`}>
                          원본 녹음 보기
                        </Link>
                      )}
                      <button
                        className="button danger"
                        onClick={handleDeleteExpression}
                        disabled={!!loading || !selectedBrowserExpression}
                      >
                        {loading === "delete-expression" ? "삭제 중..." : "표현 삭제"}
                      </button>
                    </div>
                    <audio ref={audioRef} controls className="audio-player" src={ttsUrl || undefined} />
                    {ttsUrl && (
                      <div className="muted">TTS URL: <span className="code">{ttsUrl}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {isReviewAnswerHidden && (
            <div className="mini-card muted" style={{ marginTop: 14 }}>
              복습 테스트 중에는 표현 목록도 숨겨집니다. 채점 후에 다시 확인할 수 있습니다.
            </div>
          )}

          {selectedExpression && isReviewAnswerHidden && (
            <div className="mini-card" style={{ marginTop: 16 }}>
              <strong>정답 숨김 모드</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                복습 테스트를 시작했기 때문에 채점 전까지 표현, 설명, TTS를 숨겼습니다.
              </div>
            </div>
          )}
            </>
          )}
        </section>
      </div>

      <div className="dashboard-grid">
        <section ref={testSectionRef} className={`card panel-lg ${flowStepId === "complete" ? "section-highlight" : ""}`}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              {renderSectionIntro(
                "practice",
                "3. 연습 / 복습 플레이어",
                "문제 하나에 집중해 풀고, 원하면 오늘의 복습을 같은 자리에서 한 건씩 또는 연속으로 이어서 진행합니다.",
                `${practiceFocusLabel} · 선택 표현 ${selectedExpression ? 1 : 0}개 · 복습 대상 ${reviews.length}개`,
              )}
            </div>
            {flowStepId === "complete" && <span className="badge" style={{ background: "#dbeafe" }}>자동 이동 완료</span>}
          </div>
          {expandedSections.practice && (
          <div className="grid" style={{ marginTop: 14 }}>
            <div className="practice-hero-card">
              <div className="practice-hero-top">
                <div>
                  <div className="practice-eyebrow">Practice Flow</div>
                  <strong style={{ fontSize: 20 }}>한 문제 집중형 플레이어</strong>
                  <div className="muted" style={{ marginTop: 8 }}>
                    선택한 표현을 바로 연습하거나, 오늘의 복습을 같은 화면에서 이어서 풀 수 있습니다.
                  </div>
                </div>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <span className="badge" style={{ background: "#dbeafe", color: "#1d4ed8" }}>{practiceFocusLabel}</span>
                  {activeReviewItem && (
                    <span className="badge" style={{ background: "#e0f2fe", color: "#0f172a" }}>
                      진행 {activeReviewIndex + 1}/{reviews.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="practice-mode-row">
                <button
                  type="button"
                  className={`chip ${practiceFlowMode === "single" ? "selected" : ""}`}
                  onClick={switchToSinglePracticeMode}
                  disabled={!!loading}
                >
                  단일 연습
                </button>
                <button
                  type="button"
                  className={`chip ${practiceFlowMode === "review_once" ? "selected" : ""}`}
                  onClick={() => void handleStartReviewFlow("review_once")}
                  disabled={!!loading || reviews.length === 0}
                >
                  복습 1건
                </button>
                <button
                  type="button"
                  className={`chip ${practiceFlowMode === "review_series" ? "selected" : ""}`}
                  onClick={() => void handleStartReviewFlow("review_series")}
                  disabled={!!loading || reviews.length === 0}
                >
                  연속 복습
                </button>
                <button
                  type="button"
                  className={`chip ${reviewAutoAdvance ? "selected" : ""}`}
                  onClick={() => setReviewAutoAdvanceEnabled(!reviewAutoAdvance)}
                  disabled={!!loading}
                >
                  자동 이동 {reviewAutoAdvance ? "켜짐" : "꺼짐"}
                </button>
                <button
                  type="button"
                  className={`chip ${reviewReadQuestion ? "selected" : ""}`}
                  onClick={() => setReviewReadQuestion((current) => !current)}
                  disabled={!!loading}
                >
                  문제 읽기 {reviewReadQuestion ? "켜짐" : "꺼짐"}
                </button>
              </div>

              <div className="practice-queue-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <strong>오늘의 복습 큐</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      카드를 눌러 바로 같은 플레이어에서 풉니다. 연속 복습 모드를 켜면 채점 후 자동으로 다음 카드로 이어집니다.
                    </div>
                  </div>
                  <span className="tag tag-muted">{reviews.length}개</span>
                </div>
                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  {REVIEW_STRATEGY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`chip ${reviewStrategy === option.value ? "selected" : ""}`}
                      onClick={() => setReviewStrategy(option.value)}
                      disabled={!!loading}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  {REVIEW_STRATEGY_OPTIONS.find((option) => option.value === reviewStrategy)?.description}
                </div>
                {reviews.length === 0 ? (
                  <div className="mini-card muted" style={{ marginTop: 12 }}>복습 항목이 없습니다.</div>
                ) : (
                  <div className="practice-queue-strip" style={{ marginTop: 14 }}>
                    {visibleReviews.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`practice-queue-item ${activeReviewExpressionId === item.id ? "selected" : ""}`}
                        onClick={() => void handleStartReviewPractice(item, item.recommendedTestType ?? "translation", { autoAdvance: false })}
                        disabled={!!loading}
                      >
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <strong>복습 {index + 1}</strong>
                          <span className="tag tag-muted">{item.mastery}%</span>
                        </div>
                        <div style={{ marginTop: 10, fontWeight: 700 }}>{item.korean}</div>
                        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                          {item.recommendedTestType === "situation" ? "추천: 상황형" : "추천: 번역형"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="practice-queue-controls">
                  {renderListControls("reviews", reviews.length)}
                </div>
              </div>
            </div>

            <div className="practice-player-shell">
              <div ref={practiceMainCardRef} className="practice-main-card" tabIndex={-1}>
                <div className="practice-main-head">
                  <div>
                    <div className="practice-eyebrow">Current Card</div>
                    <strong style={{ fontSize: 20 }}>
                      {activeReviewItem ? "복습 카드 풀이" : "표현 연습"}
                    </strong>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="tag tag-primary">
                      {practicePrompt?.testType === "situation" ? "상황형" : practicePrompt?.testType === "pattern" ? "패턴형" : "번역형"}
                    </span>
                    <span className="tag tag-muted">{testMode === "voice" ? "음성 답변" : "텍스트 답변"}</span>
                  </div>
                </div>

                <div className="practice-question-card">
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <button
                      className={`button ${practiceTestType === "translation" ? "" : "ghost"}`}
                      onClick={() => handleGeneratePracticePrompt("translation")}
                      disabled={!!loading || !selectedExpression}
                    >
                      번역형
                    </button>
                    <button
                      className={`button ${practiceTestType === "situation" ? "" : "ghost"}`}
                      onClick={() => handleGeneratePracticePrompt("situation")}
                      disabled={!!loading || !selectedExpression}
                    >
                      {loading === "practice-prompt" ? "생성 중..." : "상황형"}
                    </button>
                    <button
                      className={`button ${practiceTestType === "pattern" ? "" : "ghost"}`}
                      onClick={() => handleGeneratePracticePrompt("pattern")}
                      disabled={!!loading || !selectedExpression}
                    >
                      {loading === "practice-prompt" ? "생성 중..." : "패턴형"}
                    </button>
                  </div>
                  <div className="practice-question-title">
                    {practicePrompt?.promptKorean ?? selectedExpression?.koreanText ?? "표현을 먼저 선택하세요."}
                  </div>
                  {practicePrompt?.promptContext && (
                    <div className="muted" style={{ marginTop: 10 }}>{practicePrompt.promptContext}</div>
                  )}
                  {practicePrompt?.testType === "pattern" && practicePrompt?.patternLabel && (
                    <div className="muted" style={{ marginTop: 8 }}>패턴: {practicePrompt.patternLabel}</div>
                  )}
                  {practicePrompt?.testType === "pattern" && practicePrompt?.patternDescription && (
                    <div className="muted" style={{ marginTop: 8 }}>{practicePrompt.patternDescription}</div>
                  )}
                  {practicePrompt?.tips && (
                    <div className="muted" style={{ marginTop: 8 }}>힌트: {practicePrompt.tips}</div>
                  )}
                  <div className="muted" style={{ marginTop: 10 }}>답변은 문제 제시 후 3초 안에 시작해야 통과합니다.</div>
                </div>

                <div className="practice-answer-card">
                  <div className="row">
                    <button
                      className={`button ${testMode === "text" ? "" : "ghost"}`}
                      onClick={() => {
                        clearPracticeAutoStartCountdown();
                        setTestMode("text");
                      }}
                      disabled={!!loading}
                    >
                      텍스트 답변
                    </button>
                    <button
                      className={`button ${testMode === "voice" ? "" : "ghost"}`}
                      onClick={() => setTestMode("voice")}
                      disabled={!!loading}
                    >
                      음성 답변
                    </button>
                  </div>

                  {testMode === "text" ? (
                    <>
                      <textarea
                        ref={answerRef}
                        className="textarea"
                        value={answer}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          if (nextValue.length === 0) {
                            setPracticeResponseStartedAtMs(null);
                          } else if (practiceResponseStartedAtMs === null) {
                            setPracticeResponseStartedAtMs(Date.now());
                          }
                          setAnswer(nextValue);
                        }}
                        disabled={isPracticeQuestionPending}
                        placeholder="영어로 답변을 입력하세요"
                        style={{ marginTop: 12 }}
                      />
                      <div className="row" style={{ marginTop: 12 }}>
                        <button className="button secondary" onClick={handleScore} disabled={!!loading || !selectedExpression || isPracticeQuestionPending}>
                          {loading === "score" ? "채점 중..." : "채점하기"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="grid" style={{ marginTop: 12 }}>
                      <div className="mini-card">
                        <strong>음성 답변 녹음</strong>
                        <div className="muted" style={{ marginTop: 8 }}>
                          영어로 말한 뒤 녹음을 종료하면 STT로 인식해서 자동 채점합니다.
                        </div>
                        {practiceAutoStartCountdown !== null && (
                          <div className="muted" style={{ marginTop: 10 }}>
                            복습 녹음이 {practiceAutoStartCountdown}초 뒤 자동으로 시작됩니다.
                          </div>
                        )}
                        <div className="row" style={{ marginTop: 12 }}>
                          <button className="button" onClick={handleStartVoicePractice} disabled={!!loading || isPracticeRecording || isPracticeQuestionPending}>
                            {isPracticeRecording ? "녹음 중..." : practiceAutoStartCountdown !== null ? "지금 바로 시작" : "녹음 시작"}
                          </button>
                          <button className="button ghost" onClick={handleStopVoicePractice} disabled={!isPracticeRecording && practiceAutoStartCountdown === null}>
                            {practiceAutoStartCountdown !== null ? "자동 시작 취소" : "녹음 종료"}
                          </button>
                          <button className="button secondary" onClick={() => void handleScoreVoice()} disabled={!!loading || isPracticeRecording || !voiceAnswerFile || !selectedExpression || isPracticeQuestionPending}>
                            {loading === "score-voice" ? "다시 채점 중..." : "다시 채점"}
                          </button>
                        </div>
                        <div className="muted" style={{ marginTop: 10 }}>
                          {voiceAnswerFile ? `녹음 파일 준비됨: ${voiceAnswerFile.name}` : "아직 녹음된 음성 답변이 없습니다."}
                        </div>
                      </div>
                      {score?.answer && (
                        <div className="mini-card">
                          <strong>인식된 영어 답변</strong>
                          <div style={{ marginTop: 8 }}>{score.answer}</div>
                        </div>
                      )}
                      {score?.audioUrl && (
                        <div className="mini-card">
                          <strong>저장된 음성 다시 듣기</strong>
                          <audio controls className="audio-player" style={{ marginTop: 12 }} src={score.audioUrl} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {score && (
              <div className="grid score-grid">
                {activeReviewItem && (
                  <div className="mini-card">
                    <strong>복습 이동</strong>
                    <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => void handleMoveToNextReview()}
                        disabled={!!loading || !nextReviewItem}
                      >
                        {nextReviewItem ? "다음 문제" : "마지막 문제"}
                      </button>
                      <button
                        className="button ghost"
                        type="button"
                        onClick={() => setReviewAutoAdvanceEnabled(!reviewAutoAdvance)}
                        disabled={!!loading}
                      >
                        {reviewAutoAdvance ? "자동 이동 일시정지" : "자동 이동 다시 켜기"}
                      </button>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      {nextReviewItem
                        ? `다음 복습 카드: ${activeReviewIndex + 2}/${reviews.length}`
                        : "현재 카드가 마지막 복습 문제입니다."}
                    </div>
                  </div>
                )}
                <div className="mini-card">
                  <FieldHelpLabel
                    label="점수"
                    description="의미 전달, 자연스러움, 문법/정확도를 종합해서 나온 최종 점수입니다."
                  />
                  <div className="kpi" style={{ marginTop: 8 }}>{score.score}</div>
                </div>
                <div className="mini-card">
                  <FieldHelpLabel
                    label="피드백"
                    description="이번 답변에 대한 짧은 총평입니다. 점수와 세부 평가를 바탕으로 요약해서 보여줍니다."
                  />
                  <div style={{ marginTop: 8 }}>{score.feedback}</div>
                </div>
                <div className="mini-card">
                  <FieldHelpLabel
                    label={practicePrompt?.testType === "pattern" ? "이번 문제 정답" : "정답 기준"}
                    description={
                      practicePrompt?.testType === "pattern"
                        ? "이번 패턴형 문제에 대해 맞춰야 하는 기준 답안입니다."
                        : "이 앱에서 우선 익히려는 대표 기준 문장입니다. 저장된 기본 영어 표현이에요."
                    }
                  />
                  <div style={{ marginTop: 8 }}>{score.target}</div>
                  <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void handlePlayPracticeReferenceTts()}
                      disabled={!!loading || !selectedExpression?.ttsUrl}
                    >
                      정답 기준 듣기
                    </button>
                  </div>
                  {selectedExpression?.ttsUrl ? (
                    <audio
                      ref={practiceReferenceAudioRef}
                      controls
                      className="audio-player"
                      style={{ marginTop: 12 }}
                      src={selectedExpression.ttsUrl}
                    />
                  ) : (
                    <div className="muted" style={{ marginTop: 10 }}>
                      이 표현의 영어 TTS가 아직 없어 정답 기준 음성을 재생할 수 없습니다.
                    </div>
                  )}
                </div>
                {practicePrompt?.testType === "pattern" && practicePrompt.referenceTarget && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="원래 대표 표현"
                      description="이 패턴형 문제가 만들어지기 전에 기준이 된 원래 대표 표현입니다."
                    />
                    <div style={{ marginTop: 8 }}>{practicePrompt.referenceTarget}</div>
                  </div>
                )}
                {typeof score.responseLatencyMs === "number" && (
                  <div className="mini-card">
                    <strong>응답 시작</strong>
                    <div style={{ marginTop: 8 }}>
                      {score.responseTimedOut ? "3초 초과" : "3초 이내"} · {formatRecordingSeconds(score.responseLatencyMs)}
                    </div>
                  </div>
                )}
                {typeof score.meaningScore === "number" && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="의미 전달"
                      description="한국어 문제의 핵심 뜻이 얼마나 정확하게 전달됐는지 보는 점수입니다."
                    />
                    <div className="kpi" style={{ marginTop: 8 }}>{score.meaningScore}</div>
                  </div>
                )}
                {typeof score.naturalnessScore === "number" && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="자연스러움"
                      description="원어민이 실제 대화에서 쓸 법한 자연스러운 표현인지 보는 점수입니다."
                    />
                    <div className="kpi" style={{ marginTop: 8 }}>{score.naturalnessScore}</div>
                  </div>
                )}
                {typeof score.grammarScore === "number" && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="문법/정확도"
                      description="문법, 어순, 시제, 전치사, 핵심 표현의 정확성을 중심으로 보는 점수입니다."
                    />
                    <div className="kpi" style={{ marginTop: 8 }}>{score.grammarScore}</div>
                  </div>
                )}
                {score.strengthComment && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="잘한 점"
                      description="내 답변에서 의미 전달이나 표현상 좋았던 부분입니다."
                    />
                    <div style={{ marginTop: 8 }}>{score.strengthComment}</div>
                  </div>
                )}
                {score.correctionComment && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="정답 기준 코멘트"
                      description="내 답변이 정답 기준 문장과 얼마나 가까운지 보고, 그 기준 표현에 더 가깝게 맞추려면 무엇을 바꾸면 좋은지 알려줍니다."
                    />
                    <div style={{ marginTop: 8 }}>{score.correctionComment}</div>
                  </div>
                )}
                {score.meaningComment && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="의미 기준 코멘트"
                      description="정답 기준과 완전히 같지 않아도, 한국어 문제의 핵심 의미가 얼마나 잘 전달됐는지 중심으로 설명합니다."
                    />
                    <div style={{ marginTop: 8 }}>{score.meaningComment}</div>
                  </div>
                )}
                {score.suggestedAnswer && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="추천 답안"
                      description="이번 문제를 기준으로 가장 추천하는 답안 예시입니다. 정답 기준과 조금 다를 수 있습니다."
                    />
                    <div style={{ marginTop: 8 }}>{score.suggestedAnswer}</div>
                  </div>
                )}
                {score.suggestedAnswerAlt && score.suggestedAnswerAlt !== score.suggestedAnswer && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="다른 자연스러운 답안"
                      description="같은 뜻을 전달할 수 있는 또 다른 자연스러운 표현 예시입니다."
                    />
                    <div style={{ marginTop: 8 }}>{score.suggestedAnswerAlt}</div>
                  </div>
                )}
                {practicePrompt?.testType === "pattern" && (
                  <div className="mini-card">
                    <FieldHelpLabel
                      label="표현 자산 저장"
                      description="이번 패턴형 문제의 한국어 문장과 답안을 새 표현 자산으로 저장합니다. 저장 후에도 현재 테스트 화면은 그대로 유지됩니다."
                    />
                    <div className="muted" style={{ marginTop: 8 }}>
                      저장하면 새 `SavedSentence`와 연결된 `Expression`이 만들어지고, 영어/한국어 TTS도 함께 준비됩니다.
                    </div>
                    {savedPatternExpression && (
                      <div className="success-box" style={{ marginTop: 12 }}>
                        표현 자산 저장 완료
                        {savedPatternExpression.hasEnglishTts || savedPatternExpression.hasKoreanTts
                          ? ` · TTS 준비됨${
                              savedPatternExpression.hasEnglishTts && savedPatternExpression.hasKoreanTts
                                ? " (영어/한국어)"
                                : savedPatternExpression.hasEnglishTts
                                  ? " (영어)"
                                  : " (한국어)"
                            }`
                          : ""}
                      </div>
                    )}
                    <div className="row" style={{ marginTop: 12 }}>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => void handleSavePatternPracticeExpression()}
                        disabled={!!loading || !!savedPatternExpression}
                      >
                        {loading === "save-pattern-expression"
                          ? "표현 자산 저장 중..."
                          : savedPatternExpression
                            ? "표현 자산 저장 완료"
                            : "표현 자산으로 저장"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </section>

        <section ref={practiceHistorySectionRef} className="card panel-lg">
          {renderSectionIntro(
            "practiceHistory",
            "5. 최근 복습 기록",
            "최근에 채점한 복습 결과를 최신순으로 확인하고, 답변과 피드백을 다시 볼 수 있습니다.",
            `최근 기록 ${practiceHistory.length}건`,
          )}
          {expandedSections.practiceHistory && (
            <div className="grid" style={{ marginTop: 14 }}>
              {practiceHistory.length === 0 && (
                <div className="mini-card muted">아직 저장된 복습 기록이 없습니다.</div>
              )}
              {visiblePracticeHistory.map((item, index) => (
                <div
                  key={item.id}
                  className={`mini-card ${selectedExpressionId === item.expressionId && activeReviewExpressionId === null ? "section-highlight" : ""}`}
                >
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <strong>기록 {index + 1}</strong>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {recordingDateFormatter.format(new Date(item.createdAt))}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <span className="badge" style={{ background: "#e0f2fe", color: "#0f172a" }}>점수 {item.score}</span>
                      <span className="badge" style={{ background: "#f8fafc", color: "#334155" }}>
                        {item.mode === "voice" ? "음성" : "텍스트"} · {item.testType === "situation" ? "상황형" : item.testType === "pattern" ? "패턴형" : "번역형"}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontWeight: 700 }}>{item.promptKorean || item.koreanText}</div>
                  {item.promptContext && <div className="muted" style={{ marginTop: 8 }}>{item.promptContext}</div>}
                  <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void handleStartPracticeFromHistory(item)}
                      disabled={!!loading}
                    >
                      {item.testType === "situation" ? "상황형 테스트" : item.testType === "pattern" ? "패턴형 테스트" : "번역형 테스트"}
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => {
                        setSelectedExpressionId(item.expressionId);
                        setActiveReviewExpressionId(null);
                        window.setTimeout(() => {
                          testSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 120);
                      }}
                      disabled={!!loading}
                    >
                      테스트 영역으로 이동
                    </button>
                  </div>
                  <div className="grid" style={{ marginTop: 14, gap: 10 }}>
                    <div>
                      <div className="muted">기준 표현</div>
                      <div style={{ marginTop: 4 }}>{item.target || item.englishBase}</div>
                    </div>
                    <div>
                      <div className="muted">내 답변</div>
                      <div style={{ marginTop: 4 }}>{item.answer}</div>
                    </div>
                    {item.suggestedAnswer && (
                      <div>
                        <div className="muted">추천 답안</div>
                        <div style={{ marginTop: 4 }}>{item.suggestedAnswer}</div>
                      </div>
                    )}
                    {item.correctionComment && (
                      <div>
                        <div className="muted">정답 기준 코멘트</div>
                        <div style={{ marginTop: 4 }}>{item.correctionComment}</div>
                      </div>
                    )}
                    {item.meaningComment && (
                      <div>
                        <div className="muted">의미 기준 코멘트</div>
                        <div style={{ marginTop: 4 }}>{item.meaningComment}</div>
                      </div>
                    )}
                    <div>
                      <div className="muted">피드백</div>
                      <div style={{ marginTop: 4 }}>{item.feedback}</div>
                    </div>
                    {item.audioUrl && (
                      <div>
                        <div className="muted">음성 다시 듣기</div>
                        <audio controls className="audio-player" style={{ marginTop: 8 }} src={item.audioUrl} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {renderListControls("practiceHistory", practiceHistory.length)}
            </div>
          )}
        </section>

        <section ref={ttsLibrarySectionRef} className="card panel-lg">
          {renderSectionIntro(
            "ttsLibrary",
            "6. TTS 완료 표현 모아보기",
            "영어 음성까지 만들어진 표현만 따로 모아 빠르게 다시 듣고 확인할 수 있습니다.",
            ttsLibraryQuery.trim()
              ? `검색 결과 ${filteredCompletedTtsExpressions.length}개 / 전체 ${completedTtsExpressions.length}개`
              : `TTS 완료 표현 ${completedTtsExpressions.length}개`,
          )}
          {expandedSections.ttsLibrary && (
            <>
                  <div className="mini-card" style={{ marginTop: 14 }}>
                    <strong>전체 재생 옵션</strong>
                    <div className="muted" style={{ marginTop: 8 }}>
                      반복 횟수와 문장 사이 텀을 정해서 쉐도잉용으로 이어 들을 수 있습니다. 같은 세션에서 이미 받은 음성은 다시 다운로드하지 않고 재사용합니다.
                    </div>
                    <div className="grid" style={{ marginTop: 12 }}>
                      <div>
                        <div className="muted" style={{ marginBottom: 8 }}>문장당 반복 횟수</div>
                        <div className="row" style={{ gap: 8 }}>
                          {[1, 2, 3].map((count) => (
                            <button
                              key={`tts-repeat-${count}`}
                              type="button"
                              className={`chip ${ttsLibraryRepeatCount === count ? "selected" : ""}`}
                              onClick={() => setTtsLibraryRepeatCount(count as 1 | 2 | 3)}
                              disabled={isTtsLibraryPlaying || isTtsLibraryPreparing}
                            >
                              {count}회
                            </button>
                          ))}
                        </div>
                      </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>반복 사이 텀</div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          {[0, 1000, 2000, 3000].map((gapMs) => (
                            <button
                              key={`tts-gap-${gapMs}`}
                              type="button"
                              className={`chip ${ttsLibraryGapMs === gapMs ? "selected" : ""}`}
                              onClick={() => setTtsLibraryGapMs(gapMs)}
                              disabled={isTtsLibraryPlaying || isTtsLibraryPreparing}
                            >
                              {formatGapLabel(gapMs)}
                            </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>한국어 표현 포함</div>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className={`chip ${!ttsLibraryIncludeKorean ? "selected" : ""}`}
                        onClick={() => setTtsLibraryIncludeKorean(false)}
                        disabled={isTtsLibraryPlaying || isTtsLibraryPreparing}
                      >
                        영어만
                      </button>
                      <button
                        type="button"
                        className={`chip ${ttsLibraryIncludeKorean ? "selected" : ""}`}
                        onClick={() => setTtsLibraryIncludeKorean(true)}
                        disabled={isTtsLibraryPlaying || isTtsLibraryPreparing}
                      >
                        한국어 포함
                      </button>
                    </div>
                  </div>
                </div>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button
                        className="button"
                        onClick={() => void startTtsLibraryPlayback()}
                        disabled={!!loading || filteredCompletedTtsExpressions.length === 0}
                      >
                        {isTtsLibraryPreparing
                          ? "재생 준비 중..."
                          : isTtsLibraryPlaying
                          ? "재생 중..."
                          : ttsLibraryRepeatCount === 1
                          ? "전체 연속 재생"
                          : `문장당 ${ttsLibraryRepeatCount}회 반복 + 전체 연속 재생`}
                      </button>
                      <button
                        className="button ghost"
                        onClick={stopTtsLibraryPlayback}
                        disabled={!isTtsLibraryPlaying && !isTtsLibraryPreparing}
                      >
                        정지
                      </button>
                    </div>
                    <div className="muted" style={{ marginTop: 10 }}>
                      현재 설정: {ttsLibraryIncludeKorean ? "한국어 -> 영어" : "영어만"} · 문장당 {ttsLibraryRepeatCount}회 · 반복 사이 텀 {formatGapLabel(ttsLibraryGapMs)}
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {ttsLibraryCurrentExpressionId
                        ? `현재 재생: ${completedTtsExpressions.find((item) => item.id === ttsLibraryCurrentExpressionId)?.englishBase ?? "선택한 문장"}`
                        : "전체 재생을 시작하면 현재 재생 중인 문장이 여기 표시됩니다."}
                    </div>
                    <audio ref={ttsLibraryAudioRef} onEnded={handleTtsLibraryAudioEnded} preload="auto" style={{ display: "none" }} />
                  </div>

                  <div className="grid" style={{ marginTop: 14 }}>
                    <div className="mini-card">
                      <div className="muted" style={{ marginBottom: 8 }}>표현 검색</div>
                      <input
                        className="input"
                        type="search"
                        value={ttsLibraryQuery}
                        onChange={(event) => setTtsLibraryQuery(event.target.value)}
                        placeholder="영어 표현 또는 한국어 문장으로 검색"
                        disabled={isTtsLibraryPlaying || isTtsLibraryPreparing}
                      />
                      <div className="muted" style={{ marginTop: 8 }}>
                        영어 표현과 한국어 원문을 함께 검색합니다.
                      </div>
                    </div>
                    {completedTtsExpressions.length === 0 && (
                      <div className="mini-card muted">아직 TTS 생성이 완료된 표현이 없습니다.</div>
                    )}
                    {completedTtsExpressions.length > 0 && filteredCompletedTtsExpressions.length === 0 && (
                      <div className="mini-card muted">검색 결과가 없습니다.</div>
                    )}
                    {visibleCompletedTtsExpressions.map((expression, index) => (
                      <div key={`tts-library-${expression.id}`} className="mini-card">
                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <strong style={{ flex: 1 }}>{index + 1}. {expression.englishBase}</strong>
                          <span className={`tag ${ttsLibraryCurrentExpressionId === expression.id ? "tag-primary" : "tag-done"}`}>
                            {ttsLibraryCurrentExpressionId === expression.id ? "재생 중" : "TTS 완료"}
                          </span>
                        </div>
                        <div className="muted" style={{ marginTop: 8 }}>{expression.koreanText}</div>
                        <div className="muted" style={{ marginTop: 8 }}>
                          테스트 {expression.practiceCount ?? 0}회 · 최근 점수 {typeof expression.latestPracticeScore === "number" ? `${expression.latestPracticeScore}점` : "없음"}
                        </div>
                        <div className="row" style={{ marginTop: 12 }}>
                          <button
                            className="button secondary"
                            onClick={() => {
                              selectExpressionForPractice(expression);
                              window.setTimeout(() => audioRef.current?.load(), 50);
                            }}
                            disabled={!!loading}
                          >
                            선택
                          </button>
                          <button
                            className="button ghost"
                            onClick={() => {
                              selectExpressionForPractice(expression);
                              window.setTimeout(() => {
                                audioRef.current?.load();
                                audioRef.current?.play().catch(() => undefined);
                              }, 50);
                            }}
                            disabled={!!loading || !expression.ttsUrl}
                          >
                            바로 재생
                          </button>
                        </div>
                      </div>
                    ))}
                    {renderListControls("ttsLibrary", filteredCompletedTtsExpressions.length)}
                  </div>
            </>
          )}
        </section>
      </div>
      <nav className="desktop-section-nav" aria-label="대시보드 섹션 이동">
        {DASHBOARD_SECTION_TABS.map((tab) => (
          <button
            key={`desktop-${tab.id}`}
            type="button"
            className={`desktop-section-nav-button ${activeSectionId === tab.id ? "active" : ""}`}
            onClick={() => scrollToDashboardSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <nav className="mobile-section-nav" aria-label="대시보드 섹션 이동">
        {MOBILE_DASHBOARD_SECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-section-nav-button ${activeSectionId === tab.id ? "active" : ""}`}
            onClick={() => scrollToDashboardSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
