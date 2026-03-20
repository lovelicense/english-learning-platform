import type { ExpressionVariant, PracticeScoreResponse } from "@elp/shared";

export function generateExpressions(koreanText: string): ExpressionVariant {
  const text = koreanText.trim();

  if (text.includes("데리러") || text.includes("애")) {
    return {
      base: "I'm on my way to pick up my kid.",
      easy: "I'm going to pick up my child now.",
      natural: "I'm heading out to pick up my kid.",
      note: "on my way와 pick up은 일상회화에서 자주 쓰는 표현입니다."
    };
  }

  if (text.includes("전화")) {
    return {
      base: "I'll call you later.",
      easy: "I'll call you in a bit.",
      natural: "Let me call you back a little later.",
      note: "call back과 later를 함께 익히면 응용이 쉽습니다."
    };
  }

  if (text.includes("피곤") || text.includes("집")) {
    return {
      base: "I'm so tired today, so I'll just stay home.",
      easy: "I'm really tired today, so I'm staying home.",
      natural: "I'm wiped out today, so I'm just going to stay in.",
      note: "stay in은 집에 머문다는 자연스러운 회화 표현입니다."
    };
  }

  return {
    base: "Here's a natural English version of your sentence.",
    easy: "This is an easier spoken version.",
    natural: "This is a more natural conversational version.",
    note: "실서비스에서는 OpenAI STT/LLM/TTS 호출로 대체하면 됩니다."
  };
}

export function scorePracticeAnswer(target: string, answer: string): PracticeScoreResponse {
  const cleanTarget = target.trim().toLowerCase();
  const cleanAnswer = answer.trim().toLowerCase();

  if (!cleanAnswer) {
    return { score: 0, feedback: "답변이 비어 있습니다." };
  }

  if (cleanAnswer === cleanTarget) {
    return { score: 100, feedback: "아주 좋아요. 거의 완벽합니다." };
  }

  const overlap = cleanTarget.split(/\s+/).filter((word) => cleanAnswer.includes(word)).length;
  const score = Math.min(95, Math.max(40, overlap * 18));
  const feedback = score >= 70
    ? "핵심 표현은 잘 들어갔어요. 조금 더 자연스럽게 다듬으면 됩니다."
    : "의미는 일부 통할 수 있지만 핵심 표현을 다시 익히면 좋아요.";

  return { score, feedback };
}
