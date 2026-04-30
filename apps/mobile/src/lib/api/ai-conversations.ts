import { apiFetch } from "./client";

export type AiConversationTrackMode = "ENGLISH_AI" | "KOREAN_AI";
export type AiConversationTurnSpeaker = "USER" | "AI";
export type AiConversationLanguage = "EN" | "KO" | "MIXED";
export type AiConversationIoMode = "text" | "voice";

export type AiConversationTurnResponse = {
  id: string;
  speaker: AiConversationTurnSpeaker;
  language: AiConversationLanguage;
  originalText: string;
  correctedText?: string | null;
  naturalText?: string | null;
  meaningKo?: string | null;
  correctionNote?: string | null;
  inputMode?: AiConversationIoMode | null;
  outputMode?: AiConversationIoMode | null;
  ttsUrl?: string | null;
  createdAt: string;
};

export type AiConversationSessionResponse = {
  id: string;
  mode: AiConversationTrackMode;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  title?: string | null;
  topic?: string | null;
  scenario?: string | null;
  goal?: string | null;
  userRole?: string | null;
  aiRole?: string | null;
  conversationTopic?: string | null;
  situationDescription?: string | null;
  userStartText?: string | null;
  aiOutputMode?: AiConversationIoMode | null;
  userInputMode?: AiConversationIoMode | null;
  turns: AiConversationTurnResponse[];
  createdAt: string;
  updatedAt: string;
};

export type DialoguePracticeSetResponse = {
  id: string;
  conversationSessionId?: string | null;
  title: string;
  topic?: string | null;
  scenario?: string | null;
  userRole?: string | null;
  aiRole?: string | null;
  conversationTopic?: string | null;
  situationDescription?: string | null;
  userStartText?: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
  turns: Array<{
    id: string;
    sequence: number;
    aiPrompt: string;
    aiPromptTtsUrl?: string | null;
    expectedUserAnswer: string;
    expectedUserAnswerAlt?: string | null;
    hint?: string | null;
    explanation?: string | null;
    expressionId?: string | null;
    sourceConversationTurnId?: string | null;
  }>;
};

export type AiReplyAssistResponse = {
  englishEasy: string;
  englishNatural: string;
  noteKo: string;
};

export async function listAiConversationSessions(mode: AiConversationTrackMode) {
  return apiFetch<AiConversationSessionResponse[]>(`/ai-conversations/sessions?mode=${mode}`);
}

export async function getAiConversationSession(sessionId: string) {
  return apiFetch<AiConversationSessionResponse>(`/ai-conversations/sessions/${sessionId}`);
}

export async function updateAiConversationSessionTitle(sessionId: string, title: string) {
  return apiFetch<AiConversationSessionResponse>(`/ai-conversations/sessions/${sessionId}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function listDialoguePracticeSets() {
  return apiFetch<DialoguePracticeSetResponse[]>("/ai-conversations/dialogue-practice-sets");
}

export async function createAiConversationSession(input: {
  mode: AiConversationTrackMode;
  title?: string;
  goal?: string;
  userRole?: string;
  aiRole?: string;
  conversationTopic?: string;
  situationDescription?: string;
  userStartText?: string;
  aiOutputMode?: AiConversationIoMode;
  userInputMode?: AiConversationIoMode;
}) {
  return apiFetch<AiConversationSessionResponse>("/ai-conversations/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function respondToAiConversation(input: {
  sessionId?: string;
  mode: AiConversationTrackMode;
  aiOutputMode: AiConversationIoMode;
  userInputMode: AiConversationIoMode;
  text: string;
  userRole?: string;
  aiRole?: string;
  conversationTopic?: string;
  situationDescription?: string;
  userStartText?: string;
}) {
  return apiFetch<AiConversationSessionResponse>("/ai-conversations/respond", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function saveEnglishConversationTurnAsExpression(turnId: string) {
  return apiFetch<{ id: string }>(`/ai-conversations/turns/${turnId}/save-expression`, {
    method: "POST",
  });
}

export async function saveKoreanConversationTurnAndGenerateExpression(turnId: string) {
  return apiFetch<{ id: string }>(`/ai-conversations/turns/${turnId}/save-sentence/generate-expression`, {
    method: "POST",
  });
}

export async function transcribeAiConversationAudio(formData: FormData) {
  return apiFetch<{ text: string }>("/ai-conversations/transcribe", {
    method: "POST",
    body: formData,
  });
}

export async function createDialoguePracticeSetFromSession(sessionId: string) {
  return apiFetch<DialoguePracticeSetResponse>(`/ai-conversations/sessions/${sessionId}/dialogue-practice`, {
    method: "POST",
  });
}

export async function generateAiReplyAssist(input: {
  sessionId?: string;
  koreanText: string;
  userRole?: string;
  aiRole?: string;
  conversationTopic?: string;
  situationDescription?: string;
}) {
  return apiFetch<AiReplyAssistResponse>("/ai-conversations/assist-reply", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
