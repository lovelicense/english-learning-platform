import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  createDialoguePracticeSetFromSession,
  generateAiReplyAssist,
  getAiConversationSession,
  listDialoguePracticeSets,
  respondToAiConversation,
  saveEnglishConversationTurnAsExpression,
  saveKoreanConversationTurnAndGenerateExpression,
  transcribeAiConversationAudio,
  updateAiConversationSessionTitle,
  type AiReplyAssistResponse,
  type DialoguePracticeSetResponse,
  type AiConversationSessionResponse,
  type AiConversationTurnResponse,
} from "../../src/lib/api/ai-conversations";

function formatTrack(mode: AiConversationSessionResponse["mode"]) {
  return mode === "ENGLISH_AI" ? "영어 연습 트랙" : "한국어 수집 트랙";
}

function getTurnActionLabel(mode: AiConversationSessionResponse["mode"]) {
  return mode === "ENGLISH_AI" ? "영어 표현 생성" : "저장 후 영어 표현 생성";
}

function formatModeSummary(session: AiConversationSessionResponse) {
  return `AI ${session.aiOutputMode === "voice" ? "음성" : "텍스트"} · 내 답변 ${session.userInputMode === "voice" ? "음성(STT)" : "텍스트"}`;
}

type RecordedClip = {
  uri: string;
  durationMs: number;
  fileName: string;
  contentType?: string | null;
};

export default function AiConversationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const sessionId = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingTurnId, setSavingTurnId] = useState("");
  const [creatingDialogueSet, setCreatingDialogueSet] = useState(false);
  const [assistLoading, setAssistLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPermission, setRecordingPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordedClip, setRecordedClip] = useState<RecordedClip | null>(null);
  const [showEnglishAiReplyText, setShowEnglishAiReplyText] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [showAssistComposer, setShowAssistComposer] = useState(false);
  const [assistKoreanText, setAssistKoreanText] = useState("");
  const [assistResult, setAssistResult] = useState<AiReplyAssistResponse | null>(null);
  const [session, setSession] = useState<AiConversationSessionResponse | null>(null);
  const [dialoguePracticeSets, setDialoguePracticeSets] = useState<DialoguePracticeSetResponse[]>([]);
  const [latestGeneratedExpressionId, setLatestGeneratedExpressionId] = useState("");

  const hasTurns = useMemo(() => Boolean(session?.turns.length), [session?.turns.length]);
  const latestUserTurn = useMemo(
    () => [...(session?.turns ?? [])].reverse().find((turn) => turn.speaker === "USER") ?? null,
    [session?.turns],
  );
  const englishTrackNextStep = useMemo(() => {
    if (!session || session.mode !== "ENGLISH_AI") return "";
    if (!hasTurns) return "먼저 영어로 한 턴 이상 답해 세션을 시작해 주세요.";
    if (!latestUserTurn) return "내 답변이 생기면 표현 저장과 다이얼로그 연습 저장이 가능해집니다.";
    if (dialoguePracticeSets.length === 0) {
      return "좋은 사용자 턴을 표현으로 저장하고, 세션 전체를 다이얼로그 연습 세트로 바꿔 다시 말해보는 흐름이 다음 단계입니다.";
    }
    return "이미 연습 세트가 있으니, 표현 저장과 다이얼로그 연습 재시작 중 지금 필요한 쪽으로 바로 이어갈 수 있습니다.";
  }, [dialoguePracticeSets.length, hasTurns, latestUserTurn, session]);
  const koreanTrackNextStep = useMemo(() => {
    if (!session || session.mode !== "KOREAN_AI") return "";
    if (!hasTurns) return "먼저 실제로 쓰는 한국어 한 턴을 보내 세션을 시작해 주세요.";
    if (!latestUserTurn) return "내 한국어 턴이 생기면 바로 저장 후 영어 표현 생성으로 넘길 수 있습니다.";
    if (latestGeneratedExpressionId) {
      return "방금 만든 표현을 바로 보고, 연습하거나 오늘 복습으로 이어가는 것이 가장 빠른 다음 단계입니다.";
    }
    return "저장할 한국어 턴을 골라 영어 표현 생성으로 넘기면, 이 대화가 수집 채널로 완성됩니다.";
  }, [hasTurns, latestGeneratedExpressionId, latestUserTurn, session]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clipDurationLabel = useMemo(
    () => formatDurationMs(isRecording ? recordingElapsedMs : recordedClip?.durationMs),
    [isRecording, recordingElapsedMs, recordedClip?.durationMs],
  );

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setError("세션 ID가 없습니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [next, sets] = await Promise.all([getAiConversationSession(sessionId), listDialoguePracticeSets()]);
      setSession(next);
      setTitleDraft(next.title?.trim() || "");
      setDialoguePracticeSets(sets.filter((item) => item.conversationSessionId === sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 상세를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadSession();
    }, [loadSession]),
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
        <Text style={styles.description}>AI 대화 세션을 불러오는 중입니다.</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || "세션을 찾지 못했습니다."}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>이전 화면으로</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>{formatTrack(session.mode)}</Text>
      <Text style={styles.title}>{session.title?.trim() || "제목 없는 AI 세션"}</Text>
      <Text style={styles.description}>
        이 화면에서 실제 텍스트 대화를 이어가고, 사용자 턴은 바로 자산화할 수 있습니다. 영어 트랙은 표현 저장, 한국어 트랙은 저장 후 영어 표현 생성으로 이어집니다.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세션 제목</Text>
        <TextInput
          style={styles.textInput}
          value={titleDraft}
          onChangeText={setTitleDraft}
          placeholder="세션 제목"
        />
        <Pressable
          style={[styles.secondaryButton, (!titleDraft.trim() || savingTitle || titleDraft.trim() === (session.title?.trim() || "")) && styles.buttonDisabled]}
          onPress={() => void handleSaveTitle()}
          disabled={!titleDraft.trim() || savingTitle || titleDraft.trim() === (session.title?.trim() || "")}
        >
          {savingTitle ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>제목 저장</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>세션 요약</Text>
        <Text style={styles.cardText}>상태: {session.status}</Text>
        <Text style={styles.cardText}>Turns: {session.turns.length}</Text>
        <Text style={styles.cardText}>AI 응답: {session.aiOutputMode ?? "text"}</Text>
        <Text style={styles.cardText}>내 답변: {session.userInputMode ?? "text"}</Text>
        {session.userRole ? <Text style={styles.cardText}>나의 역할: {session.userRole}</Text> : null}
        {session.aiRole ? <Text style={styles.cardText}>AI 역할: {session.aiRole}</Text> : null}
        {session.conversationTopic ? <Text style={styles.cardText}>주제: {session.conversationTopic}</Text> : null}
        {session.situationDescription ? <Text style={styles.cardText}>상황: {session.situationDescription}</Text> : null}
        <Text style={styles.cardText}>현재 모드: {formatModeSummary(session)}</Text>
      </View>

      <View style={styles.pipelineCard}>
        <Text style={styles.pipelineEyebrow}>{session.mode === "ENGLISH_AI" ? "Practice Bridge" : "Collection Bridge"}</Text>
        <Text style={styles.pipelineTitle}>
          {session.mode === "ENGLISH_AI" ? "현재 세션에서 다음에 할 일" : "이 세션을 학습 흐름으로 잇는 방법"}
        </Text>
        <Text style={styles.pipelineText}>
          {session.mode === "ENGLISH_AI" ? englishTrackNextStep : koreanTrackNextStep}
        </Text>
        <View style={styles.pipelineSteps}>
          {(session.mode === "ENGLISH_AI"
            ? [
                "좋은 내 답변은 표현 자산으로 저장",
                "세션 전체는 다이얼로그 연습 세트로 변환",
                "저장된 자산은 다시 표현 연습으로 합류",
              ]
            : [
                "내 한국어 턴을 수집 자산으로 저장",
                "저장 즉시 영어 표현 생성으로 연결",
                "생성된 표현을 바로 연습/복습으로 이동",
              ]
          ).map((step, index) => (
            <View key={`${session.mode}-step-${index}`} style={styles.pipelineStepRow}>
              <View style={styles.pipelineStepBadge}>
                <Text style={styles.pipelineStepBadgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.pipelineStepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>대화 턴</Text>
        {session.mode === "ENGLISH_AI" && session.aiOutputMode === "voice" ? (
          <View style={styles.voiceOptionCard}>
            <Text style={styles.voiceOptionTitle}>AI 영문 표시</Text>
            <Text style={styles.cardText}>AI 음성 응답일 때만 영문 숨김이 적용됩니다. AI 텍스트 응답은 항상 보입니다.</Text>
            <View style={styles.inlineRow}>
              <Pressable
                style={[styles.filterChip, !showEnglishAiReplyText && styles.filterChipActive]}
                onPress={() => setShowEnglishAiReplyText(false)}
              >
                <Text style={[styles.filterChipText, !showEnglishAiReplyText && styles.filterChipTextActive]}>기본 숨기기</Text>
              </Pressable>
              <Pressable
                style={[styles.filterChip, showEnglishAiReplyText && styles.filterChipActive]}
                onPress={() => setShowEnglishAiReplyText(true)}
              >
                <Text style={[styles.filterChipText, showEnglishAiReplyText && styles.filterChipTextActive]}>영문 보이기</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {hasTurns ? (
          session.turns.map((turn, index) => (
            <View key={turn.id} style={[styles.turnCard, turn.speaker === "USER" ? styles.userTurnCard : styles.aiTurnCard]}>
              <Text style={styles.turnMeta}>
                {index + 1}. {turn.speaker === "AI" ? "AI" : "ME"} · {turn.language} ·{" "}
                {turn.speaker === "AI" ? (turn.outputMode === "voice" ? "AI 음성" : "AI 텍스트") : turn.inputMode === "voice" ? "음성(STT)" : "텍스트"}
              </Text>
              {turn.speaker === "AI" && turn.outputMode === "voice" && session.mode === "ENGLISH_AI" && !showEnglishAiReplyText ? (
                <Text style={styles.turnHint}>영문 응답은 숨김 상태입니다. 듣기에 집중하거나 아래 한국어 설명만 확인할 수 있습니다.</Text>
              ) : (
                <Text style={styles.turnText}>{turn.originalText}</Text>
              )}
              {renderTurnHints(turn)}
              {turn.speaker === "AI" && turn.ttsUrl ? (
                <Pressable
                  style={[styles.secondaryButton, playingKey === turn.id && styles.buttonDisabled]}
                  onPress={() => void handlePlayTurnAudio(turn)}
                >
                  <Text style={styles.secondaryButtonText}>{playingKey === turn.id ? "재생 중..." : "AI 음성 듣기"}</Text>
                </Pressable>
              ) : null}
              {turn.speaker === "USER" ? (
                <Pressable
                  style={[styles.turnActionButton, savingTurnId === turn.id && styles.buttonDisabled]}
                  onPress={() => void handleSaveTurn(turn)}
                  disabled={savingTurnId === turn.id}
                >
                  {savingTurnId === turn.id ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.turnActionButtonText}>{getTurnActionLabel(session.mode)}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.cardText}>아직 대화 턴이 없습니다. 위 입력창에서 첫 답변을 보내면 AI와의 대화가 이어집니다.</Text>
        )}
      </View>

      <View style={[styles.card, styles.currentReplyCard]}>
        <Text style={styles.cardTitle}>현재 답변</Text>
        <Text style={styles.cardText}>
          {session.mode === "ENGLISH_AI"
            ? "위 대화를 읽고 자연스럽게 이어서 답해 보세요. 좋은 영어 답변은 아래 턴에서 바로 표현 자산으로 저장할 수 있습니다."
            : "위 대화 흐름을 보면서 실제로 쓰는 한국어로 이어 답하세요. 필요한 턴만 저장 후 영어 표현 생성으로 연결됩니다."}
        </Text>
        {session.userInputMode === "voice" ? (
          <>
            <Text style={styles.cardText}>권한 상태: {formatPermissionLabel(recordingPermission)}</Text>
            <Text style={styles.cardText}>
              {recordedClip
                ? `최근 음성 답변 길이: ${clipDurationLabel}. 전사 후 바로 다듬어 보내거나 다시 녹음할 수 있습니다.`
                : "음성으로 답한 뒤 STT 전사본을 확인하고 바로 이어서 보낼 수 있습니다."}
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
                onPress={() => void handleTranscribeVoice()}
                disabled={!recordedClip || transcribing || isRecording}
              >
                {transcribing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>STT 전사</Text>}
              </Pressable>
            </View>
            <TextInput
              style={styles.textarea}
              multiline
              value={draft}
              onChangeText={setDraft}
              placeholder={session.mode === "ENGLISH_AI" ? "전사된 영어 답변을 확인하고 수정하세요." : "전사된 한국어 답변을 확인하고 수정하세요."}
            />
          </>
        ) : (
          <TextInput
            style={styles.textarea}
            multiline
            value={draft}
            onChangeText={setDraft}
            placeholder={session.mode === "ENGLISH_AI" ? "영어로 답해 보세요." : "실제로 쓰는 한국어로 답해 보세요."}
          />
        )}

        {session.mode === "ENGLISH_AI" ? (
          <View style={styles.inlineSection}>
            <View style={styles.inlineSectionHeader}>
              <Text style={styles.inlineSectionTitle}>도움 요청</Text>
              <Pressable style={styles.secondaryButton} onPress={() => setShowAssistComposer((current) => !current)}>
                <Text style={styles.secondaryButtonText}>{showAssistComposer ? "접기" : "열기"}</Text>
              </Pressable>
            </View>
            <Text style={styles.cardText}>
              한국어로 말하고 싶은 뜻을 먼저 적으면, 영어 답변 후보를 `easy / natural` 두 가지로 제안합니다.
            </Text>
            {showAssistComposer ? (
              <>
                <TextInput
                  style={styles.textarea}
                  multiline
                  value={assistKoreanText}
                  onChangeText={setAssistKoreanText}
                  placeholder="예: 지금은 일정이 있어서 내일 오전에 다시 이야기할 수 있을 것 같아요."
                />
                <Pressable
                  style={[styles.primaryButton, (!assistKoreanText.trim() || assistLoading) && styles.buttonDisabled]}
                  onPress={() => void handleGenerateAssist()}
                  disabled={!assistKoreanText.trim() || assistLoading}
                >
                  {assistLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>영어 답변 추천받기</Text>}
                </Pressable>
              </>
            ) : null}

            {assistResult ? (
              <View style={styles.assistCard}>
                <Text style={styles.assistLabel}>쉬운 답변</Text>
                <Text style={styles.turnText}>{assistResult.englishEasy}</Text>
                <Pressable style={styles.secondaryButton} onPress={() => applyAssistText(assistResult.englishEasy)}>
                  <Text style={styles.secondaryButtonText}>이 답변으로 채우기</Text>
                </Pressable>

                <Text style={styles.assistLabel}>자연형 답변</Text>
                <Text style={styles.turnText}>{assistResult.englishNatural}</Text>
                <Pressable style={styles.secondaryButton} onPress={() => applyAssistText(assistResult.englishNatural)}>
                  <Text style={styles.secondaryButtonText}>자연형으로 채우기</Text>
                </Pressable>

                <Text style={styles.assistLabel}>학습 메모</Text>
                <Text style={styles.turnHint}>{assistResult.noteKo}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Pressable
          style={[styles.primaryButton, (!draft.trim() || sending) && styles.buttonDisabled]}
          onPress={() => void handleSendMessage()}
          disabled={!draft.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>AI에게 보내기</Text>}
        </Pressable>
        {message ? <Text style={styles.success}>{message}</Text> : null}
      </View>

      {session.mode === "KOREAN_AI" && latestGeneratedExpressionId ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>생성된 표현 바로 이어가기</Text>
          <Text style={styles.cardText}>
            방금 저장한 한국어 턴으로 영어 표현을 만들었습니다. 지금 바로 표현 확인, 표현 연습, 오늘 복습으로 이어갈 수 있습니다.
          </Text>
          <View style={styles.inlineRow}>
            <Pressable style={styles.primaryButton} onPress={() => router.push(`/expression/${latestGeneratedExpressionId}`)}>
              <Text style={styles.primaryButtonText}>표현 보기</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push(`/expression/${latestGeneratedExpressionId}/practice`)}>
              <Text style={styles.secondaryButtonText}>바로 연습</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/(tabs)/reviews")}>
              <Text style={styles.secondaryButtonText}>오늘 복습</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {session.mode === "ENGLISH_AI" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>다이얼로그 연습으로 저장</Text>
          <Text style={styles.cardText}>
            영어 AI 대화는 세션 전체를 다이얼로그 연습 세트로 바꿔서, 대화 직후 다시 말해보는 훈련으로 이어갈 수 있습니다.
          </Text>
          <Pressable
            style={[styles.primaryButton, (!hasTurns || creatingDialogueSet) && styles.buttonDisabled]}
            onPress={() => void handleCreateDialoguePracticeSet()}
            disabled={!hasTurns || creatingDialogueSet}
          >
            {creatingDialogueSet ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>다이얼로그 연습으로 저장</Text>
            )}
          </Pressable>
          {!hasTurns ? <Text style={styles.cardText}>먼저 영어 대화 턴이 있어야 다이얼로그 연습 세트를 만들 수 있습니다.</Text> : null}

          <Text style={styles.sectionLabel}>이 세션에서 만든 연습 세트</Text>
          <View style={styles.inlineRow}>
            <Pressable style={styles.secondaryButton} onPress={() => router.push("/dialogue-practice")}>
              <Text style={styles.secondaryButtonText}>전체 세트 보기</Text>
            </Pressable>
          </View>
          {dialoguePracticeSets.length > 0 ? (
            dialoguePracticeSets.map((set) => (
              <View key={set.id} style={styles.dialogueSetCard}>
                <Text style={styles.dialogueSetTitle}>{set.title}</Text>
                <Text style={styles.cardText}>
                  {set.turns.length} turns · {new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(set.updatedAt))}
                </Text>
                {set.turns[0] ? <Text style={styles.dialoguePrompt}>Q1. {set.turns[0].aiPrompt}</Text> : null}
                {set.turns[0]?.aiPromptTtsUrl ? (
                  <View style={styles.inlineRow}>
                    <Pressable
                      style={[styles.secondaryButton, playingKey === `dialogue-${set.id}` && styles.buttonDisabled]}
                      onPress={() => void playAudio(`dialogue-${set.id}`, set.turns[0]?.aiPromptTtsUrl ?? "")}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {playingKey === `dialogue-${set.id}` ? "재생 중..." : "첫 질문 듣기"}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => router.push(`/dialogue-practice/${set.id}`)}>
                      <Text style={styles.secondaryButtonText}>연습 시작</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.cardText}>아직 이 세션에서 만든 다이얼로그 연습 세트가 없습니다.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.reuseCard}>
        <Text style={styles.cardTitle}>세션 다시 활용</Text>
        <Text style={styles.cardText}>
          {session.mode === "ENGLISH_AI"
            ? "이 세션은 `영어 대화 -> 표현 저장 -> 다이얼로그 연습` 순서로 여러 번 다시 쓸 수 있습니다."
            : "이 세션은 `한국어 수집 -> 영어 표현 생성 -> 연습/복습` 순서로 다시 이어 쓰는 수집 채널입니다."}
        </Text>
        <View style={styles.inlineRow}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/ai-conversation")}>
            <Text style={styles.secondaryButtonText}>다른 세션 보기</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void loadSession()}>
            <Text style={styles.secondaryButtonText}>현재 세션 새로고침</Text>
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );

  async function handleSendMessage() {
    if (!session || !draft.trim()) {
      return;
    }

    setSending(true);
    setError("");
    setMessage("");
    try {
      await Speech.stop();
      const updated = await respondToAiConversation({
        sessionId: session.id,
        mode: session.mode,
        aiOutputMode: session.aiOutputMode ?? "text",
        userInputMode: session.userInputMode ?? "text",
        text: draft.trim(),
      });
      setSession(updated);
      setDraft("");
      setLatestGeneratedExpressionId("");
      setRecordedClip(null);
      setRecordingElapsedMs(0);
      setMessage(session.mode === "ENGLISH_AI" ? "영어 AI 응답을 생성했습니다." : "한국어 AI 응답을 생성했습니다.");
      if ((updated.aiOutputMode ?? "text") === "voice") {
        const latestAiTurn = [...updated.turns].reverse().find((turn) => turn.speaker === "AI" && turn.ttsUrl);
        if (latestAiTurn?.ttsUrl) {
          await playAudio(latestAiTurn.id, latestAiTurn.ttsUrl);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 대화 응답 생성에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveTurn(turn: AiConversationTurnResponse) {
    if (!session) return;

    setSavingTurnId(turn.id);
    setError("");
    setMessage("");
    try {
      const created =
        session.mode === "ENGLISH_AI"
          ? await saveEnglishConversationTurnAsExpression(turn.id)
          : await saveKoreanConversationTurnAndGenerateExpression(turn.id);
      setMessage(
        session.mode === "ENGLISH_AI"
          ? "영어 사용자 턴을 표현 자산으로 저장했습니다."
          : "한국어 사용자 턴을 저장하고 영어 표현까지 생성했습니다.",
      );
      if (created?.id) {
        if (session.mode === "ENGLISH_AI") {
          router.push(`/expression/${created.id}`);
        } else {
          setLatestGeneratedExpressionId(created.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "턴 저장에 실패했습니다.");
    } finally {
      setSavingTurnId("");
    }
  }

  async function handlePlayTurnAudio(turn: AiConversationTurnResponse) {
    if (!turn.ttsUrl) return;
    await playAudio(turn.id, turn.ttsUrl);
  }

  async function handleCreateDialoguePracticeSet() {
    if (!session || session.mode !== "ENGLISH_AI") {
      return;
    }

    setCreatingDialogueSet(true);
    setError("");
    setMessage("");
    try {
      const created = await createDialoguePracticeSetFromSession(session.id);
      setDialoguePracticeSets((current) => {
        const deduped = current.filter((item) => item.id !== created.id);
        return [created, ...deduped];
      });
      setMessage(`다이얼로그 연습 세트를 만들었습니다. (${created.turns.length}개 turn)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "다이얼로그 변환에 실패했습니다.");
    } finally {
      setCreatingDialogueSet(false);
    }
  }

  async function handleGenerateAssist() {
    if (!session || session.mode !== "ENGLISH_AI") return;
    const koreanText = assistKoreanText.trim();
    if (!koreanText) {
      setError("한국어로 말하고 싶은 내용을 입력해 주세요.");
      return;
    }

    setAssistLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await generateAiReplyAssist({
        sessionId: session.id,
        koreanText,
        userRole: session.userRole ?? undefined,
        aiRole: session.aiRole ?? undefined,
        conversationTopic: session.conversationTopic ?? undefined,
        situationDescription: session.situationDescription ?? undefined,
      });
      setAssistResult(result);
      setMessage("영어 답변 후보를 생성했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "영어 답변 도움 생성에 실패했습니다.");
    } finally {
      setAssistLoading(false);
    }
  }

  function applyAssistText(text: string) {
    setDraft(text);
    setMessage("추천 답변을 현재 초안에 채웠습니다.");
  }

  async function handleSaveTitle() {
    if (!session || !titleDraft.trim()) return;

    setSavingTitle(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateAiConversationSessionTitle(session.id, titleDraft.trim());
      setSession(updated);
      setTitleDraft(updated.title?.trim() || "");
      setMessage("세션 제목을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "세션 제목 저장에 실패했습니다.");
    } finally {
      setSavingTitle(false);
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
      setMessage("음성 답변 녹음을 시작했습니다. 끝나면 `녹음 종료`를 눌러 주세요.");
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
      setMessage("음성 답변을 저장했습니다. 이제 `STT 전사`로 텍스트를 확인한 뒤 보낼 수 있습니다.");
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

  async function handleTranscribeVoice() {
    if (!recordedClip || !session) {
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
      formData.append("language", session.mode === "ENGLISH_AI" ? "en" : "ko");
      const result = await transcribeAiConversationAudio(formData);
      setDraft(result.text);
      setMessage(session.mode === "ENGLISH_AI" ? "영어 음성 답변을 STT로 전사했습니다." : "한국어 음성 답변을 STT로 전사했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 대화 음성 전사에 실패했습니다.");
    } finally {
      setTranscribing(false);
    }
  }
}

function renderTurnHints(turn: AiConversationTurnResponse) {
  return (
    <>
      {turn.correctedText ? <Text style={styles.turnHint}>교정: {turn.correctedText}</Text> : null}
      {turn.naturalText ? <Text style={styles.turnHint}>자연형: {turn.naturalText}</Text> : null}
      {turn.meaningKo ? <Text style={styles.turnHint}>뜻: {turn.meaningKo}</Text> : null}
      {turn.correctionNote ? <Text style={styles.turnHint}>메모: {turn.correctionNote}</Text> : null}
    </>
  );
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
    color: "#0f766e",
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
    gap: 8,
  },
  pipelineCard: {
    backgroundColor: "#ecfeff",
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  pipelineEyebrow: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pipelineTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  pipelineText: {
    color: "#134e4a",
    lineHeight: 21,
  },
  pipelineSteps: {
    gap: 10,
  },
  pipelineStepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  pipelineStepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ccfbf1",
  },
  pipelineStepBadgeText: {
    color: "#115e59",
    fontSize: 12,
    fontWeight: "800",
  },
  pipelineStepText: {
    flex: 1,
    color: "#334155",
    lineHeight: 20,
  },
  currentReplyCard: {
    gap: 12,
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
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 88,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f766e",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  voiceOptionCard: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 14,
    gap: 8,
  },
  voiceOptionTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  sectionLabel: {
    marginTop: 6,
    color: "#0f172a",
    fontWeight: "700",
  },
  dialogueSetCard: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 14,
    gap: 6,
  },
  reuseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  dialogueSetTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  dialoguePrompt: {
    color: "#334155",
    lineHeight: 20,
  },
  assistCard: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 14,
    gap: 8,
  },
  inlineSection: {
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    padding: 14,
    gap: 8,
  },
  inlineSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inlineSectionTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  assistLabel: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 14,
  },
  turnCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  userTurnCard: {
    backgroundColor: "#ecfeff",
  },
  aiTurnCard: {
    backgroundColor: "#f8fafc",
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
  turnActionButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#0f766e",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  turnActionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
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
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  filterChipText: {
    color: "#334155",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  success: {
    color: "#0f766e",
    lineHeight: 20,
  },
  error: {
    color: "#b91c1c",
    lineHeight: 20,
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
  const trimmed = fileName.trim() || `ai-conversation-${Date.now()}`;
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
